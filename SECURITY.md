# Security Policy

## Supported versions

KubeRelate is pre-release software. Only the latest revision of `main` is currently supported with
security and privacy fixes. Published releases will receive an explicit support table when stable
versions exist.

## Reporting a vulnerability

Do not disclose a suspected vulnerability in a public issue, discussion, pull request, or test
fixture. When the repository is public, use a
[private GitHub security advisory](https://github.com/debjotyms/kube-relate/security/advisories/new).
Until then, authorized collaborators can create a draft repository security advisory.

Include enough information to reproduce and assess the issue without including real credentials,
kubeconfigs, production manifests, or Secret values. Synthetic examples are strongly preferred.

Useful details include:

- affected revision and browser;
- expected and observed behavior;
- minimal reproduction steps;
- security or privacy impact;
- a suggested mitigation, if known.

The maintainer will validate the report, coordinate a fix and disclosure when appropriate, and
credit reporters who request attribution. Please allow time for a fix before public disclosure.

## Security boundary

KubeRelate is designed as a static browser application. Manifest analysis must not transmit source
text, persist it by default, expose Secret values in derived output, or claim live-cluster facts.
Reports that violate any of those boundaries are considered security or privacy issues.
