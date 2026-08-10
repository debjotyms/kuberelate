interface BrandMarkProps {
  className?: string
}

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" focusable="false" viewBox="0 0 40 40">
      <path
        d="M20 2.75 34.94 11.38v17.24L20 37.25 5.06 28.62V11.38L20 2.75Z"
        fill="currentColor"
        opacity="0.14"
      />
      <path
        d="M20 3.9 33.94 11.95v16.1L20 36.1 6.06 28.05v-16.1L20 3.9Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="m12.5 24.5 7.5-9 7.5 9" stroke="currentColor" strokeWidth="2" />
      <circle cx="12.5" cy="24.5" r="2.75" fill="currentColor" />
      <circle cx="20" cy="15.5" r="2.75" fill="currentColor" />
      <circle cx="27.5" cy="24.5" r="2.75" fill="currentColor" />
    </svg>
  )
}
