import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const inputArgument = process.argv.find((argument) => argument.endsWith('.json'))
const shouldApply = process.argv.includes('--apply')

if (!inputArgument) {
  throw new Error('Usage: node scripts/import-legacy-repairs.mjs <legacy-repairs.json> [--apply]')
}

const rows = JSON.parse(await readFile(resolve(inputArgument), 'utf8'))
if (!Array.isArray(rows)) throw new Error('Input must be a JSON array')

const validStatuses = new Set([
  'pending_supervisor',
  'pending_department_manager',
  'pending_factory_manager',
  'pending_purchasing',
  'purchasing_in_progress',
  'completed',
  'rejected',
])
const seenJobIds = new Set()
const issues = []

for (const row of rows) {
  const sourceRow = Number(row.source_row)
  const jobId = String(row.legacy_job_id ?? '').trim()
  if (!Number.isInteger(sourceRow) || sourceRow < 2) issues.push(`Invalid source row for ${jobId || 'unknown job'}`)
  if (!jobId) issues.push(`Missing legacy_job_id at source row ${sourceRow}`)
  if (seenJobIds.has(jobId)) issues.push(`Duplicate legacy_job_id ${jobId}`)
  seenJobIds.add(jobId)
  if (!row.created_at) issues.push(`Missing created_at for ${jobId}`)
  if (!row.requester_legacy_uid) issues.push(`Missing requester mapping for ${jobId}`)
  if (!row.department_code) issues.push(`Missing department mapping for ${jobId}`)
  if (!String(row.machine_id ?? '').trim()) issues.push(`Missing machine_id for ${jobId}`)
  const issueLength = Array.from(String(row.issue_details ?? '').trim()).length
  if (issueLength < 1 || issueLength > 1000) issues.push(`Invalid issue_details length for ${jobId}`)
  if (!validStatuses.has(row.status)) issues.push(`Invalid status for ${jobId}`)
  if (row.status === 'completed' && row.total_cost === null) issues.push(`Missing total_cost for completed job ${jobId}`)
}

console.log(JSON.stringify({
  mode: shouldApply ? 'apply' : 'validation-only',
  totalRows: rows.length,
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

const [{ data: profiles, error: profileError }, { data: departments, error: departmentError }] = await Promise.all([
  supabase.from('repair_profiles').select('id, legacy_uid, full_name, role, department_id'),
  supabase.from('repair_departments').select('id, code, name'),
])
if (profileError) throw profileError
if (departmentError) throw departmentError

const profilesByLegacyUid = new Map(profiles.map((profile) => [profile.legacy_uid, profile]))
const departmentsByCode = new Map(departments.map((department) => [department.code, department]))
const sequenceByDate = new Map()
const failedJobIds = []
let imported = 0
let skipped = 0

function sequenceFromJobId(jobId) {
  const match = jobId.match(/^REQ-(\d{2})(\d{2})(\d{2})-(\d{3,})$/)
  if (!match) return null
  const [, year, month, day, number] = match
  return { jobDate: `20${year}-${month}-${day}`, number: Number(number) }
}

for (const row of rows) {
  let insertedRequestId = null
  try {
    const requester = profilesByLegacyUid.get(row.requester_legacy_uid)
    const department = departmentsByCode.get(row.department_code)
    if (!requester) throw new Error('Requester profile does not exist')
    if (!department) throw new Error('Department does not exist')

    const { data: existing, error: existingError } = await supabase
      .from('repair_requests')
      .select('id')
      .eq('legacy_job_id', row.legacy_job_id)
      .maybeSingle()
    if (existingError) throw existingError
    if (existing) {
      skipped += 1
      continue
    }

    const { data: request, error: requestError } = await supabase
      .from('repair_requests')
      .insert({
        legacy_job_id: row.legacy_job_id,
        job_id: row.legacy_job_id,
        requester_id: requester.id,
        requester_name_snapshot: row.requester_name,
        requester_role_snapshot: requester.role,
        department_id: department.id,
        department_name_snapshot: row.department_name,
        machine_id: row.machine_id,
        issue_details: row.issue_details,
        status: row.status,
        total_cost: row.total_cost,
        approved_at: row.approved_at,
        closed_at: row.closed_at,
        created_at: row.created_at,
        updated_at: row.closed_at ?? row.approved_at ?? row.created_at,
      })
      .select('id')
      .single()
    if (requestError) throw requestError
    insertedRequestId = request.id

    const { error: actionError } = await supabase.from('repair_request_actions').insert({
      request_id: request.id,
      action: 'import',
      from_status: null,
      to_status: row.status,
      actor_id: null,
      actor_name_snapshot: 'ระบบนำเข้าข้อมูลเดิม',
      actor_role_snapshot: null,
      note: 'นำเข้าประวัติจาก Google Sheets',
      metadata: {
        legacy_status: row.legacy_status,
        supervisor_info: row.supervisor_info,
        supervisor_note: row.supervisor_note,
        department_manager_info: row.department_manager_info,
        department_manager_note: row.department_manager_note,
        factory_manager_info: row.factory_manager_info,
        factory_manager_note: row.factory_manager_note,
        purchasing_info: row.purchasing_info,
        purchasing_note: row.purchasing_note,
        completion_detail: row.completion_detail,
      },
      created_at: row.created_at,
    })
    if (actionError) throw actionError

    const attachments = []
    if (row.before_image_url) attachments.push({
      request_id: request.id,
      kind: 'before',
      legacy_drive_url: row.before_image_url,
      uploaded_by: requester.id,
      created_at: row.created_at,
    })
    if (row.after_image_url) attachments.push({
      request_id: request.id,
      kind: 'after',
      legacy_drive_url: row.after_image_url,
      uploaded_by: requester.id,
      created_at: row.closed_at ?? row.created_at,
    })
    if (attachments.length) {
      const { error: attachmentError } = await supabase.from('repair_request_attachments').insert(attachments)
      if (attachmentError) throw attachmentError
    }

    const { error: auditError } = await supabase.from('repair_legacy_import_rows').insert({
      source_sheet: 'Sheet1',
      source_row: row.source_row,
      legacy_key: row.legacy_job_id,
      payload: row,
    })
    if (auditError) throw auditError

    const sequence = sequenceFromJobId(row.legacy_job_id)
    if (sequence) {
      sequenceByDate.set(sequence.jobDate, Math.max(sequenceByDate.get(sequence.jobDate) ?? 0, sequence.number))
    }
    imported += 1
  } catch {
    if (insertedRequestId) await supabase.from('repair_requests').delete().eq('id', insertedRequestId)
    failedJobIds.push(row.legacy_job_id)
  }
}

if (!failedJobIds.length && sequenceByDate.size) {
  const sequenceRows = [...sequenceByDate].map(([job_date, last_number]) => ({ job_date, last_number }))
  const { error: sequenceError } = await supabase
    .from('repair_job_sequences')
    .upsert(sequenceRows, { onConflict: 'job_date' })
  if (sequenceError) throw sequenceError
}

console.log(JSON.stringify({ imported, skipped, failedJobIds }, null, 2))
if (failedJobIds.length) process.exitCode = 1
