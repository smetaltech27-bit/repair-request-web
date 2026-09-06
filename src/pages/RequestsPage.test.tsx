import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NotificationReadContext } from '../lib/NotificationReadContext'
import type { RepairRequest } from '../types/repair'
import { RequestsPage } from './RequestsPage'

const { useRepairRequests } = vi.hoisted(() => ({
  useRepairRequests: vi.fn(),
}))
const { exportRepairRequestsToExcel } = vi.hoisted(() => ({
  exportRepairRequestsToExcel: vi.fn(),
}))
const markRequestRead = vi.fn()

vi.mock('../hooks/useRepairData', () => ({ useRepairRequests }))
vi.mock('../lib/repairExport', () => ({ exportRepairRequestsToExcel }))

function request(id: string, department: string, statusCode: 'pending_supervisor' | 'completed' = 'pending_supervisor'): RepairRequest {
  return {
    id,
    jobId: `REQ-${id}`,
    requesterId: `user-${id}`,
    requesterName: `ผู้แจ้ง ${id}`,
    departmentId: department.toLowerCase(),
    department,
    machineId: `Machine ${id}`,
    issueDetails: `รายละเอียดอาการเสีย ${id}`,
    statusCode,
    status: statusCode === 'completed' ? 'ซ่อมเสร็จเรียบร้อย (ปิดงาน)' : 'รอหัวหน้างานอนุมัติ',
    createdAt: '2026-09-04T02:00:00.000Z',
    updatedAt: '2026-09-04T02:00:00.000Z',
    actions: [],
    attachments: [],
  }
}

function renderPage(entry = '/requests') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <NotificationReadContext.Provider value={markRequestRead}>
        <RequestsPage />
      </NotificationReadContext.Provider>
    </MemoryRouter>,
  )
}

describe('RequestsPage', () => {
  beforeEach(() => {
    markRequestRead.mockReset()
    exportRepairRequestsToExcel.mockReset()
    useRepairRequests.mockReturnValue({
      requests: [request('001', 'Machine'), request('002', 'Accounting', 'completed')],
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })
  })

  it('renders one repair per table row with report columns', () => {
    renderPage()

    expect(screen.getByRole('heading', { name: 'รายการซ่อม/ปรับปรุง' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'แจ้งซ่อมใหม่' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ทุกสถานะ' })).toHaveClass('mobile-status-filter-button')
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

  it('exports every row remaining after the current search filter', async () => {
    const user = userEvent.setup()
    renderPage('/requests?status=pending')

    await user.type(screen.getByRole('textbox', { name: 'ค้นหารายการ' }), '001')
    await user.click(screen.getByRole('button', { name: 'Export Excel' }))

    expect(exportRepairRequestsToExcel).toHaveBeenCalledTimes(1)
    expect(exportRepairRequestsToExcel).toHaveBeenCalledWith([
      expect.objectContaining({ jobId: 'REQ-001' }),
    ])
  })

  it('opens the existing details modal from the row action', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: 'ดูรายละเอียด REQ-001' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'REQ-001' })).toBeInTheDocument()
    expect(within(dialog).getByText('รายละเอียดอาการเสีย 001')).toBeInTheDocument()
    expect(markRequestRead).toHaveBeenCalledWith('001')
  })

  it('opens the matching details modal from a notification request link', () => {
    renderPage('/requests?request=002')

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'REQ-002' })).toBeInTheDocument()
    expect(within(dialog).getByText('รายละเอียดอาการเสีย 002')).toBeInTheDocument()
  })
})
