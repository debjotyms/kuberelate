# KubeRelate

**See how your Kubernetes manifests connect.**

[![CI / Pages](https://github.com/debjotyms/kuberelate/actions/workflows/ci.yml/badge.svg)](https://github.com/debjotyms/kuberelate/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-2ea44f.svg)](./LICENSE)

KubeRelate is a privacy-first, browser-based Kubernetes manifest relationship analyzer and
learning tool. It is designed to make selectors, references, namespaces, ports, identities, and
storage dependencies easier to understand without connecting to a cluster or uploading YAML.

> [!IMPORTANT]
> KubeRelate is in early development. The analyzer now explains the first complete relationship
> slice: Service selectors compared with supplied Pods and Deployment Pod templates. Broader
> Kubernetes relationship coverage is still in progress.

## Why KubeRelate

Kubernetes resources often look valid individually while failing as a system: a Service selector
does not match a workload, an Ingress points to a missing port, or a Pod references a resource that
is absent from the supplied manifests. KubeRelate aims to expose those relationships and explain
the evidence without pretending to know live cluster state.

## Current foundation

- Responsive CNCF-inspired interface with an independent product identity
- Next.js static export with no production application server
- Browser-only privacy and static-analysis boundaries
- Strict TypeScript, ESLint, Prettier, and reproducible Node/npm versions
- Vitest, Testing Library, Playwright, and axe accessibility checks
- Gated GitHub Actions build, artifact smoke test, and Pages deployment
- Light and dark color schemes with reduced-motion support
- Lazy-loaded CodeMirror YAML editor with search, history, inline parser markers, and source jumps
- Deterministic multi-document parsing, normalization, scope-aware identity, and safety limits
- Ordered resource and issue lists with partial-result recovery for malformed neighboring documents
- Namespace-correct Service selector matching for Pods and Deployment Pod templates
- Resolved and unresolved topology views with a full semantic relationship-list equivalent
- Evidence-based `KG-SVC-001` guidance, source jumps, inspectors, and cluster verification commands

The detailed [implementation plan](./PLAN.md) and [delivery checklist](./CHECKLIST.md) track current
scope and evidence. Planned V1 work now continues with reusable interactive topology, additional
relationship rules, deterministic explanations, and curated troubleshooting examples.

## Current analyzer behavior

- Parses up to 250 YAML documents and preserves one-based line/column source locations.
- Normalizes up to 500 resources with stable occurrence IDs and canonical identities.
- Applies `default` only to known namespaced kinds; known cluster-scoped and unknown kinds remain
  explicit.
- Expands Kubernetes `List` objects and preserves duplicate resource occurrences with diagnostics.
- Keeps valid documents visible when another document is malformed and clearly labels the output
  partial.
- Enforces a 2 MiB source limit and bounded YAML alias expansion without changing editor content.
- Keeps source text in React memory only and renders no Secret values outside the YAML editor.
- Matches every non-empty Service selector pair as a subset of supplied Pod or Deployment
  Pod-template labels in the same effective namespace.
- Skips selectorless and `ExternalName` Services, supports multiple valid targets, and never invents
  a resolved edge when no supplied workload matches.
- Reports an unmatched selector as warning `KG-SVC-001` with input-scoped certainty, safe comparison
  evidence, source ranges, and namespace-correct verification commands.
- Validates a Deployment selector against its own Pod-template labels as a separate definite issue.

The analyzer still validates only the minimal Kubernetes resource envelope (`apiVersion`, `kind`,
and `metadata.name`); it does not perform complete Kubernetes schema validation. Relationship
coverage is currently limited to the Service selector vertical slice.

## Privacy and analysis boundary

- Manifest processing is designed to happen entirely in the browser.
- There is no backend, account system, analytics SDK, or remote manifest processing.
- Manifest text is not persisted by default.
- Static analysis describes only the supplied YAML.
- Runtime state such as readiness, endpoints, admission changes, or controller behavior must be
  verified in a cluster.
- Real credentials, production manifests, and unredacted Secrets must never be added to issues or
  test fixtures.

## Technology

- Next.js App Router with static export
- React and strict TypeScript
- Tailwind CSS with project-owned design tokens
- CodeMirror 6, `yaml`, and `zod/mini`
- React Flow, Dagre, and Zustand for the lazy interactive topology
- Vitest and React Testing Library
- Playwright and axe-core
- GitHub Actions and GitHub Pages

## Local development

### Requirements

- Node.js 24 LTS; the exact version is in `.nvmrc`
- npm 11

```bash
git clone https://github.com/debjotyms/kuberelate.git
cd kuberelate
nvm use
npm ci
npm run dev
```

Open `http://localhost:3000`.

## Quality commands

| Command                    | Purpose                                                       |
| -------------------------- | ------------------------------------------------------------- |
| `npm run dev`              | Start the local Next.js development server                    |
| `npm run build`            | Produce the static site in `out/`                             |
| `npm run check`            | Run the complete non-browser local quality gate               |
| `npm run lint`             | Run ESLint with Next.js and TypeScript rules                  |
| `npm run typecheck`        | Generate Next.js route types and run strict TypeScript checks |
| `npm run format`           | Format maintained source and configuration files              |
| `npm run format:check`     | Verify formatting without changing files                      |
| `npm run test`             | Run Vitest in watch mode                                      |
| `npm run test:coverage`    | Run unit and component tests with V8 coverage                 |
| `npm run test:e2e`         | Build and test the production static export in Chromium       |
| `npm run measure:analyzer` | Measure the analyzer against all built-in examples            |
| `npm run check:brand`      | Scan shipped source and output for prohibited legacy branding |

To reproduce the GitHub project Pages path locally:

```bash
NEXT_PUBLIC_BASE_PATH=/kuberelate npm run build
NEXT_PUBLIC_BASE_PATH=/kuberelate npm run test:e2e:artifact
```

## CI/CD model

The production build uses `output: 'export'` and does not require a Node.js server. The workflow is
kept intentionally small and inspectable:

1. `quality` runs formatting, linting, type checks, coverage, and the brand guard.
2. `build` creates the `/kuberelate` static export and packages it once.
3. `e2e-smoke` extracts and tests that exact Pages artifact in Chromium.
4. `deploy` publishes the tested artifact only from a fully green public-repository run on `main`.

Deployment is intentionally skipped while the repository is private. When the project becomes
public, enable **GitHub Actions** under **Settings → Pages → Build and deployment → Source**, then
run the workflow from `main`.

## Contributing

Contributions are welcome once the repository is public. Start with [CONTRIBUTING.md](./CONTRIBUTING.md),
follow the [Code of Conduct](./CODE_OF_CONDUCT.md), and keep examples synthetic and free of secrets.
The checklist identifies the active milestone so contributions remain focused.

## Security

Please do not open a public issue for a vulnerability. Follow [SECURITY.md](./SECURITY.md) to report
security and privacy concerns responsibly.

## License and affiliation

KubeRelate is available under the [MIT License](./LICENSE). It is an independent project and is not
affiliated with or endorsed by the Cloud Native Computing Foundation, The Linux Foundation, or the
Kubernetes project. Kubernetes and CNCF names and marks belong to their respective owners.
