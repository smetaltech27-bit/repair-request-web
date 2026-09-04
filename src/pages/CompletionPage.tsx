import { Camera, ChevronRight, Flag } from 'lucide-react'
import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
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
import { canCompleteRequest } from '../lib/repairWorkflow'
import { formatThaiDate } from '../lib/utils'
import type { RepairRequest } from '../types/repair'

export function CompletionPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedJobId = searchParams.get('job')
  const { requests, isLoading, error, refresh } = useRepairRequests()
  const [selectedRequestState, setSelectedRequest] = useState<RepairRequest | null>(null)
  const [note, setNote] = useState('')
  const [totalCost, setTotalCost] = useState('')
  const [afterImage, setAfterImage] = useState<File | null>(null)
  const [afterImagePreviewUrl, setAfterImagePreviewUrl] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const completableRequests = useMemo(
    () => user ? requests.filter((request) => canCompleteRequest(request, user)) : [],
    [requests, user],
  )
  const linkedRequest = requestedJobId
    ? completableRequests.find((request) => request.jobId === requestedJobId) ?? null
    : null
  const selectedRequest = selectedRequestState ?? linkedRequest

  useEffect(() => {
    return () => {
      if (afterImagePreviewUrl) URL.revokeObjectURL(afterImagePreviewUrl)
    }
  }, [afterImagePreviewUrl])

  function selectAfterImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    setAfterImage(file)
    setAfterImagePreviewUrl(file ? URL.createObjectURL(file) : '')
  }

  function closeModal() {
    setSelectedRequest(null)
    setNote('')
    setTotalCost('')
    setAfterImage(null)
    setAfterImagePreviewUrl('')
    if (requestedJobId) {
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('job')
      setSearchParams(nextParams, { replace: true })
    }
  }

  async function completeRequest() {
    if (!selectedRequest || !user) return
    if (!note.trim()) {
      toast.error('กรุณากรอกหมายเหตุการปิดงาน')
      return
    }
    const parsedCost = Number(totalCost)
    if (totalCost.trim() === '' || !Number.isFinite(parsedCost) || parsedCost < 0) {
      toast.error('กรุณาระบุค่าใช้จ่ายเป็นตัวเลขตั้งแต่ 0 ขึ้นไป')
      return
    }

    setIsSubmitting(true)
    let uploadedPath = ''
    try {
      if (afterImage) {
        const compressed = await compressRepairImage(afterImage)
        uploadedPath = await uploadRepairImage(compressed, user.id, 'complete')
      }
      await transitionRepairRequest({
        requestId: selectedRequest.id,
        action: 'complete',
        note,
        totalCost: parsedCost,
        afterStoragePath: uploadedPath || undefined,
      })
      toast.success('ปิดงานเรียบร้อยแล้ว')
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
      toast.error('ปิดงานไม่สำเร็จ', {
        description: submitError instanceof Error ? submitError.message : 'กรุณาลองอีกครั้ง',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) return <DataLoading label="กำลังตรวจรายการที่รอปิดงาน…" />
  if (error) return <DataError message={error} onRetry={refresh} />

  return (
    <>
      <div>
        <p className="text-sm font-semibold text-teal-600">Completion inbox</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">รายการรอปิดงาน</h1>
        <p className="mt-1 text-sm text-slate-500">รายการที่ฝ่ายจัดซื้อรับดำเนินการแล้วและรอผู้มีสิทธิ์ปิดงาน</p>
      </div>

      <div className="mt-6 grid gap-4">
        {completableRequests.map((request) => (
          <Card key={request.id} className="group overflow-hidden transition hover:border-teal-200 hover:shadow-md">
            <button onClick={() => setSelectedRequest(request)} className="flex w-full items-start gap-4 p-4 text-left sm:p-5">
              <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-teal-50 text-teal-600 ring-1 ring-inset ring-teal-600/10">
                <Flag className="size-6" />
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
              <ChevronRight className="mt-3 size-5 shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-teal-600" />
            </button>
          </Card>
        ))}
        {completableRequests.length === 0 && (
          <DataEmpty title="ไม่มีรายการรอปิดงาน" description="ขณะนี้ไม่มี Job ที่ฝ่ายจัดซื้อรับดำเนินการแล้วและรอสิทธิ์ของคุณปิดงาน" />
        )}
      </div>

      <Modal
        open={Boolean(selectedRequest)}
        onOpenChange={(open) => !open && closeModal()}
        title="ปิดงานซ่อม"
        description={selectedRequest ? `${selectedRequest.jobId} · ${selectedRequest.machineId}` : undefined}
        footer={
          <Button className="w-full" variant="success" disabled={isSubmitting} onClick={() => void completeRequest()}>
            <Flag className="size-4" /> ยืนยันปิดงาน
          </Button>
        }
      >
        {selectedRequest && (
          <div className="space-y-6">
            <RequestDetails request={selectedRequest} />
            <div className="grid gap-4 rounded-2xl border border-teal-100 bg-teal-50/50 p-4 sm:grid-cols-2">
              <div>
                <label htmlFor="completion-total-cost" className="mb-2 block text-sm font-bold text-slate-700">ค่าใช้จ่ายทั้งหมด <span className="text-red-500">*</span></label>
                <input id="completion-total-cost" type="number" min="0" step="0.01" value={totalCost} onChange={(event) => setTotalCost(event.target.value)} className="form-control" placeholder="หากไม่มีค่าใช้จ่ายให้ใส่ 0" />
              </div>
              <div>
                <p className="mb-2 text-sm font-bold text-slate-700">รูปหลังซ่อม</p>
                <label htmlFor="completion-after-image" className="flex min-h-32 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-teal-200 bg-white text-center transition hover:border-teal-400 hover:bg-teal-50/50">
                  {afterImagePreviewUrl ? (
                    <div className="relative w-full">
                      <img src={afterImagePreviewUrl} alt="ตัวอย่างรูปหลังซ่อม" className="h-44 w-full bg-slate-100 object-contain" />
                      <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-slate-950/70 px-3 py-2 text-xs font-bold text-white">
                        <Camera className="size-4" /> แตะเพื่อเปลี่ยนรูป
                      </span>
                    </div>
                  ) : (
                    <span className="flex flex-col items-center px-3 py-4">
                      <Camera className="size-7 text-teal-600" />
                      <span className="mt-2 text-sm font-bold text-slate-700">ถ่ายรูปหรือเลือกรูปภาพ</span>
                      <span className="mt-1 text-xs text-slate-500">JPG, PNG หรือ WebP</span>
                    </span>
                  )}
                </label>
                <input id="completion-after-image" aria-label="รูปหลังซ่อม" type="file" accept="image/jpeg,image/png,image/webp" onChange={selectAfterImage} className="sr-only" />
                {afterImage && <p className="mt-2 truncate text-xs font-semibold text-teal-700">เลือกแล้ว: {afterImage.name}</p>}
              </div>
            </div>
            <div>
              <label htmlFor="completion-note" className="mb-2 block text-sm font-bold text-slate-700">หมายเหตุการปิดงาน <span className="text-red-500">*</span></label>
              <textarea id="completion-note" rows={5} value={note} onChange={(event) => setNote(event.target.value)} placeholder="เช่น ซ่อมเสร็จแล้ว หรือเปลี่ยนอะไหล่เรียบร้อย" className="form-control min-h-32 resize-y py-3" />
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
