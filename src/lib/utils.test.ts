import { formatThaiDate } from './utils'

describe('display formatting', () => {
  it('formats dates with numeric day, month, and Gregorian year', () => {
    expect(formatThaiDate(new Date(2026, 8, 4, 15, 5))).toBe('4/9/2026 15:05')
  })
})
