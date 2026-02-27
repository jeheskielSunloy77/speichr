import { useQuery } from '@tanstack/react-query'
import {
	ActivityIcon,
	ChevronDownIcon,
	DatabaseIcon,
	GaugeIcon,
	ServerIcon,
	Settings2Icon,
	ShieldIcon,
	WorkflowIcon,
} from 'lucide-react'
import * as React from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'

import { Button } from '@/renderer/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from '@/renderer/components/ui/dropdown-menu'
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarRail,
	SidebarSeparator,
	SidebarTrigger,
} from '@/renderer/components/ui/sidebar'
import { AlertsNavbarPopover } from '@/renderer/features/alerts/alerts-navbar-popover'
import { unwrapResponse } from '@/renderer/features/common/ipc'
import { useUiStore } from '@/renderer/state/ui-store'

type NavItem = {
	label: string
	path: string
	icon: React.ComponentType<{ className?: string }>
}

const workspaceItem: NavItem = {
	label: 'Workspace',
	path: '/workspace?tab=workspace',
	icon: ServerIcon,
}

const globalItems: NavItem[] = [
	{
		label: 'Workflow Templates',
		path: '/global/workflow-templates',
		icon: WorkflowIcon,
	},
	{
		label: 'Incident Bundles',
		path: '/global/incident-bundles',
		icon: ActivityIcon,
	},
	{
		label: 'Governance Admin',
		path: '/global/governance-admin',
		icon: ShieldIcon,
	},
]

const managementItems: NavItem[] = [
	{ label: 'Connections', path: '/connections', icon: DatabaseIcon },
]

const getPageTitle = (pathname: string): string => {
	if (pathname === '/connections') {
		return 'Connections'
	}
	if (pathname === '/global/alerts') {
		return 'Alerts'
	}
	if (pathname === '/global/workflow-templates') {
		return 'Workflow Templates'
	}
	if (pathname === '/global/incident-bundles') {
		return 'Incident Bundles'
	}
	if (pathname === '/global/governance-admin') {
		return 'Governance Admin'
	}
	if (pathname === '/workspace') {
		return 'Workspace'
	}

	return 'Speichr'
}

const isActivePath = (currentPath: string, targetPath: string): boolean => {
	const [baseTargetPath] = targetPath.split('?')

	if (baseTargetPath === '/workspace') {
		return currentPath === '/workspace'
	}

	return currentPath === baseTargetPath
}

const NavMenu = ({
	items,
	currentPath,
	onNavigate,
}: {
	items: NavItem[]
	currentPath: string
	onNavigate: (path: string) => void
}) => {
	return (
		<SidebarMenu>
			{items.map((item) => {
				const Icon = item.icon

				return (
					<SidebarMenuItem key={item.path}>
						<SidebarMenuButton
							isActive={isActivePath(currentPath, item.path)}
							onClick={() => onNavigate(item.path)}
						>
							<Icon className='size-4' />
							<span>{item.label}</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				)
			})}
		</SidebarMenu>
	)
}
export const AppShellLayout = () => {
	const navigate = useNavigate()
	const location = useLocation()
	const { selectedConnectionId, setSelectedConnectionId, setSettingsOpen } =
		useUiStore()

	const connectionsQuery = useQuery({
		queryKey: ['connections'],
		queryFn: async () => unwrapResponse(await window.speichr.listConnections()),
	})

	const connections = connectionsQuery.data ?? []
	const selectedConnection = React.useMemo(
		() =>
			connections.find((connection) => connection.id === selectedConnectionId) ??
			null,
		[connections, selectedConnectionId],
	)

	React.useEffect(() => {
		if (connections.length === 0) {
			setSelectedConnectionId(null)
			return
		}

		if (
			!selectedConnectionId ||
			!connections.some((connection) => connection.id === selectedConnectionId)
		) {
			setSelectedConnectionId(connections[0].id)
		}
	}, [connections, selectedConnectionId, setSelectedConnectionId])

	const pageTitle = getPageTitle(location.pathname)

	return (
		<SidebarProvider defaultOpen>
			<Sidebar>
				<SidebarHeader>
					<DropdownMenu>
						<DropdownMenuTrigger className='w-full'>
							<Button variant='outline' className='w-full h-fit justify-start py-2'>
								<div className='font-medium flex items-center gap-2 w-full'>
									<GaugeIcon className='size-3.5' />
									{selectedConnection ? (
										<div className='flex items-center w-full justify-between gap-2'>
											<p className='truncate font-medium'>{selectedConnection.name}</p>
											<ChevronDownIcon className='size-3.5' />
										</div>
									) : (
										<p>No Connection Selected</p>
									)}
								</div>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent>
							<DropdownMenuGroup>
								<DropdownMenuLabel>Saved Connections</DropdownMenuLabel>
								{connections.map((connection) => (
									<DropdownMenuItem
										key={connection.id}
										onClick={() => setSelectedConnectionId(connection.id)}
									>
										{connection.name}
									</DropdownMenuItem>
								))}
							</DropdownMenuGroup>
						</DropdownMenuContent>
					</DropdownMenu>
				</SidebarHeader>

				<SidebarSeparator />

				<SidebarContent>
					<SidebarGroup>
						<SidebarGroupLabel>Workspace</SidebarGroupLabel>
						<SidebarGroupContent>
							<NavMenu
								items={[workspaceItem]}
								currentPath={location.pathname}
								onNavigate={(path) => navigate(path)}
							/>
						</SidebarGroupContent>
					</SidebarGroup>

					<SidebarGroup>
						<SidebarGroupLabel>Global</SidebarGroupLabel>
						<SidebarGroupContent>
							<NavMenu
								items={globalItems}
								currentPath={location.pathname}
								onNavigate={(path) => navigate(path)}
							/>
						</SidebarGroupContent>
					</SidebarGroup>

					<SidebarGroup>
						<SidebarGroupLabel>Management</SidebarGroupLabel>
						<SidebarGroupContent>
							<NavMenu
								items={managementItems}
								currentPath={location.pathname}
								onNavigate={(path) => navigate(path)}
							/>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarContent>

				<SidebarFooter>
					<Button variant='outline' onClick={() => setSettingsOpen(true)}>
						<Settings2Icon className='size-3.5' />
						Settings
					</Button>
				</SidebarFooter>

				<SidebarRail />
			</Sidebar>

			<SidebarInset className='h-svh min-h-0 overflow-hidden'>
				<header className='bg-background border-b px-3 py-2'>
					<div className='flex items-center justify-between gap-2'>
						<div className='flex items-center gap-2'>
							<SidebarTrigger />
							<p className='text-sm font-medium'>{pageTitle}</p>
						</div>
						<AlertsNavbarPopover />
					</div>
				</header>
				<div className='bg-background min-h-0 flex-1 overflow-auto'>
					<Outlet />
				</div>
			</SidebarInset>
		</SidebarProvider>
	)
}
