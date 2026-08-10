import { describe, expect, it } from 'vitest'

import { brokenServiceSelectorExample } from '@/content/examples/resource-inventory'
import { analyzeManifest } from '@/domain/parser/analyze-manifest'
import { buildTopologyGraph } from '@/graph/adapter/relationship-graph'

import { layoutTopologyGraph, topologyNodeDimensions } from './dagre-layout'

function brokenGraph() {
  const analysis = analyzeManifest(brokenServiceSelectorExample.source)
  return buildTopologyGraph(analysis.resources, analysis.relationships, analysis.diagnostics)
}

describe('Dagre topology layout', () => {
  it('returns deterministic left-to-right positions with stable presentation dimensions', () => {
    const graph = brokenGraph()
    const first = layoutTopologyGraph(graph, 'LR')
    const second = layoutTopologyGraph(graph, 'LR')
    const namespace = first.nodes.find((node) => node.model.type === 'namespace')!
    const service = first.nodes.find(
      (node) => node.model.type === 'resource' && node.model.kind === 'Service',
    )!
    const unresolved = first.nodes.find((node) => node.model.type === 'unresolved')!

    expect(first).toEqual(second)
    expect(namespace.position.x).toBeLessThan(service.position.x)
    expect(service.position.x).toBeLessThan(unresolved.position.x)
    expect(service.targetPosition).toBe('left')
    expect(service.sourcePosition).toBe('right')
    expect(topologyNodeDimensions(service.model)).toEqual({ width: 220, height: 128 })
    expect(first.edges).toEqual(graph.edges)
  })

  it('changes only presentation geometry for top-to-bottom layout', () => {
    const graph = brokenGraph()
    const layout = layoutTopologyGraph(graph, 'TB')
    const namespace = layout.nodes.find((node) => node.model.type === 'namespace')!
    const service = layout.nodes.find(
      (node) => node.model.type === 'resource' && node.model.kind === 'Service',
    )!
    const unresolved = layout.nodes.find((node) => node.model.type === 'unresolved')!

    expect(namespace.position.y).toBeLessThan(service.position.y)
    expect(service.position.y).toBeLessThan(unresolved.position.y)
    expect(service.targetPosition).toBe('top')
    expect(service.sourcePosition).toBe('bottom')
    expect(layout.nodes.map((node) => node.model.id).sort()).toEqual(
      graph.nodes.map((node) => node.id).sort(),
    )
  })
})
