import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HashRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RepairRequest } from '../types/repair'
import { CompletionPage } from './CompletionPage'

const { useRepairRequests } = vi.hoisted(() => ({
  useRepairRequests: vi.fn(),
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'manager',
      username: 'manager',
      fullName: 'ผู้จัดการฝ่ายทดสอบ',
      roleCode: 'department_manager',
      role: 'ผู้จัดการฝ่าย',
      department: 'Machine',
      departmentId: 'machine',
    },
  }),
}))

vi.mock('../hooks/useRepairData', () => ({ useRepairRequests }))

function request(id: string, statusCode: RepairRequest['statusCode']): RepairRequest {
  return {
    id,
    jobId: `REQ-${id}`,
    requesterId: 'requester',
    requesterName: 'ผู้แจ้งทดสอบ',
    departmentId: 'machine',
    department: 'Machine',
    machineId: 'Machine 1',
    issueDetails: 'รายละเอียดปัญหาสำหรับการทดสอบ',
    statusCode,
    status: statusCode === 'purchasing_in_progress' ? 'กำลังดำเนินการจัดซื้อ' : 'รอจัดซื้อดำเนินการ',
    createdAt: '2026-09-04T02:00:00.000Z',
    updatedAt: '2026-09-04T02:00:00.000Z',
    actions: [],
    attachments: [],
  }
}

describe('CompletionPage', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:after-image-preview')
    URL.revokeObjectURL = vi.fn()
    useRepairRequests.mockReturnValue({
      requests: [request('READY', 'purchasing_in_progress'), request('WAITING', 'pending_purchasing')],
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })
  })

  it('shows only jobs acknowledged by purchasing and opens the close form', async () => {
    const user = userEvent.setup()
    render(<HashRouter><CompletionPage /></HashRouter>)

    expect(screen.getByText('REQ-READY')).toBeInTheDocument()
    expect(screen.queryByText('REQ-WAITING')).not.toBeInTheDocument()

    await user.click(screen.getByText('REQ-READY'))
    expect(screen.getByRole('heading', { name: 'ปิดงานซ่อม' })).toBeInTheDocument()
    expect(screen.getByLabelText(/ค่าใช้จ่ายทั้งหมด/)).toBeInTheDocument()
    expect(screen.getByLabelText(/หมายเหตุการปิดงาน/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ยืนยันปิดงาน/ })).toBeInTheDocument()
  })

  it('shows a preview after selecting an after-repair image', async () => {
    const user = userEvent.setup()
    render(<HashRouter><CompletionPage /></HashRouter>)
    await user.click(screen.getByText('REQ-READY'))

    const file = new File(['after repair'], 'after-repair.jpg', { type: 'image/jpeg' })
    await user.upload(screen.getByLabelText('รูปหลังซ่อม'), file)

    expect(screen.getByAltText('ตัวอย่างรูปหลังซ่อม')).toHaveAttribute('src', 'blob:after-image-preview')
    expect(screen.getByText('เลือกแล้ว: after-repair.jpg')).toBeInTheDocument()
  })
})
