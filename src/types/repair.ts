export type RepairStatus =
  | 'รอหัวหน้างานอนุมัติ'
  | 'รอผู้จัดการฝ่ายอนุมัติ'
  | 'รอผู้จัดการโรงงานอนุมัติ'
  | 'รอจัดซื้อดำเนินการ'
  | 'กำลังดำเนินการจัดซื้อ'
  | 'ซ่อมเสร็จเรียบร้อย (ปิดงาน)'
  | 'ไม่อนุมัติ (ตีกลับ)'

export type RepairStatusCode =
  | 'pending_supervisor'
  | 'pending_department_manager'
  | 'pending_factory_manager'
  | 'pending_purchasing'
  | 'purchasing_in_progress'
  | 'completed'
  | 'rejected'

export type UserRoleCode =
  | 'employee'
  | 'supervisor'
  | 'department_manager'
  | 'factory_manager'
  | 'purchasing'

export type RepairActionCode = 'create' | 'import' | 'approve' | 'reject' | 'acknowledge' | 'complete'

export type UserRole =
  | 'พนักงาน'
  | 'หัวหน้างาน'
  | 'ผู้จัดการฝ่าย'
  | 'ผู้จัดการโรงงาน'
  | 'จัดซื้อ'

export interface RepairRequest {
  id: string
  jobId: string
  requesterName: string
  department: string
  machineId: string
  issueDetails: string
  status: RepairStatus
  statusCode: RepairStatusCode
  createdAt: string
  updatedAt: string
  requesterId: string
  departmentId: string
  actions: RepairRequestAction[]
  attachments: RepairAttachment[]
  totalCost?: number
}

export interface RepairRequestAction {
  id: string
  action: RepairActionCode
  fromStatus?: RepairStatusCode
  toStatus: RepairStatusCode
  actorName: string
  note: string
  createdAt: string
}

export interface RepairAttachment {
  id: string
  kind: 'before' | 'after'
  storagePath?: string
  legacyDriveUrl?: string
  originalFileName?: string
  mimeType?: string
  fileSizeBytes?: number
  createdAt: string
}

export interface RepairDepartment {
  id: string
  code: string
  name: string
}

export interface RepairNotification {
  id: string
  requestId?: string
  subject: string
  body: string
  readAt?: string
  createdAt: string
}

export interface AppUser {
  id: string
  username: string
  fullName: string
  role: UserRole
  roleCode: UserRoleCode
  department: string
  departmentId?: string
  avatarPath?: string
}

export interface SettingsRepairRequest {
  id: string
  jobId: string
  requesterName: string
  departmentId: string
  departmentName: string
  machineId: string
  issueDetails: string
  statusCode: RepairStatusCode
  totalCost?: number
  createdAt: string
  updatedAt: string
  deletedAt?: string
  deletedByName?: string
}

export interface SettingsEmployee {
  id: string
  legacyUid?: string
  username: string
  fullName: string
  email?: string
  departmentId?: string
  departmentName: string
  roleCode: UserRoleCode
  isActive: boolean
  avatarPath?: string
  avatarUrl?: string
  createdAt: string
  updatedAt: string
}

export interface SettingsEmployeeInput {
  id?: string
  username: string
  password?: string
  fullName: string
  email?: string
  departmentId: string
  roleCode: UserRoleCode
  isActive: boolean
  avatarDataUrl?: string
}

export type SettingsUnlockResult =
  | { success: true; token: string; expiresAt: string }
  | {
      success: false
      code: 'AUTH_REQUIRED' | 'INVALID_PASSWORD' | 'TOO_MANY_ATTEMPTS'
      remainingAttempts?: number
      retryAfterSeconds?: number
    }
