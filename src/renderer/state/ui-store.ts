import { create } from 'zustand'

type UiState = {
  selectedConnectionId: string | null
  selectedKey: string | null
  isSettingsOpen: boolean
  setSelectedConnectionId: (connectionId: string | null) => void
  setSelectedKey: (key: string | null) => void
  setSettingsOpen: (isOpen: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  selectedConnectionId: null,
  selectedKey: null,
  isSettingsOpen: false,
  setSelectedConnectionId: (selectedConnectionId) =>
    set({ selectedConnectionId, selectedKey: null }),
  setSelectedKey: (selectedKey) => set({ selectedKey }),
  setSettingsOpen: (isSettingsOpen) => set({ isSettingsOpen }),
}))
