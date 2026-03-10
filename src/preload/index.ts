import { contextBridge } from 'electron'

import { desktopApi } from './bridge/desktop-api'

contextBridge.exposeInMainWorld('desktopApi', desktopApi)
