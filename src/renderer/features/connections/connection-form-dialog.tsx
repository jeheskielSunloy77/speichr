import * as React from 'react'
import { toast } from 'sonner'

import { Button } from '@/renderer/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/renderer/components/ui/dialog'
import { Input } from '@/renderer/components/ui/input'
import { Label } from '@/renderer/components/ui/label'
import { Switch } from '@/renderer/components/ui/switch'
import { unwrapResponse } from '@/renderer/features/common/ipc'
import type {
	ConnectionDraft,
	ConnectionProfile,
	ConnectionSecret,
} from '@/shared/contracts/cache'

const DEFAULT_TIMEOUT_MS = 5000

type ConnectionFormMode = 'create' | 'edit'

type ConnectionFormDialogProps = {
	open: boolean
	mode: ConnectionFormMode
	initialProfile?: ConnectionProfile | null
	onOpenChange: (open: boolean) => void
	onSaved: (profile: ConnectionProfile) => void
}

type FormState = {
	name: string
	engine: 'redis' | 'memcached'
	host: string
	port: string
	dbIndex: string
	tlsEnabled: boolean
	environment: 'dev' | 'staging' | 'prod'
	tags: string
	readOnly: boolean
	timeoutMs: string
	username: string
	password: string
}

const createDefaultFormState = (): FormState => ({
	name: '',
	engine: 'redis',
	host: '127.0.0.1',
	port: '6379',
	dbIndex: '0',
	tlsEnabled: false,
	environment: 'dev',
	tags: '',
	readOnly: false,
	timeoutMs: String(DEFAULT_TIMEOUT_MS),
	username: '',
	password: '',
})

const profileToFormState = (profile: ConnectionProfile): FormState => ({
	name: profile.name,
	engine: profile.engine,
	host: profile.host,
	port: String(profile.port),
	dbIndex: String(profile.dbIndex ?? 0),
	tlsEnabled: profile.tlsEnabled,
	environment: profile.environment,
	tags: profile.tags.join(', '),
	readOnly: profile.readOnly,
	timeoutMs: String(profile.timeoutMs),
	username: '',
	password: '',
})

export const ConnectionFormDialog = ({
	open,
	mode,
	initialProfile,
	onOpenChange,
	onSaved,
}: ConnectionFormDialogProps) => {
	const [form, setForm] = React.useState<FormState>(createDefaultFormState())
	const [isSaving, setIsSaving] = React.useState(false)
	const [isTesting, setIsTesting] = React.useState(false)

	React.useEffect(() => {
		if (!open) {
			return
		}

		setForm(
			mode === 'edit' && initialProfile
				? profileToFormState(initialProfile)
				: createDefaultFormState(),
		)
	}, [mode, open, initialProfile])

	const draft = React.useMemo<ConnectionDraft>(() => {
		const parsedPort = Number(form.port)
		const parsedTimeoutMs = Number(form.timeoutMs)
		const parsedDbIndex = Number(form.dbIndex)

		return {
			name: form.name.trim(),
			engine: form.engine,
			host: form.host.trim(),
			port: Number.isFinite(parsedPort) ? parsedPort : 0,
			dbIndex:
				form.engine === 'redis' && Number.isFinite(parsedDbIndex)
					? parsedDbIndex
					: undefined,
			tlsEnabled: form.tlsEnabled,
			environment: form.environment,
			tags: form.tags
				.split(',')
				.map((tag) => tag.trim())
				.filter(Boolean),
			readOnly: form.readOnly,
			timeoutMs: Number.isFinite(parsedTimeoutMs)
				? parsedTimeoutMs
				: DEFAULT_TIMEOUT_MS,
		}
	}, [form])

	const secret = React.useMemo<ConnectionSecret>(
		() => ({
			username: form.username.trim() || undefined,
			password: form.password || undefined,
		}),
		[form.username, form.password],
	)

	const canSave =
		draft.name.length > 0 &&
		draft.host.length > 0 &&
		Number.isInteger(draft.port) &&
		draft.port > 0

	const onFieldChange = <T extends keyof FormState>(
		key: T,
		value: FormState[T],
	): void => {
		setForm((previous) => ({
			...previous,
			[key]: value,
		}))
	}

	const handleTestConnection = async (): Promise<void> => {
		setIsTesting(true)
		try {
			const result = unwrapResponse(
				await window.cachify.testConnection({
					profile: draft,
					secret,
				}),
			)

			toast.success(`Connected in ${result.latencyMs}ms`)
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'Connection test failed.'
			toast.error(message)
		} finally {
			setIsTesting(false)
		}
	}

	const handleSave = async (): Promise<void> => {
		if (!canSave) {
			toast.error('Please provide valid connection details.')
			return
		}

		setIsSaving(true)

		try {
			if (mode === 'create') {
				const profile = unwrapResponse(
					await window.cachify.createConnection({
						profile: draft,
						secret,
					}),
				)

				toast.success('Connection profile created.')
				onSaved(profile)
			} else if (initialProfile) {
				const includeSecret = Boolean(secret.username || secret.password)

				const profile = unwrapResponse(
					await window.cachify.updateConnection({
						id: initialProfile.id,
						profile: draft,
						secret: includeSecret ? secret : undefined,
					}),
				)

				toast.success('Connection profile updated.')
				onSaved(profile)
			}

			onOpenChange(false)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Save failed.'
			toast.error(message)
		} finally {
			setIsSaving(false)
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='max-w-2xl'>
				<DialogHeader>
					<DialogTitle>
						{mode === 'create' ? 'New Connection' : 'Edit Connection'}
					</DialogTitle>
					<DialogDescription>
						Configure Redis or Memcached profile settings and credentials.
					</DialogDescription>
				</DialogHeader>

				<div className='grid gap-3 md:grid-cols-2'>
					<div className='space-y-1.5'>
						<Label htmlFor='connection-name'>Name</Label>
						<Input
							id='connection-name'
							value={form.name}
							onChange={(event) => onFieldChange('name', event.target.value)}
							placeholder='Primary Redis'
						/>
					</div>

					<div className='space-y-1.5'>
						<Label htmlFor='connection-engine'>Engine</Label>
						<select
							id='connection-engine'
							value={form.engine}
							onChange={(event) =>
								onFieldChange('engine', event.target.value as FormState['engine'])
							}
							className='border-input dark:bg-input/30 h-8 w-full rounded-none border bg-transparent px-2.5 text-xs'
						>
							<option value='redis'>Redis</option>
							<option value='memcached'>Memcached</option>
						</select>
					</div>

					<div className='space-y-1.5'>
						<Label htmlFor='connection-host'>Host</Label>
						<Input
							id='connection-host'
							value={form.host}
							onChange={(event) => onFieldChange('host', event.target.value)}
							placeholder='127.0.0.1'
						/>
					</div>

					<div className='space-y-1.5'>
						<Label htmlFor='connection-port'>Port</Label>
						<Input
							id='connection-port'
							value={form.port}
							onChange={(event) => onFieldChange('port', event.target.value)}
							placeholder={form.engine === 'redis' ? '6379' : '11211'}
						/>
					</div>

					{form.engine === 'redis' && (
						<div className='space-y-1.5'>
							<Label htmlFor='connection-db-index'>Redis DB Index</Label>
							<Input
								id='connection-db-index'
								value={form.dbIndex}
								onChange={(event) => onFieldChange('dbIndex', event.target.value)}
							/>
						</div>
					)}

					<div className='space-y-1.5'>
						<Label htmlFor='connection-environment'>Environment</Label>
						<select
							id='connection-environment'
							value={form.environment}
							onChange={(event) =>
								onFieldChange(
									'environment',
									event.target.value as FormState['environment'],
								)
							}
							className='border-input dark:bg-input/30 h-8 w-full rounded-none border bg-transparent px-2.5 text-xs'
						>
							<option value='dev'>dev</option>
							<option value='staging'>staging</option>
							<option value='prod'>prod</option>
						</select>
					</div>

					<div className='space-y-1.5'>
						<Label htmlFor='connection-timeout'>Timeout (ms)</Label>
						<Input
							id='connection-timeout'
							value={form.timeoutMs}
							onChange={(event) => onFieldChange('timeoutMs', event.target.value)}
						/>
					</div>

					<div className='space-y-1.5'>
						<Label htmlFor='connection-tags'>Tags (comma separated)</Label>
						<Input
							id='connection-tags'
							value={form.tags}
							onChange={(event) => onFieldChange('tags', event.target.value)}
							placeholder='local, cache'
						/>
					</div>

					<div className='space-y-1.5'>
						<Label htmlFor='connection-username'>Username</Label>
						<Input
							id='connection-username'
							value={form.username}
							onChange={(event) => onFieldChange('username', event.target.value)}
							placeholder='Optional'
						/>
					</div>

					<div className='space-y-1.5'>
						<Label htmlFor='connection-password'>Password</Label>
						<Input
							id='connection-password'
							type='password'
							value={form.password}
							onChange={(event) => onFieldChange('password', event.target.value)}
							placeholder={
								mode === 'edit' ? 'Leave blank to keep current secret' : 'Optional'
							}
						/>
					</div>

					<div className='flex items-center justify-between rounded-none border p-2.5 text-xs'>
						<span>TLS</span>
						<Switch
							checked={form.tlsEnabled}
							onCheckedChange={(checked) => onFieldChange('tlsEnabled', checked)}
						/>
					</div>

					<div className='flex items-center justify-between rounded-none border p-2.5 text-xs'>
						<span>Read-only mode</span>
						<Switch
							checked={form.readOnly}
							onCheckedChange={(checked) => onFieldChange('readOnly', checked)}
						/>
					</div>
				</div>

				<DialogFooter>
					<Button
						variant='outline'
						onClick={handleTestConnection}
						disabled={isTesting}
					>
						{isTesting ? 'Testing...' : 'Test Connection'}
					</Button>
					<Button onClick={handleSave} disabled={!canSave || isSaving}>
						{isSaving
							? 'Saving...'
							: mode === 'create'
								? 'Create Profile'
								: 'Save Changes'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
