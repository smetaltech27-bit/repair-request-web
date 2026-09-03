import { filterRepairRequests, paginateRepairRequests } from './repairList'
import { repairStatusLabels } from './repairService'
import type { RepairRequest, RepairStatusCode } from '../types/repair'

function request(id: string, statusCode: RepairStatusCode, department = 'Machine'): RepairRequest {
  return {
    id,
    jobId: `REQ-${id}`,
    requesterId: `user-${id}`,
    requesterName: id === '1' ? 'สมชาย ใจดี' : 'Jane Doe',
    departmentId: department.toLowerCase(),
    department,
    machineId: id === '1' ? 'CNC-01' : 'WELD-02',
    issueDetails: id === '1' ? 'มอเตอร์มีเสียงดังผิดปกติ' : 'เครื่องหยุดทำงาน',
    statusCode,
    status: repairStatusLabels[statusCode],
    createdAt: '2026-09-03T02:00:00.000Z',
    updatedAt: '2026-09-03T02:00:00.000Z',
    actions: [],
    attachments: [],
  }
}

describe('repair list helpers', () => {
  const requests = [
    request('1', 'pending_supervisor'),
    request('2', 'completed', 'Welding'),
  ]

  it('filters by grouped status and searchable request fields', () => {
    expect(filterRepairRequests(requests, '', 'pending')).toEqual([requests[0]])
    expect(filterRepairRequests(requests, 'jane', 'all')).toEqual([requests[1]])
    expect(filterRepairRequests(requests, 'cnc-01', 'completed')).toEqual([])
  })

  it('returns 20 items per page and clamps an out-of-range page', () => {
    const items = Array.from({ length: 45 }, (_, index) => index + 1)

    expect(paginateRepairRequests(items, 2)).toMatchObject({
      items: items.slice(20, 40),
      page: 2,
      totalPages: 3,
    })
    expect(paginateRepairRequests(items, 99)).toMatchObject({
      items: items.slice(40),
      page: 3,
      totalPages: 3,
    })
  })
})
