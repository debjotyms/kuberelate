import type { EqualitySelectorMatchResult } from '@/domain/model/analysis'

export function formatLabelMap(labels: Readonly<Record<string, string>>): string {
  const entries = Object.entries(labels).sort(([left], [right]) => left.localeCompare(right))

  return entries.length > 0
    ? entries.map(([key, value]) => `${key}=${value}`).join(', ')
    : 'no labels'
}

export function matchEqualitySelector(
  selector: Readonly<Record<string, string>>,
  labels: Readonly<Record<string, string>>,
): EqualitySelectorMatchResult {
  const comparisons = Object.entries(selector)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, expected]) => {
      if (!Object.hasOwn(labels, key)) {
        return { key, expected, state: 'missing-key' as const }
      }

      const actual = labels[key]

      return actual === expected
        ? { key, expected, actual, state: 'match' as const }
        : { key, expected, actual, state: 'different-value' as const }
    })

  return {
    matches: comparisons.every((comparison) => comparison.state === 'match'),
    comparisons,
  }
}
