import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { describe, expect, it } from 'vitest'

import { resourceInventoryExample } from '@/content/examples/resource-inventory'

import { ManifestWorkbench } from './manifest-workbench'

describe('ManifestWorkbench', () => {
  it('loads, clears, and resets the example while announcing analysis results', async () => {
    const user = userEvent.setup()
    render(<ManifestWorkbench />)

    expect(screen.getByText('Paste YAML or load the example')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Load example' }))

    await waitFor(() => {
      expect(document.querySelector('[data-analysis-status="valid"]')).toBeInTheDocument()
    })
    expect(screen.getByText('StudyGuide')).toBeInTheDocument()
    expect(screen.getByText('Generic kind')).toBeInTheDocument()
    expect(screen.getAllByText('Identity support')).toHaveLength(3)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Analysis complete. 4 resources, 0 errors, and 0 warnings.',
    )
    expect(screen.getByRole('button', { name: 'Reset' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Clear' }))
    await waitFor(() => {
      expect(document.querySelector('[data-analysis-status="empty"]')).toBeInTheDocument()
    })
    expect(screen.getByText('Paste YAML or load the example')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reset' }))
    await waitFor(() => expect(screen.getByText('StudyGuide')).toBeInTheDocument())
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

    expect(screen.getByText(maliciousName)).toBeInTheDocument()
    expect(container.querySelector('.results-panel img')).not.toBeInTheDocument()
  })

  it('has no automatically detectable accessibility violations in empty and populated states', async () => {
    const empty = render(<ManifestWorkbench />)
    const emptyResults = await axe.run(empty.container, {
      rules: { 'color-contrast': { enabled: false } },
    })
    expect(emptyResults.violations).toEqual([])
    empty.unmount()

    const populated = render(<ManifestWorkbench initialSource={resourceInventoryExample.source} />)
    const resultsPanel = screen.getByRole('region', { name: 'Resource inventory' })
    expect(within(resultsPanel).getByText('StudyGuide')).toBeInTheDocument()

    const populatedResults = await axe.run(populated.container, {
      rules: { 'color-contrast': { enabled: false } },
    })
    expect(populatedResults.violations).toEqual([])
  })
})
