import { Check, ChevronRight, ClipboardCheck, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../auth/AuthContext'
import { DataEmpty, DataError, DataLoading } from '../components/DataState'
import { RequestDetails } from '../components/RequestDetails'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { StatusBadge } from '../components/ui/StatusBadge'
import { useRepairRequests } from '../hooks/useRepairData'
import { transitionRepairRequest } from '../lib/repairService'
import { getApprovalActions, type ApprovalAction } from '../lib/repairWorkflow'
import { formatThaiDate } from '../lib/utils'
import type { RepairRequest } from '../types/repair'

export function ApprovalsPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedJobId = searchParams.get('job')
  const { requests, isLoading, error, refresh } = useRepairRequests()
  const [selectedRequestState, setSelectedRequest] = useState<RepairRequest | null>(null)
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const actionableRequests = useMemo(
    () => user ? requests.filter((request) => getApprovalActions(request, user).length > 0) : [],
    [requests, user],
  )
  const linkedRequest = requestedJobId
    ? actionableRequests.find((request) => request.jobId === requestedJobId) ?? null
    : null
  const selectedRequest = selectedRequestState ?? linkedRequest
  const selectedActions = selectedRequest && user ? getApprovalActions(selectedRequest, user) : []

  function closeModal() {
    setSelectedRequest(null)
    setNote('')
    if (requestedJobId) {
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('job')
      setSearchParams(nextParams, { replace: true })
    }
  }

  async function submitAction(action: ApprovalAction) {
    if (!selectedRequest || !user) return
    if (!note.trim()) {
      toast.error('กรุณากรอกหมายเหตุประกอบการพิจารณา')
      return
    }
    setIsSubmitting(true)
    try {
      await transitionRepairRequest({
        requestId: selectedRequest.id,
        action,
        note,
      })
      toast.success(
        action === 'reject' ? 'ตีกลับรายการเรียบร้อยแล้ว'
          : action === 'acknowledge' ? 'รับดำเนินการเรียบร้อยแล้ว'
            : 'อนุมัติรายการเรียบร้อยแล้ว',
      )
      closeModal()
      await refresh()
    } catch (submitError) {
      toast.error('ดำเนินการไม่สำเร็จ', {
        description: submitError instanceof Error ? submitError.message : 'กรุณาลองอีกครั้ง',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) return <DataLoading label="กำลังตรวจรายการที่รอคุณดำเนินการ…" />
  if (error) return <DataError message={error} onRetry={refresh} />

  return (
    <>
      <div>
        <p className="text-sm font-semibold text-teal-600">Approval inbox</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">รายการรออนุมัติ</h1>
        <p className="mt-1 text-sm text-slate-500">รายการที่รอการพิจารณาตามสิทธิ์ของคุณ</p>
      </div>

      <div className="mt-6 grid gap-4">
        {actionableRequests.map((request) => (
          <Card key={request.id} className="group overflow-hidden transition hover:border-amber-200 hover:shadow-md">
            <button onClick={() => setSelectedRequest(request)} className="flex w-full items-start gap-4 p-4 text-left sm:p-5">
              <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-600/10">
                <ClipboardCheck className="size-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-slate-950">{request.jobId}</p>
                  <StatusBadge status={request.status} />
                </div>
                <p className="mt-1 font-semibold text-slate-700">{request.machineId}</p>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">{request.issueDetails}</p>
                <p className="mt-2 text-xs text-slate-500">{request.requesterName} · {request.department} · {formatThaiDate(request.createdAt)}</p>
              </div>
              <ChevronRight className="mt-3 size-5 shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-amber-600" />
            </button>
          </Card>
        ))}
        {actionableRequests.length === 0 && (
          <DataEmpty title="ไม่มีรายการที่ต้องดำเนินการ" description="ขณะนี้ไม่มีใบแจ้งซ่อมที่รอสิทธิ์ของคุณ" />
        )}
      </div>

      <Modal
        open={Boolean(selectedRequest)}
        onOpenChange={(open) => !open && closeModal()}
        title="พิจารณารายการ"
        description={selectedRequest ? `${selectedRequest.jobId} · ${selectedRequest.machineId}` : undefined}
        titleClassName="lg:text-2xl"
        descriptionClassName="lg:text-base"
        footer={
          <div className={`grid gap-3 ${selectedActions.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {selectedActions.map((action) => (
              <Button
                key={action}
                variant={action === 'reject' ? 'danger' : 'success'}
                className="lg:h-12 lg:text-base"
                disabled={isSubmitting}
                onClick={() => void submitAction(action)}
              >
                {action === 'reject' ? <RotateCcw className="size-4 lg:size-5" /> : <Check className="size-4 lg:size-5" />}
                {action === 'reject' ? 'ตีกลับ' : action === 'acknowledge' ? 'รับดำเนินการ' : 'อนุมัติ'}
              </Button>
            ))}
          </div>
        }
      >
        {selectedRequest && (
          <div className="space-y-6">
            <RequestDetails request={selectedRequest} desktopReadable />
            <div>
              <label htmlFor="approval-note" className="mb-2 block text-sm font-bold text-slate-700 lg:text-base">หมายเหตุการพิจารณา <span className="text-red-500">*</span></label>
              <textarea id="approval-note" rows={5} value={note} onChange={(event) => setNote(event.target.value)} placeholder="ระบุเหตุผลหรือรายละเอียดประกอบการอนุมัติ" className="form-control min-h-32 resize-y py-3 lg:!text-base" />
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
