import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { describe, expect, it } from 'vitest'

import {
  brokenServiceSelectorExample,
  missingIngressPortExample,
  resourceInventoryExample,
  validIngressBackendExample,
} from '@/content/examples/resource-inventory'

import { ManifestWorkbench } from './manifest-workbench'

describe('ManifestWorkbench', () => {
  it('loads, clears, and resets the broken selector example while announcing relationships', async () => {
    const user = userEvent.setup()
    const { container } = render(<ManifestWorkbench />)

    expect(screen.getByText('Paste YAML or load the example')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Load example' }))

    await waitFor(() => {
      expect(container.querySelector('[data-analysis-status="valid"]')).toBeInTheDocument()
    })
    expect(container.querySelectorAll('[data-resource-kind]')).toHaveLength(2)
    expect(screen.getByText('Service selector matches no supplied workload')).toBeInTheDocument()
    expect(screen.getByText('input-scoped')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Analysis complete. 2 resources, 0 errors, 1 warning, and 1 relationship.',
    )
    expect(screen.getByRole('button', { name: 'Reset' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Clear' }))
    await waitFor(() => {
      expect(container.querySelector('[data-analysis-status="empty"]')).toBeInTheDocument()
    })
    expect(screen.getByText('Paste YAML or load the example')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reset' }))
    await waitFor(() =>
      expect(screen.getByText('Service selector matches no supplied workload')).toBeInTheDocument(),
    )
  })

  it('connects a selector issue to topology, inspector, and both source ranges by keyboard', async () => {
    const user = userEvent.setup()
    render(<ManifestWorkbench initialSource={brokenServiceSelectorExample.source} />)

    const issues = screen.getByRole('region', { name: 'Issues' })
    const issue = within(issues)
      .getByText('Service selector matches no supplied workload')
      .closest('article')!
    const serviceNode = await screen.findByRole('group', {
      name: /Service demo\/web\. Warning\. 1 connection.*inspect this resource/i,
    })

    await user.click(within(issue).getByRole('button', { name: 'View in topology' }))

    await waitFor(() => expect(serviceNode).toHaveFocus())
    const issueInspector = screen.getByRole('region', {
      name: 'Service selector matches no supplied workload',
    })
    expect(within(issueInspector).getByText(/Services select Pods by labels/)).toBeInTheDocument()
    expect(
      within(issueInspector).getByText('kubectl get pods -n demo --show-labels'),
    ).toBeInTheDocument()

    await user.click(
      within(issue).getByRole('button', {
        name: 'Compare workload labels: Deployment demo/web Pod-template labels',
      }),
    )
    expect(screen.getByRole('textbox', { name: 'Kubernetes YAML manifest editor' })).toHaveFocus()

    await user.click(within(issue).getByRole('button', { name: 'View selector' }))
    expect(screen.getByRole('textbox', { name: 'Kubernetes YAML manifest editor' })).toHaveFocus()
  })

  it('shows working topology and a complete semantic relationship-list equivalent', async () => {
    const user = userEvent.setup()
    const { container } = render(<ManifestWorkbench />)

    await user.click(screen.getByRole('combobox', { name: 'Example' }))
    await user.click(screen.getByRole('option', { name: 'Working Service selector' }))
    await user.click(screen.getByRole('button', { name: 'Load example' }))
    await waitFor(() => {
      expect(container.querySelector('[data-analysis-status="valid"]')).toBeInTheDocument()
    })

    expect(screen.queryByRole('region', { name: 'Issues' })).not.toBeInTheDocument()
    expect(
      await screen.findByRole('group', {
        name: /selects Pods represented by Deployment demo\/web using app=web/i,
      }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Relationship list' }))
    const list = screen.getByLabelText('Semantic relationship list')
    expect(within(list).getByText('Resolved match')).toBeInTheDocument()
    expect(
      within(list).getByText(
        'Service demo/web selects Pods represented by Deployment demo/web using app=web.',
      ),
    ).toBeInTheDocument()

    await user.click(within(list).getByRole('button'))
    expect(screen.getByRole('region', { name: 'Service selects workload' })).toHaveTextContent(
      'Inferred from labels in the supplied manifests',
    )
  })

  it('activates resource nodes and relationship edges by keyboard and focuses the inspector', async () => {
    const user = userEvent.setup()
    render(<ManifestWorkbench initialSource={brokenServiceSelectorExample.source} />)

    const serviceNode = await screen.findByRole('group', {
      name: /Service demo\/web\. Warning\. 1 connection.*inspect this resource/i,
    })
    serviceNode.focus()
    await user.keyboard('{Enter}')

    const resourceInspector = screen.getByRole('region', { name: 'Service web' })
    await waitFor(() =>
      expect(within(resourceInspector).getByRole('heading', { name: 'Service web' })).toHaveFocus(),
    )

    const relationshipEdge = screen.getByRole('group', {
      name: /Service demo\/web selects no supplied Pod.*inferred relationship, missing/i,
    })
    relationshipEdge.focus()
    await user.keyboard(' ')

    const relationshipInspector = screen.getByRole('region', {
      name: 'Service selects workload',
    })
    await waitFor(() =>
      expect(
        within(relationshipInspector).getByRole('heading', {
          name: 'Service selects workload',
        }),
      ).toHaveFocus(),
    )
  })

  it('keeps deduplicated Ingress route evidence in the map, list, inspector, and source actions', async () => {
    const user = userEvent.setup()
    render(<ManifestWorkbench initialSource={validIngressBackendExample.source} />)

    const relationshipEdge = await screen.findByRole('group', {
      name: /Ingress demo\/storefront routes 2 backend declarations to Service demo\/storefront named port http.*explicit relationship, resolved/i,
    })

    expect(screen.queryByRole('region', { name: 'Issues' })).not.toBeInTheDocument()
    relationshipEdge.focus()
    await user.keyboard('{Enter}')

    const inspector = screen.getByRole('region', { name: 'Ingress routes to Service' })
    await waitFor(() =>
      expect(
        within(inspector).getByRole('heading', { name: 'Ingress routes to Service' }),
      ).toHaveFocus(),
    )
    expect(inspector).toHaveTextContent('2 backend declarations')
    expect(inspector).toHaveTextContent('Declared on the supplied Service')
    expect(inspector).toHaveTextContent('kubectl get service storefront -n demo -o yaml')
    expect(within(inspector).getAllByRole('button', { name: /View Ingress backend/ })).toHaveLength(
      2,
    )

    await user.click(within(inspector).getByRole('button', { name: /View Ingress backend 2/ }))
    expect(screen.getByRole('textbox', { name: 'Kubernetes YAML manifest editor' })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Relationship list' }))
    const list = screen.getByLabelText('Semantic relationship list')
    expect(within(list).getAllByRole('button')).toHaveLength(1)
    expect(list).toHaveTextContent('routes to · explicit · resolved')
  })

  it('connects a missing Ingress port issue to both backend and Service source evidence', async () => {
    const user = userEvent.setup()
    render(<ManifestWorkbench initialSource={missingIngressPortExample.source} />)

    const issueTitle = screen.getByText('Ingress backend Service port is missing')
    const issue = issueTitle.closest('article')!
    expect(issue).toHaveAttribute('data-diagnostic-code', 'KG-ING-002')

    await user.click(within(issue).getByRole('button', { name: 'Inspect issue' }))
    const inspector = screen.getByRole('region', {
      name: 'Ingress backend Service port is missing',
    })
    expect(inspector).toHaveTextContent('named port admin')
    expect(within(inspector).getByRole('button', { name: 'View backend' })).toBeInTheDocument()
    expect(
      within(inspector).getByRole('button', { name: 'View Service ports' }),
    ).toBeInTheDocument()

    await user.click(within(inspector).getByRole('button', { name: 'View Service ports' }))
    expect(screen.getByRole('textbox', { name: 'Kubernetes YAML manifest editor' })).toHaveFocus()
  })

  it('shows Secret keys in the inspector while keeping values out of results', async () => {
    const sentinel = 'never-render-this-ui-secret'
    const user = userEvent.setup()
    const { container } = render(
      <ManifestWorkbench
        initialSource={`apiVersion: v1
kind: Secret
metadata:
  name: credentials
stringData:
  password: ${sentinel}
  username: demo
`}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Inspect resource' }))
    const inspector = screen.getByRole('region', { name: 'Secret credentials' })

    expect(inspector).toHaveTextContent('Values hidden by design')
    expect(inspector).toHaveTextContent('Keys: password, username')
    expect(container.querySelector('.results-panel')).not.toHaveTextContent(sentinel)
  })

  it('shows parser diagnostics and moves focus to the YAML source', async () => {
    const malformed = `apiVersion: v1
kind: ConfigMap
metadata: [
`
    const user = userEvent.setup()
    render(<ManifestWorkbench initialSource={malformed} />)

    expect(screen.getByText('YAML parse error')).toBeInTheDocument()
    expect(screen.getByText(/Document 1 · line 4, column/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'View in YAML' }))

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Kubernetes YAML manifest editor' })).toHaveFocus()
    })
  })

  it('renders resource identities as text instead of markup', () => {
    const maliciousName = '<img src=x onerror=alert(1)>'
    const source = `apiVersion: example.io/v1
kind: Widget
metadata:
  name: "${maliciousName}"
`

    const { container } = render(<ManifestWorkbench initialSource={source} />)

    expect(screen.getAllByText(maliciousName).length).toBeGreaterThan(0)
    expect(container.querySelector('.results-panel img')).not.toBeInTheDocument()
  })

  it('has no automatically detectable accessibility violations in empty and relationship states', async () => {
    const empty = render(<ManifestWorkbench />)
    const emptyResults = await axe.run(empty.container, {
      rules: { 'color-contrast': { enabled: false } },
    })
    expect(emptyResults.violations).toEqual([])
    empty.unmount()

    const broken = render(<ManifestWorkbench initialSource={brokenServiceSelectorExample.source} />)
    expect(screen.getByRole('region', { name: 'Manifest analysis' })).toHaveTextContent(
      'No matching workload',
    )
    const brokenResults = await axe.run(broken.container, {
      rules: { 'color-contrast': { enabled: false } },
    })
    expect(brokenResults.violations).toEqual([])
    broken.unmount()

    const populated = render(<ManifestWorkbench initialSource={resourceInventoryExample.source} />)
    const resultsPanel = screen.getByRole('region', { name: 'Manifest analysis' })
    expect(within(resultsPanel).getAllByText('StudyGuide').length).toBeGreaterThan(0)

    const populatedResults = await axe.run(populated.container, {
      rules: { 'color-contrast': { enabled: false } },
    })
    expect(populatedResults.violations).toEqual([])
  })

  it('toggles layout mode to collapse editor or focus diagram', async () => {
    const user = userEvent.setup()
    const { container } = render(<ManifestWorkbench />)

    const grid = container.querySelector('.workbench-grid')
    expect(grid).toHaveAttribute('data-layout-mode', 'split')

    await user.click(
      screen.getByRole('button', { name: 'Focus diagram by collapsing YAML editor' }),
    )
    expect(grid).toHaveAttribute('data-layout-mode', 'diagram')
    expect(container.querySelector('.editor-panel')).toHaveAttribute('data-collapsed', 'true')

    await user.click(screen.getByRole('button', { name: 'Show YAML editor' }))
    expect(grid).toHaveAttribute('data-layout-mode', 'split')

    await user.click(screen.getByRole('button', { name: 'Collapse code editor' }))
    expect(grid).toHaveAttribute('data-layout-mode', 'diagram')
  })
})
