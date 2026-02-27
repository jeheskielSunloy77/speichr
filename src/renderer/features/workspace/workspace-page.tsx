import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as React from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/renderer/components/ui/alert-dialog'
import { Badge } from '@/renderer/components/ui/badge'
import { Button } from '@/renderer/components/ui/button'
import { Card, CardContent } from '@/renderer/components/ui/card'
import { Checkbox } from '@/renderer/components/ui/checkbox'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/renderer/components/ui/dialog'
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from '@/renderer/components/ui/tabs'
import {
	RendererOperationError,
	unwrapResponse,
} from '@/renderer/features/common/ipc'
import { GovernancePanel } from '@/renderer/features/governance/governance-panel'
import { ObservabilityPanel } from '@/renderer/features/observability/observability-panel'
import { WorkflowPanel } from '@/renderer/features/workflows/workflow-panel'
import { KeyDetailCard } from '@/renderer/features/workspace/key-detail-card'
import { KeyListCard } from '@/renderer/features/workspace/key-list-card'
import { useUiStore } from '@/renderer/state/ui-store'
import type {
	KeyListResult,
	KeyValueRecord,
	ProviderCapabilities,
	SnapshotRecord,
} from '@/shared/contracts/cache'

const DEFAULT_PAGE_SIZE = 100

type WorkspaceTab =
	| 'workspace'
	| 'workflows'
	| 'observability'
	| 'governance'

const isWorkspaceTab = (value: string | null): value is WorkspaceTab =>
	value === 'workspace' ||
	value === 'workflows' ||
	value === 'observability' ||
	value === 'governance'

const defaultKeyListResult: KeyListResult = {
	keys: [],
	nextCursor: undefined,
}

const defaultCapabilities: ProviderCapabilities = {
	supportsTTL: true,
	supportsMonitorStream: false,
	supportsSlowLog: false,
	supportsBulkDeletePreview: false,
	supportsSnapshotRestore: false,
	supportsPatternScan: true,
}

type QueryErrorState = {
	message: string
	retryable: boolean
}

const getQueryErrorState = (error: unknown): QueryErrorState | undefined => {
	if (!error) {
		return undefined
	}

	if (error instanceof RendererOperationError) {
		return {
			message: error.message,
			retryable: Boolean(error.retryable),
		}
	}

	if (error instanceof Error) {
		return {
			message: error.message,
			retryable: false,
		}
	}

	return {
		message: 'Operation failed.',
		retryable: false,
	}
}

export const WorkspacePage = () => {
	const queryClient = useQueryClient()
	const [searchParams, setSearchParams] = useSearchParams()

	const {
		selectedConnectionId,
		selectedNamespaceIdByConnection,
		selectedKey,
		setSelectedConnectionId,
		setSelectedKey,
	} = useUiStore()
	const selectedNamespaceId = selectedConnectionId
		? selectedNamespaceIdByConnection[selectedConnectionId] ?? null
		: null

	const rawTab = searchParams.get('tab')
	const activeTab: WorkspaceTab = isWorkspaceTab(rawTab) ? rawTab : 'workspace'
	const [keyPendingDelete, setKeyPendingDelete] = React.useState<string | null>(
		null,
	)
	const [prodDeleteConfirmed, setProdDeleteConfirmed] = React.useState(false)

	const [isRollbackOpen, setIsRollbackOpen] = React.useState(false)
	const [prodRollbackConfirmed, setProdRollbackConfirmed] = React.useState(false)

	const [searchPattern, setSearchPattern] = React.useState('')
	const [cursor, setCursor] = React.useState<string | undefined>(undefined)

	const [keyName, setKeyName] = React.useState('')
	const [keyValue, setKeyValue] = React.useState('')
	const [keyTtlSeconds, setKeyTtlSeconds] = React.useState('')

	React.useEffect(() => {
		if (isWorkspaceTab(rawTab)) {
			return
		}

		const nextSearchParams = new URLSearchParams(searchParams)
		nextSearchParams.set('tab', 'workspace')
		setSearchParams(nextSearchParams, { replace: true })
	}, [rawTab, searchParams, setSearchParams])

	const connectionsQuery = useQuery({
		queryKey: ['connections'],
		queryFn: async () => unwrapResponse(await window.speichr.listConnections()),
	})

	const connections = connectionsQuery.data ?? []

	const selectedConnection = React.useMemo(
		() =>
			connections.find((connection) => connection.id === selectedConnectionId) ??
			null,
		[connections, selectedConnectionId],
	)

	React.useEffect(() => {
		if (connections.length === 0) {
			setSelectedConnectionId(null)
			return
		}

		if (
			!selectedConnectionId ||
			!connections.some((connection) => connection.id === selectedConnectionId)
		) {
			setSelectedConnectionId(connections[0].id)
		}
	}, [connections, selectedConnectionId, setSelectedConnectionId])

	React.useEffect(() => {
		setCursor(undefined)
		setSearchPattern('')
		setSelectedKey(null)
	}, [selectedConnectionId, selectedNamespaceId, setSelectedKey])

	const capabilitiesQuery = useQuery({
		queryKey: ['capabilities', selectedConnectionId],
		enabled: Boolean(selectedConnectionId),
		queryFn: async () => {
			if (!selectedConnectionId) {
				throw new Error('Connection is required to load capabilities.')
			}

			return unwrapResponse(
				await window.speichr.getCapabilities({
					connectionId: selectedConnectionId,
				}),
			)
		},
	})

	const capabilities = capabilitiesQuery.data ?? defaultCapabilities

	const keyListQuery = useQuery({
		queryKey: [
			'keys',
			selectedConnectionId,
			selectedNamespaceId,
			searchPattern,
			cursor,
		],
		enabled: Boolean(selectedConnectionId),
		queryFn: async () => {
			if (!selectedConnectionId) {
				return defaultKeyListResult
			}

			if (searchPattern.trim().length > 0) {
				return unwrapResponse(
					await window.speichr.searchKeys({
						connectionId: selectedConnectionId,
						namespaceId: selectedNamespaceId ?? undefined,
						pattern: searchPattern.trim(),
						cursor,
						limit: DEFAULT_PAGE_SIZE,
					}),
				)
			}

			return unwrapResponse(
				await window.speichr.listKeys({
					connectionId: selectedConnectionId,
					namespaceId: selectedNamespaceId ?? undefined,
					cursor,
					limit: DEFAULT_PAGE_SIZE,
				}),
			)
		},
	})

	const keyList = keyListQuery.data ?? defaultKeyListResult

	const keyDetailQuery = useQuery({
		queryKey: ['key', selectedConnectionId, selectedNamespaceId, selectedKey],
		enabled: Boolean(selectedConnectionId && selectedKey),
		queryFn: async (): Promise<KeyValueRecord> => {
			if (!selectedConnectionId || !selectedKey) {
				throw new Error('Connection and key are required to load key detail.')
			}

			return unwrapResponse(
				await window.speichr.getKey({
					connectionId: selectedConnectionId,
					namespaceId: selectedNamespaceId ?? undefined,
					key: selectedKey,
				}),
			)
		},
	})

	const snapshotsQuery = useQuery({
		queryKey: ['snapshots', selectedConnectionId, selectedNamespaceId, selectedKey],
		enabled: Boolean(selectedConnectionId && selectedKey && isRollbackOpen),
		queryFn: async (): Promise<SnapshotRecord[]> => {
			if (!selectedConnectionId || !selectedKey) {
				return []
			}

			return unwrapResponse(
				await window.speichr.listSnapshots({
					connectionId: selectedConnectionId,
					namespaceId: selectedNamespaceId ?? undefined,
					key: selectedKey,
					limit: 25,
				}),
			)
		},
	})

	const capabilitiesError = getQueryErrorState(capabilitiesQuery.error)
	const keyListError = getQueryErrorState(keyListQuery.error)
	const keyDetailError = getQueryErrorState(keyDetailQuery.error)

	const lastQueryErrorToastRef = React.useRef({
		capabilities: 0,
		keyList: 0,
		keyDetail: 0,
	})

	React.useEffect(() => {
		if (!capabilitiesError || capabilitiesQuery.errorUpdatedAt === 0) {
			return
		}

		if (
			lastQueryErrorToastRef.current.capabilities ===
			capabilitiesQuery.errorUpdatedAt
		) {
			return
		}

		lastQueryErrorToastRef.current.capabilities = capabilitiesQuery.errorUpdatedAt
		toast.error(capabilitiesError.message)
	}, [capabilitiesError, capabilitiesQuery.errorUpdatedAt])

	React.useEffect(() => {
		if (!keyListError || keyListQuery.errorUpdatedAt === 0) {
			return
		}

		if (lastQueryErrorToastRef.current.keyList === keyListQuery.errorUpdatedAt) {
			return
		}

		lastQueryErrorToastRef.current.keyList = keyListQuery.errorUpdatedAt
		toast.error(keyListError.message)
	}, [keyListError, keyListQuery.errorUpdatedAt])

	React.useEffect(() => {
		if (!keyDetailError || keyDetailQuery.errorUpdatedAt === 0) {
			return
		}

		if (
			lastQueryErrorToastRef.current.keyDetail === keyDetailQuery.errorUpdatedAt
		) {
			return
		}

		lastQueryErrorToastRef.current.keyDetail = keyDetailQuery.errorUpdatedAt
		toast.error(keyDetailError.message)
	}, [keyDetailError, keyDetailQuery.errorUpdatedAt])

	React.useEffect(() => {
		if (!selectedKey) {
			setKeyName('')
			setKeyValue('')
			setKeyTtlSeconds('')
			return
		}

		setKeyName(selectedKey)
	}, [selectedKey])

	React.useEffect(() => {
		if (!keyDetailQuery.data) {
			return
		}

		setKeyValue(keyDetailQuery.data.value ?? '')
		setKeyTtlSeconds(
			keyDetailQuery.data.ttlSeconds === null
				? ''
				: String(keyDetailQuery.data.ttlSeconds),
		)
	}, [keyDetailQuery.data])

	const saveKeyMutation = useMutation({
		mutationFn: async () => {
			if (!selectedConnectionId) {
				throw new Error('Select a connection first.')
			}

			const normalizedKey = keyName.trim()
			if (!normalizedKey) {
				throw new Error('Key name is required.')
			}

			const ttl = Number(keyTtlSeconds)
			const ttlSeconds =
				keyTtlSeconds.trim().length > 0 && Number.isFinite(ttl) && ttl > 0
					? ttl
					: undefined

			return unwrapResponse(
				await window.speichr.setKey({
					connectionId: selectedConnectionId,
					namespaceId: selectedNamespaceId ?? undefined,
					key: normalizedKey,
					value: keyValue,
					ttlSeconds,
				}),
			)
		},
		onSuccess: async () => {
			toast.success('Key saved.')
			await queryClient.invalidateQueries({
				queryKey: ['keys', selectedConnectionId, selectedNamespaceId],
			})
			await queryClient.invalidateQueries({
				queryKey: ['key', selectedConnectionId, selectedNamespaceId, keyName.trim()],
			})
			await queryClient.invalidateQueries({ queryKey: ['alerts'] })
			await queryClient.invalidateQueries({
				queryKey: [
					'observability-dashboard',
					selectedConnectionId,
					selectedNamespaceId,
				],
			})
			setSelectedKey(keyName.trim())
		},
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : 'Save failed.')
		},
	})

	const deleteKeyMutation = useMutation({
		mutationFn: async (args: { key: string; guardrailConfirmed?: boolean }) => {
			if (!selectedConnectionId) {
				throw new Error('Select a connection first.')
			}

			return unwrapResponse(
				await window.speichr.deleteKey({
					connectionId: selectedConnectionId,
					namespaceId: selectedNamespaceId ?? undefined,
					key: args.key,
					guardrailConfirmed: args.guardrailConfirmed,
				}),
			)
		},
		onSuccess: async (_result, args) => {
			toast.success('Key deleted.')
			await queryClient.invalidateQueries({
				queryKey: ['keys', selectedConnectionId, selectedNamespaceId],
			})
			await queryClient.invalidateQueries({ queryKey: ['alerts'] })
			await queryClient.invalidateQueries({
				queryKey: [
					'observability-dashboard',
					selectedConnectionId,
					selectedNamespaceId,
				],
			})
			if (selectedKey === args.key) {
				setSelectedKey(null)
			}
		},
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : 'Delete failed.')
		},
	})

	const restoreSnapshotMutation = useMutation({
		mutationFn: async (snapshotId?: string) => {
			if (!selectedConnectionId || !selectedKey) {
				throw new Error('Select a key first.')
			}

			return unwrapResponse(
				await window.speichr.restoreSnapshot({
					connectionId: selectedConnectionId,
					namespaceId: selectedNamespaceId ?? undefined,
					key: selectedKey,
					snapshotId,
					guardrailConfirmed: prodRollbackConfirmed,
				}),
			)
		},
		onSuccess: async () => {
			toast.success('Snapshot restored.')
			await queryClient.invalidateQueries({
				queryKey: ['key', selectedConnectionId, selectedNamespaceId, selectedKey],
			})
			await queryClient.invalidateQueries({ queryKey: ['alerts'] })
			await queryClient.invalidateQueries({
				queryKey: [
					'observability-dashboard',
					selectedConnectionId,
					selectedNamespaceId,
				],
			})
			setIsRollbackOpen(false)
		},
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : 'Rollback failed.')
		},
	})

	if (!connectionsQuery.isLoading && connections.length === 0) {
		return <Navigate to='/connections' replace />
	}

	return (
		<div className='bg-background text-foreground h-full min-h-0 overflow-hidden p-4'>
			{connectionsQuery.isLoading ? (
				<div className='grid h-full place-items-center'>
					<Card>
						<CardContent className='p-6 text-xs text-muted-foreground'>
							Loading workspace...
						</CardContent>
					</Card>
				</div>
			) : selectedConnection ? (
				<div className='grid h-full min-h-0 gap-3'>
					{capabilitiesError && activeTab === 'workspace' && (
						<Card>
							<CardContent className='flex items-center justify-between gap-3 p-3'>
								<div className='text-xs'>
									<p className='text-destructive font-medium'>
										Unable to load provider capabilities.
									</p>
									<p className='text-muted-foreground'>
										{capabilitiesError.message}
									</p>
								</div>
								{capabilitiesError.retryable && (
									<Button
										variant='outline'
										size='sm'
										onClick={() => {
											void capabilitiesQuery.refetch()
										}}
									>
										Retry
									</Button>
								)}
							</CardContent>
						</Card>
					)}

					<Tabs
						value={activeTab}
						onValueChange={(value) => {
							const nextTab = value as WorkspaceTab
							const nextSearchParams = new URLSearchParams(searchParams)
							nextSearchParams.set('tab', nextTab)
							setSearchParams(nextSearchParams, { replace: true })
						}}
						className='grid min-h-0 grid-rows-[auto_1fr] gap-3'
					>
						<TabsList>
							<TabsTrigger value='workspace'>Workspace</TabsTrigger>
							<TabsTrigger value='workflows'>Workflows</TabsTrigger>
							<TabsTrigger value='observability'>Observability</TabsTrigger>
							<TabsTrigger value='governance'>Governance</TabsTrigger>
						</TabsList>

						<TabsContent value='workspace' className='min-h-0'>
							<div className='grid min-h-0 gap-3 lg:grid-cols-2'>
								<KeyListCard
									title='Key Browser'
									keys={keyList.keys}
									selectedKey={selectedKey}
									searchPattern={searchPattern}
									isLoading={keyListQuery.isLoading}
									errorMessage={keyListError?.message}
									isRetryableError={keyListError?.retryable}
									readOnly={Boolean(
										selectedConnection.readOnly || selectedConnection.forceReadOnly,
									)}
									hasNextPage={Boolean(keyList.nextCursor)}
									onSearchPatternChange={(value) => {
										setSearchPattern(value)
										setCursor(undefined)
									}}
									onSelectKey={(key) => setSelectedKey(key)}
									onDeleteKey={(key) => {
										setProdDeleteConfirmed(false)
										setKeyPendingDelete(key)
									}}
									onRefresh={() =>
										queryClient.invalidateQueries({
											queryKey: [
												'keys',
												selectedConnectionId,
												selectedNamespaceId,
											],
										})
									}
									onRetry={() => {
										void keyListQuery.refetch()
									}}
									onLoadNextPage={() => setCursor(keyList.nextCursor)}
								/>

								<KeyDetailCard
									keyName={keyName}
									value={keyValue}
									ttlSeconds={keyTtlSeconds}
									readOnly={Boolean(
										selectedConnection.readOnly || selectedConnection.forceReadOnly,
									)}
									supportsTTL={capabilities.supportsTTL}
									isLoading={keyDetailQuery.isLoading}
									errorMessage={keyDetailError?.message}
									isRetryableError={keyDetailError?.retryable}
									isExistingKey={Boolean(selectedKey)}
									canRollback={Boolean(selectedKey)}
									onRollback={() => {
										setProdRollbackConfirmed(false)
										setIsRollbackOpen(true)
									}}
									onNewKey={() => {
										setSelectedKey(null)
										setKeyName('')
										setKeyValue('')
										setKeyTtlSeconds('')
									}}
									onKeyNameChange={setKeyName}
									onValueChange={setKeyValue}
									onTtlChange={setKeyTtlSeconds}
									onRetry={() => {
										void keyDetailQuery.refetch()
									}}
									onSave={() => saveKeyMutation.mutate()}
									onDelete={() => {
										if (selectedKey) {
											setProdDeleteConfirmed(false)
											setKeyPendingDelete(selectedKey)
										}
									}}
								/>
							</div>
						</TabsContent>

						<TabsContent value='workflows' className='min-h-0 overflow-auto'>
							<WorkflowPanel connection={selectedConnection} mode='connection' />
						</TabsContent>

						<TabsContent
							value='observability'
							className='min-h-0 overflow-auto'
						>
							<ObservabilityPanel
								connection={selectedConnection}
								mode='connection'
							/>
						</TabsContent>

						<TabsContent value='governance' className='min-h-0 overflow-auto'>
							<GovernancePanel connection={selectedConnection} mode='connection' />
						</TabsContent>
					</Tabs>
				</div>
			) : (
				<div className='grid h-full place-items-center'>
					<Card>
						<CardContent className='p-6 text-xs'>
							Select a connection profile to continue.
						</CardContent>
					</Card>
				</div>
			)}

			<AlertDialog
				open={Boolean(keyPendingDelete)}
				onOpenChange={(open) => {
					if (!open) {
						setKeyPendingDelete(null)
						setProdDeleteConfirmed(false)
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Key?</AlertDialogTitle>
						<AlertDialogDescription>
							This action cannot be undone and immediately removes the key.
						</AlertDialogDescription>
					</AlertDialogHeader>
					{selectedConnection?.environment === 'prod' && (
						<label className='flex items-center gap-2 text-xs text-destructive'>
							<Checkbox
								checked={prodDeleteConfirmed}
								onCheckedChange={(checked) =>
									setProdDeleteConfirmed(Boolean(checked))
								}
							/>
							Confirm destructive action on prod connection
						</label>
					)}
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								if (keyPendingDelete) {
									deleteKeyMutation.mutate({
										key: keyPendingDelete,
										guardrailConfirmed: prodDeleteConfirmed,
									})
									setKeyPendingDelete(null)
									setProdDeleteConfirmed(false)
								}
							}}
							disabled={
								selectedConnection?.environment === 'prod' &&
								!prodDeleteConfirmed
							}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<Dialog open={isRollbackOpen} onOpenChange={setIsRollbackOpen}>
				<DialogContent className='max-w-2xl'>
					<DialogHeader>
						<DialogTitle>Rollback Helper</DialogTitle>
						<DialogDescription>
							Restore a recent snapshot for the selected key.
						</DialogDescription>
					</DialogHeader>

					{selectedConnection?.environment === 'prod' && (
						<label className='flex items-center gap-2 text-xs text-destructive'>
							<Checkbox
								checked={prodRollbackConfirmed}
								onCheckedChange={(checked) =>
									setProdRollbackConfirmed(Boolean(checked))
								}
							/>
							Confirm rollback on prod connection
						</label>
					)}

					<div className='max-h-72 space-y-2 overflow-auto'>
						{snapshotsQuery.isLoading ? (
							<p className='text-muted-foreground text-xs'>
								Loading snapshots...
							</p>
						) : (snapshotsQuery.data?.length ?? 0) === 0 ? (
							<p className='text-muted-foreground text-xs'>
								No snapshots were found for this key.
							</p>
						) : (
							snapshotsQuery.data?.map((snapshot) => (
								<div key={snapshot.id} className='space-y-2 border p-2 text-xs'>
									<div className='flex items-center justify-between gap-2'>
										<div>
											<p className='font-medium'>{snapshot.key}</p>
											<p className='text-muted-foreground'>
												{new Date(snapshot.capturedAt).toLocaleString()}
											</p>
										</div>
										<Badge variant='outline'>{snapshot.reason}</Badge>
									</div>
									<div className='text-muted-foreground'>
										<p>TTL: {snapshot.ttlSeconds ?? '-'}</p>
										<p className='break-all'>
											hash: {snapshot.redactedValueHash}
										</p>
									</div>
									<Button
										size='sm'
										variant='outline'
										onClick={() => restoreSnapshotMutation.mutate(snapshot.id)}
										disabled={
											restoreSnapshotMutation.isPending ||
											(selectedConnection?.environment === 'prod' &&
												!prodRollbackConfirmed)
										}
									>
										Restore Snapshot
									</Button>
								</div>
							))
						)}
					</div>
				</DialogContent>
			</Dialog>
		</div>
	)
}
