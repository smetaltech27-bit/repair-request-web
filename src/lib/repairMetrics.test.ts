import { getRepairStats, getWeeklyTrend } from './repairMetrics'
import { repairStatusLabels } from './repairService'
import type { RepairRequest, RepairStatusCode } from '../types/repair'

function request(id: string, statusCode: RepairStatusCode, createdAt = '2026-09-03T02:00:00.000Z'): RepairRequest {
  return {
    id,
    jobId: `REQ-${id}`,
    requesterId: 'requester',
    requesterName: 'ผู้แจ้ง',
    departmentId: 'machine',
    department: 'Machine',
    machineId: 'Machine 1',
    issueDetails: 'รายละเอียดปัญหาสำหรับการทดสอบ',
    statusCode,
    status: repairStatusLabels[statusCode],
    createdAt,
    updatedAt: createdAt,
    actions: [],
    attachments: [],
  }
}

describe('repair metrics', () => {
  it('summarizes every workflow group', () => {
    const requests = [
      request('1', 'pending_supervisor'),
      request('2', 'pending_purchasing'),
      request('3', 'purchasing_in_progress'),
      request('4', 'completed'),
      request('5', 'rejected'),
    ]

    expect(getRepairStats(requests)).toEqual({ total: 5, pending: 2, inProgress: 1, completed: 1, rejected: 1 })
  })

  it('builds a seven-day trend in Bangkok time', () => {
    const trend = getWeeklyTrend(
      [request('1', 'completed', '2026-09-03T02:00:00.000Z')],
      new Date('2026-09-03T05:00:00.000Z'),
    )

    expect(trend).toHaveLength(7)
    expect(trend.at(-1)).toMatchObject({ total: 1, completed: 1, pending: 0 })
  })
})
