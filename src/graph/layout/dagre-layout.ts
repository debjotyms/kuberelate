import dagre from '@dagrejs/dagre'

import type { TopologyEdge, TopologyGraph, TopologyNode } from '@/graph/adapter/relationship-graph'

export type GraphDirection = 'LR' | 'TB'

export type LayoutHandlePosition = 'left' | 'right' | 'top' | 'bottom'

export interface PositionedTopologyNode {
  readonly model: TopologyNode
  readonly position: { readonly x: number; readonly y: number }
  readonly width: number
  readonly height: number
  readonly targetPosition: LayoutHandlePosition
  readonly sourcePosition: LayoutHandlePosition
}

export interface PositionedTopologyGraph {
  readonly nodes: readonly PositionedTopologyNode[]
  readonly edges: readonly TopologyEdge[]
  readonly direction: GraphDirection
}

const dimensions: Readonly<
  Record<TopologyNode['type'], { readonly width: number; readonly height: number }>
> = {
  namespace: { width: 190, height: 76 },
  resource: { width: 220, height: 128 },
  unresolved: { width: 220, height: 104 },
}

export function topologyNodeDimensions(node: TopologyNode): {
  readonly width: number
  readonly height: number
} {
  return { ...dimensions[node.type] }
}

function addLayoutEdges(
  graph: InstanceType<typeof dagre.graphlib.Graph>,
  topology: TopologyGraph,
): void {
  const relationships = [...topology.edges].sort((left, right) => left.id.localeCompare(right.id))

  for (const edge of relationships) {
    graph.setEdge(edge.source, edge.target)
  }

  const resources = topology.nodes
    .filter((node) => node.type === 'resource')
    .sort((left, right) => left.id.localeCompare(right.id))

  for (const resource of resources) {
    graph.setEdge(resource.namespaceNodeId, resource.id, { presentation: 'namespace-membership' })
  }
}

export function layoutTopologyGraph(
  topology: TopologyGraph,
  direction: GraphDirection = 'LR',
): PositionedTopologyGraph {
  const graph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
  const horizontal = direction === 'LR'
  graph.setGraph({
    rankdir: direction,
    ranksep: horizontal ? 90 : 72,
    nodesep: 44,
    edgesep: 24,
    marginx: 32,
    marginy: 32,
  })

  for (const node of [...topology.nodes].sort((left, right) => left.id.localeCompare(right.id))) {
    graph.setNode(node.id, topologyNodeDimensions(node))
  }

  addLayoutEdges(graph, topology)
  dagre.layout(graph)

  const positionedNodes = topology.nodes.map((node) => {
    const position = graph.node(node.id) as { x: number; y: number }
    const size = topologyNodeDimensions(node)

    return {
      model: node,
      position: {
        x: position.x - size.width / 2,
        y: position.y - size.height / 2,
      },
      ...size,
      targetPosition: horizontal ? ('left' as const) : ('top' as const),
      sourcePosition: horizontal ? ('right' as const) : ('bottom' as const),
    }
  })

  return { nodes: positionedNodes, edges: topology.edges, direction }
}
