import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const inputArgument = process.argv.find((argument) => argument.endsWith('.json'))
const shouldApply = process.argv.includes('--apply')
const expectedSourceRows = 71
const bucketName = 'repair-avatars'
const bucketLimitBytes = 8 * 1024 * 1024
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

if (!inputArgument) {
  throw new Error('Usage: node scripts/import-legacy-profile-avatars.mjs <profile-avatars.json> [--apply]')
}

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
}

const sourceRows = JSON.parse(await readFile(resolve(inputArgument), 'utf8'))
if (!Array.isArray(sourceRows)) throw new Error('Input must be a JSON array')
if (sourceRows.length !== expectedSourceRows) {
  throw new Error(`Expected ${expectedSourceRows} source rows, found ${sourceRows.length}`)
}

const normalize = (value) => String(value ?? '').trim().toLowerCase()
const seenSourceUsernames = new Set()
for (const row of sourceRows) {
  const username = normalize(row.username)
  if (!username) throw new Error(`Missing username at source row ${row.source_row}`)
  if (seenSourceUsernames.has(username)) throw new Error(`Duplicate username at source row ${row.source_row}`)
  if (!String(row.full_name ?? '').trim()) throw new Error(`Missing full name at source row ${row.source_row}`)
  if (!String(row.picture_url ?? '').startsWith('https://')) {
    throw new Error(`Invalid picture URL at source row ${row.source_row}`)
  }
  seenSourceUsernames.add(username)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: profiles, error: profileError } = await supabase
  .from('repair_profiles')
  .select('id, legacy_username, full_name, email, avatar_path, is_active')
  .eq('is_active', true)
if (profileError) throw profileError

const profilesByUsername = new Map(profiles.map((profile) => [normalize(profile.legacy_username), profile]))
const profilesByEmail = new Map(
  profiles.filter((profile) => profile.email).map((profile) => [normalize(profile.email), profile]),
)

const matchedRows = sourceRows.map((row) => {
  const sourceUsername = normalize(row.username)
  const profile = profilesByUsername.get(sourceUsername) ?? profilesByEmail.get(sourceUsername)
  if (!profile) throw new Error(`No active profile matches source row ${row.source_row}: ${row.username}`)
  if (normalize(profile.full_name) !== normalize(row.full_name)) {
    throw new Error(`Full name mismatch at source row ${row.source_row}: ${row.username}`)
  }
  return { row, profile }
})

if (new Set(matchedRows.map(({ profile }) => profile.id)).size !== matchedRows.length) {
  throw new Error('More than one source row maps to the same profile')
}

async function downloadImage(row) {
  const response = await fetch(row.picture_url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(60_000),
  })
  if (!response.ok) throw new Error(`Picture download returned HTTP ${response.status}`)

  const mimeType = (response.headers.get('content-type') || '').split(';')[0].toLowerCase()
  if (!allowedMimeTypes.has(mimeType)) throw new Error(`Unexpected MIME type: ${mimeType || 'missing'}`)

  const bytes = new Uint8Array(await response.arrayBuffer())
  if (!bytes.length) throw new Error('Downloaded file is empty')
  if (bytes.length > bucketLimitBytes) throw new Error('Downloaded file exceeds the bucket limit')

  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  return { bytes, mimeType, extension, sha256 }
}

async function findExistingObject(storagePath) {
  const slashIndex = storagePath.lastIndexOf('/')
  const folder = storagePath.slice(0, slashIndex)
  const fileName = storagePath.slice(slashIndex + 1)
  const { data, error } = await supabase.storage.from(bucketName).list(folder, {
    limit: 100,
    search: fileName,
  })
  if (error) throw error
  return data.find((item) => item.name === fileName) ?? null
}

console.log(JSON.stringify({
  mode: shouldApply ? 'apply' : 'validation-only',
  sourceRows: sourceRows.length,
  activeProfiles: profiles.length,
  matchedProfiles: matchedRows.length,
  profilesWithoutSourcePicture: profiles.length - matchedRows.length,
}, null, 2))

let downloaded = 0
let uploaded = 0
let linkedExisting = 0
let alreadyLinked = 0
let totalBytes = 0
const failures = []

for (const [index, { row, profile }] of matchedRows.entries()) {
  try {
    const image = await downloadImage(row)
    downloaded += 1
    totalBytes += image.bytes.length
    const storagePath = `${profile.id}/legacy-avatar-${image.sha256.slice(0, 16)}.${image.extension}`

    if (!shouldApply) continue
    if (profile.avatar_path) {
      if (profile.avatar_path !== storagePath) throw new Error('Profile already has a different avatar')
      alreadyLinked += 1
      continue
    }

    const existingObject = await findExistingObject(storagePath)
    if (existingObject) {
      const existingSize = Number(existingObject.metadata?.size ?? 0)
      if (existingSize !== image.bytes.length) throw new Error('Existing avatar object has a different size')
      linkedExisting += 1
    } else {
      const { error: uploadError } = await supabase.storage.from(bucketName).upload(storagePath, image.bytes, {
        contentType: image.mimeType,
        cacheControl: '86400',
        upsert: false,
        metadata: {
          sha256: image.sha256,
          source: 'legacy-google-drive-sheet2',
          source_row: row.source_row,
        },
      })
      if (uploadError) throw uploadError
      uploaded += 1
    }

    const { data: updatedProfiles, error: updateError } = await supabase
      .from('repair_profiles')
      .update({ avatar_path: storagePath })
      .eq('id', profile.id)
      .is('avatar_path', null)
      .select('id')
    if (updateError) throw updateError
    if (updatedProfiles.length !== 1) throw new Error('Profile avatar link was not updated')

    if ((index + 1) % 10 === 0 || index + 1 === matchedRows.length) {
      console.log(JSON.stringify({ processed: index + 1, total: matchedRows.length }))
    }
  } catch (error) {
    failures.push({
      sourceRow: row.source_row,
      username: row.username,
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

console.log(JSON.stringify({
  downloaded,
  uploaded,
  linkedExisting,
  alreadyLinked,
  totalBytes,
  totalMiB: Number((totalBytes / 1024 / 1024).toFixed(3)),
  failures,
}, null, 2))

if (failures.length) process.exitCode = 1
