import { legacyPasswordToAuthPassword, legacyUsernameToAuthEmail } from './authIdentity'

describe('legacyUsernameToAuthEmail', () => {
  it('keeps existing email usernames case-insensitively', async () => {
    await expect(legacyUsernameToAuthEmail(' User@Example.com ')).resolves.toBe('user@example.com')
  })

  it('maps non-email usernames to a deterministic internal identity', async () => {
    const first = await legacyUsernameToAuthEmail('legacy-user')
    const second = await legacyUsernameToAuthEmail(' LEGACY-USER ')
    expect(first).toBe(second)
    expect(first).toMatch(/^legacy-[a-f0-9]{32}@repair-request\.internal$/)
  })
})

describe('legacyPasswordToAuthPassword', () => {
  it('maps a four-digit legacy password to the same deterministic SHA-256 value used by the importer', async () => {
    await expect(legacyPasswordToAuthPassword('1234')).resolves.toBe(
      'dfc0e6b73d0bf119001b7e52be617f1155d20c0e3318c1d5aeec7c70d781424b',
    )
  })

  it('keeps passwords with six or more characters unchanged', async () => {
    await expect(legacyPasswordToAuthPassword('secret7')).resolves.toBe('secret7')
  })
})
