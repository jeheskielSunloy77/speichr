import { useQuery } from '@tanstack/react-query'
import * as React from 'react'

import { Badge } from '@/renderer/components/ui/badge'
import { Button } from '@/renderer/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/renderer/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/renderer/components/ui/table'
import { unwrapResponse } from '@/renderer/features/common/ipc'
import type { ConnectionProfile } from '@/shared/contracts/cache'

type ObservabilityPanelProps = {
  connection: ConnectionProfile
}

const getHealthVariant = (
  status: 'healthy' | 'degraded' | 'offline',
): 'default' | 'outline' | 'destructive' => {
  if (status === 'healthy') {
    return 'default'
  }

  if (status === 'degraded') {
    return 'destructive'
  }

  return 'outline'
}

export const ObservabilityPanel = ({ connection }: ObservabilityPanelProps) => {
  const [intervalMinutes, setIntervalMinutes] = React.useState('5')

  const dashboardQuery = useQuery({
    queryKey: ['observability-dashboard', connection.id, intervalMinutes],
    queryFn: async () =>
      unwrapResponse(
        await window.cachify.getObservabilityDashboard({
          connectionId: connection.id,
          intervalMinutes: Math.max(1, Number(intervalMinutes) || 5),
          limit: 300,
        }),
      ),
  })

  const dashboard = dashboardQuery.data

  return (
    <div className='grid min-h-0 gap-3'>
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between gap-2'>
            <div>
              <CardTitle>Connection Health Dashboard</CardTitle>
              <CardDescription>
                Tracks operation trends, error heatmap, unified timeline, and slow
                operation feed.
              </CardDescription>
            </div>
            <div className='flex items-center gap-2'>
              <select
                className='border-input dark:bg-input/30 h-8 rounded-none border bg-transparent px-2.5 text-xs'
                value={intervalMinutes}
                onChange={(event) => setIntervalMinutes(event.target.value)}
              >
                <option value='1'>1m buckets</option>
                <option value='5'>5m buckets</option>
                <option value='15'>15m buckets</option>
              </select>
              <Button
                variant='outline'
                size='sm'
                onClick={() => {
                  void dashboardQuery.refetch()
                }}
              >
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className='space-y-3'>
          {dashboardQuery.isLoading ? (
            <p className='text-muted-foreground text-xs'>Loading dashboard...</p>
          ) : dashboard ? (
            <div className='grid gap-3 md:grid-cols-2'>
              {dashboard.health.map((health) => (
                <div key={health.connectionId} className='space-y-2 border p-2 text-xs'>
                  <div className='flex items-center justify-between gap-2'>
                    <p className='truncate font-medium'>{health.connectionName}</p>
                    <Badge variant={getHealthVariant(health.status)}>
                      {health.status}
                    </Badge>
                  </div>
                  <div className='text-muted-foreground grid grid-cols-2 gap-1'>
                    <span>env: {health.environment}</span>
                    <span>p95: {health.latencyP95Ms}ms</span>
                    <span>error: {(health.errorRate * 100).toFixed(1)}%</span>
                    <span>ops/s: {health.opsPerSecond.toFixed(2)}</span>
                    <span>slow ops: {health.slowOpCount}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className='text-muted-foreground text-xs'>No dashboard data yet.</p>
          )}
        </CardContent>
      </Card>

      <div className='grid min-h-0 gap-3 xl:grid-cols-2'>
        <Card className='min-h-0'>
          <CardHeader>
            <CardTitle>Operation Trends</CardTitle>
            <CardDescription>
              Aggregated operation counts and errors over time.
            </CardDescription>
          </CardHeader>
          <CardContent className='max-h-64 overflow-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bucket</TableHead>
                  <TableHead>Ops</TableHead>
                  <TableHead>Errors</TableHead>
                  <TableHead>Avg Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(dashboard?.trends ?? []).map((trend) => (
                  <TableRow key={trend.bucket}>
                    <TableCell>{new Date(trend.bucket).toLocaleTimeString()}</TableCell>
                    <TableCell>{trend.operationCount}</TableCell>
                    <TableCell>{trend.errorCount}</TableCell>
                    <TableCell>{trend.avgDurationMs}ms</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className='min-h-0'>
          <CardHeader>
            <CardTitle>Error Heatmap</CardTitle>
            <CardDescription>
              Error volume by connection and environment.
            </CardDescription>
          </CardHeader>
          <CardContent className='max-h-64 overflow-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Connection</TableHead>
                  <TableHead>Environment</TableHead>
                  <TableHead>Errors</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(dashboard?.heatmap ?? []).map((cell) => (
                  <TableRow key={`${cell.connectionId}:${cell.environment}`}>
                    <TableCell>{cell.connectionId}</TableCell>
                    <TableCell>{cell.environment}</TableCell>
                    <TableCell>{cell.errorCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className='grid min-h-0 gap-3 xl:grid-cols-2'>
        <Card className='min-h-0'>
          <CardHeader>
            <CardTitle>Unified Timeline</CardTitle>
            <CardDescription>
              Combined app audit and operation events.
            </CardDescription>
          </CardHeader>
          <CardContent className='max-h-72 overflow-auto'>
            {(dashboard?.timeline ?? []).length === 0 ? (
              <p className='text-muted-foreground text-xs'>No timeline events found.</p>
            ) : (
              <div className='space-y-2'>
                {dashboard?.timeline.slice(0, 80).map((event) => (
                  <div key={event.id} className='space-y-1 border p-2 text-xs'>
                    <div className='flex items-center justify-between gap-2'>
                      <p className='truncate font-medium'>{event.action}</p>
                      <Badge variant={event.status === 'error' ? 'destructive' : 'outline'}>
                        {event.status}
                      </Badge>
                    </div>
                    <p className='text-muted-foreground truncate'>{event.keyOrPattern}</p>
                    <p className='text-muted-foreground'>
                      {new Date(event.timestamp).toLocaleString()} | {event.durationMs}ms
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className='min-h-0'>
          <CardHeader>
            <CardTitle>Slow Operation Panel</CardTitle>
            <CardDescription>
              Operations at or above the configured slow threshold.
            </CardDescription>
          </CardHeader>
          <CardContent className='max-h-72 overflow-auto'>
            {(dashboard?.slowOperations ?? []).length === 0 ? (
              <p className='text-muted-foreground text-xs'>No slow operations found.</p>
            ) : (
              <div className='space-y-2'>
                {dashboard?.slowOperations.slice(0, 80).map((event) => (
                  <div key={event.id} className='space-y-1 border p-2 text-xs'>
                    <div className='flex items-center justify-between gap-2'>
                      <p className='truncate font-medium'>{event.action}</p>
                      <Badge variant='destructive'>{event.durationMs}ms</Badge>
                    </div>
                    <p className='text-muted-foreground truncate'>{event.keyOrPattern}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
