import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { ResourceId } from '@/domain/model/analysis'
import type { GraphDirection } from '@/graph/layout/dagre-layout'

export type TopologyView = 'map' | 'list'
export type WorkbenchLayoutMode = 'split' | 'diagram' | 'editor'

export interface TopologyFocusRequest {
  readonly resourceId: ResourceId
  readonly token: number
}

export interface WorkbenchInteractionState {
  readonly topologyView: TopologyView
  readonly graphDirection: GraphDirection
  readonly layoutMode: WorkbenchLayoutMode
  readonly isFullscreen: boolean
  readonly selectedResourceId?: ResourceId
  readonly selectedRelationshipId?: string
  readonly selectedDiagnosticId?: string
  readonly topologyFocusRequest?: TopologyFocusRequest
  readonly inspectorFocusToken: number
  readonly setTopologyView: (view: TopologyView) => void
  readonly setGraphDirection: (direction: GraphDirection) => void
  readonly setLayoutMode: (mode: WorkbenchLayoutMode) => void
  readonly toggleFullscreen: (fullscreen?: boolean) => void
  readonly inspectResource: (id: ResourceId) => void
  readonly inspectRelationship: (id: string) => void
  readonly inspectDiagnostic: (id: string) => void
  readonly focusDiagnosticInTopology: (diagnosticId: string, resourceId: ResourceId) => void
  readonly requestResourceFocus: (resourceId: ResourceId) => void
  readonly clearSelection: () => void
}

const selectionReset = {
  selectedResourceId: undefined,
  selectedRelationshipId: undefined,
  selectedDiagnosticId: undefined,
  topologyFocusRequest: undefined,
} as const

export const useWorkbenchStore = create<WorkbenchInteractionState>()(
  persist(
    (set) => ({
      topologyView: 'map',
      graphDirection: 'LR',
      layoutMode: 'split',
      isFullscreen: false,
      inspectorFocusToken: 0,
      setTopologyView: (topologyView) => set({ topologyView }),
      setGraphDirection: (graphDirection) => set({ graphDirection }),
      setLayoutMode: (layoutMode) => set({ layoutMode }),
      toggleFullscreen: (fullscreen) =>
        set((state) => ({ isFullscreen: fullscreen ?? !state.isFullscreen })),
      inspectResource: (selectedResourceId) =>
        set((state) => ({
          ...selectionReset,
          selectedResourceId,
          inspectorFocusToken: state.inspectorFocusToken + 1,
        })),
      inspectRelationship: (selectedRelationshipId) =>
        set((state) => ({
          ...selectionReset,
          selectedRelationshipId,
          inspectorFocusToken: state.inspectorFocusToken + 1,
        })),
      inspectDiagnostic: (selectedDiagnosticId) =>
        set((state) => ({
          ...selectionReset,
          selectedDiagnosticId,
          inspectorFocusToken: state.inspectorFocusToken + 1,
        })),
      focusDiagnosticInTopology: (selectedDiagnosticId, resourceId) =>
        set((state) => ({
          ...selectionReset,
          topologyView: 'map',
          selectedDiagnosticId,
          topologyFocusRequest: {
            resourceId,
            token: (state.topologyFocusRequest?.token ?? 0) + 1,
          },
        })),
      requestResourceFocus: (resourceId) =>
        set((state) => ({
          topologyView: 'map',
          topologyFocusRequest: {
            resourceId,
            token: (state.topologyFocusRequest?.token ?? 0) + 1,
          },
        })),
      clearSelection: () => set(selectionReset),
    }),
    {
      name: 'kuberelate-preferences',
      partialize: (state) => ({
        graphDirection: state.graphDirection,
        layoutMode: state.layoutMode,
      }),
    },
  ),
)

export const selectTopologyView = (state: WorkbenchInteractionState) => state.topologyView
export const selectGraphDirection = (state: WorkbenchInteractionState) => state.graphDirection
export const selectLayoutMode = (state: WorkbenchInteractionState) => state.layoutMode
export const selectIsFullscreen = (state: WorkbenchInteractionState) => state.isFullscreen
export const selectSelectedResourceId = (state: WorkbenchInteractionState) =>
  state.selectedResourceId
export const selectSelectedRelationshipId = (state: WorkbenchInteractionState) =>
  state.selectedRelationshipId
export const selectSelectedDiagnosticId = (state: WorkbenchInteractionState) =>
  state.selectedDiagnosticId
export const selectTopologyFocusRequest = (state: WorkbenchInteractionState) =>
  state.topologyFocusRequest
export const selectInspectorFocusToken = (state: WorkbenchInteractionState) =>
  state.inspectorFocusToken
