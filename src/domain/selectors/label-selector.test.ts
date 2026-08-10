import { describe, expect, it } from 'vitest'

import { formatLabelSelector, matchesLabelSelector, parseLabelSelector } from './label-selector'

describe('Kubernetes LabelSelector support', () => {
  it('parses matchLabels and every supported matchExpression operator', () => {
    const selector = parseLabelSelector({
      matchLabels: { app: 'web' },
      matchExpressions: [
        { key: 'track', operator: 'In', values: ['stable', 'canary'] },
        { key: 'environment', operator: 'NotIn', values: ['dev'] },
        { key: 'managed', operator: 'Exists' },
        { key: 'retired', operator: 'DoesNotExist' },
      ],
    })

    expect(selector).toBeDefined()
    expect(
      matchesLabelSelector(selector!, {
        app: 'web',
        track: 'stable',
        environment: 'prod',
        managed: '',
      }),
    ).toBe(true)
    expect(formatLabelSelector(selector!)).toBe(
      'app=web; track in (stable, canary); environment notin (dev); managed exists; retired does not exist',
    )
  })

  it('applies In, NotIn, Exists, and DoesNotExist semantics', () => {
    const inSelector = parseLabelSelector({
      matchExpressions: [{ key: 'track', operator: 'In', values: ['stable'] }],
    })!
    const notInSelector = parseLabelSelector({
      matchExpressions: [{ key: 'track', operator: 'NotIn', values: ['canary'] }],
    })!
    const existsSelector = parseLabelSelector({
      matchExpressions: [{ key: 'track', operator: 'Exists' }],
    })!
    const absentSelector = parseLabelSelector({
      matchExpressions: [{ key: 'track', operator: 'DoesNotExist' }],
    })!

    expect(matchesLabelSelector(inSelector, {})).toBe(false)
    expect(matchesLabelSelector(inSelector, { track: 'canary' })).toBe(false)
    expect(matchesLabelSelector(notInSelector, {})).toBe(true)
    expect(matchesLabelSelector(notInSelector, { track: 'canary' })).toBe(false)
    expect(matchesLabelSelector(existsSelector, { track: '' })).toBe(true)
    expect(matchesLabelSelector(existsSelector, {})).toBe(false)
    expect(matchesLabelSelector(absentSelector, {})).toBe(true)
    expect(matchesLabelSelector(absentSelector, { track: 'stable' })).toBe(false)
  })

  it('rejects malformed selector projections instead of guessing', () => {
    expect(parseLabelSelector(undefined)).toBeUndefined()
    expect(parseLabelSelector({ matchLabels: { app: 42 } })).toBeUndefined()
    expect(parseLabelSelector({ matchExpressions: {} })).toBeUndefined()
    expect(
      parseLabelSelector({ matchExpressions: [{ key: 42, operator: 'Exists' }] }),
    ).toBeUndefined()
    expect(
      parseLabelSelector({ matchExpressions: [{ key: 'app', operator: 'Unknown' }] }),
    ).toBeUndefined()
    expect(
      parseLabelSelector({ matchExpressions: [{ key: 'app', operator: 'In', values: [] }] }),
    ).toBeUndefined()
    expect(
      parseLabelSelector({
        matchExpressions: [{ key: 'app', operator: 'Exists', values: [42] }],
      }),
    ).toBeUndefined()
    expect(formatLabelSelector({ matchLabels: {}, matchExpressions: [] })).toBe('empty selector')
  })
})
