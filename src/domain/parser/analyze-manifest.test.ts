import { describe, expect, it } from 'vitest'

import { analyzeManifest } from './analyze-manifest'

const deployment = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: demo
  labels:
    app: web
`

const service = `apiVersion: v1
kind: Service
metadata:
  name: web
`

describe('analyzeManifest', () => {
  it('treats blank input and empty YAML documents as an intentional empty state', () => {
    expect(analyzeManifest('')).toMatchObject({
      status: 'empty',
      summary: { resources: 0, errors: 0, warnings: 0, documents: 0 },
    })

    expect(analyzeManifest('# comment\n---\n...\n---\n')).toMatchObject({
      status: 'empty',
      summary: { resources: 0, errors: 0, warnings: 0 },
    })
  })

  it('parses multi-document YAML with stable source-aware core and grouped identities', () => {
    const source = `${deployment}---\n${service}`
    const first = analyzeManifest(source)
    const second = analyzeManifest(source)

    expect(first.status).toBe('valid')
    expect(first.summary).toMatchObject({ resources: 2, errors: 0, documents: 2 })
    expect(first.resources.map((resource) => resource.id)).toEqual(
      second.resources.map((resource) => resource.id),
    )

    expect(first.resources[0]).toMatchObject({
      apiVersion: 'apps/v1',
      version: 'v1',
      kind: 'Deployment',
      name: 'web',
      identity: {
        apiGroup: 'apps',
        scope: { type: 'namespaced', namespace: 'demo' },
      },
      labels: { app: 'web' },
      support: 'partial',
      source: { documentIndex: 0 },
    })
    expect(first.resources[0]?.source.fieldRanges.get('metadata.name')).toMatchObject({
      start: { line: 4, column: 9 },
    })
    expect(first.resources[1]).toMatchObject({
      version: 'v1',
      identity: {
        apiGroup: '',
        scope: { type: 'namespaced', namespace: 'default' },
      },
      source: { documentIndex: 1 },
    })
    expect(first.index.sourceOrder).toEqual(first.resources.map((resource) => resource.id))
    expect(first.index.byNamespace.get('demo')).toEqual([first.resources[0]?.id])
    expect(first.index.byNamespace.get('default')).toEqual([first.resources[1]?.id])
  })

  it('keeps valid neighboring documents when another document is malformed', () => {
    const source = `${service}---\napiVersion: v1\nkind: ConfigMap\nmetadata: [\n---\n${deployment}`
    const result = analyzeManifest(source)

    expect(result.status).toBe('partial')
    expect(result.resources.map((resource) => resource.kind)).toEqual(['Service', 'Deployment'])
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          category: 'parser',
          documentIndex: 1,
          range: expect.objectContaining({ start: expect.objectContaining({ line: 9 }) }),
        }),
      ]),
    )
  })

  it.each([
    ['a missing apiVersion', 'kind: Pod\nmetadata:\n  name: demo\n'],
    ['a non-string name', 'apiVersion: v1\nkind: Pod\nmetadata:\n  name: 42\n'],
    ['an empty kind', 'apiVersion: v1\nkind: ""\nmetadata:\n  name: demo\n'],
    [
      'an invalid grouped apiVersion',
      'apiVersion: apps/v1/extra\nkind: Pod\nmetadata:\n  name: demo\n',
    ],
  ])('diagnoses %s without throwing', (_label, source) => {
    const result = analyzeManifest(source)

    expect(result.status).toBe('invalid')
    expect(result.resources).toHaveLength(0)
    expect(result.diagnostics[0]).toMatchObject({
      code: 'KG-RESOURCE-001',
      severity: 'error',
    })
  })

  it('distinguishes explicit/default namespaces, cluster scope, and invalid cluster namespaces', () => {
    const source = `${service}---
apiVersion: v1
kind: Pod
metadata:
  name: worker
  namespace: jobs
---
apiVersion: v1
kind: Namespace
metadata:
  name: demo
  namespace: should-not-be-here
`
    const result = analyzeManifest(source)

    expect(result.resources.map((resource) => resource.identity.scope)).toEqual([
      { type: 'namespaced', namespace: 'default' },
      { type: 'namespaced', namespace: 'jobs' },
      { type: 'cluster' },
    ])
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'KG-RESOURCE-002',
          severity: 'warning',
          range: expect.objectContaining({ start: expect.objectContaining({ line: 16 }) }),
        }),
      ]),
    )
    expect(result.index.byNamespace.get('@cluster')).toEqual([result.resources[2]?.id])
  })

  it('keeps same-name resources in different namespaces distinct', () => {
    const source = `${service}---
apiVersion: v1
kind: Service
metadata:
  name: web
  namespace: other
`
    const result = analyzeManifest(source)

    expect(result.status).toBe('valid')
    expect(result.resources[0]?.key).not.toBe(result.resources[1]?.key)
    expect(result.diagnostics).toHaveLength(0)
  })

  it('preserves duplicate occurrences and diagnoses their canonical identity', () => {
    const result = analyzeManifest(`${service}---\n${service}`)

    expect(result.status).toBe('partial')
    expect(result.resources).toHaveLength(2)
    expect(result.resources[0]?.key).toBe(result.resources[1]?.key)
    expect(result.resources[0]?.id).not.toBe(result.resources[1]?.id)
    expect(result.index.byKey.get(result.resources[0]!.key)).toHaveLength(2)
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: 'KG-RESOURCE-003',
        resourceIds: [result.resources[0]?.id, result.resources[1]?.id],
      }),
    ])
  })

  it('keeps YAML duplicate-key validation strict', () => {
    const result = analyzeManifest(`apiVersion: v1
kind: ConfigMap
metadata:
  name: first
  name: second
`)

    expect(result.status).toBe('invalid')
    expect(result.resources).toHaveLength(0)
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: 'KG-YAML-DUPLICATE_KEY', severity: 'error' }),
    ])
  })

  it('expands Kubernetes List items and keeps item source locations', () => {
    const source = `apiVersion: v1
kind: List
items:
  - apiVersion: v1
    kind: ConfigMap
    metadata:
      name: settings
  - apiVersion: apps/v1
    kind: Deployment
    metadata:
      name: web
`
    const result = analyzeManifest(source)

    expect(result.status).toBe('valid')
    expect(result.resources).toHaveLength(2)
    expect(result.resources[0]).toMatchObject({
      kind: 'ConfigMap',
      source: {
        documentIndex: 0,
        listItemIndex: 0,
        range: { start: { line: 4 } },
      },
    })
    expect(result.resources[1]).toMatchObject({
      kind: 'Deployment',
      source: { listItemIndex: 1, range: { start: { line: 8 } } },
    })
  })

  it('keeps unknown custom resources generic without guessing their scope', () => {
    const source = `apiVersion: widgets.example.io/v1alpha1
kind: Widget
metadata:
  name: example
  namespace: demo
`
    const result = analyzeManifest(source)

    expect(result.status).toBe('valid')
    expect(result.resources[0]).toMatchObject({
      support: 'generic',
      identity: {
        apiGroup: 'widgets.example.io',
        scope: { type: 'unknown', declaredNamespace: 'demo' },
      },
    })

    const withoutNamespace = analyzeManifest(`apiVersion: widgets.example.io/v1
kind: Widget
metadata:
  name: cluster-or-namespaced
`)
    expect(withoutNamespace.resources[0]?.identity.scope).toEqual({ type: 'unknown' })
  })

  it('diagnoses a Kubernetes List without an items array', () => {
    const result = analyzeManifest('apiVersion: v1\nkind: List\nitems: nope\n')

    expect(result.status).toBe('invalid')
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: 'KG-RESOURCE-004', severity: 'error' }),
    ])
  })

  it('supports bounded aliases and reports excessive expansion as a recoverable parser error', () => {
    const source = `apiVersion: v1
kind: ConfigMap
metadata: &metadata
  name: settings
data:
  first: *metadata
  second: *metadata
  third: *metadata
`

    expect(analyzeManifest(source).status).toBe('valid')

    const limited = analyzeManifest(source, { maxAliasCount: 1 })
    expect(limited.status).toBe('invalid')
    expect(limited.diagnostics).toEqual([
      expect.objectContaining({ code: 'KG-YAML-ALIAS_LIMIT', severity: 'error' }),
    ])
  })

  it('reports template-like unsupported input without throwing', () => {
    const result = analyzeManifest(`apiVersion: v1
kind: Service
metadata:
  name: {{ .Values.name }}
`)

    expect(['invalid', 'partial']).toContain(result.status)
    expect(result.diagnostics.some((item) => item.category === 'parser')).toBe(true)

    const literalTemplate = analyzeManifest(`apiVersion: v1
kind: ConfigMap
metadata:
  name: template-source
data:
  inline: "{{ .Values.name }}"
  block: |
    {{- if .Values.enabled }}
    enabled
    {{- end }}
`)
    expect(literalTemplate.status).toBe('valid')
    expect(literalTemplate.diagnostics).toHaveLength(0)
  })

  it('enforces source, document, and normalized-resource limits while preserving recoverable output', () => {
    const oversized = analyzeManifest(service, { maxSourceBytes: 8 })
    expect(oversized).toMatchObject({
      status: 'limited',
      summary: { resources: 0, errors: 1 },
      diagnostics: [expect.objectContaining({ code: 'KG-LIMIT-001' })],
    })

    const documentLimited = analyzeManifest(`${service}---\n${deployment}`, { maxDocuments: 1 })
    expect(documentLimited).toMatchObject({
      status: 'limited',
      summary: { resources: 1, documents: 2, analyzedDocuments: 1 },
    })
    expect(documentLimited.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'KG-LIMIT-002' })]),
    )

    const list = `apiVersion: v1
kind: List
items:
  - ${service.replaceAll('\n', '\n    ').trim()}
  - ${deployment.replaceAll('\n', '\n    ').trim()}
`
    const resourceLimited = analyzeManifest(list, { maxResources: 1 })
    expect(resourceLimited).toMatchObject({
      status: 'limited',
      summary: { resources: 1 },
      diagnostics: [expect.objectContaining({ code: 'KG-LIMIT-003' })],
    })

    const invalidFirst = analyzeManifest(
      `apiVersion: v1
kind: List
items:
  - nope
  - apiVersion: v1
    kind: Service
    metadata:
      name: omitted
`,
      { maxResources: 1 },
    )
    expect(invalidFirst.status).toBe('limited')
    expect(invalidFirst.resources).toHaveLength(0)
    expect(invalidFirst.diagnostics.map((item) => item.code)).toEqual([
      'KG-RESOURCE-001',
      'KG-LIMIT-003',
    ])
  })

  it('keeps parser diagnostics free of the surrounding source line', () => {
    const sentinel = 'never-render-this-secret'
    const result = analyzeManifest(`apiVersion: v1
kind: Secret
metadata:
  name: demo
stringData: [${sentinel}
`)

    expect(result.diagnostics.length).toBeGreaterThan(0)
    expect(JSON.stringify(result.diagnostics)).not.toContain(sentinel)
  })
})
