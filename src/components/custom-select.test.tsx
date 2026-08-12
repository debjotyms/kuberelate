import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { CustomSelect } from './custom-select'

const options = [
  { value: 'opt1', label: 'Option One' },
  { value: 'opt2', label: 'Option Two' },
  { value: 'opt3', label: 'Option Three' },
]

describe('CustomSelect', () => {
  it('renders trigger with selected option and opens menu on click', () => {
    const handleChange = vi.fn()
    render(
      <CustomSelect
        ariaLabel="Choose option"
        onChange={handleChange}
        options={options}
        value="opt1"
      />,
    )

    const trigger = screen.getByRole('combobox', { name: 'Choose option' })
    expect(trigger).toBeInTheDocument()
    expect(trigger).toHaveTextContent('Option One')

    fireEvent.click(trigger)

    const listbox = screen.getByRole('listbox')
    expect(listbox).toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(3)

    fireEvent.click(screen.getByRole('option', { name: 'Option Two' }))
    expect(handleChange).toHaveBeenCalledWith('opt2')
  })

  it('navigates options via keyboard arrow keys and selects with Enter', () => {
    const handleChange = vi.fn()
    render(
      <CustomSelect
        ariaLabel="Choose option"
        onChange={handleChange}
        options={options}
        value="opt1"
      />,
    )

    const trigger = screen.getByRole('combobox', { name: 'Choose option' })
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })

    expect(screen.getByRole('listbox')).toBeInTheDocument()

    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    fireEvent.keyDown(trigger, { key: 'Enter' })

    expect(handleChange).toHaveBeenCalledWith('opt2')
  })

  it('closes dropdown when clicking outside', () => {
    render(
      <div>
        <CustomSelect ariaLabel="Choose option" onChange={vi.fn()} options={options} value="opt1" />
        <div data-testid="outside">Outside</div>
      </div>,
    )

    const trigger = screen.getByRole('combobox', { name: 'Choose option' })
    fireEvent.click(trigger)
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    fireEvent.mouseDown(screen.getByTestId('outside'))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
