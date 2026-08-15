# KubeRelate Delivery Checklist

> Current state: Milestone 5 Ingress-to-Service slice complete; reusable Pod-spec traversal next
> Active milestone: **Milestone 5 — Ingress, configuration, Secret, and storage**
> Detailed rationale and architecture: [PLAN.md](./PLAN.md)

## How to use this tracker

- Mark an implementation item `[x]` when its code, relevant tests, and documentation pass locally.
- Keep remote deployment items open until the corresponding GitHub Actions run or repository setting is verified.
- Add the pull request or commit link beside a milestone when it closes.
- Do not mark a milestone complete while one of its required child items is open.
- Do not start a later product version while the current version's release gate is open.
- If scope changes, update `PLAN.md` and this checklist in the same commit.
- Bugs found during a milestone belong to that milestone unless explicitly deferred with a reason.

Status convention:

- `[x]` complete and evidenced
- `[ ]` not complete
- `N/A — reason` intentionally not applicable

---

## Milestone 0 — Planning baseline

**Outcome:** KubeRelate has an implementation-ready product, architecture, test, and release plan.

- [x] Analyze the original private product brief before preparing the public repository.
- [x] Define KubeRelate as a standalone product.
- [x] Record that the shipped website must contain no legacy community-site branding, URLs, logos, routes, metadata, or analytics identifiers.
- [x] Choose a custom CNCF-inspired visual direction without implying CNCF affiliation.
- [x] Perform a preliminary product-name collision search and replace the initial working name with `KubeRelate`.
- [x] Define browser-only processing, no backend, no accounts, no AI, and no live-cluster access for V1.
- [x] Distinguish explicit, inferred, input-scoped, and runtime-only claims.
- [x] Select the core stack and document alternatives/risks.
- [x] Define the domain model, relationship matrix, and diagnostic matrix.
- [x] Define the version roadmap and vertical-slice order.
- [x] Define CI/CD, testing, accessibility, performance, security, and privacy gates.
- [x] Create this living checklist.

**Milestone gate**

- [x] Another engineer can start Milestone 1 without an unresolved architectural choice.

---

## Milestone 1 — Foundation and CI/CD

**Outcome:** a minimal static site is tested on every push and deployed only after passing checks.

### Project scaffold

- [x] Scaffold Next.js App Router with `src/`, strict TypeScript, Tailwind, and ESLint.
- [x] Configure `output: 'export'` and `trailingSlash: true`; verify the app requires no production Node server.
- [x] Avoid runtime image optimization or configure static-compatible local images.
- [x] Pin Node.js 24 LTS in `.nvmrc`, `package.json`, and CI.
- [x] Use npm and commit `package-lock.json`.
- [x] Add base-path configuration for local `/` and GitHub project Pages `/kuberelate`.
- [x] Confirm no API routes, server actions, middleware, authentication, database, or remote manifest processing exist.

### Basic product shell

- [x] Select `KubeRelate` as the public name after preliminary package, domain, source-host, and trademark collision screening; use `kuberelate` as the repository slug.
- [x] Centralize product name/tagline/URLs so a pre-release rename does not touch domain logic.
- [x] Add semantic header/main structure and skip link.
- [x] Add the selected product name, tagline, privacy statement, and static-analysis disclaimer.
- [x] Add static metadata, favicon/custom mark, and web manifest.
- [x] Add initial CNCF-inspired light/dark design tokens with contrast-safe text colors.
- [x] Use a custom product identity; do not use CNCF/Kubernetes logos as product branding.
- [x] Ensure no runtime remote font, script, image, or analytics request.

### Local quality commands

- [x] Add `npm run dev`.
- [x] Add `npm run build`.
- [x] Add `npm run lint`.
- [x] Add `npm run typecheck`.
- [x] Add `npm run format` and `npm run format:check`.
- [x] Add `npm run test` and `npm run test:coverage`.
- [x] Add `npm run test:e2e`.
- [x] Add `npm run check:brand` for shipped website source/assets/output.
- [x] Document all commands in the README starter section.

### Test foundation

- [x] Configure Vitest and React Testing Library.
- [x] Add one semantic shell/component test.
- [x] Configure Playwright against the production static output.
- [x] Add one direct-load smoke test.
- [x] Configure axe integration for representative pages/components.

### GitHub Actions pipeline

- [x] Trigger CI for every push.
- [x] Trigger CI for every pull request targeting `main`.
- [x] Add manual workflow dispatch.
- [x] Add per-branch concurrency and cancel stale runs.
- [x] Add least-privilege `quality` job: clean install, format, lint, typecheck, coverage, and brand scan.
- [x] Add `build` job after quality and upload the `out/` artifact.
- [x] Add Chromium `e2e-smoke` job against the built artifact.
- [x] Upload Playwright evidence only on failure and only from synthetic fixtures.
- [x] Add `deploy` job only for green public-repository runs from `main`.
- [x] Deploy the same tested artifact to the `github-pages` environment.
- [x] Pin official actions and enable npm caching without caching `node_modules` or browser binaries.
- [x] Verify a deliberately failing test returns a nonzero quality result and the job dependency chain blocks build/deployment.
- [x] Verify a green private `main` push completes quality, build, and E2E jobs successfully.
- [x] Make repository public and transition deployment to Vercel with automated CI quality gate.
- [x] Require quality/build/E2E checks on `main` when repository settings allow it.

**Milestone gate**

- [x] `npm ci && npm run format:check && npm run lint && npm run typecheck && npm run test:coverage && npm run build` passes locally with pinned Node.js 24.19.0.
- [x] Every push is tested by the committed workflow.
- [x] Only a fully green revision passes the CI quality gate.
- [x] The public static export passes Chromium Playwright smoke tests, axe accessibility audits, and contains no prohibited branding.

CI evidence: [CI workflow run](https://github.com/debjotyms/kuberelate/actions/runs/31870467862).
The `Quality`, `Static export`, and `Chromium smoke` checks run on every push and PR; deployment is configured for Vercel.

---

## Milestone 2 — YAML to resource list (V0)

**Outcome:** users can paste multi-document YAML and inspect source-aware normalized resources without crashes.

### Editor

- [x] Lazy-load CodeMirror 6 and YAML support.
- [x] Add a visible editor label, line numbers, highlighting, history, search, and keyboard help.
- [x] Add Load example, Clear, and Reset actions.
- [x] Add polite parse/analyze status announcements.
- [x] Keep source text in memory only.

### Parser and source mapping

- [x] Parse multiple documents with `parseAllDocuments`.
- [x] Track line/column ranges with `LineCounter`.
- [x] Ignore empty documents cleanly.
- [x] Return structured errors/warnings without throwing into React.
- [x] Analyze valid documents when another document is malformed and label results partial.
- [x] Keep duplicate-key validation strict.
- [x] Apply bounded alias expansion; never disable the limit.
- [x] Add source/document/resource limits with recoverable messages.

### Normalization and indexing

- [x] Validate the minimal `apiVersion`/`kind`/`metadata.name` envelope from `unknown`.
- [x] Split API group and version correctly, including the core group.
- [x] Add known namespaced/cluster-scoped kind registry.
- [x] Apply effective `default` namespace only to known namespaced kinds.
- [x] Preserve source document and relevant field ranges.
- [x] Expand Kubernetes `List` objects.
- [x] Preserve and diagnose duplicate canonical identities.
- [x] Display unknown CRDs generically without crashing.
- [x] Generate stable occurrence IDs and canonical keys.
- [x] Build initial identity/kind/namespace indexes.

### UI

- [x] Show resource count and ordered resource list.
- [x] Show kind, name, effective namespace/scope, source document, and support level.
- [x] Show parse and identity diagnostics.
- [x] Jump from a resource/parse issue to the relevant source line.
- [x] Complete intentional empty, malformed, partial, oversized, and valid states.

### Required test matrix

- [x] Empty input and empty documents.
- [x] Valid multi-document YAML.
- [x] Malformed YAML and recovery.
- [x] Correct source line/column mapping.
- [x] Core and grouped API versions.
- [x] Missing/invalid identity fields.
- [x] Explicit/default namespaces and cluster scope.
- [x] Invalid namespace on a known cluster-scoped kind.
- [x] Same name in different namespaces.
- [x] Duplicate identity.
- [x] `List` expansion.
- [x] Anchors/aliases and alias-limit failure.
- [x] Helm/template-like unsupported input.
- [x] Unknown CRD.
- [x] Oversized/document/resource limits.
- [x] Keyboard, axe, and production-export E2E flow.

**Milestone gate**

- [x] Valid resources and precise parser errors appear immediately and never crash the application.
- [x] V0 behavior is documented and all CI checks pass locally.

Milestone 2 evidence: parser/source contract tests, workbench component and axe tests, and production
Chromium tests cover valid, malformed, partial, recovery, keyboard, privacy, Secret-redaction,
light/dark, and 320 CSS pixel states. Coverage floors are enforced at 80% globally and 90% for domain
lines/statements, with 75% and 85% branch floors respectively.

The complete local gate passes with pinned Node.js 24.19.0 and npm 11.18.0: 28 Vitest tests, six
Chromium production-artifact tests at the `/kuberelate` Pages base path, static export, and brand
scan are green.

V0 bundle measurement (2026-08-10): the lazy analyzer/editor chunk is approximately 524 KiB raw and
166 KiB gzip and is not referenced by the initial HTML; the complete static export is approximately
1.4 MiB on disk. Future analyzer-chunk increases above 10% require investigation.

---

## Milestone 3 — Service selector vertical slice

**Outcome:** KubeRelate explains valid and broken Service-to-Pod/Deployment-template selection end to end.

### Domain logic

- [x] Define equality-selector and label-match result types.
- [x] Extract Pod `metadata.labels`.
- [x] Extract Deployment `spec.template.metadata.labels`.
- [x] Add an inverted namespaced workload-label index.
- [x] Match all Service selector pairs as a subset of candidate labels.
- [x] Enforce same-namespace matching.
- [x] Skip selectorless and `ExternalName` Services.
- [x] Support one Service matching multiple supplied workloads.
- [x] Emit inferred relationships only for actual supplied matches.
- [x] Emit an unresolved selector relationship for no match.
- [x] Validate Deployment selector against template labels separately.

### Diagnostic and education

- [x] Add stable code `KG-SVC-001`.
- [x] Use warning severity and input-scoped certainty for no supplied match.
- [x] Show selector and comparison-label evidence without guessing a target.
- [x] Explain that Services select Pods, while Deployment edges are inferred through Pod templates.
- [x] Add namespace-correct `kubectl` and EndpointSlice verification commands.
- [x] Add working and broken Service examples with asserted contracts.

### UI flow

- [x] Show Service and workload resources.
- [x] Show resolved inferred connection or a non-resource unresolved placeholder.
- [x] Use icon/text/style—not color alone—for status and certainty.
- [x] Jump from issue to topology node and Service selector source.
- [x] Jump to comparison Pod-template labels where useful.
- [x] Add resource and relationship inspector basics.
- [x] Add full semantic relationship-list equivalent.

### Required tests

- [x] Exact, subset, missing-key, and different-value selectors.
- [x] Extra workload labels.
- [x] Cross-namespace non-match.
- [x] Pod and Deployment-template targets.
- [x] Multiple valid targets.
- [x] Selectorless and `ExternalName` Services.
- [x] Invalid Deployment selector/template labels.
- [x] Diagnostic code/severity/certainty/evidence/commands/source ranges.
- [x] Stable relationship IDs and no false resolved edge.
- [x] Graph/list parity.
- [x] Issue-to-source component flow.
- [x] Playwright broken and working example flows.
- [x] axe and keyboard-only primary flow.

**Milestone gate**

- [x] The exact first-slice acceptance flow in `PLAN.md` section 12 passes locally and in CI.

Milestone 3 evidence: selector, LabelSelector, relationship, diagnostic, graph-adapter, component,
and production-browser tests cover the exact broken fixture plus working, subset, missing-key,
different-value, cross-namespace, Pod, Deployment-template, multiple-target, selectorless, and
`ExternalName` cases. The local suite passes with 48 Vitest tests and eight Chromium static-export
tests, including axe and keyboard-only issue-to-topology-to-source flows.
GitHub Actions evidence: [CI / Pages run 31417025740](https://github.com/debjotyms/kuberelate/actions/runs/31417025740)
passed Quality, Static export, and Chromium smoke for commit `a5e76e4`.

Milestone 3 bundle measurement (2026-08-10): the lazy analyzer/editor chunk is approximately
562 KiB raw and 176 KiB gzip, a raw increase of about 7.1% from the V0 baseline and below the 10%
investigation threshold. The complete static export remains approximately 1.4 MiB on disk.

---

## Milestone 4 — Reusable interactive topology

**Outcome:** topology infrastructure supports future rules without component rewrites.

- [x] Lazy-load React Flow and Dagre.
- [x] Create a pure domain-to-graph adapter.
- [x] Implement deterministic left-to-right layout and optional top-to-bottom preference.
- [x] Add custom resource, unresolved, and namespace presentation nodes.
- [x] Add semantic edge verbs and explicit/inferred/missing states.
- [x] Add pan, zoom, fit view, and focus-selected controls.
- [x] Add selected resource/relationship/diagnostic store state with narrow selectors.
- [x] Add inspector focus management and safe Secret display policy.
- [x] Enable meaningful node/edge ARIA names and keyboard activation.
- [x] Respect reduced motion.
- [x] Keep text relationship view at feature parity.
- [x] Complete topology empty/loading/error states.
- [x] Measure and record first analyzer and bundle baselines.

**Milestone gate**

- [x] A fixture relationship can be added through domain data only and appears correctly in graph, list, inspector, and keyboard navigation.

Milestone 4 evidence: the framework-free graph adapter, deterministic Dagre layout, Zustand selector
contracts, Secret-safe projection, React Flow component flow, and production-browser suite cover
resource/unresolved/namespace nodes, explicit/inferred/missing edges, both directions, graph/list
parity, inspector focus, node and edge keyboard activation, reduced motion, axe, and the Pages base
path. The local Node.js 24 gate passes with 58 Vitest tests and eight Chromium tests.
GitHub Actions evidence: [CI / Pages run 31420204154](https://github.com/debjotyms/kuberelate/actions/runs/31420204154)
passed Quality, Static export, and Chromium smoke for commit
[`97bfaa6`](https://github.com/debjotyms/kuberelate/commit/97bfaa69cd9cd3acc7b3051441861cb448cbe987).

Milestone 4 baseline (2026-08-11): `npm run measure:analyzer` processed all three built-in examples
(1,511 source bytes) across 750 warmed samples on Node.js 24.16.0 with a 0.273 ms median and
0.640 ms p95. The lazy analyzer/editor chunk remains approximately 563 KB raw and 176 KB gzip;
the nested React Flow/Dagre chunk is approximately 230 KB raw and 74 KB gzip and is absent from
the initial HTML. The complete `/kuberelate` static export is approximately 1.8 MiB on disk.

---

## Milestone 5 — Ingress, configuration, Secret, and storage

**Outcome:** core traffic and workload dependencies are resolved and explained safely.

### Ingress to Service

- [x] Extract v1 default and rule-path Service backends.
- [x] Resolve Service only in the Ingress namespace.
- [x] Validate named and numeric Service ports.
- [x] Preserve multiple backend evidence paths without duplicate edge clutter.
- [x] Handle resource backends as unsupported/generic, not missing Services.
- [x] Add valid, missing-Service, and missing-port examples.
- [x] Add source jumps, inspectors, commands, and tests for all cases.

Ingress slice local evidence (2026-08-11): the Node.js 24 quality gate passes with 72 Vitest tests,
and the exact `/kuberelate` export passes nine Chromium tests. The analyzer benchmark covers all six
built-in examples (2,711 source bytes) across 1,500 warmed samples with a 0.205 ms median and
0.349 ms p95.

### Reusable Pod-spec traversal

- [ ] Traverse Pod and Deployment Pod specs through one adapter.
- [ ] Include normal containers and init containers.
- [ ] Extract ConfigMap `envFrom`, key, volume, and projected references.
- [ ] Extract Secret `envFrom`, key, volume, projected, and `imagePullSecrets` references.
- [ ] Extract PVC volume references.
- [ ] Respect optional reference semantics in severity/copy.
- [ ] Deduplicate edges while preserving every source evidence path.
- [ ] Resolve namespaced targets only in workload namespace.

### Privacy and examples

- [ ] Redact Secret values from inspector, diagnostics, explanations, storage, URLs, logs, and test artifacts.
- [ ] Add sentinel-secret regression tests across domain and UI.
- [ ] Add missing ConfigMap, missing Secret, missing PVC, and valid dependency examples.
- [ ] Complete component/E2E/axe/keyboard coverage for issue navigation.

**Milestone gate**

- [ ] Valid and missing Ingress/ConfigMap/Secret/PVC cases pass the field-path and namespace fixture matrix.
- [ ] No Secret sentinel value appears anywhere outside in-memory source/editor content.

---

## Milestone 6 — ServiceAccount and RBAC showcase

**Outcome:** users can understand workload identity and binding-to-role chains without false permission claims.

- [ ] Resolve explicit workload `serviceAccountName`.
- [ ] Represent effective `default` ServiceAccount as inferred informational context.
- [ ] Parse RoleBinding ServiceAccount/User/Group subjects.
- [ ] Apply correct ServiceAccount subject namespace behavior.
- [ ] Resolve RoleBinding to namespaced Role.
- [ ] Resolve RoleBinding to cluster-scoped ClusterRole.
- [ ] Resolve ClusterRoleBinding only to ClusterRole.
- [ ] Resolve ClusterRoleBinding ServiceAccount subjects with explicit namespace.
- [ ] Add invalid roleRef and missing target diagnostics with correct certainty.
- [ ] Explain binding scope separately from role-definition scope.
- [ ] Do not claim complete effective authorization.
- [ ] Render full workload -> ServiceAccount -> binding -> role chain in graph and list.
- [ ] Add missing subject, missing role, RoleBinding-to-ClusterRole, and valid chain examples/fixtures.
- [ ] Test adversarial namespaces, duplicate targets, User/Group subjects, keyboard navigation, and E2E chain flow.

**Milestone gate**

- [ ] RoleBinding-to-ClusterRole and ClusterRoleBinding behavior is technically accurate, source-linked, tested, and explained.

---

## Milestone 7 — Public V1 product finish

**Outcome:** the correct analyzer becomes a coherent, accessible, responsive, documented public tool.

### Explanations and examples

- [ ] Generate deterministic architecture summaries from sorted domain data.
- [ ] Standardize Problem / Why / Evidence / Verify / Possible direction content.
- [ ] Finish six curated V1 examples with exact contract tests.
- [ ] Add predefined `?example=<id>` links only.
- [ ] Add examples gallery and docs routes.

### Responsive and product UX

- [ ] Finish desktop workbench hierarchy.
- [ ] Add mobile YAML / Topology / Issues / Resources tabs.
- [ ] Default very small screens to relationship list with optional visual graph.
- [ ] Add mobile full-height inspector and predictable Back behavior.
- [ ] Complete resource kind, namespace, severity, and focus filters required for V1 usability.
- [ ] Review every empty, loading, partial, valid, warning, error, limit, and internal-error state.
- [ ] Ensure a beginner understands purpose, privacy, and first action within roughly 10 seconds.

### Documentation and portfolio quality

- [ ] Write README purpose and authentic learning/troubleshooting story.
- [ ] Document features, supported resources/relationships/diagnostics, privacy, architecture, local setup, contributing, roadmap, limitations, and disclaimer.
- [ ] Add synthetic screenshots/GIF after UI stabilizes.
- [ ] Add contribution guide and exact quality commands.
- [ ] Confirm logical commit history and no unrelated changes.

### Accessibility and privacy hardening

- [ ] Complete graph/list parity audit.
- [ ] Complete keyboard-only primary flow.
- [ ] Complete VoiceOver/Safari and NVDA/Firefox (or documented equivalent) smoke checks.
- [ ] Pass 320px reflow, 200% zoom, contrast, reduced-motion, focus, live-region, and touch-target checks.
- [ ] Verify analysis makes no fetch/XHR/beacon/WebSocket request containing manifest data.
- [ ] Verify no default source persistence and no YAML URL state.
- [ ] Add recoverable error boundaries that never log source/raw resources.
- [ ] Add the strictest host-compatible CSP without introducing remote assets.

### Performance and scale

- [ ] Add deterministic 10/50/100/500-resource fixtures.
- [ ] Record parser, normalize, index, rule, diagnostic, and graph-adapter timings.
- [ ] Meet the initial 100-resource responsiveness target or document/resolve the measured blocker.
- [ ] Inspect bundles and explain any major dependency/chunk.
- [ ] Add a worker only if measurements justify it.

**Milestone gate**

- [ ] A first-time user can complete the primary flow without external instructions.
- [ ] All V1 success criteria and the release gate below pass.

---

## V1 Release Gate

### Automated quality

- [ ] Format, lint, strict typecheck, unit/component coverage, brand scan, build, and Chromium E2E pass.
- [ ] Coverage meets the established global and domain thresholds.
- [ ] Every built-in example passes its exact resource/relationship/diagnostic contract.
- [ ] No required test is skipped or hidden by retries.

### Browser and device matrix

- [ ] Chromium desktop.
- [ ] Firefox desktop.
- [ ] WebKit/Safari behavior.
- [ ] Representative Chromium mobile.
- [ ] Representative Mobile Safari emulation.
- [ ] Manual 320px, tablet, desktop, 200% zoom, and orientation checks.

### Accessibility

- [ ] No serious/critical axe violations.
- [ ] Primary flow is fully keyboard usable with visible focus.
- [ ] Graph information is complete in text form.
- [ ] Screen-reader smoke tests pass.
- [ ] Status is never conveyed by color alone.
- [ ] Reduced motion and focus restoration pass.

### Privacy and security

- [ ] Manifest analysis remains fully client-side.
- [ ] No analytics or remote error SDK is present.
- [ ] Manifest text is absent from URLs and default browser storage.
- [ ] Secret values are absent from derived UI outside the YAML editor, diagnostic objects, explanations, logs, reports, and screenshots.
- [ ] Malicious YAML-derived strings render as text only.
- [ ] Alias/size/count limits and error boundaries recover safely.
- [ ] No remote font/script/image dependency exists.
- [ ] Dependency, license, lockfile, action pinning, and production artifact reviews pass.
- [ ] Exported website contains no prohibited legacy branding.

### Product and documentation

- [ ] Privacy promise and static-analysis limitation are prominent.
- [ ] Issue -> topology -> inspector -> YAML navigation works.
- [ ] Six examples and troubleshooting commands are reviewed for Kubernetes accuracy.
- [ ] README, screenshots, contributing guide, roadmap, limitations, and release notes match the release.
- [ ] No open P0/P1 defects.

### Deployment

- [ ] Green `main` workflow deploys the exact tested static artifact.
- [ ] Public URL, direct routes, query examples, assets, metadata, favicon, 404, and base path work.
- [ ] Failed pipeline cannot update production.
- [ ] Tag and publish V1 release notes.

---

## Milestone 8 — V1.1 polish (locked until V1 release)

- [ ] Improve graph layout from measured usability issues.
- [ ] Add stronger namespace grouping.
- [ ] Add resource/relationship search and refined filters.
- [ ] Add Ingress TLS Secret relationship.
- [ ] Add optional panel resizing after fixed layout is solid.
- [ ] Improve shareable predefined example routes/gallery.
- [ ] Reassess Dagre versus ELK only if compound layout is a proven blocker.
- [ ] Reassess a Web Worker only if measured input delay remains.
- [ ] Improve 100-resource behavior and mobile topology from measurements.

---

## V2 — CKA troubleshooting edition (locked until V1.1 gate)

- [ ] Add StatefulSet Pod-template adapter.
- [ ] Add DaemonSet Pod-template adapter.
- [ ] Add Job Pod-template adapter.
- [ ] Add CronJob nested Pod-template adapter.
- [ ] Add HPA target relationship and diagnostics.
- [ ] Add PersistentVolume and StorageClass relationships.
- [ ] Add basic NetworkPolicy selection with qualified wording.
- [ ] Build troubleshooting scenarios from existing analysis output.
- [ ] Add Service, Ingress, RBAC, configuration, PVC, networking, and readiness scenarios.
- [ ] Give every scenario visual/text paths, evidence, commands, limitations, fixtures, accessibility, and E2E coverage.

---

## V2.5 — Advanced relationships (locked until V2 release)

- [ ] Richer NetworkPolicy peer visualization with conservative claims.
- [ ] Bounded RBAC permission summaries.
- [ ] Namespace isolation and dependency focus views.
- [ ] Large-topology search and focus controls.
- [ ] Adversarial fixtures for every advanced semantic claim.

---

## V3 — Kyverno policy visualization (locked until core product maturity)

- [ ] Add isolated Kyverno resource adapters.
- [ ] Add policy-rule virtual analysis entities.
- [ ] Add Policy/ClusterPolicy -> rule relationships.
- [ ] Add supported match/exclude -> supplied resource relationships.
- [ ] Add PolicyReport/ClusterPolicyReport -> resource result relationships.
- [ ] Keep mutation/admission execution explicitly out of scope.
- [ ] Verify V1 bundles and tests do not depend on Kyverno modules.
- [ ] Document supported Kyverno versions and static-analysis limitations.

---

## Optional V4 parking lot

- [ ] Gateway API relationships.
- [ ] Rendered Helm/Kustomize input workflow.
- [ ] Custom schema/resource adapters.
- [ ] Graph or architecture-document export.
- [ ] Manifest-set diffing.
- [ ] Security/policy mode.

These are ideas, not commitments. Promote one only through a new scoped plan after V3 or when product evidence justifies changing the roadmap.
