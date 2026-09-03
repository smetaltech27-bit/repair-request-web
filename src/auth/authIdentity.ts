const INTERNAL_AUTH_DOMAIN = 'repair-request.internal'

export async function legacyUsernameToAuthEmail(username: string) {
  const normalized = username.trim().toLowerCase()
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return normalized

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized))
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `legacy-${hash.slice(0, 32)}@${INTERNAL_AUTH_DOMAIN}`
}

export async function legacyPasswordToAuthPassword(password: string) {
  if (!/^\d{4}$/.test(password)) return password

  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`repair-legacy-v1:${password}`),
  )
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
