import { Navigate, Route, Routes } from 'react-router-dom'

import { AppShellLayout } from '@/renderer/app/app-shell-layout'
import { ConnectionsPage } from '@/renderer/features/connections/connections-page'
import { AlertsPage } from '@/renderer/features/alerts/alerts-page'
import { GovernanceAdminPage } from '@/renderer/features/governance/governance-admin-page'
import { IncidentBundlesPage } from '@/renderer/features/observability/incident-bundles-page'
import { SettingsPanel } from '@/renderer/features/settings/settings-panel'
import { WorkflowTemplatesPage } from '@/renderer/features/workflows/workflow-templates-page'
import { WorkspacePage } from '@/renderer/features/workspace/workspace-page'
import { useUiStore } from '@/renderer/state/ui-store'

export default function App() {
	const { isSettingsOpen, setSettingsOpen } = useUiStore()

	return (
		<>
			<Routes>
				<Route element={<AppShellLayout />}>
					<Route path='/connections' element={<ConnectionsPage />} />
					<Route path='/workspace' element={<WorkspacePage />} />
					<Route path='/global/alerts' element={<AlertsPage />} />
					<Route
						path='/global/workflow-templates'
						element={<WorkflowTemplatesPage />}
					/>
					<Route
						path='/global/incident-bundles'
						element={<IncidentBundlesPage />}
					/>
					<Route
						path='/global/governance-admin'
						element={<GovernanceAdminPage />}
					/>
				</Route>
				<Route path='*' element={<Navigate to='/connections' replace />} />
			</Routes>

			<SettingsPanel open={isSettingsOpen} onOpenChange={setSettingsOpen} />
		</>
	)
}
