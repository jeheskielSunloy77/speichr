import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as React from 'react'
import { toast } from 'sonner'

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
import { unwrapResponse } from '@/renderer/features/common/ipc'

const getSeverityVariant = (
  severity: 'info' | 'warning' | 'critical',
): 'default' | 'outline' | 'destructive' => {
  if (severity === 'critical') {
    return 'destructive'
  }

  if (severity === 'warning') {
    return 'outline'
  }

  return 'default'
}

export const AlertsPanel = () => {
  const queryClient = useQueryClient()
  const [unreadOnly, setUnreadOnly] = React.useState(false)

  const alertsQuery = useQuery({
    queryKey: ['alerts', unreadOnly],
    queryFn: async () =>
      unwrapResponse(
        await window.cachify.listAlerts({
          unreadOnly,
          limit: 100,
        }),
      ),
  })

  const markReadMutation = useMutation({
    mutationFn: async (id: string) =>
      unwrapResponse(
        await window.cachify.markAlertRead({
          id,
        }),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['alerts'] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Unable to mark alert read.')
    },
  })

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between gap-2'>
          <div>
            <CardTitle>Alerts</CardTitle>
            <CardDescription>
              In-app alert feed with desktop notification parity.
            </CardDescription>
          </div>
          <label className='flex items-center gap-2 text-xs'>
            <Checkbox
              checked={unreadOnly}
              onCheckedChange={(checked) => setUnreadOnly(Boolean(checked))}
            />
            Unread only
          </label>
        </div>
      </CardHeader>
      <CardContent className='max-h-[calc(100vh-280px)] space-y-2 overflow-auto'>
        {alertsQuery.isLoading ? (
          <p className='text-muted-foreground text-xs'>Loading alerts...</p>
        ) : (alertsQuery.data?.length ?? 0) === 0 ? (
          <p className='text-muted-foreground text-xs'>No alerts to display.</p>
        ) : (
          alertsQuery.data?.map((alert) => (
            <div key={alert.id} className='space-y-2 border p-2 text-xs'>
              <div className='flex items-center justify-between gap-2'>
                <div className='min-w-0'>
                  <p className='truncate font-medium'>{alert.title}</p>
                  <p className='text-muted-foreground truncate'>
                    {new Date(alert.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className='flex items-center gap-2'>
                  <Badge variant={getSeverityVariant(alert.severity)}>
                    {alert.severity}
                  </Badge>
                  {alert.read ? <Badge variant='outline'>read</Badge> : null}
                </div>
              </div>

              <p>{alert.message}</p>

              <div className='text-muted-foreground flex items-center gap-2'>
                <span>source: {alert.source}</span>
                {alert.environment && <span>env: {alert.environment}</span>}
                {alert.connectionId && <span>connection: {alert.connectionId}</span>}
              </div>

              {!alert.read && (
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => markReadMutation.mutate(alert.id)}
                  disabled={markReadMutation.isPending}
                >
                  Mark As Read
                </Button>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
