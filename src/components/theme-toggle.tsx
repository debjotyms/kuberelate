'use client'

import { useSyncExternalStore } from 'react'

import { selectTheme, useWorkbenchStore, type ThemeMode } from '@/store/workbench-store'

interface ThemeToggleProps {
  readonly className?: string
}

const emptySubscribe = () => () => {}

function useIsMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  )
}

const themeOptions: readonly {
  readonly mode: ThemeMode
  readonly label: string
  readonly ariaLabel: string
}[] = [
  { mode: 'light', label: 'Light', ariaLabel: 'Light theme' },
  { mode: 'dark', label: 'Dark', ariaLabel: 'Dark theme' },
  { mode: 'system', label: 'System', ariaLabel: 'System theme' },
]

export function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const mounted = useIsMounted()
  const theme = useWorkbenchStore(selectTheme)
  const setTheme = useWorkbenchStore((state) => state.setTheme)

  return (
    <div
      aria-label="Color theme"
      className={`theme-toggle-switcher ${className}`.trim()}
      role="group"
    >
      {themeOptions.map((opt) => {
        const isSelected = mounted && theme === opt.mode

        return (
          <button
            aria-label={opt.ariaLabel}
            aria-pressed={mounted ? isSelected : undefined}
            key={opt.mode}
            onClick={() => setTheme(opt.mode)}
            type="button"
          >
            {opt.mode === 'light' ? (
              <svg
                aria-hidden="true"
                className="size-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <circle cx="12" cy="12" r="4" />
                <path
                  d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41"
                  strokeLinecap="round"
                />
              </svg>
            ) : opt.mode === 'dark' ? (
              <svg
                aria-hidden="true"
                className="size-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  d="M21.752 15.002A9.718 9.718 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg
                aria-hidden="true"
                className="size-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <rect height="13" rx="2" width="18" x="3" y="4" />
                <path d="M8 20h8m-4-3v3" strokeLinecap="round" />
              </svg>
            )}
            <span className="hidden sm:inline">{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}
