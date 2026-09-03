import type { RepairRequest, RepairStatusCode } from '../types/repair'

export type RepairStatusFilter = 'all' | 'pending' | 'in-progress' | 'completed' | 'rejected'

export const repairStatusFilters: { value: RepairStatusFilter; label: string }[] = [
  { value: 'all', label: 'ทุกสถานะ' },
  { value: 'pending', label: 'รออนุมัติ' },
  { value: 'in-progress', label: 'กำลังดำเนินการ' },
  { value: 'completed', label: 'ปิดงานแล้ว' },
  { value: 'rejected', label: 'ตีกลับ' },
]

const statusCodesByFilter: Record<Exclude<RepairStatusFilter, 'all'>, RepairStatusCode[]> = {
  pending: [
    'pending_supervisor',
    'pending_department_manager',
    'pending_factory_manager',
    'pending_purchasing',
  ],
  'in-progress': ['purchasing_in_progress'],
  completed: ['completed'],
  rejected: ['rejected'],
}

export function filterRepairRequests(
  requests: RepairRequest[],
  query: string,
  statusFilter: RepairStatusFilter,
) {
  const normalizedQuery = query.trim().toLowerCase()
  const acceptedStatuses = statusFilter === 'all' ? null : statusCodesByFilter[statusFilter]

  return requests.filter((request) => {
    const matchesStatus = !acceptedStatuses || acceptedStatuses.includes(request.statusCode)
    const matchesQuery =
      !normalizedQuery ||
      [request.jobId, request.requesterName, request.department, request.machineId, request.issueDetails]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
    return matchesStatus && matchesQuery
  })
}

export function paginateRepairRequests<T>(items: T[], requestedPage: number, pageSize = 20) {
  const safePageSize = Math.max(1, Math.floor(pageSize))
  const totalPages = Math.max(1, Math.ceil(items.length / safePageSize))
  const page = Math.min(Math.max(1, Math.floor(requestedPage)), totalPages)
  const start = (page - 1) * safePageSize

  return {
    items: items.slice(start, start + safePageSize),
    page,
    totalPages,
  }
}
