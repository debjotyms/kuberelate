'use client'

import dynamic from 'next/dynamic'
import { Component, type ReactNode } from 'react'

import type { TopologyGraph } from '@/graph/adapter/relationship-graph'

const LazyTopologyCanvas = dynamic(
  () => import('./topology-canvas').then((module) => module.TopologyCanvas),
  {
    ssr: false,
    loading: () => (
      <div aria-live="polite" className="topology-loading">
        Preparing interactive topology…
      </div>
    ),
  },
)

interface TopologyCanvasLoaderProps {
  readonly graph: TopologyGraph
}

interface TopologyErrorBoundaryProps extends TopologyCanvasLoaderProps {
  readonly children: ReactNode
}

interface TopologyErrorBoundaryState {
  readonly failed: boolean
}

class TopologyErrorBoundary extends Component<
  TopologyErrorBoundaryProps,
  TopologyErrorBoundaryState
> {
  public state: TopologyErrorBoundaryState = { failed: false }

  public static getDerivedStateFromError(): TopologyErrorBoundaryState {
    return { failed: true }
  }

  public componentDidUpdate(previousProps: TopologyErrorBoundaryProps): void {
    if (previousProps.graph !== this.props.graph && this.state.failed) {
      this.setState({ failed: false })
    }
  }

  public render(): ReactNode {
    if (this.state.failed) {
      return (
        <div className="topology-error" role="alert">
          <strong>The interactive map could not be displayed.</strong>
          <span>Switch to the relationship list above, or try loading the map again.</span>
          <button onClick={() => this.setState({ failed: false })} type="button">
            Try map again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export function TopologyCanvasLoader({ graph }: TopologyCanvasLoaderProps) {
  return (
    <TopologyErrorBoundary graph={graph}>
      <LazyTopologyCanvas graph={graph} />
    </TopologyErrorBoundary>
  )
}
