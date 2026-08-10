import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

if (!Range.prototype.getClientRects) {
  Object.defineProperty(Range.prototype, 'getClientRects', {
    value: () => [],
  })
}

afterEach(() => {
  cleanup()
})
