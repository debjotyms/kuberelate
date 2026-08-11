import { render, screen } from '@testing-library/react'
import axe from 'axe-core'
import { describe, expect, it } from 'vitest'

import { product } from '@/config/product'

import HomePage from './page'

describe('HomePage', () => {
  it('explains the product, privacy boundary, and static-analysis boundary', () => {
    render(<HomePage />)

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /understand kubernetes before you deploy it/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('Your manifests never leave your browser.')).toBeInTheDocument()
    expect(screen.getByText('Static evidence, not runtime guesses.')).toBeInTheDocument()
    expect(screen.getByText('Milestone 5 · Ingress routing')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: 'Trace traffic from Ingress to Service.' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeInTheDocument()
    expect(product.name).toBe('KubeRelate')
    expect(screen.getByRole('link', { name: 'KubeRelate home' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main-content',
    )
  })

  it('has no automatically detectable accessibility violations', async () => {
    const { container } = render(<HomePage />)
    const results = await axe.run(container, {
      rules: {
        // jsdom has no layout engine; Playwright covers color contrast in a real browser.
        'color-contrast': { enabled: false },
      },
    })

    expect(results.violations).toEqual([])
  })
})
