import { matchEqualitySelector } from './equality-selector'
import { formatLabelMap } from './equality-selector'

export type SelectorOperator = 'In' | 'NotIn' | 'Exists' | 'DoesNotExist'

export interface LabelSelectorExpression {
  readonly key: string
  readonly operator: SelectorOperator
  readonly values: readonly string[]
}

export interface LabelSelector {
  readonly matchLabels: Readonly<Record<string, string>>
  readonly matchExpressions: readonly LabelSelectorExpression[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringMap(value: unknown): Readonly<Record<string, string>> | undefined {
  if (value === undefined) {
    return {}
  }

  if (!isRecord(value) || Object.values(value).some((entry) => typeof entry !== 'string')) {
    return undefined
  }

  return Object.freeze({ ...value } as Record<string, string>)
}

function expression(value: unknown): LabelSelectorExpression | undefined {
  if (!isRecord(value) || typeof value.key !== 'string') {
    return undefined
  }

  if (!['In', 'NotIn', 'Exists', 'DoesNotExist'].includes(String(value.operator))) {
    return undefined
  }

  const operator = value.operator as SelectorOperator
  const values = value.values === undefined ? [] : value.values

  if (!Array.isArray(values) || values.some((entry) => typeof entry !== 'string')) {
    return undefined
  }

  if ((operator === 'In' || operator === 'NotIn') && values.length === 0) {
    return undefined
  }

  return { key: value.key, operator, values }
}

export function parseLabelSelector(value: unknown): LabelSelector | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const matchLabels = stringMap(value.matchLabels)
  const rawExpressions = value.matchExpressions ?? []

  if (!matchLabels || !Array.isArray(rawExpressions)) {
    return undefined
  }

  const matchExpressions = rawExpressions.map(expression)

  if (matchExpressions.some((item) => item === undefined)) {
    return undefined
  }

  return {
    matchLabels,
    matchExpressions: matchExpressions as LabelSelectorExpression[],
  }
}

function matchesExpression(
  expression: LabelSelectorExpression,
  labels: Readonly<Record<string, string>>,
): boolean {
  const hasKey = Object.hasOwn(labels, expression.key)
  const value = labels[expression.key]

  switch (expression.operator) {
    case 'In':
      return hasKey && value !== undefined && expression.values.includes(value)
    case 'NotIn':
      return !hasKey || value === undefined || !expression.values.includes(value)
    case 'Exists':
      return hasKey
    case 'DoesNotExist':
      return !hasKey
  }
}

export function formatLabelSelector(selector: LabelSelector): string {
  const labels =
    Object.keys(selector.matchLabels).length > 0 ? [formatLabelMap(selector.matchLabels)] : []
  const expressions = selector.matchExpressions.map((item) => {
    if (item.operator === 'Exists') {
      return `${item.key} exists`
    }

    if (item.operator === 'DoesNotExist') {
      return `${item.key} does not exist`
    }

    return `${item.key} ${item.operator.toLowerCase()} (${item.values.join(', ')})`
  })

  return [...labels, ...expressions].join('; ') || 'empty selector'
}

export function matchesLabelSelector(
  selector: LabelSelector,
  labels: Readonly<Record<string, string>>,
): boolean {
  return (
    matchEqualitySelector(selector.matchLabels, labels).matches &&
    selector.matchExpressions.every((item) => matchesExpression(item, labels))
  )
}
