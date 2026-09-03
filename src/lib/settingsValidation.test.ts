import { describe, expect, it } from 'vitest'
import { settingsPasswordSchema, settingsRequestSchema } from './settingsValidation'

describe('settings password validation', () => {
  it('rejects the temporary default as a new password', () => {
    const result = settingsPasswordSchema.safeParse({
      currentPassword: '1234',
      newPassword: '1234',
      confirmPassword: '1234',
    })
    expect(result.success).toBe(false)
  })

  it('accepts a matching password with at least six characters', () => {
    const result = settingsPasswordSchema.safeParse({
      currentPassword: '1234',
      newPassword: 'repair-789',
      confirmPassword: 'repair-789',
    })
    expect(result.success).toBe(true)
  })
})

describe('settings request validation', () => {
  const request = {
    departmentId: '11111111-1111-4111-8111-111111111111',
    machineId: 'CNC-01',
    issueDetails: 'ทดสอบแก้ไขรายละเอียด',
    statusCode: 'completed' as const,
    totalCost: '',
  }

  it('requires a cost for completed requests', () => {
    expect(settingsRequestSchema.safeParse(request).success).toBe(false)
  })

  it('allows zero cost for completed requests', () => {
    expect(settingsRequestSchema.safeParse({ ...request, totalCost: '0' }).success).toBe(true)
  })
})
