import { ChevronRight, Filter, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { StatusBadge } from '../components/ui/StatusBadge'
import { DataError, DataLoading } from '../components/DataState'
import { RequestDetails } from '../components/RequestDetails'
import { useRepairRequests } from '../hooks/useRepairData'
import { formatThaiDate } from '../lib/utils'
import type { RepairRequest, RepairStatus } from '../types/repair'

const statusOptions: { value: string; label: string; statuses?: RepairStatus[] }[] = [
  { value: 'all', label: 'ทุกสถานะ' },
  {
    value: 'pending',
    label: 'รออนุมัติ',
    statuses: ['รอหัวหน้างานอนุมัติ', 'รอผู้จัดการฝ่ายอนุมัติ', 'รอผู้จัดการโรงงานอนุมัติ', 'รอจัดซื้อดำเนินการ'],
  },
  { value: 'in-progress', label: 'กำลังดำเนินการ', statuses: ['กำลังดำเนินการจัดซื้อ'] },
  { value: 'completed', label: 'ปิดงานแล้ว', statuses: ['ซ่อมเสร็จเรียบร้อย (ปิดงาน)'] },
  { value: 'rejected', label: 'ตีกลับ', statuses: ['ไม่อนุมัติ (ตีกลับ)'] },
]

export function RequestsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedJobId = searchParams.get('job')
  const [query, setQuery] = useState(requestedJobId ?? '')
  const [selectedRequestState, setSelectedRequest] = useState<RepairRequest | null>(null)
  const activeStatus = searchParams.get('status') ?? 'all'
  const { requests, isLoading, error, refresh } = useRepairRequests()
  const linkedRequest = requestedJobId
    ? requests.find((request) => request.jobId === requestedJobId) ?? null
    : null
  const selectedRequest = selectedRequestState ?? linkedRequest

  const filteredRequests = useMemo(() => {
    const option = statusOptions.find((item) => item.value === activeStatus)
    const normalizedQuery = query.trim().toLowerCase()
    return requests.filter((request) => {
      const matchesStatus = !option?.statuses || option.statuses.includes(request.status)
      const matchesQuery =
        !normalizedQuery ||
        [request.jobId, request.requesterName, request.department, request.machineId, request.issueDetails]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery)
      return matchesStatus && matchesQuery
    })
  }, [activeStatus, query, requests])

  function closeSelectedRequest() {
    setSelectedRequest(null)
    if (!requestedJobId) return
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('job')
    setSearchParams(nextParams, { replace: true })
  }

  if (isLoading) return <DataLoading label="กำลังโหลดรายการงานซ่อม…" />
  if (error) return <DataError message={error} onRetry={refresh} />

  return (
    <>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-teal-600">Repair requests</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">รายการงานซ่อม</h1>
          <p className="mt-1 text-sm text-slate-500">ค้นหา กรอง และติดตามรายการแจ้งซ่อม</p>
        </div>
        <Button asChild size="lg"><Link to="/requests/new"><Plus className="size-5" /> แจ้งซ่อมใหม่</Link></Button>
      </div>

      <Card className="mt-6 p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <label className="relative block">
            <span className="sr-only">ค้นหารายการ</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ค้นหารหัสงาน ผู้แจ้ง แผนก หรือเครื่องจักร"
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
            />
          </label>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
            <Filter className="size-4 shrink-0 text-slate-400" />
            {statusOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setSearchParams(option.value === 'all' ? {} : { status: option.value })}
                className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  activeStatus === option.value
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <div className="mt-5 grid gap-3">
        {filteredRequests.map((request) => (
          <Card key={request.id} className="group overflow-hidden transition hover:border-teal-200 hover:shadow-md">
            <button onClick={() => setSelectedRequest(request)} className="flex w-full items-start gap-4 p-4 text-left sm:p-5">
              <div className="hidden size-12 shrink-0 place-items-center rounded-2xl bg-slate-100 text-sm font-bold text-slate-500 sm:grid">
                {request.department.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-bold text-slate-950">{request.jobId}</h2>
                  <StatusBadge status={request.status} />
                </div>
                <p className="mt-1 truncate font-semibold text-slate-700">{request.machineId}</p>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">{request.issueDetails}</p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>{request.department}</span>
                  <span>{request.requesterName}</span>
                  <span>{formatThaiDate(request.createdAt)}</span>
                </div>
              </div>
              <ChevronRight className="mt-2 size-5 shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-teal-600" />
            </button>
          </Card>
        ))}
        {filteredRequests.length === 0 && (
          <Card className="p-10 text-center">
            <Search className="mx-auto size-10 text-slate-300" />
            <h2 className="mt-3 font-bold text-slate-900">ไม่พบรายการ</h2>
            <p className="mt-1 text-sm text-slate-500">ลองเปลี่ยนคำค้นหาหรือตัวกรองสถานะ</p>
          </Card>
        )}
      </div>

      <Modal
        open={Boolean(selectedRequest)}
        onOpenChange={(open) => !open && closeSelectedRequest()}
        title={selectedRequest?.jobId ?? 'รายละเอียดงาน'}
        description={selectedRequest?.machineId}
        footer={<Button className="w-full" onClick={closeSelectedRequest}>ปิดหน้าต่าง</Button>}
      >
        {selectedRequest && (
          <RequestDetails request={selectedRequest} />
        )}
      </Modal>
    </>
  )
}
