import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HashRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RepairRequest } from '../types/repair'
import { RequestsPage } from './RequestsPage'

const { useRepairRequests } = vi.hoisted(() => ({
  useRepairRequests: vi.fn(),
}))

vi.mock('../hooks/useRepairData', () => ({ useRepairRequests }))

function request(id: string, department: string): RepairRequest {
  return {
    id,
    jobId: `REQ-${id}`,
    requesterId: `user-${id}`,
    requesterName: `ผู้แจ้ง ${id}`,
    departmentId: department.toLowerCase(),
    department,
    machineId: `Machine ${id}`,
    issueDetails: `รายละเอียดอาการเสีย ${id}`,
    statusCode: 'pending_supervisor',
    status: 'รอหัวหน้างานอนุมัติ',
    createdAt: '2026-09-04T02:00:00.000Z',
    updatedAt: '2026-09-04T02:00:00.000Z',
    actions: [],
    attachments: [],
  }
}

describe('RequestsPage', () => {
  beforeEach(() => {
    useRepairRequests.mockReturnValue({
      requests: [request('001', 'Machine'), request('002', 'Accounting')],
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })
  })

  it('renders one repair per table row with report columns', () => {
    render(<HashRouter><RequestsPage /></HashRouter>)

    expect(screen.getByRole('heading', { name: 'รายการซ่อม/ปรับปรุง' })).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'ลำดับ',
      'รหัสแจ้งซ่อม',
      'วันที่แจ้ง',
      'แผนก',
      'เครื่องจักร/สถานที่',
      'อาการเสีย',
      'ผู้แจ้ง',
      'สถานะ',
      'การดำเนินการ',
    ])

    const rows = screen.getAllByRole('row')
    expect(rows).toHaveLength(3)
    expect(within(rows[1]).getByText('REQ-001')).toBeInTheDocument()
    expect(within(rows[2]).getByText('REQ-002')).toBeInTheDocument()
  })

  it('opens the existing details modal from the row action', async () => {
    const user = userEvent.setup()
    render(<HashRouter><RequestsPage /></HashRouter>)

    await user.click(screen.getByRole('button', { name: 'ดูรายละเอียด REQ-001' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'REQ-001' })).toBeInTheDocument()
    expect(within(dialog).getByText('รายละเอียดอาการเสีย 001')).toBeInTheDocument()
  })
})
