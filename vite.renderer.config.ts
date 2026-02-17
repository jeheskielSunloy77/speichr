import { defineConfig } from 'vite'

export default defineConfig(async () => {
	const react = (await import('@vitejs/plugin-react')).default
	const tailwindcss = (await import('@tailwindcss/vite')).default
	const path = (await import('path')).default

		return {
			plugins: [react({}), tailwindcss()],
			resolve: {
				alias: {
					'@': path.resolve(__dirname, './src'),
					'@/components': path.resolve(__dirname, './src/renderer/components'),
					'@/hooks': path.resolve(__dirname, './src/renderer/hooks'),
					'@/lib': path.resolve(__dirname, './src/renderer/lib'),
					'@/styles': path.resolve(__dirname, './src/renderer/styles'),
					'@/shared': path.resolve(__dirname, './src/shared'),
				},
			},
		}
})
