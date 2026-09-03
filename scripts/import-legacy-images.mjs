import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const shouldApply = process.argv.includes('--apply')
const expectedAttachmentCount = 53
const bucketName = 'repair-images'
const bucketLimitBytes = 8 * 1024 * 1024

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function extractDriveFileId(url) {
  return url.match(/\/d\/([^/]+)/)?.[1] ?? url.match(/[?&]id=([^&]+)/)?.[1] ?? null
}

function safeOriginalFileName(contentDisposition, attachment) {
  const encodedName = contentDisposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  if (encodedName) {
    try {
      return decodeURIComponent(encodedName)
    } catch {
      // Fall through to the deterministic name.
    }
  }

  const quotedName = contentDisposition?.match(/filename="([^"]+)"/i)?.[1]
  return quotedName || `legacy-${attachment.kind}-${attachment.id}.jpg`
}

function storagePathFor(attachment) {
  return `${attachment.uploaded_by}/${attachment.request_id}/legacy-${attachment.kind}-${attachment.id}.jpg`
}

async function downloadDriveImage(attachment) {
  const fileId = extractDriveFileId(attachment.legacy_drive_url)
  if (!fileId) throw new Error('Invalid Google Drive URL')

  const response = await fetch(
    `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`,
    { redirect: 'follow', signal: AbortSignal.timeout(60_000) },
  )
  if (!response.ok) throw new Error(`Google Drive returned HTTP ${response.status}`)

  const mimeType = (response.headers.get('content-type') || '').split(';')[0].toLowerCase()
  if (mimeType !== 'image/jpeg') throw new Error(`Unexpected MIME type: ${mimeType || 'missing'}`)

  const bytes = new Uint8Array(await response.arrayBuffer())
  if (!bytes.length) throw new Error('Downloaded file is empty')
  if (bytes.length > bucketLimitBytes) throw new Error('Downloaded file exceeds the bucket limit')

  return {
    bytes,
    mimeType,
    originalFileName: safeOriginalFileName(response.headers.get('content-disposition'), attachment),
    sha256: createHash('sha256').update(bytes).digest('hex'),
  }
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

const { data: attachments, error: attachmentError } = await supabase
  .from('repair_request_attachments')
  .select('id, request_id, kind, storage_path, legacy_drive_url, uploaded_by, file_size_bytes')
  .not('legacy_drive_url', 'is', null)
  .order('created_at', { ascending: true })

if (attachmentError) throw attachmentError
if (attachments.length !== expectedAttachmentCount) {
  throw new Error(`Expected ${expectedAttachmentCount} legacy attachments, found ${attachments.length}`)
}

const invalidRows = attachments.filter(
  (attachment) => !attachment.uploaded_by || !extractDriveFileId(attachment.legacy_drive_url),
)
if (invalidRows.length) throw new Error(`${invalidRows.length} attachment rows cannot be migrated safely`)

console.log(JSON.stringify({
  mode: shouldApply ? 'apply' : 'validation-only',
  totalAttachments: attachments.length,
  pending: attachments.filter((attachment) => !attachment.storage_path).length,
  alreadyLinked: attachments.filter((attachment) => attachment.storage_path).length,
}, null, 2))

let uploaded = 0
let linkedExisting = 0
let skipped = 0
let totalBytes = 0
const failures = []

for (const [index, attachment] of attachments.entries()) {
  try {
    if (attachment.storage_path) {
      skipped += 1
      totalBytes += Number(attachment.file_size_bytes ?? 0)
      continue
    }

    const image = await downloadDriveImage(attachment)
    totalBytes += image.bytes.length
    if (!shouldApply) continue

    const storagePath = storagePathFor(attachment)
    const existingObject = await findExistingObject(storagePath)
    if (existingObject) {
      const existingSize = Number(existingObject.metadata?.size ?? 0)
      if (existingSize !== image.bytes.length) {
        throw new Error('Existing Storage object has a different size')
      }
      linkedExisting += 1
    } else {
      const { error: uploadError } = await supabase.storage.from(bucketName).upload(storagePath, image.bytes, {
        contentType: image.mimeType,
        cacheControl: '3600',
        upsert: false,
        metadata: { sha256: image.sha256, source: 'legacy-google-drive' },
      })
      if (uploadError) throw uploadError
      uploaded += 1
    }

    const { error: updateError } = await supabase
      .from('repair_request_attachments')
      .update({
        storage_path: storagePath,
        original_file_name: image.originalFileName,
        mime_type: image.mimeType,
        file_size_bytes: image.bytes.length,
      })
      .eq('id', attachment.id)
      .is('storage_path', null)
    if (updateError) throw updateError

    if ((index + 1) % 10 === 0 || index + 1 === attachments.length) {
      console.log(JSON.stringify({ processed: index + 1, total: attachments.length }))
    }
  } catch (error) {
    failures.push({
      attachmentId: attachment.id,
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

console.log(JSON.stringify({
  uploaded,
  linkedExisting,
  skipped,
  totalBytes,
  totalMiB: Number((totalBytes / 1024 / 1024).toFixed(3)),
  failures,
}, null, 2))

if (failures.length) process.exitCode = 1
