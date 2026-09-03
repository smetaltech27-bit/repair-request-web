import type { RepairRequest } from '../types/repair'

const pendingStatuses = new Set([
  'pending_supervisor',
  'pending_department_manager',
  'pending_factory_manager',
  'pending_purchasing',
])

export function getRepairStats(requests: RepairRequest[]) {
  return {
    total: requests.length,
    pending: requests.filter((request) => pendingStatuses.has(request.statusCode)).length,
    inProgress: requests.filter((request) => request.statusCode === 'purchasing_in_progress').length,
    completed: requests.filter((request) => request.statusCode === 'completed').length,
    rejected: requests.filter((request) => request.statusCode === 'rejected').length,
  }
}

export function getDepartmentStats(requests: RepairRequest[]) {
  const totals = new Map<string, number>()

  requests.forEach((request) => {
    const department = request.department.trim() || 'ไม่ระบุแผนก'
    totals.set(department, (totals.get(department) ?? 0) + 1)
  })

  return Array.from(totals, ([department, total]) => ({ department, total }))
    .sort((left, right) => right.total - left.total || left.department.localeCompare(right.department, 'th'))
}

function bangkokDateKey(value: Date | string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

export function getWeeklyTrend(requests: RepairRequest[], now = new Date()) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now.getTime() - (6 - index) * 24 * 60 * 60 * 1000)
    const key = bangkokDateKey(date)
    const daily = requests.filter((request) => bangkokDateKey(request.createdAt) === key)
    return {
      day: new Intl.DateTimeFormat('th-TH', {
        timeZone: 'Asia/Bangkok',
        day: 'numeric',
        month: 'short',
      }).format(date),
      total: daily.length,
      pending: daily.filter((request) => pendingStatuses.has(request.statusCode)).length,
      completed: daily.filter((request) => request.statusCode === 'completed').length,
    }
  })
}
