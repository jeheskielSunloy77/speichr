import type { ConnectionProfile } from '@/shared/contracts/cache'

export type ConnectionEngineFilter = 'all' | 'redis' | 'memcached'

type FilterConnectionsInput = {
	connections: ConnectionProfile[]
	searchText: string
	engineFilter: ConnectionEngineFilter
}

const normalize = (value: string): string => value.trim().toLowerCase()

export const filterConnections = ({
	connections,
	searchText,
	engineFilter,
}: FilterConnectionsInput): ConnectionProfile[] => {
	const normalizedSearch = normalize(searchText)

	return connections.filter((connection) => {
		if (engineFilter !== 'all' && connection.engine !== engineFilter) {
			return false
		}

		if (!normalizedSearch) {
			return true
		}

		const searchable = normalize(
			[
				connection.name,
				connection.host,
				String(connection.port),
				connection.tags.join(' '),
			].join(' '),
		)

		return searchable.includes(normalizedSearch)
	})
}
