import { describe, expect, it } from 'vitest'

import { analyzeManifest } from '@/domain/parser/analyze-manifest'

import { projectResourceForInspector } from './safe-inspector'

describe('safe resource inspector projection', () => {
  it('exposes sorted Secret keys without exposing data or stringData values', () => {
    const sentinel = 'never-project-this-secret-value'
    const analysis = analyzeManifest(`apiVersion: v1
kind: Secret
metadata:
  name: credentials
data:
  username: dXNlcg==
stringData:
  password: ${sentinel}
  username: replacement
`)
    const projection = projectResourceForInspector(analysis.resources[0]!)

    expect(projection).toEqual({
      secretValuePolicy: 'keys-only',
      secretDataKeys: ['password', 'username'],
    })
    expect(JSON.stringify(projection)).not.toContain(sentinel)
    expect(JSON.stringify(projection)).not.toContain('dXNlcg==')
    expect(JSON.stringify(projection)).not.toContain('replacement')
  })

  it('does not apply Secret policy to another kind or API group', () => {
    const analysis = analyzeManifest(`apiVersion: v1
kind: ConfigMap
metadata:
  name: settings
data:
  feature: enabled
`)

    expect(projectResourceForInspector(analysis.resources[0]!)).toEqual({
      secretValuePolicy: 'not-applicable',
      secretDataKeys: [],
    })
  })
})
