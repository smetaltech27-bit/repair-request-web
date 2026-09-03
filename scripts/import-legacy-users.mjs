import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const inputArgument = process.argv.find((argument) => argument.endsWith('.json'))
const shouldApply = process.argv.includes('--apply')

if (!inputArgument) {
  throw new Error('Usage: node scripts/import-legacy-users.mjs <legacy-users.json> [--apply]')
}

const inputPath = resolve(inputArgument)
const users = JSON.parse(await readFile(inputPath, 'utf8'))
if (!Array.isArray(users)) throw new Error('Input must be a JSON array')

const validRoles = new Set(['employee', 'supervisor', 'department_manager', 'factory_manager', 'purchasing'])
const seenUsernames = new Set()
const issues = []
const readyUsers = []
const inactiveLegacyRows = []

function toAuthEmail(username) {
  const normalized = username.trim().toLowerCase()
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return normalized
  const hash = createHash('sha256').update(normalized).digest('hex').slice(0, 32)
  return `legacy-${hash}@repair-request.internal`
}

function toAuthPassword(password) {
  if (!/^\d{4}$/.test(password)) return password
  return createHash('sha256').update(`repair-legacy-v1:${password}`).digest('hex')
}

for (const [index, user] of users.entries()) {
  const row = index + 2
  const username = String(user.username ?? '').trim()
  const password = String(user.password ?? '')
  const legacyUid = String(user.legacy_uid ?? '').trim()

  if (!username || !password) {
    inactiveLegacyRows.push({ ...user, password: undefined, source_row: row })
    continue
  }
  const normalizedUsername = username.toLowerCase()
  if (seenUsernames.has(normalizedUsername)) issues.push(`Duplicate username at source row ${row}`)
  seenUsernames.add(normalizedUsername)
  if (!legacyUid) issues.push(`Missing legacy_uid at source row ${row}`)
  if (!String(user.full_name ?? '').trim()) issues.push(`Missing full_name at source row ${row}`)
  if (!validRoles.has(user.role)) issues.push(`Invalid role at source row ${row}`)

  readyUsers.push({ ...user, username, password, legacy_uid: legacyUid, auth_email: toAuthEmail(username), source_row: row })
}

console.log(JSON.stringify({
  mode: shouldApply ? 'apply' : 'validation-only',
  totalRows: users.length,
  readyForAuth: readyUsers.length,
  inactiveLegacyRows: inactiveLegacyRows.length,
  issues,
}, null, 2))

if (issues.length) throw new Error('Validation failed. No external data was written.')
if (!shouldApply) process.exit(0)

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for --apply')
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: departments, error: departmentError } = await supabase
  .from('repair_departments')
  .select('id, code')
if (departmentError) throw departmentError
const departmentIds = new Map(departments.map((department) => [department.code.toLowerCase(), department.id]))

let imported = 0
const failedLegacyUids = []

for (const user of readyUsers) {
  let createdAuthUserId = null
  try {
    const departmentCode = String(user.department_code ?? '').trim().toLowerCase()
    const departmentId = departmentCode ? departmentIds.get(departmentCode) : null
    if (departmentCode && !departmentId) throw new Error('Department does not exist')

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: user.auth_email,
      password: toAuthPassword(user.password),
      email_confirm: true,
      user_metadata: { legacy_username: user.username },
    })
    if (authError) throw authError
    createdAuthUserId = authData.user.id

    const { error: profileError } = await supabase.from('repair_profiles').insert({
      id: authData.user.id,
      legacy_uid: user.legacy_uid,
      legacy_username: user.username,
      full_name: user.full_name,
      email: user.email || null,
      department_id: departmentId,
      role: user.role,
      is_active: user.is_active !== false,
    })
    if (profileError) {
      await supabase.auth.admin.deleteUser(createdAuthUserId)
      createdAuthUserId = null
      throw profileError
    }

    const { password: _password, auth_email: _authEmail, ...safePayload } = user
    const { error: auditError } = await supabase.from('repair_legacy_import_rows').insert({
      source_sheet: 'USER',
      source_row: user.source_row,
      legacy_key: user.legacy_uid,
      payload: safePayload,
    })
    if (auditError) throw auditError
    imported += 1
  } catch {
    if (createdAuthUserId) await supabase.auth.admin.deleteUser(createdAuthUserId)
    failedLegacyUids.push(user.legacy_uid)
  }
}

const failedInactiveRows = []
for (const row of inactiveLegacyRows) {
  const { source_row: sourceRow, ...safePayload } = row
  const { error } = await supabase.from('repair_legacy_import_rows').insert({
    source_sheet: 'USER',
    source_row: sourceRow,
    legacy_key: row.legacy_uid || null,
    payload: safePayload,
  })
  if (error) failedInactiveRows.push(sourceRow)
}

console.log(JSON.stringify({
  imported,
  inactiveLegacyRows: inactiveLegacyRows.length,
  failedLegacyUids,
  failedInactiveRows,
}, null, 2))
if (failedLegacyUids.length || failedInactiveRows.length) process.exitCode = 1
