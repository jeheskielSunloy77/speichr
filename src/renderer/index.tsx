import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App'
import { AppProviders } from './app/providers'
import './styles/index.css'

const rootElement = document.getElementById('root')
if (!rootElement) {
	throw new Error('Root element not found.')
}

createRoot(rootElement).render(
	<React.StrictMode>
		<AppProviders>
			<App />
		</AppProviders>
	</React.StrictMode>,
)
