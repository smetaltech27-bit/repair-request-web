import {
  getDepartmentStats,
  getRepairCostMonths,
  getRepairStats,
  getRepairTotalCost,
  getWeeklyTrend,
} from './repairMetrics'
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

  it('groups departments and sorts them by request count', () => {
    const requests = [
      { ...request('1', 'completed'), department: 'Welding' },
      { ...request('2', 'pending_supervisor'), department: 'Machine' },
      { ...request('3', 'rejected'), department: 'Machine' },
      { ...request('4', 'completed'), department: '  ' },
    ]

    expect(getDepartmentStats(requests)).toEqual([
      { department: 'Machine', total: 2 },
      { department: 'ไม่ระบุแผนก', total: 1 },
      { department: 'Welding', total: 1 },
    ])
  })

  it('summarizes recorded completion costs by Bangkok closing month', () => {
    const requests = [
      { ...request('1', 'completed'), totalCost: 100.25, closedAt: '2026-09-02T18:00:00.000Z' },
      { ...request('2', 'completed'), totalCost: 200, closedAt: '2026-09-20T02:00:00.000Z' },
      { ...request('3', 'completed'), totalCost: 50, updatedAt: '2026-08-15T02:00:00.000Z' },
      { ...request('4', 'pending_supervisor'), totalCost: 999, closedAt: '2026-09-03T02:00:00.000Z' },
    ]

    expect(getRepairTotalCost(requests)).toBe(350.25)
    expect(getRepairTotalCost(requests, '2026-09')).toBe(300.25)
    expect(getRepairTotalCost(requests, '2026-08')).toBe(50)
    expect(getRepairCostMonths(requests).map((month) => month.value)).toEqual(['2026-09', '2026-08'])
  })
})
