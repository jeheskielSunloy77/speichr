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
    set((state) => {
      if (
        state.selectedConnectionId === selectedConnectionId &&
        state.selectedKey === null
      ) {
        return state
      }

      return { selectedConnectionId, selectedKey: null }
    }),
  setSelectedKey: (selectedKey) =>
    set((state) => {
      if (state.selectedKey === selectedKey) {
        return state
      }

      return { selectedKey }
    }),
  setSettingsOpen: (isSettingsOpen) =>
    set((state) => {
      if (state.isSettingsOpen === isSettingsOpen) {
        return state
      }

      return { isSettingsOpen }
    }),
}))
