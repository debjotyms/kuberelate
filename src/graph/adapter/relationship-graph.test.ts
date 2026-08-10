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
    const list = buildRelationshipList(analysis.relationships)
    const service = analysis.resources.find((resource) => resource.kind === 'Service')!
    const deployment = analysis.resources.find((resource) => resource.kind === 'Deployment')!

    expect(graph.nodes).toHaveLength(3)
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
          type: 'missing',
          name: 'No matching workload',
          status: 'missing',
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
    const list = buildRelationshipList(analysis.relationships)

    expect(graph.nodes).toHaveLength(2)
    expect(graph.edges[0]).toMatchObject({ resolution: 'resolved', label: 'selects · inferred' })
    expect(list[0]).toMatchObject({ state: 'resolved', target: analysis.resources[0]?.id })
  })
})
