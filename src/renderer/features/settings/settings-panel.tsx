import { useTheme } from 'next-themes'

import { Button } from '@/renderer/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/renderer/components/ui/dialog'

type SettingsPanelProps = {
	open: boolean
	onOpenChange: (open: boolean) => void
}

export const SettingsPanel = ({ open, onOpenChange }: SettingsPanelProps) => {
	const { theme, setTheme } = useTheme()

	const isDark = theme === 'dark'

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='max-w-lg'>
				<DialogHeader>
					<DialogTitle>Settings</DialogTitle>
					<DialogDescription>
						Personalize appearance and local workflow defaults.
					</DialogDescription>
				</DialogHeader>

				<div className='space-y-3'>
					<div className='space-y-1.5'>
						<p className='text-xs font-medium'>Theme</p>
						<div className='flex gap-2'>
							<Button
								variant={theme === 'light' ? 'default' : 'outline'}
								size='sm'
								onClick={() => setTheme('light')}
							>
								Light
							</Button>
							<Button
								variant={theme === 'dark' ? 'default' : 'outline'}
								size='sm'
								onClick={() => setTheme('dark')}
							>
								Dark
							</Button>
							<Button
								variant={theme === 'system' ? 'default' : 'outline'}
								size='sm'
								onClick={() => setTheme('system')}
							>
								System
							</Button>
						</div>
					</div>
				</div>

				<DialogFooter>
					<Button variant='outline' onClick={() => onOpenChange(false)}>
						Close
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
