import { zodResolver } from '@hookform/resolvers/zod'
import {
  Clock3,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Pencil,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { useAuth } from '../auth/AuthContext'
import { DataError, DataLoading } from '../components/DataState'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { StatusBadge } from '../components/ui/StatusBadge'
import {
  changeRepairSettingsPassword,
  listDepartments,
  listSettingsRepairRequests,
  repairStatusLabels,
  restoreSettingsRepairRequest,
  softDeleteSettingsRepairRequest,
  unlockRepairSettings,
  updateSettingsRepairRequest,
} from '../lib/repairService'
import {
  repairStatusCodes,
  settingsPasswordSchema,
  settingsRequestSchema,
  settingsUnlockSchema,
  type SettingsPasswordForm,
  type SettingsRequestForm,
  type SettingsUnlockForm,
} from '../lib/settingsValidation'
import { formatThaiDate } from '../lib/utils'
import type { RepairDepartment, SettingsRepairRequest } from '../types/repair'

function isExpiredSettingsError(error: unknown) {
  return error instanceof Error && error.message.includes('Session หมดอายุ')
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองอีกครั้ง'
}

interface PasswordFieldProps {
  id: string
  label: string
  error?: string
  autoComplete: string
  registration: ReturnType<ReturnType<typeof useForm<SettingsPasswordForm>>['register']>
}

function PasswordField({ id, label, error, autoComplete, registration }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-bold text-slate-700">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          className="form-control pr-12"
          {...registration}
        />
        <button
          type="button"
          aria-label={visible ? `ซ่อน ${label}` : `แสดง ${label}`}
          onClick={() => setVisible((value) => !value)}
          className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          {visible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
    </div>
  )
}

function ChangePasswordModal({
  open,
  sessionToken,
  onClose,
  onChanged,
  onSessionExpired,
}: {
  open: boolean
  sessionToken: string
  onClose: () => void
  onChanged: () => void
  onSessionExpired: () => void
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SettingsPasswordForm>({ resolver: zodResolver(settingsPasswordSchema) })

  useEffect(() => {
    if (!open) reset()
  }, [open, reset])

  async function submit(values: SettingsPasswordForm) {
    try {
      const result = await changeRepairSettingsPassword({
        sessionToken,
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })
      if (!result.success) {
        const messages = {
          INVALID_CURRENT_PASSWORD: 'Password ปัจจุบันไม่ถูกต้อง',
          INVALID_NEW_PASSWORD: 'Password ใหม่ต้องมี 6–64 ตัวอักษร',
          DEFAULT_PASSWORD_NOT_ALLOWED: 'ไม่สามารถใช้ 1234 เป็น Password ใหม่ได้',
          PASSWORD_UNCHANGED: 'Password ใหม่ต้องไม่ซ้ำกับ Password ปัจจุบัน',
        }
        toast.error('เปลี่ยน Password ไม่สำเร็จ', { description: result.code ? messages[result.code] : undefined })
        return
      }
      toast.success('เปลี่ยน Settings Password สำเร็จ', { description: 'ระบบล็อก Settings Session เดิมทั้งหมดแล้ว' })
      onChanged()
    } catch (error) {
      if (isExpiredSettingsError(error)) onSessionExpired()
      toast.error('เปลี่ยน Password ไม่สำเร็จ', { description: errorText(error) })
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(value) => !value && onClose()}
      title="เปลี่ยน Settings Password"
      description="Password นี้แยกจาก Password ที่ใช้ Login"
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>ยกเลิก</Button>
          <Button type="submit" form="settings-password-form" disabled={isSubmitting}>
            {isSubmitting ? 'กำลังบันทึก…' : 'เปลี่ยน Password'}
          </Button>
        </div>
      }
    >
      <form id="settings-password-form" className="space-y-5" onSubmit={handleSubmit(submit)} noValidate>
        <PasswordField
          id="current-settings-password"
          label="Password ปัจจุบัน"
          autoComplete="current-password"
          error={errors.currentPassword?.message}
          registration={register('currentPassword')}
        />
        <PasswordField
          id="new-settings-password"
          label="Password ใหม่"
          autoComplete="new-password"
          error={errors.newPassword?.message}
          registration={register('newPassword')}
        />
        <PasswordField
          id="confirm-settings-password"
          label="ยืนยัน Password ใหม่"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          registration={register('confirmPassword')}
        />
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          หลังเปลี่ยนสำเร็จ รหัส <strong>1234</strong> และ Settings Session ที่เปิดอยู่ทั้งหมดจะใช้ไม่ได้ทันที
        </div>
      </form>
    </Modal>
  )
}

function EditRequestModal({
  request,
  departments,
  sessionToken,
  onClose,
  onSaved,
  onSessionExpired,
}: {
  request: SettingsRepairRequest | null
  departments: RepairDepartment[]
  sessionToken: string
  onClose: () => void
  onSaved: () => Promise<void>
  onSessionExpired: () => void
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SettingsRequestForm>({ resolver: zodResolver(settingsRequestSchema) })

  useEffect(() => {
    if (request) {
      reset({
        departmentId: request.departmentId,
        machineId: request.machineId,
        issueDetails: request.issueDetails,
        statusCode: request.statusCode,
        totalCost: request.totalCost === undefined ? '' : String(request.totalCost),
      })
    }
  }, [request, reset])

  async function submit(values: SettingsRequestForm) {
    if (!request) return
    try {
      await updateSettingsRepairRequest({
        sessionToken,
        requestId: request.id,
        departmentId: values.departmentId,
        machineId: values.machineId,
        issueDetails: values.issueDetails,
        statusCode: values.statusCode,
        totalCost: values.totalCost.trim() === '' ? undefined : Number(values.totalCost),
      })
      toast.success(`บันทึก ${request.jobId} เรียบร้อยแล้ว`)
      onClose()
      await onSaved()
    } catch (error) {
      if (isExpiredSettingsError(error)) onSessionExpired()
      toast.error('แก้ไขรายการไม่สำเร็จ', { description: errorText(error) })
    }
  }

  return (
    <Modal
      open={Boolean(request)}
      onOpenChange={(value) => !value && onClose()}
      title="แก้ไขรายการแจ้งซ่อม"
      description={request ? `${request.jobId} · ผู้แจ้ง ${request.requesterName}` : undefined}
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>ยกเลิก</Button>
          <Button type="submit" form="settings-edit-request-form" disabled={isSubmitting}>
            {isSubmitting ? 'กำลังบันทึก…' : 'บันทึกการแก้ไข'}
          </Button>
        </div>
      }
    >
      {request && (
        <form id="settings-edit-request-form" className="space-y-5" onSubmit={handleSubmit(submit)} noValidate>
          <div className="grid gap-4 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2">
            <div><p className="text-xs text-slate-500">Job ID</p><p className="mt-1 font-bold text-slate-900">{request.jobId}</p></div>
            <div><p className="text-xs text-slate-500">ผู้แจ้ง</p><p className="mt-1 font-bold text-slate-900">{request.requesterName}</p></div>
          </div>
          <div>
            <label htmlFor="settings-department" className="mb-2 block text-sm font-bold text-slate-700">แผนก</label>
            <select id="settings-department" className="form-control" {...register('departmentId')}>
              {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            </select>
            {errors.departmentId && <p className="form-error">{errors.departmentId.message}</p>}
          </div>
          <div>
            <label htmlFor="settings-machine" className="mb-2 block text-sm font-bold text-slate-700">เครื่องจักร / รหัสเครื่อง</label>
            <input id="settings-machine" className="form-control" {...register('machineId')} />
            {errors.machineId && <p className="form-error">{errors.machineId.message}</p>}
          </div>
          <div>
            <label htmlFor="settings-issue" className="mb-2 block text-sm font-bold text-slate-700">รายละเอียดปัญหา</label>
            <textarea id="settings-issue" rows={5} className="form-control min-h-32 resize-y py-3" {...register('issueDetails')} />
            {errors.issueDetails && <p className="form-error">{errors.issueDetails.message}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="settings-status" className="mb-2 block text-sm font-bold text-slate-700">สถานะ</label>
              <select id="settings-status" className="form-control" {...register('statusCode')}>
                {repairStatusCodes.map((status) => <option key={status} value={status}>{repairStatusLabels[status]}</option>)}
              </select>
              {errors.statusCode && <p className="form-error">{errors.statusCode.message}</p>}
            </div>
            <div>
              <label htmlFor="settings-cost" className="mb-2 block text-sm font-bold text-slate-700">ค่าใช้จ่าย</label>
              <input id="settings-cost" type="number" min="0" step="0.01" className="form-control" placeholder="0.00" {...register('totalCost')} />
              {errors.totalCost && <p className="form-error">{errors.totalCost.message}</p>}
            </div>
          </div>
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-900">
            Job ID, ผู้แจ้ง และประวัติการอนุมัติจะไม่ถูกเปลี่ยน เพื่อรักษาหลักฐานเดิมของรายการ
          </div>
        </form>
      )}
    </Modal>
  )
}

export function SettingsPage() {
  const { isDemoMode } = useAuth()
  const [sessionToken, setSessionToken] = useState('')
  const [sessionExpiresAt, setSessionExpiresAt] = useState('')
  const [requests, setRequests] = useState<SettingsRepairRequest[]>([])
  const [departments, setDepartments] = useState<RepairDepartment[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState('')
  const [viewMode, setViewMode] = useState<'active' | 'trash'>('active')
  const [editingRequest, setEditingRequest] = useState<SettingsRepairRequest | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SettingsRepairRequest | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [showUnlockPassword, setShowUnlockPassword] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SettingsUnlockForm>({ resolver: zodResolver(settingsUnlockSchema) })

  const lockSettings = useCallback(() => {
    setSessionToken('')
    setSessionExpiresAt('')
    setRequests([])
    setEditingRequest(null)
    setDeleteTarget(null)
    setPasswordModalOpen(false)
    reset()
  }, [reset])

  const loadSettingsData = useCallback(async (token: string) => {
    setIsLoading(true)
    setLoadError('')
    try {
      const [requestItems, departmentItems] = await Promise.all([
        listSettingsRepairRequests(token),
        listDepartments(),
      ])
      setRequests(requestItems)
      setDepartments(departmentItems)
    } catch (error) {
      if (isExpiredSettingsError(error)) lockSettings()
      setLoadError(errorText(error))
    } finally {
      setIsLoading(false)
    }
  }, [lockSettings])

  useEffect(() => {
    if (!sessionToken || !sessionExpiresAt) return
    const remaining = new Date(sessionExpiresAt).getTime() - Date.now()
    const timer = window.setTimeout(() => {
      lockSettings()
      toast.info('Settings Session หมดอายุแล้ว')
    }, Math.max(0, remaining))
    return () => window.clearTimeout(timer)
  }, [lockSettings, sessionExpiresAt, sessionToken])

  const filteredRequests = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return requests.filter((request) => {
      const matchesMode = viewMode === 'trash' ? Boolean(request.deletedAt) : !request.deletedAt
      const matchesQuery = !normalized || [
        request.jobId,
        request.requesterName,
        request.departmentName,
        request.machineId,
        request.issueDetails,
      ].join(' ').toLowerCase().includes(normalized)
      return matchesMode && matchesQuery
    })
  }, [query, requests, viewMode])

  async function unlock(values: SettingsUnlockForm) {
    try {
      const result = await unlockRepairSettings(values.password)
      if (!result.success) {
        if (result.code === 'TOO_MANY_ATTEMPTS') {
          const minutes = Math.max(1, Math.ceil((result.retryAfterSeconds ?? 60) / 60))
          setError('password', { message: `ลองผิดเกินกำหนด กรุณารอประมาณ ${minutes} นาที` })
        } else if (result.code === 'AUTH_REQUIRED') {
          setError('password', { message: 'กรุณา Login ใหม่ก่อนเข้า Settings' })
        } else {
          setError('password', { message: `Password ไม่ถูกต้อง เหลือลองได้ ${result.remainingAttempts ?? 0} ครั้ง` })
        }
        return
      }
      setSessionToken(result.token)
      setSessionExpiresAt(result.expiresAt)
      reset()
      await loadSettingsData(result.token)
      toast.success('ปลดล็อก Settings แล้ว', { description: 'Session นี้ใช้งานได้ 15 นาที' })
    } catch (error) {
      setError('password', { message: errorText(error) })
    }
  }

  async function deleteRequest() {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await softDeleteSettingsRepairRequest(sessionToken, deleteTarget.id)
      toast.success(`ย้าย ${deleteTarget.jobId} ไปถังขยะแล้ว`, { description: 'สามารถกู้คืนได้จากแท็บถังขยะ' })
      setDeleteTarget(null)
      await loadSettingsData(sessionToken)
    } catch (error) {
      if (isExpiredSettingsError(error)) lockSettings()
      toast.error('ลบรายการไม่สำเร็จ', { description: errorText(error) })
    } finally {
      setIsDeleting(false)
    }
  }

  async function restoreRequest(request: SettingsRepairRequest) {
    try {
      await restoreSettingsRepairRequest(sessionToken, request.id)
      toast.success(`กู้คืน ${request.jobId} แล้ว`)
      await loadSettingsData(sessionToken)
    } catch (error) {
      if (isExpiredSettingsError(error)) lockSettings()
      toast.error('กู้คืนรายการไม่สำเร็จ', { description: errorText(error) })
    }
  }

  if (!sessionToken) {
    return (
      <div className="mx-auto max-w-lg">
        <div className="text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-slate-950 text-white shadow-xl shadow-slate-950/20">
            <Settings2 className="size-8" />
          </div>
          <p className="mt-5 text-sm font-bold uppercase tracking-[0.18em] text-teal-600">Restricted settings</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">ยืนยัน Settings Password</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">รหัสนี้เป็นคนละตัวกับ Password ที่ใช้ Login เข้าระบบ</p>
        </div>

        <Card className="mt-7 p-5 sm:p-7">
          {isDemoMode ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              หน้า Settings ต้องเชื่อมต่อ Supabase จึงจะทดสอบสิทธิ์ได้
            </div>
          ) : (
            <form onSubmit={handleSubmit(unlock)} className="space-y-5" noValidate>
              <div>
                <label htmlFor="settings-unlock-password" className="mb-2 block text-sm font-bold text-slate-700">Settings Password</label>
                <div className="relative">
                  <input
                    id="settings-unlock-password"
                    type={showUnlockPassword ? 'text' : 'password'}
                    autoComplete="off"
                    inputMode="text"
                    className="form-control pr-12"
                    placeholder="กรอก Settings Password"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    aria-label={showUnlockPassword ? 'ซ่อน Settings Password' : 'แสดง Settings Password'}
                    onClick={() => setShowUnlockPassword((value) => !value)}
                    className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    {showUnlockPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </div>
                {errors.password && <p role="alert" className="form-error">{errors.password.message}</p>}
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                <ShieldCheck className="size-5" /> {isSubmitting ? 'กำลังตรวจสอบ…' : 'ปลดล็อก Settings'}
              </Button>
            </form>
          )}
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900">
            <strong>ครั้งแรกใช้รหัส 1234</strong> และควรเปลี่ยนเป็นรหัสใหม่ทันทีหลังปลดล็อก
          </div>
        </Card>
      </div>
    )
  }

  if (isLoading && requests.length === 0) return <DataLoading label="กำลังโหลดข้อมูลสำหรับจัดการ…" />
  if (loadError && requests.length === 0) return <DataError message={loadError} onRetry={() => void loadSettingsData(sessionToken)} />

  const activeCount = requests.filter((request) => !request.deletedAt).length
  const trashCount = requests.length - activeCount

  return (
    <>
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-teal-600">Administration</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">ตั้งค่าและจัดการรายการ</h1>
          <p className="mt-1 text-sm text-slate-500">แก้ไข ลบ และกู้คืนรายการแจ้งซ่อม พร้อมบันทึก Audit Log</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void loadSettingsData(sessionToken)} disabled={isLoading}>
            <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} /> รีเฟรช
          </Button>
          <Button variant="secondary" onClick={() => setPasswordModalOpen(true)}><KeyRound className="size-4" /> เปลี่ยน Password</Button>
          <Button variant="ghost" onClick={lockSettings}><LockKeyhole className="size-4" /> ล็อก</Button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><p className="text-xs font-bold text-slate-500">รายการใช้งาน</p><p className="mt-1 text-2xl font-bold text-slate-950">{activeCount}</p></Card>
        <Card className="p-4"><p className="text-xs font-bold text-slate-500">ในถังขยะ</p><p className="mt-1 text-2xl font-bold text-red-600">{trashCount}</p></Card>
        <Card className="border-teal-200 bg-teal-50/60 p-4"><div className="flex items-center gap-2 text-teal-800"><Clock3 className="size-4" /><p className="text-xs font-bold">ปลดล็อกถึง</p></div><p className="mt-1 font-bold text-teal-950">{new Date(sessionExpiresAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</p></Card>
      </div>

      <Card className="mt-5 p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <label className="relative block">
            <span className="sr-only">ค้นหารายการ</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="form-control pl-11" placeholder="ค้นหา Job ID ผู้แจ้ง แผนก เครื่องจักร หรือรายละเอียด" />
          </label>
          <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1">
            <button onClick={() => setViewMode('active')} className={`rounded-lg px-4 py-2 text-xs font-bold transition ${viewMode === 'active' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>รายการ ({activeCount})</button>
            <button onClick={() => setViewMode('trash')} className={`rounded-lg px-4 py-2 text-xs font-bold transition ${viewMode === 'trash' ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500'}`}>ถังขยะ ({trashCount})</button>
          </div>
        </div>
      </Card>

      <div className="mt-4 grid gap-3">
        {filteredRequests.map((request) => (
          <Card key={request.id} className={`overflow-hidden ${request.deletedAt ? 'border-red-200 bg-red-50/20' : ''}`}>
            <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-bold text-slate-950">{request.jobId}</h2>
                  <StatusBadge status={repairStatusLabels[request.statusCode]} />
                  {request.deletedAt && <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold text-red-700">อยู่ในถังขยะ</span>}
                </div>
                <p className="mt-1 font-semibold text-slate-700">{request.machineId}</p>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">{request.issueDetails}</p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>{request.requesterName}</span><span>{request.departmentName}</span><span>{formatThaiDate(request.createdAt)}</span>
                  {request.totalCost !== undefined && <span>฿{request.totalCost.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>}
                </div>
                {request.deletedAt && <p className="mt-2 text-xs font-medium text-red-600">ลบเมื่อ {formatThaiDate(request.deletedAt)}{request.deletedByName ? ` โดย ${request.deletedByName}` : ''}</p>}
              </div>
              <div className="grid grid-cols-2 gap-2 lg:flex">
                {request.deletedAt ? (
                  <Button variant="secondary" className="col-span-2" onClick={() => void restoreRequest(request)}><RotateCcw className="size-4" /> กู้คืนรายการ</Button>
                ) : (
                  <>
                    <Button variant="secondary" onClick={() => setEditingRequest(request)}><Pencil className="size-4" /> แก้ไข</Button>
                    <Button variant="danger" onClick={() => setDeleteTarget(request)}><Trash2 className="size-4" /> ลบ</Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
        {filteredRequests.length === 0 && (
          <Card className="p-10 text-center">
            {viewMode === 'trash' ? <Trash2 className="mx-auto size-10 text-slate-300" /> : <Search className="mx-auto size-10 text-slate-300" />}
            <h2 className="mt-3 font-bold text-slate-900">{viewMode === 'trash' ? 'ถังขยะว่าง' : 'ไม่พบรายการ'}</h2>
            <p className="mt-1 text-sm text-slate-500">{query ? 'ลองเปลี่ยนคำค้นหา' : 'ยังไม่มีข้อมูลในส่วนนี้'}</p>
          </Card>
        )}
      </div>

      <EditRequestModal
        request={editingRequest}
        departments={departments}
        sessionToken={sessionToken}
        onClose={() => setEditingRequest(null)}
        onSaved={() => loadSettingsData(sessionToken)}
        onSessionExpired={lockSettings}
      />

      <Modal
        open={Boolean(deleteTarget)}
        onOpenChange={(value) => !value && setDeleteTarget(null)}
        title="ย้ายรายการไปถังขยะ?"
        description={deleteTarget ? `${deleteTarget.jobId} · ${deleteTarget.machineId}` : undefined}
        footer={
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>ยกเลิก</Button>
            <Button variant="danger" disabled={isDeleting} onClick={() => void deleteRequest()}>
              <Trash2 className="size-4" /> {isDeleting ? 'กำลังลบ…' : 'ยืนยันลบ'}
            </Button>
          </div>
        }
      >
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900">
          รายการจะหายจากหน้าปกติและขั้นตอนอนุมัติ แต่ข้อมูล ประวัติ และรูปภาพจะยังคงอยู่เพื่อให้กู้คืนได้ เลข Job จะไม่ถูกนำกลับมาใช้ซ้ำ
        </div>
      </Modal>

      <ChangePasswordModal
        open={passwordModalOpen}
        sessionToken={sessionToken}
        onClose={() => setPasswordModalOpen(false)}
        onChanged={lockSettings}
        onSessionExpired={lockSettings}
      />
    </>
  )
}
