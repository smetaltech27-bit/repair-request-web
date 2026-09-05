import { Eye, Filter, Plus, Search } from 'lucide-react'
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
          <p className="text-sm font-semibold text-teal-600">Maintenance requests</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">รายการซ่อม/ปรับปรุง</h1>
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

      <Card className="mt-5 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
          <p className="text-sm font-bold text-slate-800">รายการทั้งหมด</p>
          <p className="text-xs font-semibold text-slate-500">พบ {filteredRequests.length} จาก {requests.length} รายการ</p>
        </div>

        {filteredRequests.length > 0 ? (
          <>
            <p className="border-b border-slate-100 bg-slate-50/70 px-4 py-2 text-[11px] font-medium text-slate-500 sm:hidden">
              เลื่อนซ้าย–ขวาเพื่อดูข้อมูลทุกคอลัมน์
            </p>
            <div className="overflow-x-auto overscroll-x-contain">
              <table className="w-full min-w-[1280px] table-fixed text-left text-sm">
                <thead className="bg-slate-50 text-xs font-bold text-slate-500">
                  <tr>
                    <th scope="col" className="w-16 px-4 py-3 text-center">ลำดับ</th>
                    <th scope="col" className="w-40 px-4 py-3">รหัสแจ้งซ่อม</th>
                    <th scope="col" className="w-40 px-4 py-3">วันที่แจ้ง</th>
                    <th scope="col" className="w-32 px-4 py-3">แผนก</th>
                    <th scope="col" className="w-44 px-4 py-3">เครื่องจักร/สถานที่</th>
                    <th scope="col" className="w-64 px-4 py-3">อาการเสีย</th>
                    <th scope="col" className="w-44 px-4 py-3">ผู้แจ้ง</th>
                    <th scope="col" className="w-44 px-4 py-3">สถานะ</th>
                    <th scope="col" className="w-40 px-4 py-3 text-center">การดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRequests.map((request, index) => (
                    <tr key={request.id} className="transition hover:bg-teal-50/40">
                      <td className="px-4 py-3.5 text-center font-semibold text-slate-500">{index + 1}</td>
                      <td className="px-4 py-3.5 font-bold text-slate-950">{request.jobId}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-500">{formatThaiDate(request.createdAt)}</td>
                      <td className="px-4 py-3.5"><p className="truncate text-slate-600" title={request.department}>{request.department}</p></td>
                      <td className="px-4 py-3.5"><p className="truncate font-semibold text-slate-700" title={request.machineId}>{request.machineId}</p></td>
                      <td className="px-4 py-3.5"><p className="truncate text-slate-600" title={request.issueDetails}>{request.issueDetails}</p></td>
                      <td className="px-4 py-3.5"><p className="truncate text-slate-600" title={request.requesterName}>{request.requesterName}</p></td>
                      <td className="px-4 py-3.5"><StatusBadge status={request.status} className="whitespace-nowrap" /></td>
                      <td className="px-4 py-3.5 text-center">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setSelectedRequest(request)}
                          aria-label={`ดูรายละเอียด ${request.jobId}`}
                        >
                          <Eye className="size-4" /> ดูรายละเอียด
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="p-10 text-center">
            <Search className="mx-auto size-10 text-slate-300" />
            <h2 className="mt-3 font-bold text-slate-900">ไม่พบรายการ</h2>
            <p className="mt-1 text-sm text-slate-500">ลองเปลี่ยนคำค้นหาหรือตัวกรองสถานะ</p>
          </div>
        )}
      </Card>

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
