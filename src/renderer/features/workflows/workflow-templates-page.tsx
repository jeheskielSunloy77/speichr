import { WorkflowPanel } from '@/renderer/features/workflows/workflow-panel'

export const WorkflowTemplatesPage = () => {
	return (
		<div className='h-full min-h-0 overflow-auto p-4'>
			<WorkflowPanel mode='templates' />
		</div>
	)
}
