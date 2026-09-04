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

function repairCostMonthKey(request: RepairRequest) {
  return bangkokDateKey(request.closedAt ?? request.updatedAt).slice(0, 7)
}

function hasRecordedCost(request: RepairRequest) {
  return request.statusCode === 'completed' && request.totalCost !== undefined && Number.isFinite(request.totalCost)
}

export function getRepairTotalCost(requests: RepairRequest[], month = 'all') {
  return requests
    .filter((request) => hasRecordedCost(request) && (month === 'all' || repairCostMonthKey(request) === month))
    .reduce((total, request) => total + (request.totalCost ?? 0), 0)
}

export function getRepairCostMonths(requests: RepairRequest[]) {
  const months = new Set(
    requests
      .filter(hasRecordedCost)
      .map(repairCostMonthKey),
  )

  return Array.from(months)
    .sort((left, right) => right.localeCompare(left))
    .map((value) => {
      const [year, month] = value.split('-')
      return { value, label: `${Number(month)}/${year}` }
    })
}

export function getWeeklyTrend(requests: RepairRequest[], now = new Date()) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now.getTime() - (6 - index) * 24 * 60 * 60 * 1000)
    const key = bangkokDateKey(date)
    const [, month, day] = key.split('-')
    const daily = requests.filter((request) => bangkokDateKey(request.createdAt) === key)
    return {
      day: `${Number(day)}/${Number(month)}`,
      total: daily.length,
      pending: daily.filter((request) => pendingStatuses.has(request.statusCode)).length,
      completed: daily.filter((request) => request.statusCode === 'completed').length,
    }
  })
}
