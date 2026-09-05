import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardClock,
  ClipboardList,
  Filter,
  Plus,
  RotateCcw,
  Search,
  Wrench,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { PieLabelRenderProps } from 'recharts'
import { DataError, DataLoading } from '../components/DataState'
import { RequestDetails } from '../components/RequestDetails'
import { useRepairRequests } from '../hooks/useRepairData'
import {
  getDepartmentStats,
  getRepairCostMonths,
  getRepairStats,
  getRepairTotalCost,
} from '../lib/repairMetrics'
import {
  filterRepairRequests,
  paginateRepairRequests,
  repairStatusFilters,
  type RepairStatusFilter,
} from '../lib/repairList'
import { formatThaiDate } from '../lib/utils'
import type { RepairRequest } from '../types/repair'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { StatusBadge } from '../components/ui/StatusBadge'

const statCards = [
  { key: 'total', label: 'งานทั้งหมด', icon: ClipboardList, color: 'teal' },
  { key: 'pending', label: 'รออนุมัติ', icon: ClipboardClock, color: 'amber' },
  { key: 'inProgress', label: 'กำลังดำเนินการ', icon: Wrench, color: 'emerald' },
  { key: 'completed', label: 'ปิดงานแล้ว', icon: CheckCircle2, color: 'blue' },
  { key: 'rejected', label: 'ตีกลับ', icon: RotateCcw, color: 'red' },
]

const statColorClasses: Record<string, string> = {
  teal: 'bg-teal-50 text-teal-600 ring-teal-600/10',
  amber: 'bg-amber-50 text-amber-600 ring-amber-600/10',
  emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-600/10',
  blue: 'bg-sky-50 text-sky-600 ring-sky-600/10',
  red: 'bg-red-50 text-red-600 ring-red-600/10',
  violet: 'bg-violet-50 text-violet-600 ring-violet-600/10',
}

const RADIAN = Math.PI / 180
const DASHBOARD_PAGE_SIZE = 20

function useMobileChartLayout() {
  const [isMobile, setIsMobile] = useState(() => (
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 639px)').matches
      : false
  ))

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mediaQuery = window.matchMedia('(max-width: 639px)')
    const updateLayout = () => setIsMobile(mediaQuery.matches)
    updateLayout()
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateLayout)
      return () => mediaQuery.removeEventListener('change', updateLayout)
    }

    mediaQuery.addListener(updateLayout)
    return () => mediaQuery.removeListener(updateLayout)
  }, [])

  return isMobile
}

function renderPieValueLabel({ cx, cy, midAngle, innerRadius, outerRadius, value }: PieLabelRenderProps) {
  const count = Number(value)
  if (!count) return null

  const radius = Number(innerRadius) + (Number(outerRadius) - Number(innerRadius)) * 0.54
  const x = Number(cx) + radius * Math.cos(-Number(midAngle) * RADIAN)
  const y = Number(cy) + radius * Math.sin(-Number(midAngle) * RADIAN)

  return (
    <text x={x} y={y} fill="#ffffff" textAnchor="middle" dominantBaseline="central" className="text-xs lg:text-sm" fontWeight={700}>
      {count}
    </text>
  )
}

export function DashboardPage() {
  const isMobileChartLayout = useMobileChartLayout()
  const [selectedRequest, setSelectedRequest] = useState<RepairRequest | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<RepairStatusFilter>('all')
  const [requestedPage, setRequestedPage] = useState(1)
  const [costMonth, setCostMonth] = useState('all')
  const { requests, isLoading, error, refresh } = useRepairRequests()
  const stats = useMemo(() => getRepairStats(requests), [requests])
  const departmentData = useMemo(() => getDepartmentStats(requests), [requests])
  const costMonths = useMemo(() => getRepairCostMonths(requests), [requests])
  const totalCost = useMemo(() => getRepairTotalCost(requests, costMonth), [costMonth, requests])
  const pieData = useMemo(() => [
    { name: 'รออนุมัติ', value: stats.pending, color: '#f59e0b' },
    { name: 'กำลังดำเนินการ', value: stats.inProgress, color: '#10b981' },
    { name: 'ปิดงานแล้ว', value: stats.completed, color: '#0ea5a4' },
    { name: 'ตีกลับ', value: stats.rejected, color: '#ef4444' },
  ], [stats])
  const filteredRequests = useMemo(
    () => filterRepairRequests(requests, query, statusFilter),
    [query, requests, statusFilter],
  )
  const paginatedRequests = useMemo(
    () => paginateRepairRequests(filteredRequests, requestedPage, DASHBOARD_PAGE_SIZE),
    [filteredRequests, requestedPage],
  )

  if (isLoading) return <DataLoading label="กำลังโหลดภาพรวมงานซ่อม…" />
  if (error) return <DataError message={error} onRetry={refresh} />

  return (
    <>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-teal-600 lg:text-base">Maintenance overview</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl lg:text-[34px]">ภาพรวมงานซ่อม</h1>
          <p className="mt-1 text-sm text-slate-500 lg:text-base">ติดตามสถานะและภาพรวมงานซ่อมทั้งบริษัทในที่เดียว</p>
        </div>
        <Button asChild size="lg" className="hidden sm:inline-flex">
          <Link to="/requests/new"><Plus className="size-5" /> แจ้งซ่อมใหม่</Link>
        </Button>
      </div>

      <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {statCards.map(({ key, label, icon: Icon, color }) => (
          <Card key={label} className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-500 sm:text-sm lg:text-base">{label}</p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{stats[key as keyof typeof stats]}</p>
              </div>
              <span className={`grid size-10 place-items-center rounded-xl ring-1 ring-inset sm:size-11 ${statColorClasses[color]}`}>
                <Icon className="size-5" />
              </span>
            </div>
          </Card>
        ))}
        <Card className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-500 sm:text-sm lg:text-base">ค่าใช้จ่ายรวม (บาท)</p>
              <p className="mt-2 whitespace-nowrap text-2xl font-bold tracking-tight text-slate-950 2xl:text-3xl">
                {new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(totalCost)}
              </p>
            </div>
            <span className={`grid size-10 shrink-0 place-items-center rounded-xl ring-1 ring-inset sm:size-11 ${statColorClasses.violet}`}>
              <span aria-hidden="true" className="grid size-6 place-items-center rounded-full border-2 border-current text-sm font-extrabold leading-none">฿</span>
            </span>
          </div>
          <label className="mt-3 block">
            <span className="sr-only">กรองค่าใช้จ่ายตามเดือนที่ปิดงาน</span>
            <select
              value={costMonth}
              onChange={(event) => setCostMonth(event.target.value)}
              className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs font-semibold text-slate-600 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-500/10 lg:text-sm"
            >
              <option value="all">ทุกเดือน</option>
              {costMonths.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
            </select>
          </label>
        </Card>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card className="min-w-0 overflow-hidden p-4 sm:p-5">
          <div>
            <h2 className="font-bold text-slate-950 lg:text-lg">สัดส่วนสถานะงาน</h2>
            <p className="mt-1 text-xs text-slate-500 lg:text-sm">ข้อมูลใบแจ้งซ่อมทั้งบริษัททั้งหมด {requests.length} งาน</p>
          </div>
          <div className="mt-3 min-w-0 items-center gap-2 sm:grid sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="mx-auto h-56 w-full min-w-0 max-w-72 overflow-hidden sm:h-64 sm:max-w-none">
              <ResponsiveContainer width="100%" height="100%" debounce={80}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={isMobileChartLayout ? 48 : 58}
                    outerRadius={isMobileChartLayout ? 80 : 94}
                    paddingAngle={2}
                    labelLine={false}
                    label={renderPieValueLabel}
                  >
                    {pieData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 sm:mt-0 sm:min-w-40 sm:grid-cols-1 sm:gap-2">
              {pieData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-2 text-xs text-slate-600 lg:text-sm">
                  <span className="h-2.5 w-5 shrink-0 rounded-sm" style={{ backgroundColor: entry.color }} />
                  <span>{entry.name}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="min-w-0 overflow-hidden p-4 sm:p-5">
          <div>
            <h2 className="font-bold text-slate-950 lg:text-lg">สถิติแจ้งซ่อมแยกตามแผนก</h2>
            <p className="mt-1 text-xs text-slate-500 lg:text-sm">จำนวนรายการใบแจ้งซ่อมทั้งบริษัทในแต่ละแผนก</p>
          </div>
          <div className="mt-4 min-w-0 overflow-hidden pb-1 sm:overflow-x-auto">
            <div
              className="h-64 w-full min-w-0 lg:[&_.recharts-cartesian-axis-tick-value]:text-[13px] lg:[&_.recharts-label]:text-sm"
              style={{ minWidth: isMobileChartLayout ? 0 : `${Math.max(520, departmentData.length * 120)}px` }}
            >
              <ResponsiveContainer width="100%" height="100%" debounce={80}>
                <BarChart
                  data={departmentData}
                  margin={isMobileChartLayout
                    ? { top: 22, right: 0, left: -34, bottom: 38 }
                    : { top: 22, right: 8, left: -24, bottom: 8 }}
                >
                  <CartesianGrid stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="department"
                    tick={{ fontSize: isMobileChartLayout ? 9 : 11, fill: '#64748b' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                    interval={0}
                    angle={isMobileChartLayout ? -22 : 0}
                    textAnchor={isMobileChartLayout ? 'end' : 'middle'}
                    height={isMobileChartLayout ? 54 : 30}
                  />
                  <YAxis tick={{ fontSize: isMobileChartLayout ? 9 : 11, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip formatter={(value) => [`${value} งาน`, 'จำนวนงาน']} />
                  <Bar dataKey="total" name="จำนวนงาน" fill="#0ea5a4" radius={[5, 5, 0, 0]} maxBarSize={84}>
                    <LabelList dataKey="total" position="top" fill="#0f766e" fontSize={12} fontWeight={700} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
      </section>

      <Card className="mt-5 overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <h2 className="font-bold text-slate-950 lg:text-lg">รายการแจ้งซ่อมทั้งหมด</h2>
            <p className="mt-0.5 text-xs text-slate-500 lg:text-sm">พบ {filteredRequests.length} จากทั้งหมด {requests.length} รายการ</p>
          </div>
          <Button asChild size="sm" className="shrink-0 px-3 text-xs sm:hidden">
            <Link to="/requests/new"><Plus className="size-4" /> แจ้งซ่อม</Link>
          </Button>
        </div>

        <div className="border-b border-slate-100 p-3 sm:p-4">
          <div className="grid gap-2.5 sm:gap-3 lg:grid-cols-[1fr_auto]">
            <label className="relative block">
              <span className="sr-only">ค้นหารายการ</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400 sm:left-3.5 sm:size-5" />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setRequestedPage(1)
                }}
                placeholder="ค้นหารหัสงาน ผู้แจ้ง แผนก หรือเครื่องจักร"
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-2.5 text-[11px] outline-none transition placeholder:text-[10px] focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10 sm:h-11 sm:rounded-xl sm:pl-11 sm:pr-4 sm:text-sm sm:placeholder:text-sm lg:text-base lg:placeholder:text-base"
              />
            </label>
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:gap-2 lg:pb-0">
              <Filter className="hidden size-4 shrink-0 text-slate-400 sm:block" />
              {repairStatusFilters.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setStatusFilter(option.value)
                    setRequestedPage(1)
                  }}
                  className={`shrink-0 rounded-lg px-2 py-1.5 text-[10px] font-bold transition sm:rounded-xl sm:px-3.5 sm:py-2 sm:text-xs lg:text-sm ${
                    statusFilter === option.value
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[820px] text-left text-sm lg:text-base">
            <thead className="bg-slate-50 text-xs font-bold text-slate-500 lg:text-sm">
              <tr>
                <th className="px-5 py-3">รหัสงาน</th>
                <th className="px-5 py-3">แผนก</th>
                <th className="px-5 py-3">เครื่องจักร</th>
                <th className="px-5 py-3">สถานะ</th>
                <th className="px-5 py-3">วันที่แจ้ง</th>
                <th className="px-5 py-3 text-right">การดำเนินการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedRequests.items.map((request) => (
                <tr key={request.id} className="transition hover:bg-slate-50/80">
                  <td className="px-5 py-3.5 font-bold text-slate-900">{request.jobId}</td>
                  <td className="px-5 py-3.5 text-slate-600">{request.department}</td>
                  <td className="px-5 py-3.5 text-slate-600">{request.machineId}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={request.status} className="lg:text-sm" /></td>
                  <td className="px-5 py-3.5 text-slate-500">{formatThaiDate(request.createdAt)}</td>
                  <td className="px-5 py-3.5 text-right">
                    <Button variant="secondary" size="sm" className="lg:text-base" onClick={() => setSelectedRequest(request)}>ดูรายละเอียด</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-slate-100 md:hidden">
          {paginatedRequests.items.map((request) => (
            <button key={request.id} onClick={() => setSelectedRequest(request)} className="flex w-full items-start gap-3 p-4 text-left transition hover:bg-slate-50">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-slate-900">{request.jobId}</p>
                  <StatusBadge status={request.status} />
                </div>
                <p className="mt-1 truncate text-sm font-medium text-slate-700">{request.machineId}</p>
                <p className="mt-0.5 text-xs text-slate-500">{request.department} · {formatThaiDate(request.createdAt)}</p>
              </div>
              <ChevronRight className="mt-2 size-5 shrink-0 text-slate-400" />
            </button>
          ))}
        </div>

        {filteredRequests.length === 0 ? (
          <div className="border-t border-slate-100 p-10 text-center">
            <Search className="mx-auto size-10 text-slate-300" />
            <h3 className="mt-3 font-bold text-slate-900">ไม่พบรายการ</h3>
            <p className="mt-1 text-sm text-slate-500 lg:text-base">ลองเปลี่ยนคำค้นหาหรือตัวกรองสถานะ</p>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3 border-t border-slate-100 px-4 py-4">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="lg:text-base"
              disabled={paginatedRequests.page <= 1}
              onClick={() => setRequestedPage(paginatedRequests.page - 1)}
            >
              <ChevronLeft className="size-4" /> ย้อนกลับ
            </Button>
            <span className="min-w-20 text-center text-xs font-semibold text-slate-500 lg:text-sm">
              หน้า {paginatedRequests.page} / {paginatedRequests.totalPages}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="lg:text-base"
              disabled={paginatedRequests.page >= paginatedRequests.totalPages}
              onClick={() => setRequestedPage(paginatedRequests.page + 1)}
            >
              ถัดไป <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </Card>

      <Modal
        open={Boolean(selectedRequest)}
        onOpenChange={(open) => !open && setSelectedRequest(null)}
        title={selectedRequest?.jobId ?? 'รายละเอียดงาน'}
        description={selectedRequest?.machineId}
        footer={<Button className="w-full" onClick={() => setSelectedRequest(null)}>ปิดหน้าต่าง</Button>}
      >
        {selectedRequest && (
          <RequestDetails request={selectedRequest} enableImagePreview />
        )}
      </Modal>
    </>
  )
}
