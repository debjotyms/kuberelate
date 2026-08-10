import { describe, expect, it } from 'vitest'

import { formatLabelMap, matchEqualitySelector } from './equality-selector'

describe('equality selector matching', () => {
  it('matches exact and subset selectors while allowing extra workload labels', () => {
    expect(matchEqualitySelector({ app: 'web' }, { app: 'web' })).toEqual({
      matches: true,
      comparisons: [{ key: 'app', expected: 'web', actual: 'web', state: 'match' }],
    })
    expect(matchEqualitySelector({ app: 'web' }, { app: 'web', tier: 'frontend' }).matches).toBe(
      true,
    )
    expect(matchEqualitySelector({}, { app: 'web' })).toEqual({ matches: true, comparisons: [] })
  })

  it('distinguishes missing keys from different values and sorts evidence by key', () => {
    expect(matchEqualitySelector({ tier: 'frontend', app: 'website' }, { app: 'web' })).toEqual({
      matches: false,
      comparisons: [
        { key: 'app', expected: 'website', actual: 'web', state: 'different-value' },
        { key: 'tier', expected: 'frontend', state: 'missing-key' },
      ],
    })
  })

  it('formats safe label evidence deterministically', () => {
    expect(formatLabelMap({ tier: 'frontend', app: 'web' })).toBe('app=web, tier=frontend')
    expect(formatLabelMap({})).toBe('no labels')
  })
})
