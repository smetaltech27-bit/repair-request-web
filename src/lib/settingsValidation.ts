import { z } from 'zod'

export const repairStatusCodes = [
  'pending_supervisor',
  'pending_department_manager',
  'pending_factory_manager',
  'pending_purchasing',
  'purchasing_in_progress',
  'completed',
  'rejected',
] as const

export const settingsUnlockSchema = z.object({
  password: z.string().min(1, 'กรุณากรอก Settings Password'),
})

export const settingsPasswordSchema = z.object({
  currentPassword: z.string().min(1, 'กรุณากรอก Password ปัจจุบัน'),
  newPassword: z
    .string()
    .min(6, 'Password ใหม่ต้องมีอย่างน้อย 6 ตัวอักษร')
    .max(64, 'Password ใหม่ต้องไม่เกิน 64 ตัวอักษร')
    .refine((value) => value !== '1234', 'ไม่สามารถใช้ 1234 เป็น Password ใหม่ได้'),
  confirmPassword: z.string().min(1, 'กรุณายืนยัน Password ใหม่'),
}).refine((values) => values.newPassword === values.confirmPassword, {
  message: 'Password ใหม่ทั้งสองช่องไม่ตรงกัน',
  path: ['confirmPassword'],
})

export const settingsRequestSchema = z.object({
  departmentId: z.string().uuid('กรุณาเลือกแผนก'),
  machineId: z.string().trim().min(2, 'กรุณาระบุเครื่องจักรอย่างน้อย 2 ตัวอักษร'),
  issueDetails: z.string().trim().min(1, 'กรุณากรอกรายละเอียดปัญหา').max(1000, 'รายละเอียดต้องไม่เกิน 1,000 ตัวอักษร'),
  statusCode: z.enum(repairStatusCodes),
  totalCost: z.string(),
}).superRefine((values, context) => {
  const trimmedCost = values.totalCost.trim()
  if (values.statusCode === 'completed' && trimmedCost === '') {
    context.addIssue({ code: 'custom', path: ['totalCost'], message: 'รายการที่ปิดงานแล้วต้องระบุค่าใช้จ่าย' })
    return
  }
  if (trimmedCost !== '') {
    const cost = Number(trimmedCost)
    if (!Number.isFinite(cost) || cost < 0) {
      context.addIssue({ code: 'custom', path: ['totalCost'], message: 'ค่าใช้จ่ายต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป' })
    }
  }
})

export const employeeRoleCodes = [
  'employee',
  'supervisor',
  'department_manager',
  'factory_manager',
  'purchasing',
] as const

const employeePasswordSchema = z.string().refine((value) => {
  if (!value) return true
  if (/^\d{4}$/.test(value)) return true
  const characterLength = Array.from(value).length
  const byteLength = new TextEncoder().encode(value).length
  return characterLength >= 6 && byteLength <= 72
}, 'ใช้ตัวเลข 4 หลัก หรือ Password ตั้งแต่ 6 ตัวอักษรและไม่เกิน 72 bytes')

export const settingsEmployeeSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, 'กรุณากรอก Username')
    .max(120, 'Username ต้องไม่เกิน 120 ตัวอักษร')
    .regex(/^\S+$/, 'Username ต้องไม่มีช่องว่าง'),
  password: employeePasswordSchema,
  confirmPassword: z.string(),
  fullName: z.string().trim().min(1, 'กรุณากรอกชื่อ–นามสกุล').max(200, 'ชื่อต้องไม่เกิน 200 ตัวอักษร'),
  email: z.union([z.literal(''), z.string().trim().email('รูปแบบ Email ไม่ถูกต้อง')]),
  departmentId: z.string().uuid('กรุณาเลือกแผนก'),
  roleCode: z.enum(employeeRoleCodes),
  isActive: z.boolean(),
}).superRefine((values, context) => {
  if (values.password !== values.confirmPassword) {
    context.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Password ทั้งสองช่องไม่ตรงกัน' })
  }
})

export type SettingsUnlockForm = z.infer<typeof settingsUnlockSchema>
export type SettingsPasswordForm = z.infer<typeof settingsPasswordSchema>
export type SettingsRequestForm = z.infer<typeof settingsRequestSchema>
export type SettingsEmployeeForm = z.infer<typeof settingsEmployeeSchema>
