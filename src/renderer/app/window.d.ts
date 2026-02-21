import type { SpeichrApi } from '../../shared/contracts/api'

declare global {
	interface Window {
		speichr: SpeichrApi
	}
}

export {}
