# KubeRelate Implementation Plan

> Status: Milestone 2 YAML-to-resource-list implementation complete; public Pages activation deferred while private
> Last updated: 2026-08-10
> Companion tracker: [CHECKLIST.md](./CHECKLIST.md)

## Decisions at a glance

| Area | Decision |
| --- | --- |
| Product | Standalone, privacy-first Kubernetes manifest relationship analyzer and learning tool |
| Name | **KubeRelate** is the selected public product name; `kuberelate` is the repository slug |
| Tagline | **See how your Kubernetes manifests connect.** |
| Framework | Next.js App Router, TypeScript, static export only |
| Runtime | Entire analyzer runs in the browser; no API routes, server actions, accounts, or remote processing |
| First release | V1, built as small vertical slices rather than by resource category in isolation |
| First slice | Service selector compared with Pod and Deployment Pod-template labels |
| Styling | CNCF-inspired blue/turquoise/neutral design tokens with a custom product identity |
| Brand boundary | No legacy community-site name, URL, logo, metadata, route, analytics identifier, or copy in the shipped website |
| CI/CD | GitHub Actions on every push and pull request; after public release, deploy static output to GitHub Pages from `main` only after all checks pass |
| Package manager/runtime | npm with a committed lockfile; Node.js 24 LTS pinned in local and CI configuration |
| Privacy default | Do not persist manifest text, do not add analytics in V1, and never send input over the network |

This plan is the public source of truth for product scope, architecture, and delivery decisions. The original private product brief is intentionally not part of the open-source repository.

---

## 1. Product Summary

KubeRelate is a browser-based static analyzer that turns one or more Kubernetes YAML documents into three connected views:

1. a source-aware YAML editor;
2. a resource relationship graph and equivalent text view;
3. evidence-based diagnostics with explanations and real-cluster verification commands.

The core problem is not YAML formatting. Kubernetes objects can look reasonable alone while failing as a system because a selector, name, namespace, port, subject, or volume reference does not line up with another object. KubeRelate makes those relationships visible without requiring a cluster and without uploading manifests.

### Primary users

- Kubernetes and CKA learners who need to understand troubleshooting logic.
- Beginners who understand individual resources but not the full traffic, identity, configuration, or storage chain.
- Developers and platform engineers who want a fast architectural overview and a pre-deployment consistency check.

### Product principles

- Give useful output within seconds: paste, inspect, learn.
- Be technically conservative. Say “not found in the supplied manifests,” never claim runtime state that is unavailable.
- Explain evidence and Kubernetes behavior, not just emit a rule code.
- Keep domain logic independent of React so it can be tested thoroughly.
- Treat the graph as one view, not the only view.
- Make privacy visible and verifiable through architecture, not just marketing copy.
- Do not add AI to the core analyzer.

### Naming decision gate

**KubeRelate** is the project, package, and public product name. Preliminary source-host, package-registry, `.com` registration, web, and trademark-database searches found no obvious exact collision as of 2026-08-10. This is a practical naming screen, not a legal opinion; repeat it before a public V1 announcement or paid launch.

### V1 non-goals

- Connecting to a live cluster or accepting kubeconfig credentials.
- Full OpenAPI/schema validation or API-server admission emulation.
- Helm/Kustomize rendering, mutation, or automatic YAML repair.
- Runtime health, readiness, endpoint, networking, storage, or authorization guarantees.
- Accounts, saved cloud projects, backend storage, collaboration, or arbitrary share links.
- Complete RBAC permission simulation or NetworkPolicy packet-path simulation.

### V1 success outcome

A user can paste a realistic manifest set, see the supported resources and their namespace-correct relationships, discover the core V1 errors, follow an issue to the graph and source lines, read safe troubleshooting guidance, use the experience by keyboard and on mobile, and understand both the privacy promise and static-analysis limitation.

---

## 2. Technical Feasibility

Static manifests contain enough information to resolve many structural relationships deterministically, but they cannot reveal actual cluster state. The product must keep these categories visible in both code and copy.

| Category | What KubeRelate can determine | Examples | Required wording |
| --- | --- | --- | --- |
| Explicit relationship | One resource contains a typed name/kind reference to another | Ingress backend to Service; Pod volume to PVC; RoleBinding `roleRef`; `serviceAccountName` | “This manifest references…” |
| Inferred relationship | Kubernetes semantics connect objects by values rather than direct object references | Service selector to supplied Pod labels or Deployment Pod-template labels; NetworkPolicy selector to workloads | “Based on labels in the supplied manifests…” |
| Input-scoped absence | A referenced or selectable target is not present in the pasted set | Missing ConfigMap; no supplied workload matches a Service selector | “No matching resource was found in the supplied manifests.” |
| Runtime-only fact | The answer depends on the API server, controllers, admission, status, nodes, or external infrastructure | Actual EndpointSlices, readiness, Ingress controller, bound PVC, image pull success, live RBAC decision | “Verify this in a cluster…”; never state it as observed fact |

### Deterministically knowable in V1

- YAML syntax errors and source positions.
- Whether a document has a Kubernetes-like `apiVersion`, `kind`, and `metadata.name` envelope.
- Resource identity, including namespace defaulting for the analyzer and known cluster scope.
- Duplicate identities within the supplied set.
- Deployment selector/template-label consistency.
- Equality-based Service selector matches against supplied Pods and supported workload Pod templates.
- Ingress Service name and named/numeric Service port references.
- Common Pod-spec references to ConfigMaps, Secrets, PVCs, and ServiceAccounts.
- RoleBinding and ClusterRoleBinding `roleRef` and ServiceAccount subjects.
- Whether an included referenced object or Service port exists.

### Knowable only with qualification

- A Deployment represents potential Pods, not live Pods. A Service-to-Deployment edge is an inference through `spec.template.metadata.labels`.
- A missing dependency may already exist in the target cluster or may be installed separately.
- A selector matching multiple supplied workloads can be valid and is not inherently an error.
- A default ServiceAccount exists in a functioning namespace, but it may not be included in the pasted YAML.
- Unknown custom resources may contain relationships KubeRelate does not understand.

### Not knowable from static YAML alone

- Whether Pods are running, Ready, scheduled, admitted, or mutated.
- Whether a Service has live EndpointSlices or receives traffic.
- Whether an Ingress controller/class exists or how controller-specific annotations behave.
- Whether a ConfigMap, Secret, PVC, Role, or ServiceAccount exists outside the supplied set.
- Effective authorization after all live bindings, aggregated ClusterRoles, admission, and identity information.
- Whether a PVC binds, a StorageClass provisions storage, or a volume mounts successfully.
- Effective network connectivity after CNI behavior, DNS, routes, sidecars, meshes, and live NetworkPolicies.
- Cluster-version-specific defaulting, deprecations, validation, or webhook behavior unless a target version is explicitly modeled later.

---

## 3. Architecture Proposal

### 3.1 Data flow

```text
Editor text
   |
   v
YAML parser + source map
   |
   v
Envelope validation + List expansion
   |
   v
Normalized resource instances
   |
   v
Scope-aware resource indexes
   |
   +----------------------+
   |                      |
   v                      v
Relationship rules    Resource rules
   |                      |
   +----------+-----------+
              v
        Diagnostic rules
              |
       +------+-------+
       |              |
       v              v
 Graph adapter   Explanations/inspectors
       |              |
       +------+-------+
              v
         React UI state
```

Only the outer UI layer imports React, Next.js, CodeMirror, React Flow, or Zustand. The parser and Kubernetes analysis pipeline remain pure TypeScript.

### 3.2 Layer responsibilities

| Layer | Responsibility | Must not do |
| --- | --- | --- |
| Parser | Parse multi-document YAML, retain document/range information, return structured errors and warnings | Interpret Kubernetes relationships or render UI |
| Normalizer | Validate the minimal resource envelope, split API group/version, assign scope/namespace, expand `List` items, produce safe typed projections | Pretend to fully validate Kubernetes schemas |
| Resource registry | Describe known kind scope, Pod-spec/template paths, display metadata, and extractor support | Depend on a component library |
| Indexes | Resolve identity by group/kind/name/scope, group resources, track duplicates, and support label candidates | Repeatedly scan every resource for every rule |
| Relationship engine | Run independent rules that emit explicit/inferred, resolved/unresolved/ambiguous relationships with evidence | Emit JSX or user-interface state |
| Diagnostic engine | Run stable rule codes, assign severity and certainty, include safe evidence and verification guidance | Include Secret values or make live-cluster claims |
| Explanation engine | Generate deterministic architecture and issue explanations from resources and relationships | Call an LLM or external API |
| Graph adapter/layout | Convert domain relationships to presentation nodes/edges and lay them out | Become the source of domain truth |
| Store | Hold editor text, selected item, active view, filters, theme, and immutable latest analysis result | Reimplement analysis or persist manifests silently |
| UI | Present editor, topology, accessible relationship list, diagnostics, inspector, examples, and responsive navigation | Read arbitrary raw YAML shapes directly |

### 3.3 Proposed repository structure

```text
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── docs/page.tsx
│   ├── examples/page.tsx
│   ├── error.tsx
│   └── globals.css
├── components/
│   ├── ui/                 # small project-owned primitives
│   └── layout/             # shell, header, panels, mobile tabs
├── features/
│   ├── workbench/
│   ├── editor/
│   ├── topology/
│   ├── diagnostics/
│   ├── inspector/
│   └── examples/
├── domain/
│   ├── model/
│   ├── parser/
│   ├── resources/          # kind registry and safe projections
│   ├── indexes/
│   ├── selectors/
│   ├── relationships/
│   │   └── rules/
│   ├── diagnostics/
│   │   └── rules/
│   └── explanations/
├── graph/
│   ├── adapter/
│   └── layout/
├── store/
├── content/
│   ├── examples/
│   └── concepts/
└── test/
    ├── fixtures/
    └── builders/
e2e/
public/
```

Tests for small pure modules should be colocated as `*.test.ts`; reusable YAML fixtures and end-to-end tests live in the dedicated test folders.

### 3.4 Analysis orchestration

Expose one pure entry point:

```ts
analyzeManifest(source: string, options?: AnalysisOptions): AnalysisResult
```

`AnalysisResult` contains parser messages, normalized resources, indexes or index summaries, relationships, diagnostics, and deterministic summary data. UI code receives this result and does not call individual rules ad hoc.

Parsing runs after a short debounce. Error-free documents may still be analyzed when another document in the stream is malformed, but the UI must visibly label the result as partial. The same input must always produce stable IDs and stable diagnostic ordering.

### 3.5 State and persistence

The Zustand store contains only interaction state and the latest immutable pipeline result. Expensive derived values use store selectors or pure memoized adapters; they are not copied into multiple state branches.

V1 persists only non-sensitive preferences such as theme, panel sizing, and graph direction. Manifest text is memory-only. An explicit “remember this manifest on this device” option may be evaluated in V1.1, off by default and accompanied by a warning. Built-in example IDs may be placed in the URL; arbitrary YAML and Secret data may not.

### 3.6 Static deployment boundary

Next.js uses `output: 'export'`. The project must contain no runtime API route, server action, middleware, authentication, database adapter, or dynamic request dependency. The analyzer workbench is a client component behind a small static shell. Browser-only editor and graph packages are lazy-loaded so static prerendering remains safe and the initial shell stays small.

---

## 4. Technology Decisions

Versions are pinned by `package-lock.json` when scaffolding begins. Upgrade versions deliberately rather than encoding “latest” into CI.

| Concern | Choice | Why | Alternative considered | Main risk / mitigation |
| --- | --- | --- | --- | --- |
| Runtime | Node.js 24 LTS | Supported LTS line as of this plan; reproducible local/CI builds | Node 26 is Current, not LTS | Pin `.nvmrc`, `engines`, and CI major |
| Framework | Next.js App Router + static export | Strong static routing, metadata, docs/examples pages, code splitting, and portable `out/` artifact without a backend | Vite React SPA is simpler and slightly lighter | Static export forbids server features; enforce with config and build tests |
| Language | TypeScript in strict mode | Domain modeling, discriminated unions, safer rule contracts | JavaScript | Keep unsafe YAML at `unknown` boundaries; prohibit broad `any` |
| Styling | Tailwind CSS plus CSS custom-property tokens | Fast bespoke UI work, zero runtime, consistent responsive and state styling | CSS Modules only | Keep semantic project components; avoid unreadable repeated utility blocks |
| YAML | `yaml` | Browser support, multi-document API, AST/ranges, parser errors, line counter, alias limits | `js-yaml` | Convert with an alias limit and keep parser failures structured |
| Editor | CodeMirror 6 with YAML language package | Modular, accessible, lighter and more configurable than Monaco for one language | Monaco Editor | Lazy-load and import only required extensions |
| Graph | `@xyflow/react` | Mature custom nodes/edges, pan/zoom, keyboard and screen-reader support | Cytoscape.js; custom SVG | Lazy-load; provide a complete text relationship view |
| Layout | `@dagrejs/dagre` for V1 | Small, deterministic directed layout and documented React Flow integration | ELK is stronger for compound graphs | Namespace sub-flow limits; reassess ELK only in V1.1 if grouping requires it |
| UI state | Zustand | Small typed cross-panel store with selector-based subscriptions | `useReducer` + Context | Keep analysis pure and avoid a global dumping ground |
| Boundary schemas | `zod/mini` for the small resource envelope and projections | Runtime safety at untrusted boundaries with a smaller client footprint | Hand-written guards only | Do not attempt to encode complete Kubernetes schemas |
| Unit/component tests | Vitest + React Testing Library + user-event | Fast TypeScript tests and official Next.js setup path | Jest | Keep most domain tests in the Node environment; jsdom only for components |
| E2E | Playwright | Cross-browser support, mobile emulation, traces, reliable CI | Cypress | Run a Chromium smoke suite on each push; broader projects at release time |
| Accessibility tests | axe-core integration plus manual keyboard/screen-reader checks | Catches common violations while preserving required human review | Automated tests alone | Treat automation as a floor, not certification |
| Lint/format | ESLint with Next rules + Prettier | Familiar, visible quality gates and framework-specific checks | Biome | Keep configurations small and commands separate |
| CI/CD | GitHub Actions + GitHub Pages | Visible build/test/deploy pipeline for a fully static repository | Vercel automatic deployment | One gated workflow, least privilege, concurrency cancellation |

### Why Next.js instead of Vite

Vite would be the smallest valid choice for a single-screen tool. Next.js is selected because KubeRelate also needs indexable privacy/docs/example pages, static metadata, route-level lazy loading, and a polished public project surface. Static export keeps the runtime architecture equivalent to a hosted SPA: build-time HTML plus browser JavaScript, with no Node server in production.

If static export begins forcing workarounds or the product returns to one route only, a switch to Vite remains possible because all Kubernetes domain modules are framework-independent.

### Dependencies intentionally excluded from V1

- No Kubernetes JavaScript client: it is aimed at API communication, which V1 forbids.
- No complete Kubernetes schema bundle: large, version-sensitive, and outside relationship-analysis scope.
- No component-suite generator by default: build only the primitives actually needed.
- No analytics SDK, error-reporting SDK, LLM SDK, or remote telemetry.
- No ELK, web worker abstraction, query library, or persistence library until measurements justify them.

### Dependency footprint implications

- **Next.js/React** establish the baseline framework cost, but route-level static output keeps docs/examples code separate and avoids a production server bundle.
- **`yaml`** is accepted in the initial analyzer chunk because parsing is core functionality and the package has no runtime dependencies; a full Kubernetes schema collection would be substantially larger and is excluded.
- **CodeMirror** is a moderate feature cost, so import only the state/view/commands/YAML extensions used by KubeRelate and lazy-load the editor. Monaco was rejected primarily because its general IDE/language-worker surface is unnecessary here.
- **React Flow plus Dagre** will likely be the largest optional feature chunk. Lazy-load topology independently, keep the relationship list usable first, and measure the first vertical slice before setting a hard cap. A custom SVG could be smaller but would transfer substantial interaction and accessibility risk into project code.
- **Zustand and `zod/mini`** are deliberately small utilities. If measured output shows either is unjustified, their narrow boundaries make replacement with `useReducer` or local guards feasible.
- **Tailwind** adds build tooling but no client-side runtime. Vitest, Testing Library, Playwright, axe, ESLint, and Prettier are development-only and must not enter production chunks.

### Bundle and performance policy

- Lazy-load CodeMirror and the graph bundle at feature boundaries.
- Keep the static shell useful while those chunks load.
- Record route and analyzer chunk sizes in release notes; investigate any single unexplained increase over 10%.
- Establish hard budgets after the first measured vertical slice rather than guessing before dependencies are installed.

### Official decision references

- [Next.js static exports](https://nextjs.org/docs/app/guides/static-exports)
- [Next.js SPA guidance](https://nextjs.org/docs/app/guides/single-page-applications)
- [`yaml` document and source APIs](https://eemeli.org/yaml/)
- [CodeMirror modular architecture](https://codemirror.net/docs/guide/)
- [React Flow accessibility](https://reactflow.dev/learn/advanced-use/accessibility)
- [React Flow layout options](https://reactflow.dev/learn/layouting/layouting)
- [Vitest with Next.js](https://nextjs.org/docs/app/guides/testing/vitest)
- [Playwright in CI](https://playwright.dev/docs/ci)
- [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [CNCF brand guidelines](https://www.cncf.io/brand-guidelines/)

---

## 5. Domain Model

The examples below define boundaries, not final implementation code.

### 5.1 Resource identity and source

```ts
type ResourceId = string & { readonly __brand: 'ResourceId' }
type ResourceKey = string & { readonly __brand: 'ResourceKey' }

type ResourceScope =
  | { type: 'namespaced'; namespace: string }
  | { type: 'cluster' }
  | { type: 'unknown'; declaredNamespace?: string }

interface ResourceIdentity {
  apiGroup: string // empty string means the core API group
  kind: string
  name: string
  scope: ResourceScope
}

interface SourcePosition {
  offset: number
  line: number
  column: number
}

interface SourceRange {
  start: SourcePosition
  end: SourcePosition
}

interface ResourceSource {
  documentIndex: number
  listItemIndex?: number
  range?: SourceRange
  fieldRanges: ReadonlyMap<string, SourceRange>
}

interface KubernetesResource {
  id: ResourceId             // occurrence-specific; stable for identical input
  key: ResourceKey           // canonical group/kind/scope/name identity
  identity: ResourceIdentity
  apiVersion: string
  version: string
  kind: string
  name: string
  labels: Readonly<Record<string, string>>
  annotations: Readonly<Record<string, string>>
  source: ResourceSource
  support: 'full' | 'partial' | 'generic'
  raw: unknown               // memory-only; never trusted or rendered as HTML
}
```

The canonical key excludes API version but includes API group, kind, scope, namespace where applicable, and name. The index maps a key to an array so duplicate manifests are preserved and reported rather than overwritten.

For an unknown custom kind, an explicit `metadata.namespace` is retained as a declared value, but absence of that field does not prove cluster scope or justify defaulting to `default`. Unknown-scope resources do not participate in namespace-sensitive resolution until a CRD or adapter supplies scope information.

### 5.2 Selectors and references

```ts
type SelectorOperator = 'In' | 'NotIn' | 'Exists' | 'DoesNotExist'

interface LabelSelector {
  matchLabels: Readonly<Record<string, string>>
  matchExpressions: readonly {
    key: string
    operator: SelectorOperator
    values: readonly string[]
  }[]
}

interface ResourceReference {
  id: string
  source: ResourceId
  relationship: RelationshipType
  expected: ResourceIdentity
  sourcePath: string
  optional: boolean
}
```

Service selectors are equality maps. General `LabelSelector` support exists for Deployment validation and later NetworkPolicy/HPA-related work. Matching functions return structured evidence, not just booleans.

### 5.3 Relationships

```ts
type RelationshipCertainty = 'explicit' | 'inferred'

type RelationshipResolution =
  | { state: 'resolved'; target: ResourceId }
  | { state: 'missing'; expected: ResourceIdentity | { description: string } }
  | { state: 'ambiguous'; candidates: readonly ResourceId[] }

interface RelationshipEvidence {
  sourcePath: string
  summary: string
  comparedValues?: Readonly<Record<string, string>>
}

interface ResourceRelationship {
  id: string
  source: ResourceId
  type: RelationshipType
  certainty: RelationshipCertainty
  resolution: RelationshipResolution
  evidence: RelationshipEvidence
}
```

Missing relationships remain first-class data so the graph adapter can show an unresolved target without inventing a Kubernetes resource.

### 5.4 Diagnostics

```ts
type DiagnosticSeverity = 'error' | 'warning' | 'info'
type StaticCertainty = 'definite' | 'input-scoped' | 'informational'

interface Diagnostic {
  id: string
  code: string
  severity: DiagnosticSeverity
  certainty: StaticCertainty
  title: string
  problem: string
  whyItMatters: string
  evidence: readonly SafeEvidenceItem[]
  resources: readonly ResourceId[]
  sourceRanges: readonly SourceRange[]
  verificationCommands: readonly string[]
  possibleDirection?: string
  documentationSlug?: string
}
```

`SafeEvidenceItem` permits names, keys, selectors, ports, kinds, namespaces, and source paths but cannot contain arbitrary ConfigMap or Secret values. Rule codes are stable and testable, for example `KG-SVC-001`.

### 5.5 Rule contracts

```ts
interface AnalysisContext {
  resources: readonly KubernetesResource[]
  index: ResourceIndex
}

interface RelationshipRule {
  id: string
  evaluate(context: AnalysisContext): readonly ResourceRelationship[]
}

interface DiagnosticContext extends AnalysisContext {
  relationships: readonly ResourceRelationship[]
}

interface DiagnosticRule {
  code: string
  evaluate(context: DiagnosticContext): readonly Diagnostic[]
}
```

Rules are registered in an explicit ordered list. A rule failure is contained and surfaced as a generic analyzer failure without breaking other rules.

### 5.6 Graph presentation model

```ts
type GraphNodeModel =
  | { type: 'resource'; id: string; resource: ResourceId; status: NodeStatus }
  | { type: 'unresolved'; id: string; relationshipId: string; label: string }
  | { type: 'namespace'; id: string; namespace: string }

interface GraphEdgeModel {
  id: string
  source: string
  target: string
  label: string
  certainty: RelationshipCertainty
  status: 'resolved' | 'missing' | 'ambiguous'
  relationshipId: string
}
```

These types belong to the graph adapter and are converted to React Flow types at the final boundary. React Flow objects never leak back into domain logic.

---

## 6. Relationship Matrix

“Workload” in V1 means Pod or Deployment Pod template. Later versions reuse the Pod-spec/template adapters for additional controllers.

| Source resource | Relationship | Target resource | Resolution strategy | Version |
| --- | --- | --- | --- | --- |
| Namespace | visually contains | Namespaced resource | Effective namespace; presentation grouping, not a Kubernetes reference | V1 |
| Service | selects | Pod | Service equality selector is a subset of Pod labels in the same namespace | V1 |
| Service | selects represented Pods | Deployment | Infer through `spec.template.metadata.labels` in the same namespace | V1 |
| Ingress | routes to | Service | `defaultBackend` and rule backend service name in Ingress namespace | V1 |
| Ingress | routes to Service port | Service port | Match backend `port.name` or `port.number` against `spec.ports` | V1 |
| Pod/Deployment | reads from | ConfigMap | `envFrom`, `env.valueFrom`, `volumes.configMap`, projected sources | V1 |
| Pod/Deployment | reads from | Secret | `envFrom`, `env.valueFrom`, secret/projected volumes | V1 |
| Pod/Deployment | pulls image with | Secret | Pod-spec `imagePullSecrets` | V1 |
| Pod/Deployment | runs as | ServiceAccount | Explicit `serviceAccountName`; inferred `default` when absent | V1 |
| Pod/Deployment | mounts | PersistentVolumeClaim | Pod-spec `volumes.persistentVolumeClaim.claimName` | V1 |
| RoleBinding | grants | Role | `roleRef.kind=Role`, name, binding namespace | V1 |
| RoleBinding | grants namespaced access from | ClusterRole | `roleRef.kind=ClusterRole`, cluster-scoped name | V1 |
| RoleBinding | binds | ServiceAccount | ServiceAccount subject namespace, defaulting carefully to binding namespace where API semantics allow | V1 |
| ClusterRoleBinding | grants | ClusterRole | `roleRef.kind=ClusterRole`, cluster-scoped name | V1 |
| ClusterRoleBinding | binds | ServiceAccount | Explicit subject namespace and name | V1 |
| Ingress | uses TLS certificate from | Secret | `spec.tls[].secretName` in Ingress namespace | V1.1 |
| Service | selects represented Pods | StatefulSet/DaemonSet/Job | Reuse Pod-template label adapter | V2 |
| Service | selects Pod template | CronJob | Infer through Job template, clearly labeled conceptual | V2 |
| Additional workload | reads/uses/mounts | ConfigMap/Secret/ServiceAccount/PVC | Reuse the normalized Pod-spec adapter | V2 |
| HorizontalPodAutoscaler | scales | Deployment/StatefulSet/other target | `scaleTargetRef` group/kind/name in HPA namespace | V2 |
| NetworkPolicy | selects | Pod/workload template | Evaluate `podSelector` within policy namespace | V2 |
| PersistentVolumeClaim | requests class from | StorageClass | `storageClassName`; cluster-scoped target | V2 |
| PersistentVolume | binds or is prebound to | PersistentVolumeClaim | `claimRef` and PVC `volumeName` | V2 |
| StatefulSet | creates claims from | PVC template | `volumeClaimTemplates`; virtual/template relationship | V2 |
| CronJob | creates | Job template | Structural template relationship, not a live Job assertion | V2.5 |
| NetworkPolicy | permits/denies selected peer set | Pod/workload template | Basic ingress/egress peer selector interpretation with explicit limitations | V2.5 |
| Kyverno Policy/ClusterPolicy | contains | Policy rule | Rule nodes derived from policy spec | V3 |
| Kyverno rule | matches/excludes | Resource | Kind, namespace, name, label and operation criteria supported by the adapter | V3 |
| PolicyReport/ClusterPolicyReport | reports result for | Resource | Report scope/resource reference and result metadata | V3 |
| Gateway/HTTPRoute | routes to | Service | Gateway API backend references | Optional V4 |

Relationship resolvers must never connect namespaced objects across namespaces unless the Kubernetes field explicitly supports a namespace. Unknown or unsupported reference forms remain visible as generic metadata rather than being guessed.

---

## 7. Diagnostic Matrix

Certainty meanings:

- **Definite:** proven directly from the supplied source and supported Kubernetes semantics.
- **Input-scoped:** proven missing or unmatched only inside the supplied manifest set; the live cluster may differ.
- **Informational:** a learning or operational observation, not universal invalidity.

| Diagnostic | Severity | Resources | Static certainty | Version |
| --- | --- | --- | --- | --- |
| YAML cannot be parsed | Error | Source document | Definite | V0 |
| Document is not a Kubernetes object | Warning | Source document | Definite | V0 |
| Required identity field is missing or invalid | Error | Resource candidate | Definite | V0 |
| Known cluster-scoped resource declares a namespace | Error | Resource | Definite | V0 |
| Duplicate canonical resource identity | Error | Duplicate resources | Definite within input | V0 |
| Helm/template expression prevents analysis | Warning | Source document | Definite | V0 |
| Deployment selector does not match its Pod-template labels | Error | Deployment | Definite | V1 |
| Service selector matches no supplied workload | Warning | Service and comparison candidates | Input-scoped | V1 |
| Service selector matches multiple supplied workloads | Info | Service and workloads | Informational | V1 |
| Ingress backend Service is not supplied | Error | Ingress | Input-scoped | V1 |
| Ingress references a port absent from a supplied Service | Error | Ingress, Service | Definite | V1 |
| Referenced ConfigMap is not supplied | Error | Workload | Input-scoped | V1 |
| Referenced Secret is not supplied | Error | Workload | Input-scoped | V1 |
| Referenced PVC is not supplied | Error | Workload | Input-scoped | V1 |
| Custom ServiceAccount is not supplied | Error | Workload | Input-scoped | V1 |
| Workload uses the default ServiceAccount | Info | Workload | Informational | V1 |
| RoleBinding `roleRef` has an unsupported/invalid kind | Error | RoleBinding | Definite | V1 |
| RoleBinding target Role/ClusterRole is not supplied | Error | RoleBinding | Input-scoped | V1 |
| RoleBinding ServiceAccount subject is not supplied | Warning | RoleBinding | Input-scoped | V1 |
| ClusterRoleBinding does not reference a ClusterRole | Error | ClusterRoleBinding | Definite | V1 |
| ClusterRoleBinding target ClusterRole is not supplied | Error | ClusterRoleBinding | Input-scoped | V1 |
| ClusterRoleBinding ServiceAccount subject is not supplied | Warning | ClusterRoleBinding | Input-scoped | V1 |
| Container image uses a floating `latest` tag or no tag | Info | Workload | Informational | V1 |
| Container lacks resource requests/limits | Info | Workload | Informational | V1.1 |
| Ingress TLS Secret is not supplied | Warning | Ingress | Input-scoped | V1.1 |
| HPA target is not supplied | Error | HPA | Input-scoped | V2 |
| NetworkPolicy selects no supplied workloads | Warning | NetworkPolicy | Input-scoped | V2 |
| PVC StorageClass is not supplied | Warning | PVC | Input-scoped | V2 |
| PV/PVC prebinding disagrees | Error | PV, PVC | Definite when both are supplied | V2 |
| Unknown kind has generic support only | Info | Unknown resource | Informational | V0 |

Severity is separate from certainty. For example, an Ingress pointing to an absent Service is severe for the submitted set, while still being input-scoped because that Service may already exist in a cluster.

---

## 8. UX Information Architecture

### 8.1 Main screen

Desktop uses a three-region workbench:

```text
Header: KubeRelate | Examples | Docs | Privacy | Theme | Reset
----------------------------------------------------------------
YAML editor (40%)       | Topology / Relationship list (60%)
----------------------------------------------------------------
Status summary: errors | warnings | resources | relationships
----------------------------------------------------------------
Diagnostics list       | Contextual resource/edge inspector
```

Panels may become resizable after the fixed responsive layout is usable. The initial implementation should not make panel resizing a prerequisite for a good experience.

### 8.2 Ten-second comprehension goal

Before input, the graph region shows:

- the one-line promise;
- a visible “processed only in this browser” privacy statement;
- a primary “Paste YAML” cue associated with the editor;
- three compact example buttons, led by “Broken Service selector”;
- a small static-analysis limitation link.

There is no modal onboarding and no mandatory tutorial. Loading an example is one click and uses a clearly labeled sample, never hidden default data.

### 8.3 Editor

- Multi-document YAML, line numbers, syntax highlighting, undo/redo, search, keyboard shortcuts, and accessible labels.
- Toolbar actions: load example, clear, reset current example, and optional format only after source-location behavior is safe.
- Parse errors appear inline and in the diagnostics list.
- Selecting a diagnostic scrolls to the most relevant range and briefly emphasizes it.
- Analysis is debounced; a small non-blocking status announces “Analyzing…” and result counts.

### 8.4 Topology

- Default left-to-right flow for traffic/dependency readability; allow top-to-bottom preference.
- Node shows kind, name, effective namespace, status icon/text, and connection count.
- Edge labels use verbs such as “selects,” “routes to,” “reads from,” “runs as,” “mounts,” and “grants.”
- Explicit edges are solid; inferred edges are dashed and also labeled “inferred” in the inspector.
- Missing targets render as clearly non-resource placeholder nodes, not fake Kubernetes objects.
- Filters: namespace, resource kind, severity, and “focus selected.” Search and namespace grouping land in V1.1 unless needed for V1 usability.
- The graph starts fitted to view and preserves manual viewport only until analysis input changes materially.

### 8.5 Accessible relationship view

A “List view” beside the “Graph view” renders the same domain data as nested semantic lists and tables. Every relationship, missing target, and diagnostic available in the graph must be available here. It is not a reduced fallback.

### 8.6 Diagnostics and inspector

Diagnostics are sorted by severity, source document, line, then stable code. Each card includes:

- severity text and icon;
- concise problem title;
- certainty label where input-scoped;
- involved resources;
- expandable problem, why, evidence, verify, and possible-direction sections;
- actions to focus graph, open resource, and jump to YAML.

The inspector adapts by resource kind but always includes identity, namespace/scope, important fields, relationships, diagnostics, and copyable troubleshooting commands. Secret inspectors show key names and metadata only, never decoded or raw values.

### 8.7 Examples and deterministic explanation

V1 examples:

1. broken Service selector;
2. missing ConfigMap;
3. Ingress backend error;
4. RBAC subject/role problem;
5. missing PVC;
6. working multi-tier application.

Example query strings contain only stable IDs, such as `?example=broken-service`. “Explain this architecture” creates a deterministic paragraph from sorted resources and resolved relationships, followed by potential problems and the static-analysis disclaimer.

### 8.8 Mobile and tablet

Below the desktop breakpoint, replace the split workbench with four persistent tabs: **YAML**, **Topology**, **Issues**, and **Resources**. Opening an issue changes the active tab only after the user chooses “View in YAML” or “View in topology,” avoiding surprising context switches. The inspector becomes a full-height sheet/page with a clear Back action.

For very small screens, default topology to the relationship list and retain an explicit “Open visual graph” action.

### 8.9 CNCF-inspired visual direction

- Use CNCF blue (`#0086FF`), turquoise (`#93EAFF`), black, cloud white, and stone as inspiration, with darker derived blues where text contrast requires them.
- Use a custom KubeRelate wordmark and topology/hexagon motif; do not reuse or modify the CNCF or Kubernetes logos.
- Use neutral system or locally bundled fonts; no runtime font request.
- Use subtle grid/topology backgrounds, precise 1px borders, compact developer-tool density, and generous focus rings.
- Do not imply CNCF sponsorship or affiliation. Product identity remains more prominent than the visual inspiration.
- Run an automated brand-content check against shipped source, metadata, examples, manifest, and `public/` assets so the prohibited legacy site brand cannot reappear accidentally.

---

## 9. Accessibility Plan

Target WCAG 2.2 AA for the public V1 experience.

### Structure and navigation

- Semantic landmarks (`header`, `nav`, `main`, labeled complementary panels) and one logical `h1`.
- A skip link to the workbench and predictable heading hierarchy.
- All actions use native buttons/links unless a composite widget genuinely requires ARIA.
- Visible focus indicators with at least 3:1 contrast and no keyboard traps.
- Focus returns sensibly when inspectors, sheets, or dialogs close.

### Editor

- Persistent visible label and concise keyboard help.
- Parser state announced through a polite live region without announcing every keystroke.
- Diagnostics connect to editor locations through labeled buttons; raw line/column is also stated.
- Do not depend on editor decorations alone to convey an error.

### Graph

- Keep React Flow node and edge focusability enabled and provide meaningful custom ARIA labels.
- Enter/Space opens the selected node or edge; Escape returns focus to the graph or invoking control.
- Never encode severity or relationship certainty by color/dash style alone.
- Provide list view parity, not merely an image description.
- Avoid automatic animated panning when `prefers-reduced-motion` is set.

### Visual and content requirements

- Test text, status, focus, graph nodes, and graph edges in light and dark themes for contrast.
- Minimum 44-by-44 CSS pixel touch targets for primary mobile controls where practical.
- Severity always combines icon, text, and color.
- Plain-language explanations retain exact field names in code styling.
- Copy buttons announce success without moving focus.

### Verification

- axe checks in component tests for key panels and in Playwright for empty, valid, and error states.
- Keyboard-only walkthrough for the entire primary flow before every release.
- Screen-reader smoke test on VoiceOver/Safari and NVDA/Firefox or the closest available matrix.
- 200% zoom and responsive reflow check at 320 CSS pixels.

---

## 10. Version Roadmap

### V0 — Product foundation

**Scope:** scaffold, static shell, design tokens, editor, parser, source positions, normalization, effective scope, resource list, unknown kinds, parse errors, and CI/CD.

**Resource support:** generic envelope for all kinds; typed registry entries for Namespace, Pod, Deployment, Service, Ingress, ConfigMap, Secret, PVC, ServiceAccount, Role/Binding, and ClusterRole/Binding.

**Technical goals:** prove browser-only static export, pure analysis pipeline, stable IDs, fixture testing, and gated Pages deployment.

**Exit criteria:** multi-document input cannot crash the app; valid resources and parser errors are listed with source positions; unknown kinds remain visible; all push checks and main deployment work.

### V1 — Public core

**Scope:** five production-quality vertical slices, interactive topology, diagnostics, resource/edge inspector, examples, deterministic explanation, privacy copy, responsive tabs, and accessibility baseline.

**Resource support:** Namespace, Pod, Deployment, Service, Ingress, ConfigMap, Secret, PVC, ServiceAccount, Role, RoleBinding, ClusterRole, ClusterRoleBinding.

**User-visible features:** Service/workload inference, Ingress routing, configuration/Secret/PVC/identity references, RBAC chains, source jumps, troubleshooting commands, six examples, graph/list parity.

**Exit criteria:** all V1 success criteria in the brief pass; no P0/P1 defects; CI is green; supported relationships and limitations are documented; production artifact contains no prohibited legacy branding or manifest telemetry.

### V1.1 — Polish and measured hardening

**Scope:** filters, search, stronger namespace grouping, Ingress TLS Secret relationship, shareable example URLs, improved layout, optional panel resizing, docs/examples gallery, and measured performance work.

**Technical goals:** add a worker only if traces show main-thread analysis causes visible input delay; evaluate ELK only if Dagre grouping is inadequate; establish bundle and input-size budgets from data.

**Exit criteria:** useful behavior with approximately 100 supplied resources on supported hardware; filters/list remain accessible; release browser matrix passes.

### V2 — CKA troubleshooting edition

**Resource support:** StatefulSet, DaemonSet, Job, CronJob, HPA, PersistentVolume, StorageClass, NetworkPolicy.

**Features:** reusable Pod-spec analysis for added workloads, HPA/storage/network relationships, and guided troubleshooting scenarios for Service, Ingress, RBAC, configuration, PVC, networking, and readiness.

**Technical goals:** scenario engine consumes existing diagnostics and relationships rather than creating a second analyzer.

**Exit criteria:** each scenario contains evidence, a visual/text path, cluster verification commands, limitations, fixtures, and at least one E2E flow.

### V2.5 — Advanced relationships

**Scope:** richer NetworkPolicy selection/peer views, RBAC permission summaries with explicit boundaries, dependency focus mode, namespace isolation view, topology search, and scale-oriented graph controls.

**Exit criteria:** advanced claims have documented Kubernetes assumptions and adversarial fixtures; graph remains usable and list view remains complete.

### V3 — Policy visualization

**Scope:** Kyverno Policy, ClusterPolicy, ValidatingPolicy, MutatingPolicy, PolicyReport, and ClusterPolicyReport adapters.

**Features:** Policy to rule to selected resource to report-result visualization; no live policy execution and no coupling of V1 core to Kyverno packages.

**Exit criteria:** policy adapters are isolated, generic resources still work without them, and V1 relationship/diagnostic tests remain unchanged and green.

### Optional V4 — Extensions

Evaluate Gateway API, rendered Helm/Kustomize input, custom schema adapters, graph/document export, manifest-set diffing, and optional local-only assistance. Each requires a separate product decision; none is pre-committed.

---

## 11. Step-by-Step Implementation Plan

Each phase ends in a reviewable, deployable state. Tests and documentation are part of the phase, not cleanup work after it.

### Phase 0 — Planning baseline

**Objective:** remove product ambiguity before code.

**Likely files:** `PLAN.md`, `CHECKLIST.md`, later `README.md`.

**Tasks:**

- Record the standalone brand, client-only boundary, V1 scope, static-analysis wording, stack, deployment target, and non-goals.
- Keep the original private brief out of the public repository and treat this plan as authoritative.
- Define milestone gates and the rule for marking checklist items complete.

**Tests/review:** manually check that every requested planning section, V1 relationship, V1 diagnostic, CI/CD requirement, privacy constraint, and branding constraint has an owner in the plan.

**Complete when:** this plan and the living checklist are committed and accepted.

### Phase 1 — Scaffold, quality gates, and continuous deployment

**Objective:** create the smallest reproducible Next.js static project and prove every push is verified.

**Likely files:** `package.json`, `package-lock.json`, `.nvmrc`, `next.config.ts`, `tsconfig.json`, `eslint.config.*`, `.prettierrc*`, `vitest.config.*`, `playwright.config.ts`, `src/app/*`, `e2e/smoke.spec.ts`, `.github/workflows/ci.yml`.

**Tasks:**

- Scaffold Next.js App Router with strict TypeScript, Tailwind, ESLint, `src/`, and static export. Use `trailingSlash: true` for portable directory routes on GitHub Pages, and either avoid `next/image` or configure static-compatible unoptimized/local images.
- Pin Node 24 LTS and npm expectations; commit the lockfile.
- Add scripts: `dev`, `build`, `lint`, `typecheck`, `format`, `format:check`, `test`, `test:coverage`, `test:e2e`, and `check:brand`.
- Render a semantic shell, privacy statement, static-analysis disclaimer, and custom KubeRelate metadata with no prohibited legacy branding.
- Configure Vitest/Testing Library and one shell unit test.
- Configure Playwright and one production-export smoke test.
- Add one GitHub Actions workflow with these gates:
  1. **quality** on every push and pull request: clean install, format check, lint, typecheck, unit tests with coverage, brand scan;
  2. **build** after quality: static export and artifact upload;
  3. **e2e-smoke** after build: serve the exported artifact and run Chromium smoke tests;
  4. **deploy** only when the repository is public and a `main` run passes every prior job: deploy the same tested `out/` artifact to the `github-pages` environment.
- Use job-level least privilege, pinned official actions, npm caching, per-branch concurrency with stale-run cancellation, and failure-only Playwright artifacts.
- Configure the project Pages base path (`/kuberelate`) through an explicit build environment value so local development remains at `/`.
- Keep Pages deployment disabled while the repository is private. Require the quality/build/E2E checks on `main` after the first CI run, then enable Pages via Actions when the repository becomes public.

**Tests required:** clean install, shell component, 404/static route behavior, production build, exported asset paths, direct page load, and prohibited-brand scan.

**Complete when:** a private push runs all verification jobs; a deliberately failing test blocks downstream jobs; after public release, a green `main` run publishes the exact tested artifact.

### Phase 2 — Design foundation, YAML editor, and V0 parser

**Objective:** deliver “YAML to source-aware resource list” without a graph.

**Likely files:** `src/components/ui/*`, `src/features/editor/*`, `src/features/workbench/*`, `src/domain/parser/*`, `src/domain/model/*`, `src/domain/resources/*`, `src/content/examples/*`, `src/test/fixtures/parser/*`.

**Tasks:**

- Define CNCF-inspired light/dark tokens, typography, spacing, status semantics, focus styles, and the custom node visual language.
- Integrate lazy-loaded CodeMirror with YAML syntax, line numbers, history, search, a visible label, and keyboard help.
- Parse with `parseAllDocuments`, a `LineCounter`, strict duplicate-key handling, pretty errors, and bounded alias expansion during JS conversion.
- Ignore empty documents without warnings; preserve syntax warnings/errors per document.
- Validate only the Kubernetes envelope and retain unknown kinds as generic resources.
- Expand `kind: List` items into source-linked resource instances.
- Split `apiVersion` into group/version and implement the known kind scope registry.
- Apply analyzer default namespace `default` only for known namespaced resources that omit it; never assign a namespace to known cluster-scoped resources.
- Preserve duplicates as separate instances and emit a duplicate-identity diagnostic.
- Show resource counts, resource list, support level, parse messages, and line/column jumps.
- Enforce source size, document count, and alias limits with a helpful non-crashing message.

**Tests required:** empty input/documents, multi-document YAML, malformed documents, source lines, core and grouped API versions, missing identity, explicit/default namespaces, cluster scope, invalid namespace on a known cluster-scoped kind, same names across namespaces, duplicate identity, `List`, aliases, unknown CRDs, and template syntax.

**Complete when:** the V0 exit criteria pass in unit, component, E2E, keyboard, and production-export testing.

### Phase 3 — First vertical slice: Service to workload

**Objective:** prove the entire product architecture with one polished Kubernetes problem.

**Likely files:** `src/domain/selectors/*`, `src/domain/indexes/*`, `src/domain/resources/pod-spec.ts`, `src/domain/relationships/rules/service-selects-workload.ts`, `src/domain/diagnostics/rules/service-selector.ts`, `src/graph/*`, `src/features/topology/*`, `src/features/diagnostics/*`, `src/features/inspector/*`.

**Tasks:**

- Build identity, namespace, kind, and inverted label indexes.
- Extract Pod labels and Deployment Pod-template labels through typed adapters.
- Implement equality-selector matching with same-namespace enforcement.
- Skip selectorless and `ExternalName` Services; allow one-to-many valid matches.
- Emit inferred resolved relationships for matches and an unresolved selector result for no match.
- Validate Deployment selector against its own Pod-template labels as a separate definite rule.
- Emit `KG-SVC-001` with safe evidence, input-scoped wording, and commands.
- Render resource and unresolved nodes, semantic/dashed edges, status markers, pan/zoom/fit controls, and a complete relationship list.
- Connect issue selection to topology focus, inspector content, and source ranges.
- Add the broken and working Service examples.

**Tests required:** exact/subset matches, mismatched values, missing labels, empty selectors, `ExternalName`, cross-namespace non-match, multiple matches, Pods and Deployments, invalid Deployment selector, stable IDs, graph/list parity, selection/source navigation, and end-to-end broken/working examples.

**Complete when:** the exact flow in section 12 works, is accessible, survives malformed neighboring YAML, and passes CI.

### Phase 4 — General topology and interaction hardening

**Objective:** make the graph infrastructure reusable before adding relationship categories.

**Likely files:** `src/graph/adapter/*`, `src/graph/layout/*`, `src/features/topology/*`, `src/store/*`.

**Tasks:**

- Keep graph generation a pure adapter from resources, relationships, diagnostics, and filters.
- Add deterministic Dagre layout, stable node dimensions, fit behavior, and saved direction preference.
- Implement selected resource/relationship/diagnostic state once in the store.
- Add accessible node/edge names, keyboard activation, reduced motion, empty/loading/error states, and list-view parity tests.
- Add resource inspector sections and safe Secret display policy before Secret relationships arrive.
- Measure the first real bundles and analysis timings; record budgets without adding premature infrastructure.

**Tests required:** deterministic adapter output, missing/ambiguous targets, keyboard graph flow, reduced motion, inspector focus management, list parity, and visual state assertions that do not rely only on snapshots.

**Complete when:** adding a new relationship rule requires no topology component rewrite.

### Phase 5 — Ingress vertical slice

**Objective:** explain and validate Ingress to Service routing.

**Likely files:** `src/domain/resources/ingress.ts`, `src/domain/relationships/rules/ingress-service.ts`, `src/domain/diagnostics/rules/ingress-*`, `src/content/examples/ingress-*`.

**Tasks:**

- Extract v1 `defaultBackend` and every HTTP path Service backend with source paths.
- Resolve only inside the Ingress namespace.
- Match named and numeric backend ports against Service `spec.ports`.
- Preserve multiple paths to the same Service as evidence without visual edge spam.
- Surface unsupported resource backends as generic/unsupported information, not false missing-Service errors.
- Add routing-chain inspector copy, verification commands, valid/missing-Service/missing-port examples, and source jumps.

**Tests required:** default backend, multiple hosts/paths, named port, numeric port, missing Service, missing port, same Service name in two namespaces, duplicate Services, resource backend, and E2E issue-to-source navigation.

**Complete when:** all three expected Ingress states—valid, missing Service, missing port—are deterministic and explained accurately.

### Phase 6 — Configuration, Secret, and storage vertical slice

**Objective:** cover the common Pod-spec dependency paths once and reuse them.

**Likely files:** `src/domain/resources/pod-spec.ts`, `src/domain/relationships/rules/workload-config.ts`, `src/domain/relationships/rules/workload-storage.ts`, matching diagnostic rules and examples.

**Tasks:**

- Create one Pod-spec traversal for Pod and Deployment that visits normal and init containers.
- Extract ConfigMap references from `envFrom`, `env.valueFrom`, ConfigMap volumes, and projected sources.
- Extract Secret references from the corresponding environment/volume forms and `imagePullSecrets`.
- Extract PVC claim names from volumes.
- Respect `optional: true`: still show the relationship, but reduce/omit missing-target severity according to Kubernetes semantics and explain it.
- Resolve all namespaced targets in the workload namespace.
- Deduplicate repeated references into one edge while preserving every evidence path.
- Redact Secret values everywhere outside the user-controlled YAML editor/source buffer, including inspector, error objects, copy, and test reports.
- Add missing ConfigMap, Secret, PVC, and valid dependency examples.

**Tests required:** every supported field path, init/multiple containers, repeated refs, projected volume, optional refs, same names cross-namespace, missing/provided target, Secret redaction, and E2E example flows.

**Complete when:** one new supported workload kind can reuse these extractors without duplicating field traversal.

### Phase 7 — Identity and RBAC showcase slice

**Objective:** make Pod/Workload to ServiceAccount to binding to role relationships a flagship feature without claiming full authorization simulation.

**Likely files:** `src/domain/resources/rbac.ts`, `src/domain/relationships/rules/workload-service-account.ts`, `role-binding.ts`, `cluster-role-binding.ts`, matching diagnostics, inspector content, and fixtures.

**Tasks:**

- Resolve explicit workload ServiceAccounts; represent default ServiceAccount behavior as inferred informational context.
- Parse RoleBinding subjects, including ServiceAccount namespace semantics, while retaining User/Group subjects as generic subject data.
- Resolve RoleBinding `roleRef` to Role in the binding namespace or ClusterRole at cluster scope.
- Resolve ClusterRoleBinding only to ClusterRole and require an explicit namespace for ServiceAccount subjects.
- Render the identity chain and explain binding scope separately from role definition scope.
- Do not calculate a definitive “can user X perform verb Y” answer in V1.
- Add missing subject, missing Role, RoleBinding-to-ClusterRole, and valid chain examples.

**Tests required:** binding namespace, explicit cross-namespace ServiceAccount subject where valid, User/Group subjects, Role and ClusterRole refs, invalid roleRef kinds, ClusterRoleBinding scope, duplicate/ambiguous targets, default ServiceAccount, and E2E chain navigation.

**Complete when:** the graph and text view accurately explain both `RoleBinding -> ClusterRole` and namespaced permission scope.

### Phase 8 — Explanations, examples, responsive UX, and documentation

**Objective:** turn correct analysis into a coherent public learning product.

**Likely files:** `src/domain/explanations/*`, `src/content/concepts/*`, `src/content/examples/*`, `src/app/docs/*`, `src/app/examples/*`, responsive feature components, `README.md`.

**Tasks:**

- Generate deterministic architecture prose from sorted namespaces, resource roles, and resolved relationships.
- Standardize diagnostic content into Problem, Why it matters, Evidence, Verify, and Possible direction.
- Finish six curated V1 examples with expected-diagnostic assertions.
- Implement example query strings without arbitrary YAML serialization.
- Add desktop/tablet/mobile layouts and full-screen mobile inspector behavior.
- Create supported resources, diagnostics, limitations, privacy, architecture, local setup, contributing, and roadmap documentation.
- Add screenshots/GIF only after UI stabilizes; ensure samples contain no real identifiers or secrets.
- Run copy review for beginner clarity and Kubernetes accuracy.

**Tests required:** deterministic explanation snapshots using structured sentence fragments, no stale facts when input changes, example contract tests, query parsing, responsive E2E, all empty/error/loading states, and docs link checks.

**Complete when:** a first-time user can understand the purpose and run the primary flow without external guidance.

### Phase 9 — V1 hardening and public release

**Objective:** close production, privacy, performance, accessibility, and repository-quality gaps.

**Likely files:** error boundaries, security metadata, CI adjustments, release docs, all test suites.

**Tasks:**

- Add recoverable feature and route error boundaries that never log manifest content.
- Enforce parser/input limits and friendly recovery.
- Verify no fetch/XHR/beacon/WebSocket is caused by analysis.
- Add a static content security policy where the host supports it and document GitHub Pages header limitations.
- Run measured 10/50/100-resource fixtures and optimize only observed hot paths.
- Run Chromium/Firefox/WebKit desktop and representative mobile projects for release candidates.
- Complete axe, keyboard, screen-reader, zoom, contrast, and reduced-motion checks.
- Audit dependencies/licenses, action pinning, production bundle, static artifact contents, metadata, and source maps policy.
- Finish README, contribution guide, roadmap links, screenshots, limitations, and release notes.
- Tag V1 only after the release checklist is fully marked.

**Tests required:** full unit/component/E2E suite, release browser matrix, production artifact inspection, privacy/network regression, brand scan, performance fixtures, and manual acceptance test.

**Complete when:** section 18 and the V1 release gate in `CHECKLIST.md` are entirely satisfied.

### Planned commit sequence

Keep commits independently understandable and green where possible:

1. `docs(plan): define kuberelate architecture and delivery checklist`
2. `chore(app): scaffold static nextjs typescript project`
3. `ci: add gated test build and pages deployment pipeline`
4. `feat(parser): parse multi-document yaml with source locations`
5. `feat(resources): normalize kubernetes resource identity and scope`
6. `feat(editor): add accessible kubernetes yaml editor`
7. `feat(relations): infer service workload selector matches`
8. `feat(diagnostics): explain unmatched service selectors`
9. `feat(graph): render resource relationships and list alternative`
10. `feat(relations): resolve ingress service backends and ports`
11. `feat(relations): resolve workload config secret and pvc references`
12. `feat(rbac): visualize service account binding and role chains`
13. `feat(explain): generate deterministic architecture summaries`
14. `feat(ui): complete responsive accessible workbench`
15. `docs: prepare kuberelate v1 release documentation`

Do not mix mechanical formatting, unrelated refactors, and a domain rule in the same commit.

---

## 12. First Vertical Slice

### 12.1 Exact input fixture

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: demo
spec:
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.27
---
apiVersion: v1
kind: Service
metadata:
  name: web
  namespace: demo
spec:
  selector:
    app: website
  ports:
    - name: http
      port: 80
      targetPort: 80
```

### 12.2 End-to-end analysis flow

1. **Editor:** CodeMirror updates memory-only source text. After roughly 250 ms without input, the workbench calls the pure analyzer.
2. **Parser:** `parseAllDocuments` returns two error-free documents and ranges for the Service selector and Deployment template labels.
3. **Normalization:** resources become `apps/Deployment/demo/web` and `core/Service/demo/web` identities. The API group keeps same-named kinds from different groups distinct.
4. **Indexing:** both enter the `demo` namespace index. Deployment template label token `app=web` enters the inverted workload-label index.
5. **Selector logic:** Service selector matching requires every pair in `{app: website}` to exist with the same value in candidate Pod labels. `app=web` fails; different namespaces would never become candidates.
6. **Relationship result:** emit one inferred unresolved relationship, `Service/demo/web --selects--> no supplied matching workload`, with selector evidence. The Deployment can be retained as a comparison candidate, not mislabeled as a target.
7. **Diagnostic:** emit stable code `KG-SVC-001`, severity `warning`, certainty `input-scoped`, title “Service selector matches no supplied workload.” Evidence states expected `app=website` and comparison label `app=web` without claiming a live endpoint failure.
8. **Graph:** show Service and Deployment resource nodes. The Service carries a warning badge and a dashed edge to a clearly styled non-resource “No matching workload” placeholder. Selecting the issue may softly highlight the comparison Deployment but must label why it is only a candidate.
9. **Text alternative:** show “Service `demo/web` selects no supplied Pod or supported Pod template using `app=website`.”
10. **Explanation:** explain that a Service selects Pods by labels, a Deployment only supplies a Pod-template inference, and the live cluster may contain other matching Pods.
11. **Verification commands:** offer namespaced commands such as:

```bash
kubectl get service web -n demo -o yaml
kubectl get pods -n demo --show-labels
kubectl get endpointslice -n demo -l kubernetes.io/service-name=web
kubectl describe service web -n demo
```

12. **Navigation:** “View selector” focuses the Service selector lines; “Compare workload labels” focuses the Deployment template-label lines; focus and active-panel state are announced accessibly.

### 12.3 Matching semantics

- A non-empty Service selector matches when all selector key/value pairs equal candidate Pod labels; candidate labels may contain additional keys.
- The Service and candidate must have the same effective namespace.
- Pod uses `metadata.labels`; Deployment uses `spec.template.metadata.labels`.
- A selectorless Service is valid and does not produce the no-workload diagnostic.
- `ExternalName` Service does not use selectors and is excluded.
- Multiple matches are valid; create one inferred relation per target and optionally an informational observation.
- Deployment `spec.selector` mismatch with its own template is a separate definite diagnostic.
- The engine does not infer a target from resource names or “closest” labels.

### 12.4 Required tests for the slice

- Parser and source range for the exact fixture.
- Normalized IDs and effective namespaces.
- Exact match, selector-subset match, value mismatch, missing key, empty selector, and extra Pod labels.
- Same labels in a different namespace do not match.
- Pod and Deployment template matches.
- One Service matching multiple workloads.
- Selectorless and `ExternalName` Services do not warn.
- Diagnostic code, severity, certainty, ordering, safe evidence, and commands.
- No resolved relationship is emitted for the mismatch.
- Graph unresolved-node adapter and relationship-list parity.
- Component flow from issue to inspector and source.
- Playwright flow: load example, see two resources, see warning, select warning, focus Service, navigate to YAML.
- axe scan and keyboard-only equivalent of the same flow.

---

## 13. Testing Plan

### 13.1 Unit tests

Pure domain tests cover parser behavior, source mapping, normalization, API group parsing, scope, IDs, indexes, selectors, Pod-spec extraction, each relationship rule, each diagnostic rule, deterministic explanation, graph adapter, and layout input/output.

Prefer table-driven tests and small builders. A rule test must assert both positive and negative cases, exact certainty, source path, namespace behavior, stable code, and safe evidence.

### 13.2 Fixture contract tests

Store sanitized fixtures under `src/test/fixtures/<category>/` with an adjacent expected summary or inline test expectation. At minimum:

- valid and broken Service selectors;
- same names in multiple namespaces;
- matching and invalid Deployment selectors;
- Ingress valid/missing Service/missing named or numeric port;
- every ConfigMap/Secret/PVC reference form;
- optional references;
- RoleBinding to Role and ClusterRole;
- ClusterRoleBinding and cross-namespace ServiceAccount subjects;
- duplicate resources, `List`, empty documents, aliases, malformed YAML, template expressions, and unknown CRDs;
- a working multi-tier set and a mixed set with multiple independent diagnostics.

Every built-in example is also a test fixture with an asserted resource/relationship/diagnostic contract. This prevents educational copy and analyzer output from drifting apart.

### 13.3 Component/integration tests

- Editor toolbar, parse announcements, and source navigation.
- Resource list, diagnostic sorting/filtering, expandable explanation sections, command copy, and Secret redaction.
- Graph/list toggle, node/edge selection, missing target, focus management, mobile tabs, and empty/error/loading states.
- Store selectors ensure unrelated panels do not re-render excessively.
- Avoid broad snapshots; assert roles, names, user behavior, and structured output.

### 13.4 End-to-end tests

Every push runs a small Chromium suite against the production static export:

1. shell and privacy copy load;
2. broken Service example produces the expected resource count and `KG-SVC-001` flow;
3. valid example has no error diagnostics;
4. malformed YAML recovers after correction;
5. one mobile-tab flow;
6. analysis triggers no manifest network transmission.

Release candidates add Firefox, WebKit, desktop Chromium, and representative mobile emulation. Traces/screenshots/videos are uploaded only on failure and use synthetic fixtures.

### 13.5 Accessibility and visual regression

- axe checks for shell, empty workbench, populated graph/list, open inspector, diagnostics, and mobile navigation.
- Manual keyboard and screen-reader verification remains a release gate.
- Use a very small set of stable screenshot assertions only for high-risk layout states after the visual system settles; do not make pixel snapshots the primary UI test.

### 13.6 Privacy/security regressions

- Assert Secret values never appear in rendered text outside the YAML editor, diagnostic objects, architecture explanations, logs, URLs, or storage.
- Intercept `fetch`, XHR, beacon, and WebSocket during analysis and fail if manifest-derived traffic occurs.
- Assert manifest text is absent from `localStorage` and `sessionStorage` by default.
- Test malicious names/labels containing HTML and script-like text render only as text.
- Test alias-expansion and oversized-input limits.
- Scan the exported artifact for the prohibited legacy brand and known real-looking fixture markers.

### 13.7 Coverage policy

Start with meaningful global floors of 80% lines/statements/functions and 75% branches once V0 stabilizes. Hold parser, selector, identity, relationship, and diagnostic domain folders to at least 90% lines/statements and 85% branches. Raising a threshold is preferred; lowering it requires an explained plan change. Coverage never replaces missing edge-case assertions.

### 13.8 CI behavior

- No watch mode, retries that hide deterministic failures, or network-dependent tests.
- Use one Playwright worker in CI for reproducibility.
- Cache npm downloads, not `node_modules` or browser binaries.
- Use only synthetic manifest fixtures in artifacts.
- A skipped required suite is a pipeline failure unless the skip is explicitly documented and time-bounded.

---

## 14. Performance Plan

### Input safety limits

Begin with explicit, configurable limits: 2 MiB source text, 250 YAML documents, 500 normalized resources, and the YAML library's bounded alias expansion (never disabled). Display a helpful limit diagnostic and leave the editor content intact. Revisit limits from real use rather than silently increasing them.

### Analysis efficiency

- Parse once per debounced source revision, not once per panel.
- Build `Map<ResourceKey, ResourceId[]>`, kind, namespace, and source-order indexes in one pass.
- Build an inverted Pod-label index keyed by namespace plus `key=value`. Service matching intersects the smallest candidate sets instead of scanning every workload for every selector where possible.
- Extract Pod-spec references once into normalized projections reused by relationship and diagnostic rules.
- Resolve explicit references with constant-time key lookup.
- Aggregate repeated references as evidence on one relationship.
- Sort only at stable output boundaries, not inside each lookup.
- Memoize graph adaptation by the immutable analysis revision and filter state.

### UI responsiveness

- Debounce analysis by approximately 250 ms while typing; paste may analyze immediately on the next frame when safe.
- Lazy-load editor and topology chunks with useful skeletons.
- Memoize custom graph nodes and keep node/edge type maps outside render functions.
- Enable React Flow visible-element rendering when measurements show a benefit.
- Do not render large raw-object trees by default; inspectors progressively disclose important fields.
- Consider virtualizing resource/diagnostic lists only after approximately 200 rows or measured jank.

### Measurement gates

Create deterministic 10-, 50-, 100-, and 500-resource synthetic fixtures. Record parse, normalize, index, relation, diagnostic, and graph-adapter timings locally with `performance.now()`; do not transmit them. The initial target is an analysis pipeline under 150 ms for a 100-resource supported fixture on a typical development laptop, excluding the intentional debounce. CI tracks gross regressions but does not enforce fragile wall-clock microbenchmarks initially.

A Web Worker is a V1.1 contingency. Add it only if 100-resource interaction or paste produces measurable main-thread blocking after indexing and render fixes. Keep the pure `analyzeManifest` boundary worker-compatible from day one.

---

## 15. Security and Privacy Review

| Threat | Control | Verification |
| --- | --- | --- |
| Manifest exfiltration | No analyzer network code, analytics, remote logging, or API; browser-only dependencies | Playwright network interception and bundle/code review |
| Secret disclosure outside the source editor | Redaction adapter hides `data`/`stringData` values in inspectors and derived views; show key names only | Unit/component/E2E sentinel-secret tests |
| Secret disclosure in state/storage | Memory-only source; preferences whitelist excludes source and raw resources | Storage assertions after paste/reload |
| Secret disclosure in URLs | Only predefined example IDs; no arbitrary YAML serialization | Router tests and artifact review |
| XSS through YAML fields | Keep values as `unknown`, render through React text nodes, prohibit unsafe HTML, sanitize any future export | Script-like fixture tests and lint rule/review |
| Prototype/cyclic/alias abuse | Strict parser options, bounded aliases, guarded traversal, cycle-safe utilities | Alias bomb, cycle, duplicate-key, and malformed fixtures |
| Browser denial of service | Source/document/resource limits, debounce, bounded inspector rendering, recoverable errors | Oversized and adversarial fixture tests |
| Accidental logging | No source/raw objects in console or error boundary payloads; generic caught-error messages | Spy on console/reporting hooks in tests |
| Clipboard surprise | Copy only on explicit activation and label exactly what will be copied | Component and keyboard tests |
| Third-party asset leakage | Self-host assets/fonts; no CDN images, scripts, or fonts | Production request and artifact inspection |
| Dependency/supply-chain issue | Lockfile, pinned CI actions, deliberate upgrades, license/audit review before release | Clean-install and release audit |
| Brand contamination | Scan shipped source, metadata, manifest, examples, and `public/` output | `check:brand` in every CI run |

### Content Security Policy

Use the strictest static-compatible policy the deployed host supports: self-hosted scripts/styles/assets, no objects, restricted base/form targets, and same-origin-only connections needed for static Next.js navigation. GitHub Pages does not provide arbitrary response headers, so any meta-policy limitations—especially framing controls—must be documented. Do not weaken the policy to accommodate analytics or remote fonts in V1.

### Secret behavior

The parser necessarily holds user input in browser memory. KubeRelate must not decode Secret data automatically, include raw values in evidence, show them in architecture explanations, send them to clipboard through a generic “copy resource” action, or persist them. If a later raw-YAML inspector is added, Secret value ranges remain masked by default and reveal requires an explicit, local-only user action.

### Analytics decision

V1 has no analytics. A later privacy review may permit coarse events such as example ID or count buckets, but event types must have closed schemas that cannot accept names, namespaces, field values, YAML, or free-form error messages. The product remains fully usable when analytics is absent or blocked.

---

## 16. Standalone Hosting Plan

The earlier embedded-site integration is intentionally out of scope. KubeRelate ships as its own product and must not inherit another site's name, URL, logo, navigation, footer, analytics, design tokens, or metadata.

### Initial deployment

- Repository: `debjotyms/kuberelate`.
- Initial visibility: private while foundational work is verified; switch to public for the open-source launch.
- Host: GitHub Pages through the gated Actions workflow.
- Initial base path: `/kuberelate` for project Pages; local development stays at `/`.
- Routes: `/` for the workbench, `/docs`, `/examples`, and static `?example=<id>` state.
- Artifact: Next.js `out/`, built once after quality checks and used for E2E and deployment.

### Repository settings needed before first deployment

- After the repository becomes public, enable GitHub Pages with GitHub Actions as the source.
- Confirm Actions and environment permissions are available.
- Decide whether `main` branch protection can require the workflow checks.
- Confirm the final public URL and whether a custom domain/CNAME is planned.
- If a custom domain removes the repository base path, update and test asset/routing configuration before DNS changes.
- Decide whether public source maps are acceptable; default to framework production behavior and inspect the artifact.

An external community or portfolio site may link to KubeRelate later without changing the KubeRelate UI or runtime. Any future embedding/integration is a separate decision and cannot silently introduce manifest telemetry.

---

## 17. Development Milestones

### Milestone 0 — Plan established

**Outcome:** architecture, stack, scope, CI/CD, roadmap, risks, and checklist exist.
**Gate:** no unresolved decision blocks scaffolding.

### Milestone 1 — Foundation and CI/CD

**Outcome:** a static KubeRelate shell, reproducible toolchain, test foundation, and gated Pages workflow exist.
**Gate:** the local Node 24 gate passes, every push is tested, and a green `main` revision deploys the tested artifact.

### Milestone 2 — YAML to resource list

**Outcome:** editor, multi-document parser, normalized identities, source locations, generic unknown kinds, and parser diagnostics.
**Gate:** V0 tests and the production Pages pipeline are green.

### Milestone 3 — Service to Deployment/Pod analysis

**Outcome:** namespace-aware selector inference, mismatch diagnostic, evidence, commands, source jumps, working/broken examples.
**Gate:** section 12 acceptance flow passes locally and in CI.

### Milestone 4 — Interactive topology

**Outcome:** graph and text relationship views, reusable adapter/layout, inspector, keyboard interaction, mobile fallback.
**Gate:** a new relationship type can be rendered without topology refactoring.

### Milestone 5 — Core traffic/configuration/storage diagnostics

**Outcome:** Ingress to Service/port and workload to ConfigMap/Secret/PVC relationships with examples and safe evidence.
**Gate:** supported field-path matrix and all missing/valid states are covered.

### Milestone 6 — Identity and RBAC

**Outcome:** workload to ServiceAccount to binding to Role/ClusterRole chains and accurate scope explanations.
**Gate:** RoleBinding-to-ClusterRole and ClusterRoleBinding cases pass adversarial namespace fixtures.

### Milestone 7 — Public V1 candidate

**Outcome:** deterministic architecture explanation, six examples, docs/README, responsive workbench, accessibility and privacy hardening.
**Gate:** complete release checklist with no open P0/P1 issue.

### Milestone 8 — V1.1 polish

**Outcome:** measured layout, filtering, search, namespace grouping, docs gallery, and 100-resource usability improvements.
**Gate:** performance/accessibility targets pass without weakening V1 correctness.

### Milestone 9 — V2 CKA mode

**Outcome:** expanded workloads/storage/networking and guided troubleshooting mode.
**Gate:** every scenario is driven by the common analysis model and has fixtures/E2E coverage.

---

## 18. Release Checklist

The detailed, markable version is in `CHECKLIST.md`. A release is not ready until all applicable items below are evidenced.

### Correctness

- All supported resource, relationship, diagnostic, namespace, duplicate, and unknown-kind cases pass.
- Diagnostic wording distinguishes definite, input-scoped, and runtime-only claims.
- Built-in examples assert exact expected results.
- No skipped required tests or unexplained flaky retries.

### CI/CD and artifact

- Every push and pull request runs format, lint, typecheck, coverage, brand scan, build, and Chromium E2E.
- Only a green `main` push deploys; a failing check demonstrably blocks deploy.
- Tested `out/` artifact is the deployed artifact.
- Actions use least privilege and pinned versions; concurrent stale deploys are canceled.
- Production URL, direct routes, 404 behavior, base path, asset paths, metadata, icon, and web manifest work.

### Browsers and responsive behavior

- Chromium, Firefox, WebKit, and representative mobile emulation pass the release suite.
- Manual checks cover current Chrome/Firefox and Safari when available.
- 320px reflow, tablet, desktop, 200% zoom, touch targets, and orientation changes remain usable.

### Accessibility

- Automated axe suite has no serious/critical violations.
- Full primary flow works keyboard-only with visible focus and logical order.
- Graph has complete text parity and useful screen-reader names.
- Screen-reader smoke tests, reduced motion, contrast, live announcements, and focus restoration pass.

### Privacy and security

- Pasted YAML triggers no manifest processing request.
- Manifest text is not persisted by default and never appears in URLs.
- Secret values are absent from all derived UI outside the YAML editor, diagnostics, explanations, storage, logs, analytics, reports, and screenshots.
- Malicious labels/names render as text; parser limits and error boundaries recover safely.
- No remote font/script/image dependency or analytics SDK is in the artifact.
- Prohibited legacy brand scan passes for source and exported website.

### Product quality

- Empty, parsing, partial-analysis, valid, warning, error, oversized-input, and internal-error states are intentional.
- Issue to topology to inspector to source navigation is clear.
- Six examples, privacy copy, static-analysis disclaimer, and troubleshooting commands are reviewed.
- Resource names and dense graphs remain readable; 100-resource behavior is measured.

### Repository and documentation

- README covers purpose/story, features, screenshots, privacy, resources, diagnostics, architecture, local setup, contributing, roadmap, limits, and disclaimer.
- License and third-party notices are correct.
- Contribution commands match CI exactly.
- Screenshots/GIF use synthetic data and match the release.
- Changelog/release notes list scope and known limitations.
- Working tree is reviewed so unrelated user changes are not included accidentally.

---

## 19. Future Kyverno Evolution

V1 should be extensible for policy resources without importing Kyverno concepts into every core type.

### Extension boundaries to preserve

- The resource registry dispatches by API group and kind. Generic resources remain valid even when no adapter is installed.
- Relationship and diagnostic engines consume registered rules through stable interfaces.
- Relationship evidence supports arbitrary safe field paths and structured metadata.
- The graph adapter already supports non-resource/unresolved presentation nodes, so policy-rule nodes can be introduced later without pretending they are Kubernetes API objects.
- Rule codes and content live with their extension, for example `extensions/kyverno/diagnostics` in V3.

### V3 model evolution

Add a discriminated `AnalysisEntity` only when needed:

```ts
type AnalysisEntity =
  | { type: 'resource'; resource: ResourceId }
  | { type: 'policy-rule'; policy: ResourceId; ruleName: string }
  | { type: 'policy-result'; report: ResourceId; resultIndex: number }
```

Then adapters can produce:

```text
Policy / ClusterPolicy
  -> contains -> Policy rule
  -> matches or excludes -> supplied resource
  <- reports result through <- PolicyReport / ClusterPolicyReport
```

### Technical boundaries

- Policy selection is deterministic only for the supported match/exclude subset and supplied resource data.
- KubeRelate does not execute mutations, generate resources, call admission, or claim a policy will pass in a live cluster.
- PolicyReport results are reported observations from the pasted object, not independently verified facts.
- Kyverno version/API differences live in adapter fixtures and compatibility metadata.
- No Kyverno package, schema set, UI copy, or virtual-rule complexity enters V1 bundles.

This preserves a clean path to policy visualization while keeping the initial analyzer small and generally useful.

---

## 20. Risks and Scope Traps

| Risk / trap | Impact | Mitigation / decision |
| --- | --- | --- |
| Treating Deployment as a Service's literal target | Teaches incorrect Kubernetes semantics | Label the edge inferred through the Pod template and explain that Services select Pods |
| Missing-from-input phrased as missing-from-cluster | False confidence and technical inaccuracy | Encode `input-scoped` certainty and lint/review diagnostic copy |
| Full schema validation in V1 | Version explosion and huge bundles | Validate only the envelope and supported projections; document the boundary |
| Live-cluster connection | Credentials, backend, security, and product-scope explosion | Explicit non-goal through V3 |
| Automatic fixes/YAML mutation | Source mapping and unsafe recommendations | Explain direction only; postpone editing/fixes |
| Helm/Kustomize rendering | Requires toolchains, templates, files, and security review | Detect unsupported templates and postpone |
| Complete RBAC evaluation | Aggregation, groups, live bindings, impersonation, and admission complexity | Visualize structural chains only in V1 |
| Deep NetworkPolicy claims | CNI/runtime behavior can contradict static view | V2 basic selection first; qualify every peer/connectivity statement |
| Graph-first accessibility | Excludes keyboard and screen-reader users | Relationship list is a first-class view with parity tests |
| Namespace grouping too early | Dagre compound-layout complexity delays value | Start with namespace badges/filtering; reassess ELK in V1.1 |
| Monaco or comprehensive UI suite | Unnecessary bundle and design-system weight | Use modular CodeMirror and project-owned primitives |
| Premature Web Worker | Serialization/source-map complexity before measured need | Keep pure worker-ready API; add only from performance data |
| Arbitrary YAML share URLs | Leaks Secrets/history and breaks URL limits | Predefined example IDs only |
| Manifest persistence by default | Leaves sensitive configuration on shared devices | Memory-only V1; explicit opt-in review later |
| Analytics/error SDK | Easy accidental payload leakage | No telemetry in V1; closed-schema privacy review later |
| Official CNCF/Kubernetes logo reuse | Trademark/affiliation confusion | Use inspired tokens and a custom mark; follow published guidelines |
| Initial working-name collisions | Search confusion and weak product distinctiveness | Use the screened `KubeRelate` identity consistently and repeat screening before V1 launch |
| Building V2 while V1 is incomplete | Broad but shallow portfolio result | Checklist gates forbid starting the next version before V1 release criteria |
| Giant “Kubernetes engine” modules | Hard-to-test coupling and regressions | Small extractors/rules, shared context, explicit registry, colocated tests |
| Optimizing only for screenshots | Tool feels like a toy on real input | Fixture breadth, 100-resource measurement, text view, malformed-input recovery |
| Generated-looking commit history | Weakens portfolio evidence | Small semantic commits with tests and rationale; no bulk final dump |

### Scope rule

When a proposed task does not directly satisfy the current milestone exit criteria, put it in the roadmap rather than the active sprint. Finish one vertical slice—including tests, accessibility, content, and deployment—before opening the next.
