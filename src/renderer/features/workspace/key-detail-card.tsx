import { FilePenLineIcon, PlusIcon, SaveIcon, Trash2Icon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type KeyDetailCardProps = {
  keyName: string
  value: string
  ttlSeconds: string
  readOnly: boolean
  supportsTTL: boolean
  isLoading: boolean
  isExistingKey: boolean
  onNewKey: () => void
  onKeyNameChange: (value: string) => void
  onValueChange: (value: string) => void
  onTtlChange: (value: string) => void
  onSave: () => void
  onDelete: () => void
}

export const KeyDetailCard = ({
  keyName,
  value,
  ttlSeconds,
  readOnly,
  supportsTTL,
  isLoading,
  isExistingKey,
  onNewKey,
  onKeyNameChange,
  onValueChange,
  onTtlChange,
  onSave,
  onDelete,
}: KeyDetailCardProps) => {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle>Key Detail</CardTitle>
            <CardDescription>
              Inspect and edit value payloads and TTL configuration.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {readOnly && <Badge variant="outline">Read-only</Badge>}
            <Button variant="outline" size="sm" onClick={onNewKey}>
              <PlusIcon className="size-3.5" />
              New Key
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="workspace-key">Key</Label>
          <Input
            id="workspace-key"
            value={keyName}
            onChange={(event) => onKeyNameChange(event.target.value)}
            placeholder="session:123"
            disabled={isExistingKey || readOnly}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="workspace-value">Value</Label>
          <Textarea
            id="workspace-value"
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            className="min-h-44"
            placeholder="JSON or string value"
            disabled={readOnly}
          />
        </div>

        {supportsTTL && (
          <div className="space-y-1.5">
            <Label htmlFor="workspace-ttl">TTL seconds</Label>
            <Input
              id="workspace-ttl"
              value={ttlSeconds}
              onChange={(event) => onTtlChange(event.target.value)}
              placeholder="Optional"
              disabled={readOnly}
            />
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <FilePenLineIcon className="size-3.5" />
            {isLoading
              ? 'Loading key details...'
              : isExistingKey
                ? 'Editing existing key'
                : 'Preparing new key'}
          </div>
          <div className="flex gap-2">
            {isExistingKey && (
              <Button
                variant="destructive"
                size="sm"
                disabled={readOnly}
                onClick={onDelete}
              >
                <Trash2Icon className="size-3.5" />
                Delete
              </Button>
            )}
            <Button size="sm" disabled={readOnly} onClick={onSave}>
              <SaveIcon className="size-3.5" />
              Save
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
