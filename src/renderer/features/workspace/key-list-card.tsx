import { SearchIcon, RefreshCwIcon, Trash2Icon } from 'lucide-react'

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
import { Separator } from '@/components/ui/separator'

type KeyListCardProps = {
  title: string
  keys: string[]
  selectedKey: string | null
  searchPattern: string
  isLoading: boolean
  readOnly: boolean
  hasNextPage: boolean
  onSearchPatternChange: (value: string) => void
  onSelectKey: (key: string) => void
  onDeleteKey: (key: string) => void
  onRefresh: () => void
  onLoadNextPage: () => void
}

export const KeyListCard = ({
  title,
  keys,
  selectedKey,
  searchPattern,
  isLoading,
  readOnly,
  hasNextPage,
  onSearchPatternChange,
  onSelectKey,
  onDeleteKey,
  onRefresh,
  onLoadNextPage,
}: KeyListCardProps) => {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>
              Pattern search supports wildcard syntax such as <code>user:*</code>.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCwIcon className="size-3.5" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex h-full min-h-0 flex-col gap-3">
        <div className="relative">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2" />
          <Input
            className="pl-7"
            placeholder="Search keys by pattern"
            value={searchPattern}
            onChange={(event) => onSearchPatternChange(event.target.value)}
          />
        </div>

        <Separator />

        <div className="no-scrollbar min-h-0 flex-1 space-y-1 overflow-auto">
          {isLoading ? (
            <p className="text-muted-foreground p-2 text-xs">Loading keys...</p>
          ) : keys.length === 0 ? (
            <p className="text-muted-foreground p-2 text-xs">
              No keys found for this query.
            </p>
          ) : (
            keys.map((key) => (
              <div
                key={key}
                className={`group flex items-center justify-between rounded-none border px-2 py-1.5 text-xs ${
                  key === selectedKey
                    ? 'border-primary bg-primary/10'
                    : 'hover:bg-muted/50 border-transparent'
                }`}
              >
                <button
                  className="min-w-0 flex-1 truncate text-left"
                  onClick={() => onSelectKey(key)}
                  type="button"
                >
                  {key}
                </button>
                <div className="ml-2 flex items-center gap-2">
                  {!readOnly ? (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => onDeleteKey(key)}
                    >
                      <Trash2Icon className="size-3.5" />
                    </Button>
                  ) : (
                    <Badge variant="outline">RO</Badge>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {hasNextPage && !searchPattern && (
          <Button variant="outline" size="sm" onClick={onLoadNextPage}>
            Load Next Page
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
