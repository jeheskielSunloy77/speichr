import type { CachifyApi } from '../../shared/contracts/api'

declare global {
  interface Window {
    cachify: CachifyApi
  }
}

export {}
