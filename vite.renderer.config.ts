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
			},
		},
	}
})
