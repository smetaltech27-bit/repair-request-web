import { zodResolver } from '@hookform/resolvers/zod'
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  UserRoundCheck,
  UserRoundX,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { compressRepairImage } from '../../lib/imageProcessing'
import { listSettingsEmployees, saveSettingsEmployee } from '../../lib/repairService'
import {
  employeeRoleCodes,
  settingsEmployeeSchema,
  type SettingsEmployeeForm,
} from '../../lib/settingsValidation'
import type { RepairDepartment, SettingsEmployee, UserRoleCode } from '../../types/repair'
import { DataError, DataLoading } from '../DataState'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Modal } from '../ui/Modal'

const roleLabels: Record<UserRoleCode, string> = {
  employee: 'พนักงาน',
  supervisor: 'หัวหน้างาน',
  department_manager: 'ผู้จัดการฝ่าย',
  factory_manager: 'ผู้จัดการโรงงาน',
  purchasing: 'จัดซื้อ',
}

const employeesPerPage = 20

function employeeSequence(employee: SettingsEmployee) {
  const match = /^USER-(\d+)$/i.exec(employee.legacyUid ?? '')
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY
}

function compareEmployees(left: SettingsEmployee, right: SettingsEmployee) {
  const sequenceDifference = employeeSequence(left) - employeeSequence(right)
  if (Number.isFinite(sequenceDifference) && sequenceDifference !== 0) return sequenceDifference
  if (Number.isFinite(employeeSequence(left)) !== Number.isFinite(employeeSequence(right))) {
    return Number.isFinite(employeeSequence(left)) ? -1 : 1
  }
  return left.username.localeCompare(right.username, 'th', { numeric: true, sensitivity: 'base' })
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองอีกครั้ง'
}

function isExpiredSettingsError(error: unknown) {
  return error instanceof Error && error.message.includes('Session หมดอายุ')
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์รูปพนักงานได้'))
    reader.readAsDataURL(file)
  })
}

function EmployeeAvatar({ employee, className = 'size-12' }: { employee: SettingsEmployee; className?: string }) {
  return (
    <div className={`grid shrink-0 place-items-center overflow-hidden rounded-2xl bg-teal-100 font-bold text-teal-700 ${className}`}>
      {employee.avatarUrl ? (
        <img src={employee.avatarUrl} alt={`รูปพนักงาน ${employee.fullName}`} className="size-full object-cover" />
      ) : (
        employee.fullName.trim().charAt(0) || '?'
      )}
    </div>
  )
}

function EmployeePasswordField({
  id,
  label,
  registration,
  error,
}: {
  id: string
  label: string
  registration: ReturnType<ReturnType<typeof useForm<SettingsEmployeeForm>>['register']>
  error?: string
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-bold text-slate-700">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete="new-password"
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

function EmployeeModal({
  employee,
  open,
  departments,
  sessionToken,
  onClose,
  onSaved,
  onSessionExpired,
}: {
  employee: SettingsEmployee | null
  open: boolean
  departments: RepairDepartment[]
  sessionToken: string
  onClose: () => void
  onSaved: () => Promise<void>
  onSessionExpired: () => void
}) {
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState(employee?.avatarUrl ?? '')
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SettingsEmployeeForm>({
    resolver: zodResolver(settingsEmployeeSchema),
    defaultValues: {
      username: employee?.username ?? '',
      password: '',
      confirmPassword: '',
      fullName: employee?.fullName ?? '',
      email: employee?.email ?? '',
      departmentId: employee?.departmentId ?? departments[0]?.id ?? '',
      roleCode: employee?.roleCode ?? 'employee',
      isActive: employee?.isActive ?? true,
    },
  })

  function selectAvatar(file: File | null) {
    setAvatarFile(file)
    if (!file) {
      setAvatarPreview(employee?.avatarUrl ?? '')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setAvatarPreview(String(reader.result ?? ''))
    reader.readAsDataURL(file)
  }

  async function submit(values: SettingsEmployeeForm) {
    if (!employee && !values.password) {
      setError('password', { message: 'กรุณากำหนด Password สำหรับพนักงานใหม่' })
      return
    }

    try {
      let avatarDataUrl: string | undefined
      if (avatarFile) {
        const compressed = await compressRepairImage(avatarFile)
        avatarDataUrl = await fileToDataUrl(compressed)
      }

      await saveSettingsEmployee({
        sessionToken,
        employee: {
          id: employee?.id,
          username: values.username.trim(),
          password: values.password || undefined,
          fullName: values.fullName.trim(),
          email: values.email.trim() || undefined,
          departmentId: values.departmentId,
          roleCode: values.roleCode,
          isActive: values.isActive,
          avatarDataUrl,
        },
      })
      toast.success(employee ? 'แก้ไขข้อมูลพนักงานแล้ว' : 'เพิ่มพนักงานใหม่แล้ว', {
        description: `${values.fullName.trim()} · ${values.username.trim()}`,
      })
      onClose()
      await onSaved()
    } catch (error) {
      if (isExpiredSettingsError(error)) onSessionExpired()
      toast.error(employee ? 'แก้ไขพนักงานไม่สำเร็จ' : 'เพิ่มพนักงานไม่สำเร็จ', { description: errorText(error) })
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(value) => !value && onClose()}
      title={employee ? 'แก้ไขข้อมูลพนักงาน' : 'เพิ่มพนักงานใหม่'}
      description="Username และ Password แก้ไขได้เฉพาะผู้ที่ปลดล็อกหน้า Settings"
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>ยกเลิก</Button>
          <Button type="submit" form="settings-employee-form" disabled={isSubmitting}>
            {isSubmitting ? 'กำลังบันทึก…' : 'บันทึกพนักงาน'}
          </Button>
        </div>
      }
    >
      <form id="settings-employee-form" className="space-y-5" onSubmit={handleSubmit(submit)} noValidate>
        <div className="flex flex-col items-center gap-4 rounded-2xl bg-slate-50 p-4 sm:flex-row">
          <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-teal-100 text-2xl font-bold text-teal-700">
            {avatarPreview ? <img src={avatarPreview} alt="ตัวอย่างรูปพนักงาน" className="size-full object-cover" /> : (employee?.fullName?.charAt(0) || '?')}
          </div>
          <div className="w-full">
            <label htmlFor="employee-avatar" className="mb-2 block text-sm font-bold text-slate-700">รูปพนักงาน</label>
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-teal-200 hover:bg-teal-50">
              <Camera className="size-4" /> เลือกรูปใหม่
              <input
                id="employee-avatar"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => selectAvatar(event.target.files?.[0] ?? null)}
              />
            </label>
            <p className="mt-2 text-xs text-slate-500">รองรับ JPG, PNG และ WebP ระบบจะย่อรูปก่อนบันทึก</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="employee-username" className="mb-2 block text-sm font-bold text-slate-700">Username</label>
            <input id="employee-username" autoComplete="off" className="form-control" {...register('username')} />
            {errors.username && <p className="form-error">{errors.username.message}</p>}
          </div>
          <div>
            <label htmlFor="employee-full-name" className="mb-2 block text-sm font-bold text-slate-700">ชื่อ–นามสกุล</label>
            <input id="employee-full-name" className="form-control" {...register('fullName')} />
            {errors.fullName && <p className="form-error">{errors.fullName.message}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="employee-email" className="mb-2 block text-sm font-bold text-slate-700">Email สำหรับแจ้งเตือน <span className="font-normal text-slate-400">(ไม่บังคับ)</span></label>
          <input id="employee-email" type="email" autoComplete="off" className="form-control" {...register('email')} />
          {errors.email && <p className="form-error">{errors.email.message}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="employee-department" className="mb-2 block text-sm font-bold text-slate-700">แผนก</label>
            <select id="employee-department" className="form-control" {...register('departmentId')}>
              {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            </select>
            {errors.departmentId && <p className="form-error">{errors.departmentId.message}</p>}
          </div>
          <div>
            <label htmlFor="employee-role" className="mb-2 block text-sm font-bold text-slate-700">Role / สิทธิ์</label>
            <select id="employee-role" className="form-control" {...register('roleCode')}>
              {employeeRoleCodes.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
            </select>
            {errors.roleCode && <p className="form-error">{errors.roleCode.message}</p>}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <EmployeePasswordField
            id="employee-password"
            label={employee ? 'Password ใหม่ (เว้นว่างได้)' : 'Password'}
            registration={register('password')}
            error={errors.password?.message}
          />
          <EmployeePasswordField
            id="employee-confirm-password"
            label="ยืนยัน Password"
            registration={register('confirmPassword')}
            error={errors.confirmPassword?.message}
          />
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
          <input type="checkbox" className="mt-1 size-4 accent-teal-600" {...register('isActive')} />
          <span>
            <span className="block text-sm font-bold text-slate-800">เปิดใช้งานบัญชี</span>
            <span className="mt-1 block text-xs leading-5 text-slate-500">เมื่อปิด พนักงานจะ Login และใช้งานระบบไม่ได้ แต่ประวัติงานเดิมยังอยู่ครบ</span>
          </span>
        </label>

        <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          <ShieldAlert className="mt-0.5 size-5 shrink-0" />
          <p>การเปลี่ยน Role หรือแผนกมีผลต่อสิทธิ์ดูงาน ขั้นตอนอนุมัติ และผู้รับการแจ้งเตือน ส่วน Password เดิมจะไม่ถูกแสดงหรือจัดเก็บในข้อมูลพนักงาน</p>
        </div>
      </form>
    </Modal>
  )
}

export function EmployeeManagement({
  sessionToken,
  departments,
  onSessionExpired,
}: {
  sessionToken: string
  departments: RepairDepartment[]
  onSessionExpired: () => void
}) {
  const [employees, setEmployees] = useState<SettingsEmployee[]>([])
  const [query, setQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [editingEmployee, setEditingEmployee] = useState<SettingsEmployee | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const loadEmployees = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')
    try {
      setEmployees(await listSettingsEmployees(sessionToken))
    } catch (error) {
      if (isExpiredSettingsError(error)) onSessionExpired()
      setLoadError(errorText(error))
    } finally {
      setIsLoading(false)
    }
  }, [onSessionExpired, sessionToken])

  useEffect(() => {
    let active = true
    listSettingsEmployees(sessionToken)
      .then((items) => {
        if (active) setEmployees(items)
      })
      .catch((error) => {
        if (!active) return
        if (isExpiredSettingsError(error)) onSessionExpired()
        setLoadError(errorText(error))
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [onSessionExpired, sessionToken])

  const filteredEmployees = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return employees.filter((employee) => !normalized || [
      employee.username,
      employee.fullName,
      employee.email,
      employee.departmentName,
      roleLabels[employee.roleCode],
      employee.legacyUid,
    ].filter(Boolean).join(' ').toLowerCase().includes(normalized)).sort(compareEmployees)
  }, [employees, query])

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / employeesPerPage))
  const visiblePage = Math.min(currentPage, totalPages)
  const pageStart = (visiblePage - 1) * employeesPerPage
  const paginatedEmployees = filteredEmployees.slice(pageStart, pageStart + employeesPerPage)

  const activeCount = employees.filter((employee) => employee.isActive).length
  const inactiveCount = employees.length - activeCount

  function openCreate() {
    setEditingEmployee(null)
    setModalOpen(true)
  }

  function openEdit(employee: SettingsEmployee) {
    setEditingEmployee(employee)
    setModalOpen(true)
  }

  if (isLoading && employees.length === 0) return <DataLoading label="กำลังโหลดข้อมูลพนักงาน…" />
  if (loadError && employees.length === 0) return <DataError message={loadError} onRetry={() => void loadEmployees()} />

  return (
    <>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><p className="text-xs font-bold text-slate-500">พนักงานทั้งหมด</p><p className="mt-1 text-2xl font-bold text-slate-950">{employees.length}</p></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-emerald-700"><UserRoundCheck className="size-4" /><p className="text-xs font-bold">ใช้งานอยู่</p></div><p className="mt-1 text-2xl font-bold text-emerald-700">{activeCount}</p></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-slate-500"><UserRoundX className="size-4" /><p className="text-xs font-bold">ปิดใช้งาน</p></div><p className="mt-1 text-2xl font-bold text-slate-700">{inactiveCount}</p></Card>
      </div>

      <Card className="mt-5 p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <label className="relative block">
            <span className="sr-only">ค้นหาพนักงาน</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setCurrentPage(1)
              }}
              className="form-control pl-11"
              placeholder="ค้นหาชื่อ Username Email แผนก Role หรือ USER-xxx"
            />
          </label>
          <Button variant="secondary" onClick={() => void loadEmployees()} disabled={isLoading}>
            <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} /> รีเฟรช
          </Button>
          <Button onClick={openCreate}><Plus className="size-4" /> เพิ่มพนักงาน</Button>
        </div>
      </Card>

      <div className="mt-4 grid gap-3">
        {paginatedEmployees.map((employee) => (
          <Card key={employee.id} className={!employee.isActive ? 'border-slate-200 bg-slate-50/70' : ''}>
            <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="flex min-w-0 items-center gap-4">
                <EmployeeAvatar employee={employee} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate font-bold text-slate-950">{employee.fullName}</h2>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${employee.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                      {employee.isActive ? 'ใช้งานอยู่' : 'ปิดใช้งาน'}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm font-semibold text-teal-700">{employee.username}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>{employee.departmentName}</span>
                    <span>{roleLabels[employee.roleCode]}</span>
                    {employee.email && <span>{employee.email}</span>}
                    {employee.legacyUid && <span>{employee.legacyUid}</span>}
                  </div>
                </div>
              </div>
              <Button variant="secondary" onClick={() => openEdit(employee)}><Pencil className="size-4" /> แก้ไข</Button>
            </div>
          </Card>
        ))}
        {filteredEmployees.length === 0 && (
          <Card className="p-10 text-center">
            <Users className="mx-auto size-10 text-slate-300" />
            <h2 className="mt-3 font-bold text-slate-900">ไม่พบพนักงาน</h2>
            <p className="mt-1 text-sm text-slate-500">ลองเปลี่ยนคำค้นหา หรือเพิ่มพนักงานใหม่</p>
          </Card>
        )}
      </div>

      {filteredEmployees.length > 0 && (
        <nav aria-label="แบ่งหน้ารายชื่อพนักงาน" className="mt-6 flex flex-col items-center justify-center gap-3 pb-2">
          <p className="text-xs font-medium text-slate-500">
            แสดง {pageStart + 1}–{Math.min(pageStart + employeesPerPage, filteredEmployees.length)} จาก {filteredEmployees.length} รายชื่อ
          </p>
          <div className="flex items-center justify-center gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={visiblePage <= 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            >
              <ChevronLeft className="size-4" /> ย้อนกลับ
            </Button>
            <span className="min-w-24 rounded-xl bg-slate-950 px-4 py-3 text-center text-sm font-bold text-white">
              หน้า {visiblePage} / {totalPages}
            </span>
            <Button
              type="button"
              variant="secondary"
              disabled={visiblePage >= totalPages}
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            >
              ถัดไป <ChevronRight className="size-4" />
            </Button>
          </div>
        </nav>
      )}

      {modalOpen && (
        <EmployeeModal
          key={editingEmployee?.id ?? 'new-employee'}
          employee={editingEmployee}
          open
          departments={departments}
          sessionToken={sessionToken}
          onClose={() => setModalOpen(false)}
          onSaved={loadEmployees}
          onSessionExpired={onSessionExpired}
        />
      )}
    </>
  )
}
