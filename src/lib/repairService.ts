import { supabase } from './supabase'
import type {
  RepairActionCode,
  RepairAttachment,
  RepairDepartment,
  RepairNotification,
  RepairRequest,
  RepairRequestAction,
  RepairStatus,
  RepairStatusCode,
} from '../types/repair'

const bucketName = 'repair-images'

export const repairStatusLabels: Record<RepairStatusCode, RepairStatus> = {
  pending_supervisor: 'รอหัวหน้างานอนุมัติ',
  pending_department_manager: 'รอผู้จัดการฝ่ายอนุมัติ',
  pending_factory_manager: 'รอผู้จัดการโรงงานอนุมัติ',
  pending_purchasing: 'รอจัดซื้อดำเนินการ',
  purchasing_in_progress: 'กำลังดำเนินการจัดซื้อ',
  completed: 'ซ่อมเสร็จเรียบร้อย (ปิดงาน)',
  rejected: 'ไม่อนุมัติ (ตีกลับ)',
}

export const repairActionLabels: Record<RepairActionCode, string> = {
  create: 'สร้างใบแจ้งซ่อม',
  import: 'นำเข้าข้อมูลเดิม',
  approve: 'อนุมัติ',
  reject: 'ตีกลับ',
  acknowledge: 'รับดำเนินการ',
  complete: 'ปิดงาน',
}

interface RawActionRow {
  id: string
  action: RepairActionCode
  from_status: RepairStatusCode | null
  to_status: RepairStatusCode
  actor_name_snapshot: string
  note: string | null
  created_at: string
}

interface RawAttachmentRow {
  id: string
  kind: 'before' | 'after'
  storage_path: string | null
  legacy_drive_url: string | null
  original_file_name: string | null
  mime_type: string | null
  file_size_bytes: number | string | null
  created_at: string
}

interface RawRequestRow {
  id: string
  job_id: string
  requester_id: string
  requester_name_snapshot: string
  department_id: string
  department_name_snapshot: string
  machine_id: string
  issue_details: string
  status: RepairStatusCode
  total_cost: number | string | null
  created_at: string
  updated_at: string
  actions: RawActionRow[] | null
  attachments: RawAttachmentRow[] | null
}

function requireSupabase() {
  if (!supabase) throw new Error('ระบบยังไม่ได้เชื่อมต่อ Supabase')
  return supabase
}

function mapAction(row: RawActionRow): RepairRequestAction {
  return {
    id: row.id,
    action: row.action,
    fromStatus: row.from_status ?? undefined,
    toStatus: row.to_status,
    actorName: row.actor_name_snapshot,
    note: row.note ?? '',
    createdAt: row.created_at,
  }
}

function mapAttachment(row: RawAttachmentRow): RepairAttachment {
  return {
    id: row.id,
    kind: row.kind,
    storagePath: row.storage_path ?? undefined,
    legacyDriveUrl: row.legacy_drive_url ?? undefined,
    originalFileName: row.original_file_name ?? undefined,
    mimeType: row.mime_type ?? undefined,
    fileSizeBytes: row.file_size_bytes === null ? undefined : Number(row.file_size_bytes),
    createdAt: row.created_at,
  }
}

function mapRequest(row: RawRequestRow): RepairRequest {
  return {
    id: row.id,
    jobId: row.job_id,
    requesterId: row.requester_id,
    requesterName: row.requester_name_snapshot,
    departmentId: row.department_id,
    department: row.department_name_snapshot,
    machineId: row.machine_id,
    issueDetails: row.issue_details,
    statusCode: row.status,
    status: repairStatusLabels[row.status],
    totalCost: row.total_cost === null ? undefined : Number(row.total_cost),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    actions: (row.actions ?? []).map(mapAction).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    attachments: (row.attachments ?? []).map(mapAttachment).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  }
}

export async function listRepairRequests() {
  const client = requireSupabase()
  const { data, error } = await client
    .from('repair_requests')
    .select(`
      id, job_id, requester_id, requester_name_snapshot, department_id,
      department_name_snapshot, machine_id, issue_details, status, total_cost,
      created_at, updated_at,
      actions:repair_request_actions (
        id, action, from_status, to_status, actor_name_snapshot, note, created_at
      ),
      attachments:repair_request_attachments (
        id, kind, storage_path, legacy_drive_url, original_file_name,
        mime_type, file_size_bytes, created_at
      )
    `)
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw error
  return (data as unknown as RawRequestRow[]).map(mapRequest)
}

export async function listDepartments() {
  const client = requireSupabase()
  const { data, error } = await client
    .from('repair_departments')
    .select('id, code, name')
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return data as RepairDepartment[]
}

export async function createRepairRequest(input: {
  departmentId: string
  machineId: string
  issueDetails: string
  attachment?: { path: string; file: File }
}) {
  const client = requireSupabase()
  const { data, error } = await client.rpc('create_repair_request', {
    p_department_id: input.departmentId,
    p_machine_id: input.machineId,
    p_issue_details: input.issueDetails,
    p_before_storage_path: input.attachment?.path ?? null,
    p_original_file_name: input.attachment?.file.name ?? null,
    p_mime_type: input.attachment?.file.type ?? null,
    p_file_size_bytes: input.attachment?.file.size ?? null,
  })
  if (error) throw error
  return data as string
}

export async function transitionRepairRequest(input: {
  requestId: string
  action: Exclude<RepairActionCode, 'create' | 'import'>
  note: string
  totalCost?: number
  afterStoragePath?: string
}) {
  const client = requireSupabase()
  const { data, error } = await client.rpc('transition_repair_request', {
    p_request_id: input.requestId,
    p_action: input.action,
    p_note: input.note,
    p_total_cost: input.totalCost ?? null,
    p_after_storage_path: input.afterStoragePath ?? null,
  })
  if (error) throw error
  return data as RepairStatusCode
}

export async function uploadRepairImage(file: File, userId: string, scope: 'new' | 'complete') {
  const client = requireSupabase()
  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${userId}/${scope}/${crypto.randomUUID()}.${extension}`
  const { error } = await client.storage.from(bucketName).upload(path, file, {
    contentType: file.type,
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw error
  return path
}

export async function removeRepairImage(path: string) {
  const client = requireSupabase()
  const { error } = await client.storage.from(bucketName).remove([path])
  if (error) throw error
}

export async function downloadRepairImage(path: string) {
  const client = requireSupabase()
  const { data, error } = await client.storage.from(bucketName).download(path)
  if (error) throw error
  return data
}

export async function listNotifications(limit = 10) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('repair_notifications')
    .select('id, request_id, subject, body, read_at, created_at')
    .eq('channel', 'in_app')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data.map((row): RepairNotification => ({
    id: row.id,
    requestId: row.request_id ?? undefined,
    subject: row.subject,
    body: row.body,
    readAt: row.read_at ?? undefined,
    createdAt: row.created_at,
  }))
}

export async function getUnreadNotificationCount() {
  const client = requireSupabase()
  const { count, error } = await client
    .from('repair_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('channel', 'in_app')
    .is('read_at', null)
  if (error) throw error
  return count ?? 0
}

export async function markNotificationRead(notificationId: string) {
  const client = requireSupabase()
  const { error } = await client.rpc('repair_mark_notification_read', {
    p_notification_id: notificationId,
  })
  if (error) throw error
}
