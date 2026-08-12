import { beforeEach, describe, expect, it } from 'vitest'

import { brokenServiceSelectorExample } from '@/content/examples/resource-inventory'
import { analyzeManifest } from '@/domain/parser/analyze-manifest'

import {
  selectGraphDirection,
  selectIsFullscreen,
  selectLayoutMode,
  selectSelectedDiagnosticId,
  selectSelectedRelationshipId,
  selectSelectedResourceId,
  selectTheme,
  selectTopologyView,
  useWorkbenchStore,
} from './workbench-store'

const resourceId = analyzeManifest(brokenServiceSelectorExample.source).resources[0]!.id

describe('workbench interaction store', () => {
  beforeEach(() => {
    useWorkbenchStore.setState({
      theme: 'system',
      topologyView: 'map',
      graphDirection: 'LR',
      layoutMode: 'split',
      isFullscreen: false,
      selectedResourceId: undefined,
      selectedRelationshipId: undefined,
      selectedDiagnosticId: undefined,
      topologyFocusRequest: undefined,
      inspectorFocusToken: 0,
    })
    localStorage.clear()
    delete document.documentElement.dataset.theme
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

  it('handles layoutMode and isFullscreen toggling', () => {
    const store = useWorkbenchStore.getState()

    expect(selectLayoutMode(useWorkbenchStore.getState())).toBe('split')
    expect(selectIsFullscreen(useWorkbenchStore.getState())).toBe(false)

    store.setLayoutMode('diagram')
    expect(selectLayoutMode(useWorkbenchStore.getState())).toBe('diagram')

    store.toggleFullscreen(true)
    expect(selectIsFullscreen(useWorkbenchStore.getState())).toBe(true)

    store.toggleFullscreen()
    expect(selectIsFullscreen(useWorkbenchStore.getState())).toBe(false)
  })

  it('handles theme toggling and updates document element dataset', () => {
    const store = useWorkbenchStore.getState()
    expect(selectTheme(useWorkbenchStore.getState())).toBe('system')

    store.setTheme('dark')
    expect(selectTheme(useWorkbenchStore.getState())).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('kuberelate-theme')).toBe('dark')

    store.setTheme('light')
    expect(selectTheme(useWorkbenchStore.getState())).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('kuberelate-theme')).toBe('light')
  })

  it('persists theme, graph direction, and layoutMode', () => {
    useWorkbenchStore.getState().inspectDiagnostic('diagnostic:test')
    useWorkbenchStore.getState().setTheme('dark')
    useWorkbenchStore.getState().setGraphDirection('TB')
    useWorkbenchStore.getState().setLayoutMode('diagram')

    expect(selectTheme(useWorkbenchStore.getState())).toBe('dark')
    expect(selectGraphDirection(useWorkbenchStore.getState())).toBe('TB')
    expect(selectLayoutMode(useWorkbenchStore.getState())).toBe('diagram')
    const persisted = localStorage.getItem('kuberelate-preferences')
    expect(persisted).not.toBeNull()
    expect(JSON.parse(persisted!)).toEqual({
      state: { theme: 'dark', graphDirection: 'TB', layoutMode: 'diagram' },
      version: 0,
    })
  })
})
