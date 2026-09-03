import { getAvailableActions } from './repairWorkflow'
import { repairStatusLabels } from './repairService'
import type { AppUser, RepairRequest, RepairStatusCode, UserRoleCode } from '../types/repair'

function user(roleCode: UserRoleCode, id = 'actor'): AppUser {
  const labels = {
    employee: 'พนักงาน',
    supervisor: 'หัวหน้างาน',
    department_manager: 'ผู้จัดการฝ่าย',
    factory_manager: 'ผู้จัดการโรงงาน',
    purchasing: 'จัดซื้อ',
  } as const
  return { id, username: id, fullName: id, roleCode, role: labels[roleCode], department: 'Machine', departmentId: 'machine' }
}

function request(statusCode: RepairStatusCode, requesterId = 'requester'): RepairRequest {
  return {
    id: 'request',
    jobId: 'REQ-TEST',
    requesterId,
    requesterName: 'ผู้แจ้ง',
    departmentId: 'machine',
    department: 'Machine',
    machineId: 'Machine 1',
    issueDetails: 'รายละเอียดปัญหาสำหรับการทดสอบ',
    statusCode,
    status: repairStatusLabels[statusCode],
    createdAt: '2026-09-03T02:00:00.000Z',
    updatedAt: '2026-09-03T02:00:00.000Z',
    actions: [],
    attachments: [],
  }
}

describe('repair workflow actions', () => {
  it('offers approve and reject only to the matching supervisor', () => {
    expect(getAvailableActions(request('pending_supervisor'), user('supervisor'))).toEqual(['reject', 'approve'])
    expect(getAvailableActions(request('pending_supervisor'), user('employee'))).toEqual([])
  })

  it('does not allow an approver to approve their own request', () => {
    expect(getAvailableActions(request('pending_factory_manager', 'actor'), user('factory_manager'))).toEqual([])
  })

  it('uses purchasing acknowledgement and completion actions', () => {
    expect(getAvailableActions(request('pending_purchasing'), user('purchasing'))).toEqual(['reject', 'acknowledge'])
    expect(getAvailableActions(request('purchasing_in_progress'), user('department_manager'))).toEqual(['complete'])
  })
})
