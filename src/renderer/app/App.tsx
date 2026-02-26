import { Navigate, Route, Routes } from 'react-router-dom'

import { ConnectionsPage } from '@/renderer/features/connections/connections-page'
import { SettingsPanel } from '@/renderer/features/settings/settings-panel'
import { WorkspacePage } from '@/renderer/features/workspace/workspace-page'
import { useUiStore } from '@/renderer/state/ui-store'

export default function App() {
	const { isSettingsOpen, setSettingsOpen } = useUiStore()

	return (
		<>
			<Routes>
				<Route path='/connections' element={<ConnectionsPage />} />
				<Route path='/workspace' element={<WorkspacePage />} />
				<Route path='*' element={<Navigate to='/connections' replace />} />
			</Routes>

			<SettingsPanel open={isSettingsOpen} onOpenChange={setSettingsOpen} />
		</>
	)
}
