import { contextBridge } from 'electron'

import { speichrApi } from './bridge/speichr-api'

contextBridge.exposeInMainWorld('speichr', speichrApi)
