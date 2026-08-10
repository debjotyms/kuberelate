'use client'

import {
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  getSmoothStepPath,
  useNodesInitialized,
  useReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'

import type {
  NamespaceTopologyNode,
  ResourceTopologyNode,
  TopologyEdge,
  TopologyGraph,
  TopologyNodeStatus,
  UnresolvedTopologyNode,
} from '@/graph/adapter/relationship-graph'
import { layoutTopologyGraph } from '@/graph/layout/dagre-layout'
import {
  selectGraphDirection,
  selectIsFullscreen,
  selectSelectedDiagnosticId,
  selectSelectedRelationshipId,
  selectSelectedResourceId,
  selectTopologyFocusRequest,
  useWorkbenchStore,
} from '@/store/workbench-store'

interface TopologyCanvasProps {
  readonly graph: TopologyGraph
}

type ResourceFlowNode = Node<{ model: ResourceTopologyNode }, 'resource'>
type UnresolvedFlowNode = Node<{ model: UnresolvedTopologyNode }, 'unresolved'>
type NamespaceFlowNode = Node<{ model: NamespaceTopologyNode }, 'namespace'>
type TopologyFlowNode = ResourceFlowNode | UnresolvedFlowNode | NamespaceFlowNode
type RelationshipFlowEdge = Edge<{ model: TopologyEdge }, 'relationship'>

const positionByHandle = {
  bottom: Position.Bottom,
  left: Position.Left,
  right: Position.Right,
  top: Position.Top,
} as const

function statusPresentation(status: TopologyNodeStatus): { icon: string; label: string } {
  switch (status) {
    case 'error':
      return { icon: '×', label: 'Error' }
    case 'warning':
      return { icon: '!', label: 'Warning' }
    case 'info':
      return { icon: 'i', label: 'Information' }
    case 'missing':
      return { icon: '?', label: 'Unresolved' }
    case 'ok':
      return { icon: '✓', label: 'No detected issues' }
  }
}

function ResourceNode({
  data,
  selected,
  sourcePosition,
  targetPosition,
}: NodeProps<ResourceFlowNode>) {
  const status = statusPresentation(data.model.status)

  return (
    <article
      aria-hidden="true"
      className={`topology-node topology-node-${data.model.status}`}
      data-selected={selected || undefined}
      data-topology-node={data.model.resourceId}
    >
      <Handle
        className="topology-handle"
        isConnectable={false}
        position={targetPosition ?? Position.Left}
        type="target"
      />
      <span className="topology-node-kind">{data.model.kind}</span>
      <strong>{data.model.name}</strong>
      <span className="topology-node-scope">{data.model.scope}</span>
      <span className="topology-node-status">
        <span>{status.icon}</span> {status.label} · {data.model.connectionCount}{' '}
        {data.model.connectionCount === 1 ? 'connection' : 'connections'}
      </span>
      <Handle
        className="topology-handle"
        isConnectable={false}
        position={sourcePosition ?? Position.Right}
        type="source"
      />
    </article>
  )
}

function UnresolvedNode({
  data,
  selected,
  sourcePosition,
  targetPosition,
}: NodeProps<UnresolvedFlowNode>) {
  return (
    <article
      aria-hidden="true"
      className="topology-node topology-node-unresolved"
      data-selected={selected || undefined}
      data-relationship-id={data.model.relationshipId}
    >
      <Handle
        className="topology-handle"
        isConnectable={false}
        position={targetPosition ?? Position.Left}
        type="target"
      />
      <span className="topology-node-kind">Unresolved target</span>
      <strong>{data.model.name}</strong>
      <span className="topology-node-scope">{data.model.description}</span>
      <Handle
        className="topology-handle"
        isConnectable={false}
        position={sourcePosition ?? Position.Right}
        type="source"
      />
    </article>
  )
}

function NamespaceNode({ data }: NodeProps<NamespaceFlowNode>) {
  return (
    <article
      aria-hidden="true"
      className={`topology-namespace topology-namespace-${data.model.scopeType}`}
    >
      <span>{data.model.scopeType === 'namespaced' ? 'Namespace' : 'Scope'}</span>
      <strong>{data.model.namespace}</strong>
      <small>
        {data.model.memberCount} {data.model.memberCount === 1 ? 'resource' : 'resources'}
      </small>
    </article>
  )
}

function RelationshipEdge({
  data,
  id,
  markerEnd,
  selected,
  sourcePosition,
  sourceX,
  sourceY,
  targetPosition,
  targetX,
  targetY,
}: EdgeProps<RelationshipFlowEdge>) {
  if (!data) {
    return null
  }

  const [path, labelX, labelY] = getSmoothStepPath({
    sourcePosition,
    sourceX,
    sourceY,
    targetPosition,
    targetX,
    targetY,
    borderRadius: 12,
  })
  const missing = data.model.resolution === 'missing'

  return (
    <>
      <BaseEdge
        className={`topology-flow-edge topology-flow-edge-${data.model.certainty} topology-flow-edge-${data.model.resolution}`}
        data-relationship-id={data.model.relationshipId}
        id={id}
        interactionWidth={24}
        markerEnd={markerEnd}
        path={path}
        style={{
          stroke: missing ? 'var(--kg-warning)' : 'var(--kg-brand-strong)',
          strokeDasharray: missing || data.model.certainty === 'inferred' ? '7 5' : undefined,
          strokeWidth: selected ? 3 : 2,
        }}
      />
      <EdgeLabelRenderer>
        <span
          aria-hidden="true"
          className={`topology-edge-label topology-edge-label-${data.model.resolution}`}
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
        >
          {data.model.label}
        </span>
      </EdgeLabelRenderer>
    </>
  )
}

const nodeTypes = {
  namespace: NamespaceNode,
  resource: ResourceNode,
  unresolved: UnresolvedNode,
}

const edgeTypes = {
  relationship: RelationshipEdge,
}

function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => setReducedMotion(preference.matches)
    updatePreference()
    preference.addEventListener('change', updatePreference)

    return () => preference.removeEventListener('change', updatePreference)
  }, [])

  return reducedMotion
}

function TopologyCanvasInner({ graph }: TopologyCanvasProps) {
  const direction = useWorkbenchStore(selectGraphDirection)
  const selectedResourceId = useWorkbenchStore(selectSelectedResourceId)
  const selectedRelationshipId = useWorkbenchStore(selectSelectedRelationshipId)
  const selectedDiagnosticId = useWorkbenchStore(selectSelectedDiagnosticId)
  const focusRequest = useWorkbenchStore(selectTopologyFocusRequest)
  const inspectResource = useWorkbenchStore((state) => state.inspectResource)
  const inspectRelationship = useWorkbenchStore((state) => state.inspectRelationship)
  const clearSelection = useWorkbenchStore((state) => state.clearSelection)
  const setGraphDirection = useWorkbenchStore((state) => state.setGraphDirection)
  const canvasRef = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()
  const nodesInitialized = useNodesInitialized()
  const { fitView, getNode } = useReactFlow<TopologyFlowNode, RelationshipFlowEdge>()

  const highlightedNodeIds = useMemo(() => {
    const ids = new Set<string>()

    if (selectedResourceId) {
      ids.add(selectedResourceId)
    }

    if (selectedRelationshipId) {
      const edge = graph.edges.find((item) => item.relationshipId === selectedRelationshipId)
      if (edge) {
        ids.add(edge.source)
        ids.add(edge.target)
      }
    }

    if (selectedDiagnosticId) {
      for (const node of graph.nodes) {
        if (node.type === 'resource' && node.diagnosticIds.includes(selectedDiagnosticId)) {
          ids.add(node.id)
        }
      }
    }

    return ids
  }, [graph, selectedDiagnosticId, selectedRelationshipId, selectedResourceId])

  const layout = useMemo(() => layoutTopologyGraph(graph, direction), [direction, graph])
  const nodes = useMemo<TopologyFlowNode[]>(
    () =>
      layout.nodes.map((item) => {
        const common = {
          id: item.model.id,
          position: item.position,
          width: item.width,
          height: item.height,
          sourcePosition: positionByHandle[item.sourcePosition],
          targetPosition: positionByHandle[item.targetPosition],
          draggable: false,
          connectable: false,
          deletable: false,
          focusable: true,
          selected: highlightedNodeIds.has(item.model.id),
        }

        switch (item.model.type) {
          case 'resource':
            return {
              ...common,
              type: 'resource',
              data: { model: item.model },
              ariaLabel: `${item.model.ariaLabel} Press Enter or Space to inspect this resource.`,
            }
          case 'unresolved':
            return {
              ...common,
              type: 'unresolved',
              data: { model: item.model },
              ariaLabel: `${item.model.ariaLabel} Press Enter or Space to inspect this relationship.`,
            }
          case 'namespace':
            return {
              ...common,
              type: 'namespace',
              data: { model: item.model },
              ariaLabel: item.model.ariaLabel,
              selectable: false,
              selected: false,
            }
        }
      }),
    [highlightedNodeIds, layout.nodes],
  )
  const edges = useMemo<RelationshipFlowEdge[]>(
    () =>
      layout.edges.map((model) => ({
        id: model.id,
        source: model.source,
        target: model.target,
        type: 'relationship',
        data: { model },
        ariaLabel: `${model.ariaLabel} Press Enter or Space to inspect this relationship.`,
        deletable: false,
        focusable: true,
        selectable: true,
        selected: selectedRelationshipId === model.relationshipId,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: model.resolution === 'missing' ? 'var(--kg-warning)' : 'var(--kg-brand-strong)',
          width: 18,
          height: 18,
        },
      })),
    [layout.edges, selectedRelationshipId],
  )
  const graphSignature = useMemo(
    () =>
      `${graph.nodes.map((node) => node.id).join('|')}::${graph.edges.map((edge) => edge.id).join('|')}`,
    [graph],
  )

  const focusNodes = useCallback(
    (nodeIds: readonly string[]) => {
      const focusTarget = [
        ...(canvasRef.current?.querySelectorAll<HTMLElement>('.react-flow__node') ?? []),
      ].find((element) => element.dataset.id === nodeIds[0])
      focusTarget?.focus()

      const visibleNodes = nodeIds
        .map((id) => getNode(id))
        .filter((node): node is NonNullable<typeof node> => Boolean(node))

      if (visibleNodes.length === 0) {
        return
      }

      void fitView({
        nodes: visibleNodes,
        padding: 0.2,
        maxZoom: 1.25,
        duration: reducedMotion ? 0 : 220,
      })
    },
    [fitView, getNode, reducedMotion],
  )

  const isFullscreen = useWorkbenchStore(selectIsFullscreen)
  const toggleFullscreen = useWorkbenchStore((state) => state.toggleFullscreen)

  useEffect(() => {
    if (!nodesInitialized) {
      return
    }

    const timer = setTimeout(() => {
      void fitView({ padding: 0.08, maxZoom: 1.05, duration: reducedMotion ? 0 : 180 })
    }, 50)

    return () => clearTimeout(timer)
  }, [direction, fitView, graphSignature, isFullscreen, nodesInitialized, reducedMotion])

  useEffect(() => {
    if (focusRequest) {
      focusNodes([focusRequest.resourceId])
    }
  }, [focusNodes, focusRequest])

  const selectedNodeIds = useMemo(() => [...highlightedNodeIds], [highlightedNodeIds])

  function activateFromKeyboard(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }

    const element = event.target instanceof Element ? event.target : undefined
    const nodeElement = element?.closest<HTMLElement>('.react-flow__node')
    const edgeElement = element?.closest<SVGGElement>('.react-flow__edge')
    const model = graph.nodes.find((node) => node.id === nodeElement?.dataset.id)

    if (model?.type === 'resource') {
      event.preventDefault()
      event.stopPropagation()
      inspectResource(model.resourceId)
    } else if (model?.type === 'unresolved') {
      event.preventDefault()
      event.stopPropagation()
      inspectRelationship(model.relationshipId)
    } else if (edgeElement?.dataset.id) {
      const edge = graph.edges.find((item) => item.id === edgeElement.dataset.id)
      if (!edge) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      inspectRelationship(edge.relationshipId)
    }
  }

  return (
    <div
      aria-label="Relationship topology map"
      className="topology-canvas"
      data-graph-direction={direction}
      onKeyDownCapture={activateFromKeyboard}
      ref={canvasRef}
    >
      <ReactFlow<TopologyFlowNode, RelationshipFlowEdge>
        ariaLabelConfig={{
          'edge.a11yDescription.default': 'Press Enter or Space to inspect this relationship.',
          'node.a11yDescription.default': 'Press Enter or Space to inspect this topology item.',
          'node.a11yDescription.keyboardDisabled': 'This topology item cannot be moved.',
        }}
        autoPanOnNodeFocus
        colorMode="system"
        deleteKeyCode={null}
        edgeTypes={edgeTypes}
        edges={edges}
        edgesFocusable
        fitView
        fitViewOptions={{ padding: 0.08, maxZoom: 1.05 }}
        maxZoom={1.8}
        minZoom={0.25}
        multiSelectionKeyCode={null}
        nodeTypes={nodeTypes}
        nodes={nodes}
        nodesConnectable={false}
        nodesDraggable={false}
        nodesFocusable
        onEdgeClick={(_, edge) => inspectRelationship(edge.data!.model.relationshipId)}
        onNodeClick={(_, node) => {
          if (node.type === 'resource') {
            inspectResource(node.data.model.resourceId)
          } else if (node.type === 'unresolved') {
            inspectRelationship(node.data.model.relationshipId)
          }
        }}
        onPaneClick={clearSelection}
        proOptions={{ hideAttribution: true }}
        selectionKeyCode={null}
      >
        <Controls position="bottom-left" showInteractive={false} />
        <Panel className="topology-canvas-panel" position="top-right">
          <div aria-label="Graph direction" className="graph-direction" role="group">
            <button
              aria-label="Lay out graph left to right"
              aria-pressed={direction === 'LR'}
              onClick={() => setGraphDirection('LR')}
              type="button"
            >
              Left → right
            </button>
            <button
              aria-label="Lay out graph top to bottom"
              aria-pressed={direction === 'TB'}
              onClick={() => setGraphDirection('TB')}
              type="button"
            >
              Top → bottom
            </button>
          </div>
          <button
            className="focus-selected-button"
            disabled={selectedNodeIds.length === 0}
            onClick={() => focusNodes(selectedNodeIds)}
            type="button"
          >
            Focus selected
          </button>
          <button
            aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
            className="focus-selected-button"
            onClick={() => toggleFullscreen()}
            type="button"
          >
            {isFullscreen ? 'Exit full screen' : 'Full screen'}
          </button>
        </Panel>
      </ReactFlow>
    </div>
  )
}

export function TopologyCanvas({ graph }: TopologyCanvasProps) {
  if (graph.nodes.length === 0) {
    return <p className="topology-empty">No resources are available to map.</p>
  }

  return (
    <ReactFlowProvider>
      <TopologyCanvasInner graph={graph} />
    </ReactFlowProvider>
  )
}
