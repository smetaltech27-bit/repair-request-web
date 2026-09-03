import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsPage } from './SettingsPage'

const { unlockRepairSettings, listSettingsRepairRequests, listDepartments } = vi.hoisted(() => ({
  unlockRepairSettings: vi.fn(),
  listSettingsRepairRequests: vi.fn(),
  listDepartments: vi.fn(),
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
  })

  it('requires the separate settings password before showing management controls', async () => {
    const user = userEvent.setup()
    render(<SettingsPage />)

    expect(screen.getByRole('heading', { name: 'ยืนยัน Settings Password' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'แก้ไข' })).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Settings Password'), '1234')
    await user.click(screen.getByRole('button', { name: /ปลดล็อก Settings/ }))

    expect(await screen.findByRole('heading', { name: 'ตั้งค่าและจัดการรายการ' })).toBeInTheDocument()
    expect(screen.getByText('REQ-TEST-001')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'แก้ไข' })).toBeInTheDocument()
    expect(unlockRepairSettings).toHaveBeenCalledWith('1234')
  })
})
