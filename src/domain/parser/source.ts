import { isMap, isNode, isScalar, isSeq, type Node, type Range } from 'yaml'
import type { LineCounter } from 'yaml'

import type { SourceRange } from '@/domain/model/analysis'

export function toSourceRange(
  range: Range | null | undefined,
  lineCounter: LineCounter,
): SourceRange | undefined {
  if (!range) {
    return undefined
  }

  const start = lineCounter.linePos(range[0])
  const end = lineCounter.linePos(range[1])

  return {
    start: { offset: range[0], line: start.line, column: start.col },
    end: { offset: range[1], line: end.line, column: end.col },
  }
}

function scalarKey(node: unknown): string | undefined {
  if (!isScalar(node)) {
    return undefined
  }

  return typeof node.value === 'string' ? node.value : String(node.value)
}

export function findNodeAtPath(
  root: Node | null,
  path: readonly (string | number)[],
): Node | undefined {
  let current: Node | undefined = root ?? undefined

  for (const segment of path) {
    if (typeof segment === 'number') {
      if (!current || !isSeq(current)) {
        return undefined
      }

      const item = current.items[segment]
      current = isNode(item) ? item : undefined
      continue
    }

    if (!current || !isMap(current)) {
      return undefined
    }

    const pair = current.items.find((item) => scalarKey(item.key) === segment)
    current = pair && isNode(pair.value) ? pair.value : undefined
  }

  return current
}
