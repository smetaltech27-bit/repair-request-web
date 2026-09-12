import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { formatThaiDate } from '../lib/utils'
import type { RepairRequest } from '../types/repair'
import { RequestDetails } from './RequestDetails'

const { downloadRepairImage } = vi.hoisted(() => ({
  downloadRepairImage: vi.fn(),
}))

vi.mock('../lib/repairService', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/repairService')>()
  return { ...original, downloadRepairImage }
})

const repairRequest: RepairRequest = {
  id: 'request-1',
  jobId: 'REQ-001',
  requesterId: 'user-1',
  requesterName: 'ผู้แจ้งทดสอบ',
  departmentId: 'machine',
  department: 'Machine',
  machineId: 'Machine 1',
  issueDetails: 'รายละเอียดปัญหา',
  statusCode: 'pending_supervisor',
  status: 'รอหัวหน้างานอนุมัติ',
  createdAt: '2026-09-05T02:00:00.000Z',
  updatedAt: '2026-09-05T02:00:00.000Z',
  actions: [],
  attachments: [{
    id: 'attachment-1',
    kind: 'before',
    storagePath: 'request-1/before.jpg',
    createdAt: '2026-09-05T02:00:00.000Z',
  }],
}

describe('RequestDetails image preview', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:repair-image')
    URL.revokeObjectURL = vi.fn()
    downloadRepairImage.mockResolvedValue(new Blob(['image'], { type: 'image/jpeg' }))
  })

  it('opens and closes a large image only when preview is enabled', async () => {
    const user = userEvent.setup()
    render(<RequestDetails request={repairRequest} enableImagePreview />)

    const previewButton = await screen.findByRole('button', { name: 'ดูรูปขนาดใหญ่ รูปก่อนซ่อม REQ-001' })
    await user.click(previewButton)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'ดูรูปขนาดใหญ่' })).toBeInTheDocument()
    expect(screen.getAllByAltText('รูปก่อนซ่อม REQ-001').at(-1)).toHaveAttribute('src', 'blob:repair-image')

    await user.click(screen.getByRole('button', { name: 'ปิดรูปขนาดใหญ่' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('keeps the image non-interactive when preview is not enabled', async () => {
    render(<RequestDetails request={repairRequest} />)

    expect(await screen.findByAltText('รูปก่อนซ่อม REQ-001')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /ดูรูปขนาดใหญ่/ })).not.toBeInTheDocument()
  })

  it('uses readable typography for the detail content on every viewport', () => {
    render(<RequestDetails request={repairRequest} />)

    expect(screen.getByText('รอหัวหน้างาน')).toHaveClass('text-sm')
    expect(screen.getByText('ผู้แจ้งทดสอบ')).toHaveClass('text-base')
    expect(screen.getByText('วันที่แจ้ง')).toHaveClass('text-sm', 'font-bold')
    expect(screen.getAllByText('รายละเอียดปัญหา')[0]).toHaveClass('text-base', 'font-bold')
    expect(screen.getByText('ยังไม่มีประวัติการดำเนินการ')).toHaveClass('text-sm')
    expect(screen.getByText('ก่อนซ่อม')).toHaveClass('text-sm')
  })
})

describe('RequestDetails legacy approval history', () => {
  it('shows the real requester and available legacy timestamps without import-system text', () => {
    render(
      <RequestDetails
        request={{
          ...repairRequest,
          approvedAt: '2026-08-25T03:29:00.000Z',
          actions: [{
            id: 'import-1',
            action: 'import',
            toStatus: 'completed',
            actorName: 'ระบบนำเข้าข้อมูลเดิม',
            note: 'ซิงก์ข้อมูลจริงล่าสุดจาก Sheet1',
            createdAt: '2026-08-21T07:00:58.000Z',
            legacyMetadata: {
              supervisorInfo: 'หัวหน้า ก (อนุมัติ)',
              supervisorNote: 'ตรวจสอบแล้ว อนุมัติให้ซ่อม',
              factoryManagerInfo: 'ผู้จัดการโรงงาน ก (อนุมัติ)',
              factoryManagerNote: 'อนุมัติงบซ่อม',
              purchasingInfo: 'จัดซื้อ ก (รับทราบรายการ)',
              purchasingNote: 'รับทราบและสั่งซื้อแล้ว',
              completionDetail: 'ปิดงานโดย หัวหน้า ก: ซ่อมเรียบร้อยแล้ว',
            },
          }],
        }}
      />,
    )

    expect(screen.getAllByText('ผู้แจ้ง')).not.toHaveLength(0)
    expect(screen.getByText(`ผู้แจ้งทดสอบ · ${formatThaiDate(repairRequest.createdAt)}`)).toBeInTheDocument()
    expect(screen.queryByText('นำเข้าข้อมูลเดิม')).not.toBeInTheDocument()
    expect(screen.queryByText('ระบบนำเข้าข้อมูลเดิม')).not.toBeInTheDocument()
    expect(screen.queryByText('ซิงก์ข้อมูลจริงล่าสุดจาก Sheet1')).not.toBeInTheDocument()
    expect(screen.getByText('ความคิดเห็นจากประวัติเดิม')).toBeInTheDocument()
    expect(screen.getByText('ความคิดเห็นจากประวัติเดิม')).toHaveClass('text-sm')
    expect(screen.getByText('หัวหน้างาน')).toBeInTheDocument()
    expect(screen.getByText('ตรวจสอบแล้ว อนุมัติให้ซ่อม')).toBeInTheDocument()
    expect(screen.getByText('ตรวจสอบแล้ว อนุมัติให้ซ่อม')).toHaveClass('text-base', 'leading-7')
    expect(screen.queryByText('ผู้จัดการฝ่าย')).not.toBeInTheDocument()
    expect(screen.getByText('ผู้จัดการโรงงาน')).toBeInTheDocument()
    expect(screen.getByText(`ผู้จัดการโรงงาน ก (อนุมัติ) · ${formatThaiDate('2026-08-25T03:29:00.000Z')}`)).toBeInTheDocument()
    expect(screen.getByText('อนุมัติงบซ่อม')).toBeInTheDocument()
    expect(screen.getByText('จัดซื้อ')).toBeInTheDocument()
    expect(screen.getByText('รับทราบและสั่งซื้อแล้ว')).toBeInTheDocument()
    expect(screen.getByText('ปิดงาน')).toBeInTheDocument()
    expect(screen.getByText('ปิดงานโดย หัวหน้า ก: ซ่อมเรียบร้อยแล้ว')).toBeInTheDocument()
  })
})
