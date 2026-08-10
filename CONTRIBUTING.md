# Contributing to KubeRelate

Thank you for helping make Kubernetes relationships easier to understand. KubeRelate is being
built in small, tested milestones; focused changes are much easier to review than broad rewrites.

## Before you start

1. Read the [Code of Conduct](./CODE_OF_CONDUCT.md).
2. Check the active milestone in [CHECKLIST.md](./CHECKLIST.md).
3. Search existing issues before proposing duplicate work.
4. Open an issue before a large architectural change or new dependency.

Security vulnerabilities and sensitive privacy problems belong in a private report described in
[SECURITY.md](./SECURITY.md), not a public issue.

## Development setup

KubeRelate uses Node.js 24 LTS and npm 11.

```bash
git clone https://github.com/debjotyms/kube-relate.git
cd kube-relate
nvm use
npm ci
npm run dev
```

## Engineering expectations

- Keep parsing and Kubernetes analysis deterministic and independent from React.
- Preserve the browser-only boundary: no backend, accounts, telemetry, or remote YAML processing.
- Describe supplied manifests conservatively; do not claim live cluster state.
- Use synthetic Kubernetes fixtures with obviously fake values.
- Never commit credentials, real manifests, kubeconfigs, tokens, or unredacted Secret values.
- Keep the graph and semantic text representation aligned.
- Include accessible names, keyboard behavior, focus handling, and non-color status cues with UI
  changes.
- Avoid adding a dependency when a small project-owned implementation is sufficient.

## Required checks

Before opening a pull request, run:

```bash
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run test:coverage
npm run build
npm run check:brand
npm run test:e2e:artifact
```

When testing the Pages artifact, build it with `NEXT_PUBLIC_BASE_PATH=/kube-relate` first.

## Commits and pull requests

- Use concise conventional-style commit subjects such as `feat(parser): preserve source ranges`.
- Keep commits independently understandable and avoid unrelated formatting churn.
- Explain the problem, implementation boundary, tests, and user-visible impact in the pull request.
- Link the relevant checklist item or issue.
- Include screenshots only when they materially help review and contain synthetic data.
- Update documentation and the checklist when behavior or scope changes.

By contributing, you agree that your contribution is licensed under the repository's MIT License.
