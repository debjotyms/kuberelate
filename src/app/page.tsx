import Link from 'next/link'

import { BrandMark } from '@/components/brand-mark'
import { product } from '@/config/product'

const flowSteps = [
  {
    description: 'Drop in one file or a multi-document manifest set.',
    eyebrow: '01 · Input',
    title: 'Paste Kubernetes YAML',
  },
  {
    description: 'Follow selectors, names, ports, identities, and volume references.',
    eyebrow: '02 · Map',
    title: 'See the relationships',
  },
  {
    description: 'Get evidence, context, and commands you can run against a cluster.',
    eyebrow: '03 · Learn',
    title: 'Understand the problem',
  },
] as const

const privacyPoints = [
  'No account or sign-in',
  'No manifest uploads',
  'No AI-generated guesses',
] as const

export default function HomePage() {
  return (
    <div className="min-h-screen overflow-hidden bg-canvas text-ink">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <header className="relative z-20 border-b border-line/80 bg-canvas/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-4 sm:px-8 lg:px-10">
          <Link
            aria-label={`${product.name} home`}
            className="group flex items-center gap-3 rounded-lg font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-focus/50"
            href="/"
          >
            <BrandMark className="size-9 text-brand transition-transform group-hover:-rotate-3" />
            <span className="text-lg">{product.name}</span>
          </Link>

          <nav aria-label="Primary navigation" className="flex items-center gap-1 sm:gap-2">
            <a className="nav-link hidden sm:inline-flex" href="#how-it-works">
              How it works
            </a>
            <a className="nav-link hidden sm:inline-flex" href="#privacy">
              Privacy
            </a>
            <a
              className="button-secondary ml-1"
              href={product.githubUrl}
              rel="noreferrer"
              target="_blank"
            >
              GitHub
              <span aria-hidden="true">↗</span>
            </a>
          </nav>
        </div>
      </header>

      <main id="main-content">
        <section className="topology-backdrop relative isolate border-b border-line/70">
          <div className="mx-auto grid w-full max-w-7xl gap-14 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16 lg:px-10 lg:py-28">
            <div className="relative z-10 max-w-2xl">
              <p className="eyebrow-pill">
                <span className="status-pulse" aria-hidden="true" />
                Static Kubernetes manifest analyzer
              </p>
              <h1 className="mt-7 text-balance text-5xl leading-[0.98] font-semibold tracking-[-0.045em] sm:text-6xl lg:text-7xl">
                Understand Kubernetes{' '}
                <span className="text-brand-strong">before you deploy it.</span>
              </h1>
              <p className="mt-7 max-w-xl text-pretty text-lg leading-8 text-muted sm:text-xl">
                {product.description} All analysis happens locally in your browser.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <a className="button-primary" href="#how-it-works">
                  Explore the workflow
                  <span aria-hidden="true">↓</span>
                </a>
                <a className="button-secondary" href="#analysis-boundary">
                  What static analysis knows
                </a>
              </div>

              <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-3 text-sm font-medium text-muted">
                {privacyPoints.map((point) => (
                  <li className="flex items-center gap-2" key={point}>
                    <span className="check-mark" aria-hidden="true">
                      ✓
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            <figure className="workbench-preview relative z-10" aria-labelledby="preview-caption">
              <div className="preview-toolbar">
                <div aria-hidden="true" className="flex gap-1.5">
                  <span className="size-2.5 rounded-full bg-error/70" />
                  <span className="size-2.5 rounded-full bg-warning/70" />
                  <span className="size-2.5 rounded-full bg-success/70" />
                </div>
                <span>manifest-set.yaml</span>
                <span className="privacy-chip">Local only</span>
              </div>

              <div className="grid min-h-96 md:grid-cols-[0.82fr_1.18fr]">
                <div className="border-b border-line bg-code p-5 md:border-r md:border-b-0">
                  <div className="mb-5 flex items-center justify-between text-xs font-semibold tracking-wide text-muted uppercase">
                    <span>YAML</span>
                    <span>2 resources</span>
                  </div>
                  <pre
                    className="overflow-hidden text-[0.75rem] leading-6 text-code-ink"
                    aria-label="Example Kubernetes manifest"
                  >
                    <code>{`kind: Deployment
metadata:
  name: web
spec:
  template:
    metadata:
      labels:
        app: web
---
kind: Service
spec:
  selector:
    app: website`}</code>
                  </pre>
                </div>

                <div className="flex flex-col bg-surface-muted/65 p-5 sm:p-6">
                  <div className="flex items-center justify-between text-xs font-semibold tracking-wide text-muted uppercase">
                    <span>Resource topology</span>
                    <span>demo namespace</span>
                  </div>

                  <div className="flex flex-1 flex-col items-center justify-center py-7">
                    <div className="resource-node">
                      <span className="resource-kind">Service</span>
                      <strong>web</strong>
                      <span className="node-status node-status-warning">1 warning</span>
                    </div>
                    <div className="broken-edge" aria-hidden="true">
                      <span>selects?</span>
                    </div>
                    <div className="resource-node resource-node-muted">
                      <span className="resource-kind">Deployment</span>
                      <strong>web</strong>
                      <span className="node-status">app=web</span>
                    </div>
                  </div>

                  <div className="diagnostic-card">
                    <span className="diagnostic-icon" aria-hidden="true">
                      !
                    </span>
                    <div>
                      <strong>Selector matches no supplied workload</strong>
                      <p>Expected app=website · Found app=web</p>
                    </div>
                  </div>
                </div>
              </div>
              <figcaption className="sr-only" id="preview-caption">
                A preview showing a Service selector that does not match a Deployment Pod template.
              </figcaption>
            </figure>
          </div>
        </section>

        <section
          className="border-b border-line bg-surface"
          id="privacy"
          aria-labelledby="privacy-title"
        >
          <div className="mx-auto grid w-full max-w-7xl gap-8 px-5 py-12 sm:px-8 md:grid-cols-[auto_1fr] md:items-center lg:px-10">
            <div className="privacy-emblem" aria-hidden="true">
              <svg fill="none" viewBox="0 0 24 24">
                <path d="M7.5 10V7a4.5 4.5 0 0 1 9 0v3" stroke="currentColor" strokeWidth="1.8" />
                <rect
                  x="4"
                  y="10"
                  width="16"
                  height="11"
                  rx="3"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path d="M12 14v3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
              </svg>
            </div>
            <div>
              <p className="section-kicker">Privacy is an architecture choice</p>
              <h2
                className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl"
                id="privacy-title"
              >
                Your manifests never leave your browser.
              </h2>
              <p className="mt-3 max-w-3xl leading-7 text-muted">
                Parsing, relationship discovery, and diagnostics run on your device. There is no
                backend, account system, analytics pipeline, or remote manifest processing.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-canvas" id="how-it-works" aria-labelledby="workflow-title">
          <div className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:px-10">
            <div className="max-w-2xl">
              <p className="section-kicker">A faster way to reason about manifests</p>
              <h2
                className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl"
                id="workflow-title"
              >
                From YAML to an evidence-backed troubleshooting path.
              </h2>
              <p className="mt-4 text-lg leading-8 text-muted">
                KubeRelate focuses on the places where individually valid-looking resources stop
                lining up.
              </p>
            </div>

            <ol className="mt-12 grid gap-5 lg:grid-cols-3">
              {flowSteps.map((step) => (
                <li className="step-card" key={step.eyebrow}>
                  <p className="section-kicker">{step.eyebrow}</p>
                  <h3 className="mt-4 text-xl font-semibold tracking-tight">{step.title}</h3>
                  <p className="mt-3 leading-7 text-muted">{step.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          className="border-y border-line bg-surface-muted/55"
          id="analysis-boundary"
          aria-labelledby="boundary-title"
        >
          <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 py-16 sm:px-8 md:grid-cols-[0.8fr_1.2fr] md:items-start lg:px-10">
            <div>
              <p className="section-kicker">Technically conservative by design</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight" id="boundary-title">
                Static evidence, not runtime guesses.
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <article className="boundary-card">
                <span className="boundary-label boundary-label-known">KubeRelate can show</span>
                <h3>Manifest relationships</h3>
                <p>
                  Selectors, named references, namespaces, ports, identities, and supplied
                  dependencies.
                </p>
              </article>
              <article className="boundary-card">
                <span className="boundary-label">Verify in a cluster</span>
                <h3>Runtime state</h3>
                <p>
                  Readiness, live endpoints, admission changes, controller behavior, and network
                  traffic.
                </p>
              </article>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-canvas">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <p>© 2026 {product.name}. Open-source Kubernetes learning and troubleshooting.</p>
          <a className="footer-link" href={product.githubUrl} rel="noreferrer" target="_blank">
            View source on GitHub <span aria-hidden="true">↗</span>
          </a>
        </div>
      </footer>
    </div>
  )
}
