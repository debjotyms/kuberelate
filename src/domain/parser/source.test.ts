import { describe, expect, it } from 'vitest'
import { LineCounter, parseDocument, type Node } from 'yaml'

import { findNodeAtPath, toSourceRange } from './source'

function parse(source: string): { root: Node | null; lineCounter: LineCounter } {
  const lineCounter = new LineCounter()
  const document = parseDocument<Node>(source, { lineCounter })

  return { root: document.contents, lineCounter }
}

describe('source mapping helpers', () => {
  it('converts offsets to one-based line and column positions', () => {
    const { lineCounter } = parse('first\nsecond\n')

    expect(toSourceRange([6, 12, 12], lineCounter)).toEqual({
      start: { offset: 6, line: 2, column: 1 },
      end: { offset: 12, line: 2, column: 7 },
    })
    expect(toSourceRange(undefined, lineCounter)).toBeUndefined()
  })

  it('walks mapping and sequence nodes without assuming their shape', () => {
    const { root } = parse(`items:
  - metadata:
      name: demo
numeric:
  1: one
complex:
  ? [not, scalar]
  : ignored
`)

    expect(findNodeAtPath(root, ['items', 0, 'metadata', 'name'])?.toJS).toBeTypeOf('function')
    expect(findNodeAtPath(root, ['numeric', '1'])).toBeDefined()
    expect(findNodeAtPath(root, ['items', 2])).toBeUndefined()
    expect(findNodeAtPath(root, ['items', 'name'])).toBeUndefined()
    expect(findNodeAtPath(root, ['numeric', 0])).toBeUndefined()
    expect(findNodeAtPath(root, ['complex', 'missing'])).toBeUndefined()
    expect(findNodeAtPath(null, ['anything'])).toBeUndefined()
  })
})
