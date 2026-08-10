import { describe, expect, it } from 'vitest'

import {
  brokenServiceSelectorExample,
  workingServiceSelectorExample,
} from '@/content/examples/resource-inventory'
import { analyzeManifest } from '@/domain/parser/analyze-manifest'

import { buildRelationshipList, buildTopologyGraph } from './relationship-graph'

describe('relationship graph adapter', () => {
  it('creates a non-resource missing placeholder and keeps graph/list relationship parity', () => {
    const analysis = analyzeManifest(brokenServiceSelectorExample.source)
    const graph = buildTopologyGraph(
      analysis.resources,
      analysis.relationships,
      analysis.diagnostics,
    )
    const list = buildRelationshipList(graph)
    const service = analysis.resources.find((resource) => resource.kind === 'Service')!
    const deployment = analysis.resources.find((resource) => resource.kind === 'Deployment')!

    expect(graph.nodes).toHaveLength(4)
    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'resource',
          resourceId: service.id,
          status: 'warning',
        }),
        expect.objectContaining({
          type: 'resource',
          resourceId: deployment.id,
          status: 'ok',
        }),
        expect.objectContaining({
          type: 'unresolved',
          name: 'No matching workload',
          status: 'missing',
        }),
        expect.objectContaining({
          type: 'namespace',
          namespace: 'demo',
          memberCount: 2,
        }),
      ]),
    )
    expect(graph.edges[0]).toMatchObject({
      source: service.id,
      certainty: 'inferred',
      resolution: 'missing',
      label: 'selects · no supplied match',
    })
    expect(graph.edges.map((edge) => edge.relationshipId)).toEqual(list.map((item) => item.id))
    expect(list[0]).toMatchObject({ state: 'missing', target: undefined })
  })

  it('adapts a resolved target without a placeholder', () => {
    const analysis = analyzeManifest(workingServiceSelectorExample.source)
    const graph = buildTopologyGraph(
      analysis.resources,
      analysis.relationships,
      analysis.diagnostics,
    )
    const list = buildRelationshipList(graph)
    const relationship = analysis.relationships[0]!

    expect(graph.nodes).toHaveLength(3)
    expect(graph.edges[0]).toMatchObject({ resolution: 'resolved', label: 'selects · inferred' })
    expect(relationship.resolution.state).toBe('resolved')
    expect(list[0]).toMatchObject({
      state: 'resolved',
      target:
        relationship.resolution.state === 'resolved' ? relationship.resolution.target : undefined,
    })
  })

  it('carries explicit certainty through the generic edge and list presentation contracts', () => {
    const analysis = analyzeManifest(workingServiceSelectorExample.source)
    const explicitRelationship = { ...analysis.relationships[0]!, certainty: 'explicit' as const }
    const graph = buildTopologyGraph(
      analysis.resources,
      [explicitRelationship],
      analysis.diagnostics,
    )

    expect(graph.edges[0]).toMatchObject({
      certainty: 'explicit',
      verb: 'selects',
      label: 'selects · explicit',
    })
    expect(buildRelationshipList(graph)[0]).toMatchObject({
      certainty: 'explicit',
      verb: 'selects',
      state: 'resolved',
    })
  })
})
