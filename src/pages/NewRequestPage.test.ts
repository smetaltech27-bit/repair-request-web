import { describe, expect, it } from 'vitest'
import { requestSchema } from '../lib/newRequestValidation'

describe('requestSchema', () => {
  it('requires issue details but accepts a single non-whitespace character', () => {
    const valid = requestSchema.safeParse({
      machineId: 'M1',
      issueDetails: 'ดัง',
      image: undefined,
    })
    const blank = requestSchema.safeParse({
      machineId: 'M1',
      issueDetails: '   ',
      image: undefined,
    })

    expect(valid.success).toBe(true)
    expect(blank.success).toBe(false)
  })
})
