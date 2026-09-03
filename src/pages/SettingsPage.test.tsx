import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsPage } from './SettingsPage'

const { unlockRepairSettings, listSettingsRepairRequests, listDepartments, listSettingsEmployees } = vi.hoisted(() => ({
  unlockRepairSettings: vi.fn(),
  listSettingsRepairRequests: vi.fn(),
  listDepartments: vi.fn(),
  listSettingsEmployees: vi.fn(),
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ isDemoMode: false }),
}))

vi.mock('../lib/repairService', () => ({
  repairStatusLabels: {
    pending_supervisor: 'รอหัวหน้างานอนุมัติ',
    pending_department_manager: 'รอผู้จัดการฝ่ายอนุมัติ',
    pending_factory_manager: 'รอผู้จัดการโรงงานอนุมัติ',
    pending_purchasing: 'รอจัดซื้อดำเนินการ',
    purchasing_in_progress: 'กำลังดำเนินการจัดซื้อ',
    completed: 'ซ่อมเสร็จเรียบร้อย (ปิดงาน)',
    rejected: 'ไม่อนุมัติ (ตีกลับ)',
  },
  unlockRepairSettings,
  listSettingsRepairRequests,
  listDepartments,
  changeRepairSettingsPassword: vi.fn(),
  updateSettingsRepairRequest: vi.fn(),
  softDeleteSettingsRepairRequest: vi.fn(),
  restoreSettingsRepairRequest: vi.fn(),
  listSettingsEmployees,
  saveSettingsEmployee: vi.fn(),
}))

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    unlockRepairSettings.mockResolvedValue({
      success: true,
      token: 'test-session-token',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    })
    listDepartments.mockResolvedValue([{ id: '11111111-1111-4111-8111-111111111111', code: 'machine', name: 'Machine' }])
    listSettingsRepairRequests.mockResolvedValue([{
      id: '22222222-2222-4222-8222-222222222222',
      jobId: 'REQ-TEST-001',
      requesterName: 'ผู้ใช้ทดสอบ',
      departmentId: '11111111-1111-4111-8111-111111111111',
      departmentName: 'Machine',
      machineId: 'CNC-01',
      issueDetails: 'รายละเอียดรายการทดสอบ',
      statusCode: 'pending_supervisor',
      createdAt: '2026-09-03T00:00:00.000Z',
      updatedAt: '2026-09-03T00:00:00.000Z',
    }])
    listSettingsEmployees.mockResolvedValue([{
      id: '33333333-3333-4333-8333-333333333333',
      legacyUid: 'USER-073',
      username: 'sompol',
      fullName: 'สมพล ว่องสิริชนน์',
      departmentId: '11111111-1111-4111-8111-111111111111',
      departmentName: 'Machine',
      roleCode: 'employee',
      isActive: true,
      createdAt: '2026-09-03T00:00:00.000Z',
      updatedAt: '2026-09-03T00:00:00.000Z',
    }])
  })

  it('requires the separate settings password before showing management controls', async () => {
    const user = userEvent.setup()
    render(<SettingsPage />)

    expect(screen.getByRole('heading', { name: 'ยืนยัน Settings Password' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'แก้ไข' })).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Settings Password'), '1234')
    await user.click(screen.getByRole('button', { name: /ปลดล็อก Settings/ }))

    expect(await screen.findByRole('heading', { name: 'ตั้งค่าและจัดการระบบ' })).toBeInTheDocument()
    expect(screen.getByText('REQ-TEST-001')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'แก้ไข' })).toBeInTheDocument()
    expect(unlockRepairSettings).toHaveBeenCalledWith('1234')
  })

  it('loads employee administration only after its settings tab is selected', async () => {
    const user = userEvent.setup()
    render(<SettingsPage />)

    await user.type(screen.getByLabelText('Settings Password'), '1234')
    await user.click(screen.getByRole('button', { name: /ปลดล็อก Settings/ }))
    await screen.findByText('REQ-TEST-001')

    expect(listSettingsEmployees).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /จัดการพนักงาน/ }))

    expect(await screen.findByText('สมพล ว่องสิริชนน์')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /เพิ่มพนักงาน/ })).toBeInTheDocument()
    expect(listSettingsEmployees).toHaveBeenCalledWith('test-session-token')
  })

  it('sorts employees by USER number and shows twenty employees per page', async () => {
    listSettingsEmployees.mockResolvedValueOnce(Array.from({ length: 21 }, (_, index) => {
      const userNumber = 21 - index
      const paddedNumber = String(userNumber).padStart(3, '0')
      return {
        id: `${paddedNumber.padStart(8, '0')}-3333-4333-8333-333333333333`,
        legacyUid: `USER-${paddedNumber}`,
        username: `user${paddedNumber}`,
        fullName: `พนักงาน ${paddedNumber}`,
        departmentId: '11111111-1111-4111-8111-111111111111',
        departmentName: 'Machine',
        roleCode: 'employee',
        isActive: true,
        createdAt: '2026-09-03T00:00:00.000Z',
        updatedAt: '2026-09-03T00:00:00.000Z',
      }
    }))

    const user = userEvent.setup()
    render(<SettingsPage />)
    await user.type(screen.getByLabelText('Settings Password'), '1234')
    await user.click(screen.getByRole('button', { name: /ปลดล็อก Settings/ }))
    await screen.findByText('REQ-TEST-001')
    await user.click(screen.getByRole('button', { name: /จัดการพนักงาน/ }))

    expect(await screen.findByText('พนักงาน 001')).toBeInTheDocument()
    expect(screen.getByText('พนักงาน 020')).toBeInTheDocument()
    expect(screen.queryByText('พนักงาน 021')).not.toBeInTheDocument()
    expect(screen.getByText('หน้า 1 / 2')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /ถัดไป/ }))
    expect(await screen.findByText('พนักงาน 021')).toBeInTheDocument()
    expect(screen.queryByText('พนักงาน 001')).not.toBeInTheDocument()
    expect(screen.getByText('หน้า 2 / 2')).toBeInTheDocument()
  })
})
