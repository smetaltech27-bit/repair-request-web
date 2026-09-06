import { describe, expect, it } from 'vitest'
import type { RepairRequest } from '../types/repair'
import { buildRepairReportWorksheetXml, createRepairReportWorkbook } from './repairExport'

function request(id: string): RepairRequest {
  return {
    id,
    jobId: `REQ-${id}`,
    requesterId: `user-${id}`,
    requesterName: `ผู้แจ้ง ${id}`,
    departmentId: 'machine',
    department: 'Machine',
    machineId: `เครื่อง ${id}`,
    issueDetails: `รายละเอียด & อาการ <${id}>`,
    statusCode: 'completed',
    status: 'ซ่อมเสร็จเรียบร้อย (ปิดงาน)',
    createdAt: '2026-09-04T02:00:00.000Z',
    updatedAt: '2026-09-04T03:00:00.000Z',
    closedAt: '2026-09-04T04:00:00.000Z',
    totalCost: 1_250.5,
    actions: [],
    attachments: [],
  }
}

describe('repair Excel export', () => {
  it('builds every report column and every supplied row with typed values', () => {
    const worksheet = buildRepairReportWorksheetXml([request('001'), request('002')])

    expect(worksheet).toContain('เครื่องจักร / รหัสเครื่อง / สถานที่')
    expect(worksheet).toContain('ค่าใช้จ่ายทั้งหมด (บาท)')
    expect(worksheet).toContain('REQ-001')
    expect(worksheet).toContain('REQ-002')
    expect(worksheet).toContain('รายละเอียด &amp; อาการ &lt;001&gt;')
    expect(worksheet).toContain('<c r="K2" s="3"><v>1250.5</v></c>')
    expect(worksheet).toContain('<c r="C2" s="2"><v>')
    expect(worksheet).toContain('<autoFilter ref="A1:K3"/>')
  })

  it('creates a valid ZIP-based xlsx container', () => {
    const workbook = createRepairReportWorkbook([request('001')])
    const contents = new TextDecoder().decode(workbook)

    expect(Array.from(workbook.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04])
    expect(contents).toContain('[Content_Types].xml')
    expect(contents).toContain('xl/worksheets/sheet1.xml')
    expect(contents).toContain('REQ-001')
  })
})
