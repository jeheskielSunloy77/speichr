import { GovernancePanel } from '@/renderer/features/governance/governance-panel'

export const GovernanceAdminPage = () => {
	return (
		<div className='h-full min-h-0 overflow-auto p-4'>
			<GovernancePanel mode='admin' />
		</div>
	)
}
