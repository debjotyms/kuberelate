import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

const storageValues = new Map<string, string>()
const memoryStorage: Storage = {
  get length() {
    return storageValues.size
  },
  clear: () => storageValues.clear(),
  getItem: (key) => storageValues.get(key) ?? null,
  key: (index) => [...storageValues.keys()][index] ?? null,
  removeItem: (key) => storageValues.delete(key),
  setItem: (key, value) => storageValues.set(key, value),
}

Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: memoryStorage,
})

class TestResizeObserver implements ResizeObserver {
  public constructor(private readonly callback: ResizeObserverCallback) {}

  public disconnect(): void {}

  public observe(target: Element): void {
    const rect = target.getBoundingClientRect()
    const entry = {
      target,
      contentRect: rect,
      borderBoxSize: [],
      contentBoxSize: [],
      devicePixelContentBoxSize: [],
    } as unknown as ResizeObserverEntry

    queueMicrotask(() => this.callback([entry], this))
  }

  public unobserve(): void {}
}

Object.defineProperty(globalThis, 'ResizeObserver', {
  configurable: true,
  value: TestResizeObserver,
})

class TestDOMMatrixReadOnly {
  public readonly m22 = 1
}

Object.defineProperty(window, 'DOMMatrixReadOnly', {
  configurable: true,
  value: TestDOMMatrixReadOnly,
})

Object.defineProperties(HTMLElement.prototype, {
  offsetWidth: {
    configurable: true,
    get(): number {
      const inlineWidth = Number.parseFloat(this.style.width)
      return Number.isFinite(inlineWidth)
        ? inlineWidth
        : this.classList.contains('react-flow') || this.classList.contains('topology-canvas')
          ? 800
          : 0
    },
  },
  offsetHeight: {
    configurable: true,
    get(): number {
      const inlineHeight = Number.parseFloat(this.style.height)
      return Number.isFinite(inlineHeight)
        ? inlineHeight
        : this.classList.contains('react-flow') || this.classList.contains('topology-canvas')
          ? 480
          : 0
    },
  },
})

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  value: (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => true,
  }),
})

if (!Range.prototype.getClientRects) {
  Object.defineProperty(Range.prototype, 'getClientRects', {
    value: () => [],
  })
}

afterEach(async () => {
  cleanup()
  const { useWorkbenchStore } = await import('@/store/workbench-store')
  useWorkbenchStore.setState({
    topologyView: 'map',
    graphDirection: 'LR',
    selectedResourceId: undefined,
    selectedRelationshipId: undefined,
    selectedDiagnosticId: undefined,
    topologyFocusRequest: undefined,
    inspectorFocusToken: 0,
  })
  memoryStorage.clear()
})
