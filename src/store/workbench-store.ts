import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { ResourceId } from '@/domain/model/analysis'
import type { GraphDirection } from '@/graph/layout/dagre-layout'

export type TopologyView = 'map' | 'list'

export interface TopologyFocusRequest {
  readonly resourceId: ResourceId
  readonly token: number
}

export interface WorkbenchInteractionState {
  readonly topologyView: TopologyView
  readonly graphDirection: GraphDirection
  readonly selectedResourceId?: ResourceId
  readonly selectedRelationshipId?: string
  readonly selectedDiagnosticId?: string
  readonly topologyFocusRequest?: TopologyFocusRequest
  readonly inspectorFocusToken: number
  readonly setTopologyView: (view: TopologyView) => void
  readonly setGraphDirection: (direction: GraphDirection) => void
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
      inspectorFocusToken: 0,
      setTopologyView: (topologyView) => set({ topologyView }),
      setGraphDirection: (graphDirection) => set({ graphDirection }),
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
      partialize: (state) => ({ graphDirection: state.graphDirection }),
    },
  ),
)

export const selectTopologyView = (state: WorkbenchInteractionState) => state.topologyView
export const selectGraphDirection = (state: WorkbenchInteractionState) => state.graphDirection
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
