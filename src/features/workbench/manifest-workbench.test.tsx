import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { describe, expect, it } from 'vitest'

import {
  brokenServiceSelectorExample,
  resourceInventoryExample,
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
    const serviceNode = screen.getByRole('button', {
      name: /Service demo\/web\. Warning\. Inspect resource/,
    })

    await user.click(within(issue).getByRole('button', { name: 'View in topology' }))

    expect(serviceNode).toHaveFocus()
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

    await user.selectOptions(screen.getByLabelText('Example'), 'working-service-selector')
    await user.click(screen.getByRole('button', { name: 'Load example' }))
    await waitFor(() => {
      expect(container.querySelector('[data-analysis-status="valid"]')).toBeInTheDocument()
    })

    expect(screen.queryByRole('region', { name: 'Issues' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Inspect relationship\./ })).toHaveAccessibleName(
      /selects Pods represented by Deployment demo\/web using app=web/,
    )

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
})
