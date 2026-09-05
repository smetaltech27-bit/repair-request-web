import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
})
