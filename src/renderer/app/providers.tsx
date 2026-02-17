import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import * as React from 'react'

import { Toaster } from '@/renderer/components/ui/sonner'
import { TooltipProvider } from '@/renderer/components/ui/tooltip'

export const AppProviders = ({ children }: { children: React.ReactNode }) => {
	const [queryClient] = React.useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						refetchOnWindowFocus: false,
						retry: 1,
					},
					mutations: {
						retry: 0,
					},
				},
			}),
	)

	return (
		<ThemeProvider attribute='class' defaultTheme='system' enableSystem>
			<QueryClientProvider client={queryClient}>
				<TooltipProvider>
					{children}
					<Toaster position='bottom-right' />
				</TooltipProvider>
			</QueryClientProvider>
		</ThemeProvider>
	)
}
