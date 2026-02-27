import { create } from 'zustand'

type UiState = {
  selectedConnectionId: string | null
  selectedNamespaceIdByConnection: Record<string, string | null>
  selectedKey: string | null
  isSettingsOpen: boolean
  setSelectedConnectionId: (connectionId: string | null) => void
  setSelectedNamespaceId: (
    connectionId: string,
    namespaceId: string | null,
  ) => void
  clearConnectionNamespaceSelection: (connectionId: string) => void
  setSelectedKey: (key: string | null) => void
  setSettingsOpen: (isOpen: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  selectedConnectionId: null,
  selectedNamespaceIdByConnection: {},
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
  setSelectedNamespaceId: (connectionId, namespaceId) =>
    set((state) => ({
      selectedNamespaceIdByConnection: {
        ...state.selectedNamespaceIdByConnection,
        [connectionId]: namespaceId,
      },
      selectedKey: null,
    })),
  clearConnectionNamespaceSelection: (connectionId) =>
    set((state) => {
      if (!(connectionId in state.selectedNamespaceIdByConnection)) {
        return state
      }

      const nextSelections = { ...state.selectedNamespaceIdByConnection }
      delete nextSelections[connectionId]
      return { selectedNamespaceIdByConnection: nextSelections, selectedKey: null }
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
