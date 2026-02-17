import { contextBridge } from 'electron'

import { cachifyApi } from './bridge/cachify-api'

contextBridge.exposeInMainWorld('cachify', cachifyApi)
