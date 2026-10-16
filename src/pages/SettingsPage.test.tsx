import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsPage } from './SettingsPage'

const {
  unlockRepairSettings,
  listSettingsRepairRequests,
  listSettingsApprovalComments,
  listDepartments,
  listSettingsEmployees,
  updateSettingsRepairRequest,
} = vi.hoisted(() => ({
  unlockRepairSettings: vi.fn(),
  listSettingsRepairRequests: vi.fn(),
  listSettingsApprovalComments: vi.fn(),
  listDepartments: vi.fn(),
  listSettingsEmployees: vi.fn(),
  updateSettingsRepairRequest: vi.fn(),
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
  listSettingsApprovalComments,
  listDepartments,
  changeRepairSettingsPassword: vi.fn(),
  updateSettingsRepairRequest,
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
    listSettingsApprovalComments.mockResolvedValue([
      {
        key: 'action:44444444-4444-4444-8444-444444444444:supervisor',
        source: 'action',
        actionId: '44444444-4444-4444-8444-444444444444',
        stepCode: 'supervisor',
        stepLabel: 'หัวหน้างาน',
        actorName: 'หัวหน้า ทดสอบ',
        decision: 'approve',
        note: 'อนุมัติให้ซ่อม',
        createdAt: '2026-09-03T01:00:00.000Z',
      },
      {
        key: 'legacy:55555555-5555-4555-8555-555555555555:factory_manager',
        source: 'legacy',
        actionId: '55555555-5555-4555-8555-555555555555',
        stepCode: 'factory_manager',
        stepLabel: 'ผู้จัดการโรงงาน',
        actorName: 'ผู้จัดการโรงงานเดิม',
        decision: 'import',
        note: 'อนุมัติจากข้อมูลเดิม',
        createdAt: '2026-09-03T02:00:00.000Z',
      },
    ])
    updateSettingsRepairRequest.mockResolvedValue(undefined)
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

  it('loads and saves editable approver comments for current and legacy approval steps', async () => {
    const user = userEvent.setup()
    render(<SettingsPage />)

    await user.type(screen.getByLabelText('Settings Password'), '1234')
    await user.click(screen.getByRole('button', { name: /ปลดล็อก Settings/ }))
    await screen.findByText('REQ-TEST-001')
    await user.click(screen.getByRole('button', { name: 'แก้ไข' }))

    const supervisorComment = await screen.findByLabelText('Comment หัวหน้างาน')
    const factoryManagerComment = screen.getByLabelText('Comment ผู้จัดการโรงงาน')
    expect(supervisorComment).toHaveValue('อนุมัติให้ซ่อม')
    expect(factoryManagerComment).toHaveValue('อนุมัติจากข้อมูลเดิม')
    expect(listSettingsApprovalComments).toHaveBeenCalledWith(
      'test-session-token',
      '22222222-2222-4222-8222-222222222222',
    )

    await user.clear(supervisorComment)
    await user.type(supervisorComment, 'ตรวจสอบแล้ว อนุมัติให้ดำเนินการ')
    await user.clear(factoryManagerComment)
    await user.type(factoryManagerComment, 'อนุมัติงบประมาณตามประวัติเดิม')
    await user.click(screen.getByRole('button', { name: 'บันทึกการแก้ไข' }))

    expect(updateSettingsRepairRequest).toHaveBeenCalledWith(expect.objectContaining({
      sessionToken: 'test-session-token',
      requestId: '22222222-2222-4222-8222-222222222222',
      approvalComments: [
        {
          source: 'action',
          actionId: '44444444-4444-4444-8444-444444444444',
          stepCode: 'supervisor',
          note: 'ตรวจสอบแล้ว อนุมัติให้ดำเนินการ',
        },
        {
          source: 'legacy',
          actionId: '55555555-5555-4555-8555-555555555555',
          stepCode: 'factory_manager',
          note: 'อนุมัติงบประมาณตามประวัติเดิม',
        },
      ],
    }))
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
