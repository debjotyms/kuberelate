'use client'

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'

export interface CustomSelectOption {
  readonly value: string
  readonly label: string
}

interface CustomSelectProps {
  readonly id?: string
  readonly ariaLabel?: string
  readonly ariaLabelledBy?: string
  readonly options: readonly CustomSelectOption[]
  readonly value: string
  readonly onChange: (value: string) => void
  readonly className?: string
}

export function CustomSelect({
  id,
  ariaLabel,
  ariaLabelledBy,
  options,
  value,
  onChange,
  className = '',
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listboxId = useId()

  const selectedOption = options.find((opt) => opt.value === value) ?? options[0]

  const closeMenu = useCallback(() => {
    setIsOpen(false)
    setFocusedIndex(-1)
  }, [])

  const selectOption = useCallback(
    (optionValue: string) => {
      onChange(optionValue)
      closeMenu()
      buttonRef.current?.focus()
    },
    [closeMenu, onChange],
  )

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        closeMenu()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [closeMenu, isOpen])

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (
      event.key === 'ArrowDown' ||
      event.key === 'ArrowUp' ||
      event.key === 'Enter' ||
      event.key === ' '
    ) {
      event.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
        const currentIdx = options.findIndex((opt) => opt.value === value)
        setFocusedIndex(currentIdx >= 0 ? currentIdx : 0)
      } else if (event.key === 'ArrowDown') {
        setFocusedIndex((prev) => (prev + 1) % options.length)
      } else if (event.key === 'ArrowUp') {
        setFocusedIndex((prev) => (prev - 1 + options.length) % options.length)
      } else if ((event.key === 'Enter' || event.key === ' ') && focusedIndex >= 0) {
        const targetOption = options[focusedIndex]
        if (targetOption) {
          selectOption(targetOption.value)
        }
      }
    } else if (event.key === 'Escape' && isOpen) {
      event.preventDefault()
      closeMenu()
    }
  }

  return (
    <div className={`custom-select-container ${className}`.trim()} ref={containerRef}>
      <button
        aria-controls={isOpen ? listboxId : undefined}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        className="custom-select-trigger"
        id={id}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        ref={buttonRef}
        role="combobox"
        type="button"
      >
        <span className="truncate">{selectedOption?.label}</span>
        <svg
          aria-hidden="true"
          className={`size-4 shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          viewBox="0 0 24 24"
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen ? (
        <ul
          aria-activedescendant={
            focusedIndex >= 0 ? `${listboxId}-option-${focusedIndex}` : undefined
          }
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          className="custom-select-menu"
          id={listboxId}
          role="listbox"
          tabIndex={-1}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value
            const isFocused = index === focusedIndex

            return (
              <li
                aria-selected={isSelected}
                className={`custom-select-option ${isSelected ? 'is-selected' : ''} ${isFocused ? 'is-focused' : ''}`}
                id={`${listboxId}-option-${index}`}
                key={option.value}
                onClick={() => selectOption(option.value)}
                onMouseEnter={() => setFocusedIndex(index)}
                role="option"
              >
                <span className="custom-select-check" aria-hidden="true">
                  {isSelected ? '✓' : ''}
                </span>
                <span className="truncate">{option.label}</span>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
