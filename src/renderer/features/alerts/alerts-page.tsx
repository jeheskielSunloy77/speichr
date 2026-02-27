import { useQuery } from '@tanstack/react-query'
import * as React from 'react'

import { unwrapResponse } from '@/renderer/features/common/ipc'
import { AlertsPanel } from '@/renderer/features/alerts/alerts-panel'
import { useUiStore } from '@/renderer/state/ui-store'

export const AlertsPage = () => {
	const { selectedConnectionId } = useUiStore()

	const connectionsQuery = useQuery({
		queryKey: ['connections'],
		queryFn: async () => unwrapResponse(await window.speichr.listConnections()),
	})

	const selectedConnection = React.useMemo(
		() =>
			(connectionsQuery.data ?? []).find(
				(connection) => connection.id === selectedConnectionId,
			) ?? null,
		[connectionsQuery.data, selectedConnectionId],
	)

	return (
		<div className='h-full min-h-0 overflow-auto p-4'>
			<AlertsPanel connection={selectedConnection} />
		</div>
	)
}
