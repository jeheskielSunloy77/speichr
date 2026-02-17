import { FilePenLineIcon, PlusIcon, SaveIcon, Trash2Icon } from 'lucide-react'

import { Badge } from '@/renderer/components/ui/badge'
import { Button } from '@/renderer/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/renderer/components/ui/card'
import { Input } from '@/renderer/components/ui/input'
import { Label } from '@/renderer/components/ui/label'
import { Textarea } from '@/renderer/components/ui/textarea'

type KeyDetailCardProps = {
	keyName: string
	value: string
	ttlSeconds: string
	readOnly: boolean
	supportsTTL: boolean
	isLoading: boolean
	errorMessage?: string
	isRetryableError?: boolean
	isExistingKey: boolean
	canRollback?: boolean
	onNewKey: () => void
	onKeyNameChange: (value: string) => void
	onValueChange: (value: string) => void
	onTtlChange: (value: string) => void
	onRetry?: () => void
	onSave: () => void
	onDelete: () => void
	onRollback?: () => void
}

export const KeyDetailCard = ({
	keyName,
	value,
	ttlSeconds,
	readOnly,
	supportsTTL,
	isLoading,
	errorMessage,
	isRetryableError,
	isExistingKey,
	canRollback,
	onNewKey,
	onKeyNameChange,
	onValueChange,
	onTtlChange,
	onRetry,
	onSave,
	onDelete,
	onRollback,
}: KeyDetailCardProps) => {
	return (
		<Card className='h-full'>
			<CardHeader>
				<div className='flex items-center justify-between gap-2'>
					<div>
						<CardTitle>Key Detail</CardTitle>
						<CardDescription>
							Inspect and edit value payloads and TTL configuration.
						</CardDescription>
					</div>
					<div className='flex items-center gap-2'>
						{readOnly && <Badge variant='outline'>Read-only</Badge>}
						<Button variant='outline' size='sm' onClick={onNewKey}>
							<PlusIcon className='size-3.5' />
							New Key
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent className='space-y-3'>
				{isLoading ? (
					<div className='text-muted-foreground flex items-center gap-1.5 text-xs'>
						<FilePenLineIcon className='size-3.5' />
						Loading key details...
					</div>
				) : errorMessage ? (
					<div className='space-y-2 border p-2 text-xs'>
						<p className='text-destructive'>{errorMessage}</p>
						{isRetryableError && onRetry && (
							<Button size='sm' variant='outline' onClick={onRetry}>
								Retry
							</Button>
						)}
					</div>
				) : (
					<>
						<div className='space-y-1.5'>
							<Label htmlFor='workspace-key'>Key</Label>
							<Input
								id='workspace-key'
								value={keyName}
								onChange={(event) => onKeyNameChange(event.target.value)}
								placeholder='session:123'
								disabled={isExistingKey || readOnly}
							/>
						</div>

						<div className='space-y-1.5'>
							<Label htmlFor='workspace-value'>Value</Label>
							<Textarea
								id='workspace-value'
								value={value}
								onChange={(event) => onValueChange(event.target.value)}
								className='min-h-44'
								placeholder='JSON or string value'
								disabled={readOnly}
							/>
						</div>

						{supportsTTL && (
							<div className='space-y-1.5'>
								<Label htmlFor='workspace-ttl'>TTL seconds</Label>
								<Input
									id='workspace-ttl'
									value={ttlSeconds}
									onChange={(event) => onTtlChange(event.target.value)}
									placeholder='Optional'
									disabled={readOnly}
								/>
							</div>
						)}

						<div className='flex items-center justify-between gap-2'>
							<div className='text-muted-foreground flex items-center gap-1.5 text-xs'>
								<FilePenLineIcon className='size-3.5' />
								{isExistingKey ? 'Editing existing key' : 'Preparing new key'}
							</div>
							<div className='flex gap-2'>
								{isExistingKey && canRollback && onRollback && (
									<Button
										variant='outline'
										size='sm'
										onClick={onRollback}
									>
										Rollback
									</Button>
								)}
								{isExistingKey && (
									<Button
										variant='destructive'
										size='sm'
										disabled={readOnly}
										onClick={onDelete}
									>
										<Trash2Icon className='size-3.5' />
										Delete
									</Button>
								)}
								<Button size='sm' disabled={readOnly} onClick={onSave}>
									<SaveIcon className='size-3.5' />
									Save
								</Button>
							</div>
						</div>
					</>
				)}
			</CardContent>
		</Card>
	)
}
