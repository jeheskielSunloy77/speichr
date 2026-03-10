import type { DesktopApi } from '../../shared/contracts/api'

declare global {
	interface Window {
		desktopApi: DesktopApi
	}
}

export {}
