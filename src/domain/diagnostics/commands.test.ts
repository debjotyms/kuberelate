import { describe, expect, it } from 'vitest'

import { shellArgument } from './commands'

describe('verification command arguments', () => {
  it('leaves Kubernetes-style names readable and quotes unexpected input safely', () => {
    expect(shellArgument('web-api.v1')).toBe('web-api.v1')
    expect(shellArgument('web; echo unsafe')).toBe("'web; echo unsafe'")
    expect(shellArgument("odd'name")).toBe("'odd'\\''name'")
  })
})
