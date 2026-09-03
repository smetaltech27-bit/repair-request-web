import {
  CheckCircle2,
  ChevronRight,
  ClipboardClock,
  ClipboardList,
  Plus,
  RotateCcw,
  Wrench,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { DataError, DataLoading } from '../components/DataState'
import { RequestDetails } from '../components/RequestDetails'
import { useRepairRequests } from '../hooks/useRepairData'
import { getRepairStats, getWeeklyTrend } from '../lib/repairMetrics'
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
}

export function DashboardPage() {
  const [selectedRequest, setSelectedRequest] = useState<RepairRequest | null>(null)
  const { requests, isLoading, error, refresh } = useRepairRequests()
  const stats = useMemo(() => getRepairStats(requests), [requests])
  const weeklyTrend = useMemo(() => getWeeklyTrend(requests), [requests])
  const pieData = useMemo(() => [
    { name: 'รออนุมัติ', value: stats.pending, color: '#f59e0b' },
    { name: 'กำลังดำเนินการ', value: stats.inProgress, color: '#10b981' },
    { name: 'ปิดงานแล้ว', value: stats.completed, color: '#0ea5a4' },
    { name: 'ตีกลับ', value: stats.rejected, color: '#ef4444' },
  ], [stats])

  if (isLoading) return <DataLoading label="กำลังโหลดภาพรวมงานซ่อม…" />
  if (error) return <DataError message={error} onRetry={refresh} />

  return (
    <>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-teal-600">Maintenance overview</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">ภาพรวมงานซ่อม</h1>
          <p className="mt-1 text-sm text-slate-500">ติดตามสถานะและแนวโน้มงานซ่อมล่าสุดในที่เดียว</p>
        </div>
        <Button asChild size="lg" className="hidden sm:inline-flex">
          <Link to="/requests/new"><Plus className="size-5" /> แจ้งซ่อมใหม่</Link>
        </Button>
      </div>

      <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {statCards.map(({ key, label, icon: Icon, color }) => (
          <Card key={label} className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-500 sm:text-sm">{label}</p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{stats[key as keyof typeof stats]}</p>
              </div>
              <span className={`grid size-10 place-items-center rounded-xl ring-1 ring-inset sm:size-11 ${statColorClasses[color]}`}>
                <Icon className="size-5" />
              </span>
            </div>
          </Card>
        ))}
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <Card className="p-5">
          <div>
            <h2 className="font-bold text-slate-950">สัดส่วนสถานะงาน</h2>
            <p className="mt-1 text-xs text-slate-500">ข้อมูลที่คุณมีสิทธิ์เข้าถึงทั้งหมด {requests.length} งาน</p>
          </div>
          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={54} outerRadius={82} paddingAngle={3}>
                  {pieData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" iconType="circle" iconSize={8} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <div>
            <h2 className="font-bold text-slate-950">แนวโน้มงานซ่อม</h2>
            <p className="mt-1 text-xs text-slate-500">ภาพรวม 7 วันล่าสุด</p>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyTrend} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="total" name="งานทั้งหมด" stroke="#0891b2" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="completed" name="ปิดงานแล้ว" stroke="#0f766e" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="pending" name="รออนุมัติ" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      <Card className="mt-5 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="font-bold text-slate-950">รายการล่าสุด</h2>
            <p className="mt-0.5 text-xs text-slate-500">อัปเดตสถานะงานล่าสุด</p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/requests">ดูทั้งหมด <ChevronRight className="size-4" /></Link>
          </Button>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold text-slate-500">
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
              {requests.slice(0, 5).map((request) => (
                <tr key={request.id} className="transition hover:bg-slate-50/80">
                  <td className="px-5 py-3.5 font-bold text-slate-900">{request.jobId}</td>
                  <td className="px-5 py-3.5 text-slate-600">{request.department}</td>
                  <td className="px-5 py-3.5 text-slate-600">{request.machineId}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={request.status} /></td>
                  <td className="px-5 py-3.5 text-slate-500">{formatThaiDate(request.createdAt)}</td>
                  <td className="px-5 py-3.5 text-right">
                    <Button variant="secondary" size="sm" onClick={() => setSelectedRequest(request)}>ดูรายละเอียด</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-slate-100 md:hidden">
          {requests.slice(0, 5).map((request) => (
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
      </Card>

      <Button asChild size="lg" className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-20 rounded-2xl shadow-xl sm:hidden">
        <Link to="/requests/new"><Plus className="size-5" /> แจ้งซ่อม</Link>
      </Button>

      <Modal
        open={Boolean(selectedRequest)}
        onOpenChange={(open) => !open && setSelectedRequest(null)}
        title={selectedRequest?.jobId ?? 'รายละเอียดงาน'}
        description={selectedRequest?.machineId}
        footer={<Button className="w-full" onClick={() => setSelectedRequest(null)}>ปิดหน้าต่าง</Button>}
      >
        {selectedRequest && (
          <RequestDetails request={selectedRequest} />
        )}
      </Modal>
    </>
  )
}
