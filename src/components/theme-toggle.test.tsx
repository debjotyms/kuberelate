import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { useWorkbenchStore } from '@/store/workbench-store'

import { ThemeToggle } from './theme-toggle'

describe('ThemeToggle', () => {
  beforeEach(() => {
    useWorkbenchStore.setState({
      theme: 'system',
    })
    localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  it('renders all theme options and updates theme on click', () => {
    render(<ThemeToggle />)

    const lightButton = screen.getByRole('button', { name: 'Light theme' })
    const darkButton = screen.getByRole('button', { name: 'Dark theme' })
    const systemButton = screen.getByRole('button', { name: 'System theme' })

    expect(lightButton).toBeInTheDocument()
    expect(darkButton).toBeInTheDocument()
    expect(systemButton).toBeInTheDocument()
    expect(systemButton).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(lightButton)
    expect(useWorkbenchStore.getState().theme).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(lightButton).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(darkButton)
    expect(useWorkbenchStore.getState().theme).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(darkButton).toHaveAttribute('aria-pressed', 'true')
  })
})
