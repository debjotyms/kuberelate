import { beforeEach, describe, expect, it } from 'vitest'

import { brokenServiceSelectorExample } from '@/content/examples/resource-inventory'
import { analyzeManifest } from '@/domain/parser/analyze-manifest'

import {
  selectGraphDirection,
  selectSelectedDiagnosticId,
  selectSelectedRelationshipId,
  selectSelectedResourceId,
  selectTopologyView,
  useWorkbenchStore,
} from './workbench-store'

const resourceId = analyzeManifest(brokenServiceSelectorExample.source).resources[0]!.id

describe('workbench interaction store', () => {
  beforeEach(() => {
    useWorkbenchStore.setState({
      topologyView: 'map',
      graphDirection: 'LR',
      selectedResourceId: undefined,
      selectedRelationshipId: undefined,
      selectedDiagnosticId: undefined,
      topologyFocusRequest: undefined,
      inspectorFocusToken: 0,
    })
    localStorage.clear()
  })

  it('keeps one selected inspector entity and advances the inspector focus token', () => {
    const store = useWorkbenchStore.getState()

    store.inspectResource(resourceId)
    expect(selectSelectedResourceId(useWorkbenchStore.getState())).toBe(resourceId)
    expect(useWorkbenchStore.getState().inspectorFocusToken).toBe(1)

    store.inspectRelationship('relationship:test')
    expect(selectSelectedResourceId(useWorkbenchStore.getState())).toBeUndefined()
    expect(selectSelectedRelationshipId(useWorkbenchStore.getState())).toBe('relationship:test')
    expect(useWorkbenchStore.getState().inspectorFocusToken).toBe(2)

    store.inspectDiagnostic('diagnostic:test')
    expect(selectSelectedRelationshipId(useWorkbenchStore.getState())).toBeUndefined()
    expect(selectSelectedDiagnosticId(useWorkbenchStore.getState())).toBe('diagnostic:test')
    expect(useWorkbenchStore.getState().inspectorFocusToken).toBe(3)
  })

  it('routes diagnostic focus to the map and emits repeatable resource focus requests', () => {
    const store = useWorkbenchStore.getState()
    store.setTopologyView('list')
    store.focusDiagnosticInTopology('diagnostic:test', resourceId)

    expect(selectTopologyView(useWorkbenchStore.getState())).toBe('map')
    expect(useWorkbenchStore.getState().topologyFocusRequest).toEqual({
      resourceId,
      token: 1,
    })

    useWorkbenchStore.getState().requestResourceFocus(resourceId)
    expect(useWorkbenchStore.getState().topologyFocusRequest?.token).toBe(2)

    useWorkbenchStore.getState().clearSelection()
    expect(useWorkbenchStore.getState().topologyFocusRequest).toBeUndefined()
    expect(selectSelectedDiagnosticId(useWorkbenchStore.getState())).toBeUndefined()
  })

  it('persists graph direction but no selection or manifest-shaped data', () => {
    useWorkbenchStore.getState().inspectDiagnostic('diagnostic:test')
    useWorkbenchStore.getState().setGraphDirection('TB')

    expect(selectGraphDirection(useWorkbenchStore.getState())).toBe('TB')
    const persisted = localStorage.getItem('kuberelate-preferences')
    expect(persisted).not.toBeNull()
    expect(JSON.parse(persisted!)).toEqual({
      state: { graphDirection: 'TB' },
      version: 0,
    })
  })
})
