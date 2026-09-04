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
import { compressRepairImage } from '../lib/imageProcessing'
import { removeRepairImage, transitionRepairRequest, uploadRepairImage } from '../lib/repairService'
import { getAvailableActions, type WorkflowAction } from '../lib/repairWorkflow'
import { formatThaiDate } from '../lib/utils'
import type { RepairRequest } from '../types/repair'

export function ApprovalsPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedJobId = searchParams.get('job')
  const { requests, isLoading, error, refresh } = useRepairRequests()
  const [selectedRequestState, setSelectedRequest] = useState<RepairRequest | null>(null)
  const [note, setNote] = useState('')
  const [totalCost, setTotalCost] = useState('')
  const [afterImage, setAfterImage] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const actionableRequests = useMemo(
    () => user ? requests.filter((request) => getAvailableActions(request, user).length > 0) : [],
    [requests, user],
  )
  const linkedRequest = requestedJobId
    ? actionableRequests.find((request) => request.jobId === requestedJobId) ?? null
    : null
  const selectedRequest = selectedRequestState ?? linkedRequest
  const selectedActions = selectedRequest && user ? getAvailableActions(selectedRequest, user) : []
  const isCompletion = selectedActions.includes('complete')

  function closeModal() {
    setSelectedRequest(null)
    setNote('')
    setTotalCost('')
    setAfterImage(null)
    if (requestedJobId) {
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('job')
      setSearchParams(nextParams, { replace: true })
    }
  }

  async function submitAction(action: WorkflowAction) {
    if (!selectedRequest || !user) return
    if (!note.trim()) {
      toast.error('กรุณากรอกหมายเหตุประกอบการพิจารณา')
      return
    }
    const parsedCost = Number(totalCost)
    if (action === 'complete' && (totalCost.trim() === '' || !Number.isFinite(parsedCost) || parsedCost < 0)) {
      toast.error('กรุณาระบุค่าใช้จ่ายเป็นตัวเลขตั้งแต่ 0 ขึ้นไป')
      return
    }

    setIsSubmitting(true)
    let uploadedPath = ''
    try {
      if (action === 'complete' && afterImage) {
        const compressed = await compressRepairImage(afterImage)
        uploadedPath = await uploadRepairImage(compressed, user.id, 'complete')
      }
      await transitionRepairRequest({
        requestId: selectedRequest.id,
        action,
        note,
        totalCost: action === 'complete' ? parsedCost : undefined,
        afterStoragePath: uploadedPath || undefined,
      })
      toast.success(
        action === 'reject' ? 'ตีกลับรายการเรียบร้อยแล้ว'
          : action === 'acknowledge' ? 'รับดำเนินการเรียบร้อยแล้ว'
            : action === 'complete' ? 'ปิดงานเรียบร้อยแล้ว'
              : 'อนุมัติรายการเรียบร้อยแล้ว',
      )
      closeModal()
      await refresh()
    } catch (submitError) {
      if (uploadedPath) {
        try {
          await removeRepairImage(uploadedPath)
        } catch {
          // Unlinked uploads remain removable by their owner.
        }
      }
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
        footer={
          <div className={`grid gap-3 ${selectedActions.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {selectedActions.map((action) => (
              <Button
                key={action}
                variant={action === 'reject' ? 'danger' : 'success'}
                disabled={isSubmitting}
                onClick={() => void submitAction(action)}
              >
                {action === 'reject' ? <RotateCcw className="size-4" /> : <Check className="size-4" />}
                {action === 'reject' ? 'ตีกลับ' : action === 'acknowledge' ? 'รับดำเนินการ' : action === 'complete' ? 'ปิดงาน' : 'อนุมัติ'}
              </Button>
            ))}
          </div>
        }
      >
        {selectedRequest && (
          <div className="space-y-6">
            <RequestDetails request={selectedRequest} />
            {isCompletion && (
              <div className="grid gap-4 rounded-2xl border border-teal-100 bg-teal-50/50 p-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="total-cost" className="mb-2 block text-sm font-bold text-slate-700">ค่าใช้จ่ายทั้งหมด <span className="text-red-500">*</span></label>
                  <input id="total-cost" type="number" min="0" step="0.01" value={totalCost} onChange={(event) => setTotalCost(event.target.value)} className="form-control" placeholder="0.00" />
                </div>
                <div>
                  <label htmlFor="after-image" className="mb-2 block text-sm font-bold text-slate-700">รูปหลังซ่อม</label>
                  <input id="after-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setAfterImage(event.target.files?.[0] ?? null)} className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:font-bold file:text-teal-700" />
                </div>
              </div>
            )}
            <div>
              <label htmlFor="approval-note" className="mb-2 block text-sm font-bold text-slate-700">หมายเหตุการพิจารณา <span className="text-red-500">*</span></label>
              <textarea id="approval-note" rows={5} value={note} onChange={(event) => setNote(event.target.value)} placeholder="ระบุเหตุผลหรือรายละเอียดประกอบการอนุมัติ" className="form-control min-h-32 resize-y py-3" />
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
