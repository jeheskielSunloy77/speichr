import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Edit2Icon,
  PlusIcon,
  ServerIcon,
  Settings2Icon,
  ShieldIcon,
  Trash2Icon,
} from 'lucide-react'
import * as React from 'react'
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/renderer/components/ui/card'
import { Checkbox } from '@/renderer/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/renderer/components/ui/dialog'
import { Separator } from '@/renderer/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/renderer/components/ui/tabs'
import { AlertsPanel } from '@/renderer/features/alerts/alerts-panel'
import {
  RendererOperationError,
  unwrapResponse,
} from '@/renderer/features/common/ipc'
import { ConnectionFormDialog } from '@/renderer/features/connections/connection-form-dialog'
import { ObservabilityPanel } from '@/renderer/features/observability/observability-panel'
import { SettingsPanel } from '@/renderer/features/settings/settings-panel'
import { WorkflowPanel } from '@/renderer/features/workflows/workflow-panel'
import { KeyDetailCard } from '@/renderer/features/workspace/key-detail-card'
import { KeyListCard } from '@/renderer/features/workspace/key-list-card'
import { useUiStore } from '@/renderer/state/ui-store'
import type {
  ConnectionProfile,
  KeyListResult,
  KeyValueRecord,
  ProviderCapabilities,
  SnapshotRecord,
} from '@/shared/contracts/cache'

const DEFAULT_PAGE_SIZE = 100

type ConnectionDialogState = {
  open: boolean
  mode: 'create' | 'edit'
  profile: ConnectionProfile | null
}

type WorkspaceTab = 'workspace' | 'workflows' | 'observability' | 'alerts'

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

export default function App() {
  const queryClient = useQueryClient()

  const {
    selectedConnectionId,
    selectedKey,
    setSelectedConnectionId,
    setSelectedKey,
    isSettingsOpen,
    setSettingsOpen,
  } = useUiStore()

  const [activeTab, setActiveTab] = React.useState<WorkspaceTab>('workspace')

  const [connectionDialog, setConnectionDialog] =
    React.useState<ConnectionDialogState>({
      open: false,
      mode: 'create',
      profile: null,
    })

  const [connectionIdPendingDelete, setConnectionIdPendingDelete] =
    React.useState<string | null>(null)
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

  const connectionsQuery = useQuery({
    queryKey: ['connections'],
    queryFn: async () => unwrapResponse(await window.cachify.listConnections()),
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
  }, [selectedConnectionId, setSelectedKey])

  const capabilitiesQuery = useQuery({
    queryKey: ['capabilities', selectedConnectionId],
    enabled: Boolean(selectedConnectionId),
    queryFn: async () => {
      if (!selectedConnectionId) {
        throw new Error('Connection is required to load capabilities.')
      }

      return unwrapResponse(
        await window.cachify.getCapabilities({
          connectionId: selectedConnectionId,
        }),
      )
    },
  })

  const capabilities = capabilitiesQuery.data ?? defaultCapabilities

  const keyListQuery = useQuery({
    queryKey: ['keys', selectedConnectionId, searchPattern, cursor],
    enabled: Boolean(selectedConnectionId),
    queryFn: async () => {
      if (!selectedConnectionId) {
        return defaultKeyListResult
      }

      if (searchPattern.trim().length > 0) {
        return unwrapResponse(
          await window.cachify.searchKeys({
            connectionId: selectedConnectionId,
            pattern: searchPattern.trim(),
            cursor,
            limit: DEFAULT_PAGE_SIZE,
          }),
        )
      }

      return unwrapResponse(
        await window.cachify.listKeys({
          connectionId: selectedConnectionId,
          cursor,
          limit: DEFAULT_PAGE_SIZE,
        }),
      )
    },
  })

  const keyList = keyListQuery.data ?? defaultKeyListResult

  const keyDetailQuery = useQuery({
    queryKey: ['key', selectedConnectionId, selectedKey],
    enabled: Boolean(selectedConnectionId && selectedKey),
    queryFn: async (): Promise<KeyValueRecord> => {
      if (!selectedConnectionId || !selectedKey) {
        throw new Error('Connection and key are required to load key detail.')
      }

      return unwrapResponse(
        await window.cachify.getKey({
          connectionId: selectedConnectionId,
          key: selectedKey,
        }),
      )
    },
  })

  const snapshotsQuery = useQuery({
    queryKey: ['snapshots', selectedConnectionId, selectedKey],
    enabled: Boolean(selectedConnectionId && selectedKey && isRollbackOpen),
    queryFn: async (): Promise<SnapshotRecord[]> => {
      if (!selectedConnectionId || !selectedKey) {
        return []
      }

      return unwrapResponse(
        await window.cachify.listSnapshots({
          connectionId: selectedConnectionId,
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

  const deleteConnectionMutation = useMutation({
    mutationFn: async (connectionId: string) =>
      unwrapResponse(await window.cachify.deleteConnection({ id: connectionId })),
    onSuccess: (_result, connectionId) => {
      queryClient.invalidateQueries({ queryKey: ['connections'] })

      if (selectedConnectionId === connectionId) {
        setSelectedConnectionId(null)
      }

      toast.success('Connection profile deleted.')
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Delete failed.')
    },
  })

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
        await window.cachify.setKey({
          connectionId: selectedConnectionId,
          key: normalizedKey,
          value: keyValue,
          ttlSeconds,
        }),
      )
    },
    onSuccess: async () => {
      toast.success('Key saved.')
      await queryClient.invalidateQueries({
        queryKey: ['keys', selectedConnectionId],
      })
      await queryClient.invalidateQueries({
        queryKey: ['key', selectedConnectionId, keyName.trim()],
      })
      await queryClient.invalidateQueries({ queryKey: ['alerts'] })
      await queryClient.invalidateQueries({
        queryKey: ['observability-dashboard', selectedConnectionId],
      })
      setSelectedKey(keyName.trim())
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Save failed.')
    },
  })

  const deleteKeyMutation = useMutation({
    mutationFn: async (args: {
      key: string
      guardrailConfirmed?: boolean
    }) => {
      if (!selectedConnectionId) {
        throw new Error('Select a connection first.')
      }

      return unwrapResponse(
        await window.cachify.deleteKey({
          connectionId: selectedConnectionId,
          key: args.key,
          guardrailConfirmed: args.guardrailConfirmed,
        }),
      )
    },
    onSuccess: async (_result, args) => {
      toast.success('Key deleted.')
      await queryClient.invalidateQueries({
        queryKey: ['keys', selectedConnectionId],
      })
      await queryClient.invalidateQueries({ queryKey: ['alerts'] })
      await queryClient.invalidateQueries({
        queryKey: ['observability-dashboard', selectedConnectionId],
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
        await window.cachify.restoreSnapshot({
          connectionId: selectedConnectionId,
          key: selectedKey,
          snapshotId,
          guardrailConfirmed: prodRollbackConfirmed,
        }),
      )
    },
    onSuccess: async () => {
      toast.success('Snapshot restored.')
      await queryClient.invalidateQueries({
        queryKey: ['key', selectedConnectionId, selectedKey],
      })
      await queryClient.invalidateQueries({ queryKey: ['alerts'] })
      await queryClient.invalidateQueries({
        queryKey: ['observability-dashboard', selectedConnectionId],
      })
      setIsRollbackOpen(false)
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Rollback failed.')
    },
  })

  const openCreateConnectionDialog = (): void => {
    setConnectionDialog({
      open: true,
      mode: 'create',
      profile: null,
    })
  }

  const openEditConnectionDialog = (profile: ConnectionProfile): void => {
    setConnectionDialog({
      open: true,
      mode: 'edit',
      profile,
    })
  }

  const onConnectionSaved = async (profile: ConnectionProfile): Promise<void> => {
    setSelectedConnectionId(profile.id)
    await queryClient.invalidateQueries({ queryKey: ['connections'] })
  }

  const renderOnboarding = () => (
    <div className='grid min-h-screen place-items-center p-6'>
      <Card className='w-full max-w-xl'>
        <CardHeader>
          <CardTitle>Cachify Studio</CardTitle>
          <CardDescription>
            Start by adding your first Redis or Memcached connection profile.
          </CardDescription>
        </CardHeader>
        <CardContent className='flex items-center gap-2'>
          <Button onClick={openCreateConnectionDialog}>
            <PlusIcon className='size-3.5' />
            Add First Connection
          </Button>
          <Button variant='outline' onClick={() => setSettingsOpen(true)}>
            <Settings2Icon className='size-3.5' />
            Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  )

  return (
    <div className='bg-background text-foreground grid h-screen min-h-screen grid-cols-[300px_1fr]'>
      <aside className='border-r'>
        <div className='flex items-center justify-between px-3 py-3'>
          <div>
            <p className='text-sm font-semibold'>Connections</p>
            <p className='text-muted-foreground text-xs'>Redis + Memcached</p>
          </div>
          <div className='flex gap-1'>
            <Button
              variant='ghost'
              size='icon-sm'
              onClick={() => setSettingsOpen(true)}
            >
              <Settings2Icon className='size-4' />
            </Button>
            <Button
              variant='ghost'
              size='icon-sm'
              onClick={openCreateConnectionDialog}
            >
              <PlusIcon className='size-4' />
            </Button>
          </div>
        </div>
        <Separator />

        <div className='no-scrollbar h-[calc(100vh-57px)] space-y-1 overflow-auto p-2'>
          {connectionsQuery.isLoading && (
            <p className='text-muted-foreground px-2 py-2 text-xs'>Loading...</p>
          )}

          {!connectionsQuery.isLoading && connections.length === 0 && (
            <Card>
              <CardContent className='space-y-2 p-3'>
                <p className='text-muted-foreground text-xs'>
                  No connection profiles yet.
                </p>
                <Button size='sm' onClick={openCreateConnectionDialog}>
                  Create Profile
                </Button>
              </CardContent>
            </Card>
          )}

          {connections.map((connection) => {
            const selected = connection.id === selectedConnectionId

            return (
              <button
                key={connection.id}
                type='button'
                className={`w-full rounded-none border px-2 py-2 text-left text-xs transition-colors ${
                  selected
                    ? 'border-primary bg-primary/10'
                    : 'border-transparent hover:bg-muted/50'
                }`}
                onClick={() => setSelectedConnectionId(connection.id)}
              >
                <div className='flex items-center justify-between gap-2'>
                  <div className='min-w-0'>
                    <p className='truncate font-medium'>{connection.name}</p>
                    <p className='text-muted-foreground truncate text-xs'>
                      {connection.host}:{connection.port}
                    </p>
                  </div>
                  <div className='flex items-center gap-1'>
                    <Button
                      variant='ghost'
                      size='icon-xs'
                      onClick={(event) => {
                        event.stopPropagation()
                        openEditConnectionDialog(connection)
                      }}
                    >
                      <Edit2Icon className='size-3.5' />
                    </Button>
                    <Button
                      variant='ghost'
                      size='icon-xs'
                      onClick={(event) => {
                        event.stopPropagation()
                        setConnectionIdPendingDelete(connection.id)
                      }}
                    >
                      <Trash2Icon className='size-3.5' />
                    </Button>
                  </div>
                </div>

                <div className='mt-2 flex items-center gap-1.5'>
                  <Badge variant='outline'>{connection.engine}</Badge>
                  <Badge variant='outline'>{connection.environment}</Badge>
                  {connection.readOnly && <Badge variant='destructive'>Read-only</Badge>}
                  {connection.forceReadOnly && (
                    <Badge variant='destructive'>Policy RO</Badge>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </aside>

      <main className='h-screen overflow-hidden p-4'>
        {connections.length === 0 ? (
          renderOnboarding()
        ) : selectedConnection ? (
          <div className='grid h-full min-h-0 grid-rows-[auto_1fr] gap-3'>
            <Card>
              <CardContent className='flex items-center justify-between p-3'>
                <div className='min-w-0'>
                  <div className='flex items-center gap-2'>
                    <ServerIcon className='size-4' />
                    <p className='truncate text-sm font-medium'>{selectedConnection.name}</p>
                    <Badge variant='outline'>{selectedConnection.engine}</Badge>
                    <Badge variant='outline'>{selectedConnection.environment}</Badge>
                    {(selectedConnection.readOnly || selectedConnection.forceReadOnly) && (
                      <Badge variant='destructive'>
                        <ShieldIcon className='size-3' />
                        Read-only
                      </Badge>
                    )}
                  </div>
                  <p className='text-muted-foreground truncate text-xs'>
                    {selectedConnection.host}:{selectedConnection.port}
                  </p>
                </div>
                <div className='text-muted-foreground text-xs'>
                  {selectedConnection.engine === 'memcached' &&
                    'Memcached key search is based on app-indexed keys.'}
                </div>
              </CardContent>
            </Card>

            {capabilitiesError && activeTab === 'workspace' && (
              <Card>
                <CardContent className='flex items-center justify-between gap-3 p-3'>
                  <div className='text-xs'>
                    <p className='text-destructive font-medium'>
                      Unable to load provider capabilities.
                    </p>
                    <p className='text-muted-foreground'>{capabilitiesError.message}</p>
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
              onValueChange={(value) => setActiveTab(value as WorkspaceTab)}
              className='grid min-h-0 grid-rows-[auto_1fr] gap-3'
            >
              <TabsList>
                <TabsTrigger value='workspace'>Workspace</TabsTrigger>
                <TabsTrigger value='workflows'>Workflows</TabsTrigger>
                <TabsTrigger value='observability'>Observability</TabsTrigger>
                <TabsTrigger value='alerts'>Alerts</TabsTrigger>
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
                        queryKey: ['keys', selectedConnectionId],
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
                <WorkflowPanel connection={selectedConnection} />
              </TabsContent>

              <TabsContent value='observability' className='min-h-0 overflow-auto'>
                <ObservabilityPanel connection={selectedConnection} />
              </TabsContent>

              <TabsContent value='alerts' className='min-h-0 overflow-auto'>
                <AlertsPanel />
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className='grid h-full place-items-center'>
            <Card>
              <CardContent className='p-6 text-xs'>
                Select a connection profile to begin.
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      <ConnectionFormDialog
        open={connectionDialog.open}
        mode={connectionDialog.mode}
        initialProfile={connectionDialog.profile}
        onOpenChange={(open) =>
          setConnectionDialog((current) => ({
            ...current,
            open,
          }))
        }
        onSaved={onConnectionSaved}
      />

      <SettingsPanel open={isSettingsOpen} onOpenChange={setSettingsOpen} />

      <AlertDialog
        open={Boolean(connectionIdPendingDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setConnectionIdPendingDelete(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Connection?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the saved profile and keychain secret reference.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (connectionIdPendingDelete) {
                  deleteConnectionMutation.mutate(connectionIdPendingDelete)
                  setConnectionIdPendingDelete(null)
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                selectedConnection?.environment === 'prod' && !prodDeleteConfirmed
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
              <p className='text-muted-foreground text-xs'>Loading snapshots...</p>
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
                    <p className='break-all'>hash: {snapshot.redactedValueHash}</p>
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
