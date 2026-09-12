import { ImageIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNotificationRead } from '../lib/NotificationReadContext'
import { cn, formatCurrency, formatThaiDate } from '../lib/utils'
import { repairActionLabels } from '../lib/repairService'
import type { LegacyRepairActionMetadata, RepairRequest } from '../types/repair'
import { ImageLightbox } from './ImageLightbox'
import { PrivateRepairImage } from './PrivateRepairImage'
import { StatusBadge } from './ui/StatusBadge'

function legacyHistoryItems(metadata: LegacyRepairActionMetadata, factoryManagerAt?: string) {
  return [
    { label: 'หัวหน้างาน', actor: metadata.supervisorInfo, note: metadata.supervisorNote },
    { label: 'ผู้จัดการฝ่าย', actor: metadata.departmentManagerInfo, note: metadata.departmentManagerNote },
    { label: 'ผู้จัดการโรงงาน', actor: metadata.factoryManagerInfo, note: metadata.factoryManagerNote, createdAt: factoryManagerAt },
    { label: 'จัดซื้อ', actor: metadata.purchasingInfo, note: metadata.purchasingNote },
    { label: 'ปิดงาน', actor: undefined, note: metadata.completionDetail },
  ].filter((item) => item.actor || item.note)
}

export function RequestDetails({
  request,
  desktopReadable = false,
  enableImagePreview = false,
}: {
  request: RepairRequest
  desktopReadable?: boolean
  enableImagePreview?: boolean
}) {
  const markRequestRead = useNotificationRead()
  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null)

  useEffect(() => {
    markRequestRead(request.id)
  }, [markRequestRead, request.id])

  return (
    <>
      <div className={cn('space-y-6 text-base', desktopReadable && 'lg:space-y-7')}>
        <StatusBadge
          status={request.status}
          className="px-3 py-1.5 text-sm"
        />

      <div className={cn('grid gap-5 rounded-2xl bg-slate-50 p-5 sm:grid-cols-2', desktopReadable && 'lg:p-6')}>
        <div><p className="text-sm font-bold text-slate-600">ผู้แจ้ง</p><p className="mt-1 text-base font-bold text-slate-950">{request.requesterName}</p></div>
        <div><p className="text-sm font-bold text-slate-600">แผนก</p><p className="mt-1 text-base font-bold text-slate-950">{request.department}</p></div>
        <div><p className="text-sm font-bold text-slate-600">วันที่แจ้ง</p><p className="mt-1 text-base text-slate-800">{formatThaiDate(request.createdAt)}</p></div>
        <div><p className="text-sm font-bold text-slate-600">ค่าใช้จ่าย</p><p className="mt-1 text-base text-slate-800">{formatCurrency(request.totalCost)}</p></div>
      </div>

      <div>
        <p className="text-base font-bold text-slate-600">รายละเอียดปัญหา</p>
        <p className="mt-2 whitespace-pre-wrap text-base leading-7 text-slate-800">{request.issueDetails}</p>
      </div>

      {request.attachments.length > 0 && (
        <div>
          <p className="flex items-center gap-2 text-base font-bold text-slate-600"><ImageIcon className="size-5" /> รูปภาพประกอบ</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {request.attachments.map((attachment) => {
              const alt = `${attachment.kind === 'before' ? 'รูปก่อนซ่อม' : 'รูปหลังซ่อม'} ${request.jobId}`
              return (
                <figure key={attachment.id}>
                  <PrivateRepairImage
                    storagePath={attachment.storagePath}
                    legacyDriveUrl={attachment.legacyDriveUrl}
                    alt={alt}
                    onPreview={enableImagePreview ? (src) => setPreviewImage({ src, alt }) : undefined}
                  />
                  <figcaption className="mt-2 text-center text-sm font-semibold text-slate-600">
                    {attachment.kind === 'before' ? 'ก่อนซ่อม' : 'หลังซ่อม'}
                  </figcaption>
                </figure>
              )
            })}
          </div>
        </div>
      )}

      <div>
        <p className="text-base font-bold text-slate-600">ลำดับการดำเนินการ</p>
        <div className="mt-3 space-y-5 border-l-2 border-teal-200 pl-4">
          {request.actions.map((action) => {
            const importedHistory = action.legacyMetadata
              ? legacyHistoryItems(action.legacyMetadata, request.approvedAt)
              : []
            const isLegacyImport = action.action === 'import'

            return (
              <div key={action.id}>
                <p className="text-base font-bold text-slate-900">
                  {isLegacyImport ? 'ผู้แจ้ง' : repairActionLabels[action.action]}
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {isLegacyImport ? request.requesterName : action.actorName} · {formatThaiDate(isLegacyImport ? request.createdAt : action.createdAt)}
                </p>
                {!isLegacyImport && action.note && <p className="mt-1 whitespace-pre-wrap text-base leading-7 text-slate-700">{action.note}</p>}
                {importedHistory.length > 0 && (
                  <div className="mt-3 space-y-4 rounded-xl bg-slate-50 p-4">
                    <p className="text-sm font-bold text-teal-700">ความคิดเห็นจากประวัติเดิม</p>
                    {importedHistory.map((item) => (
                      <div key={item.label}>
                        <p className="text-sm font-bold text-slate-800">{item.label}</p>
                        {item.actor && (
                          <p className="mt-1 text-sm leading-6 text-slate-600">
                            {item.actor}{item.createdAt ? ` · ${formatThaiDate(item.createdAt)}` : ''}
                          </p>
                        )}
                        {item.note && <p className="mt-1 whitespace-pre-wrap text-base leading-7 text-slate-800">{item.note}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          {request.actions.length === 0 && <p className="text-sm text-slate-600">ยังไม่มีประวัติการดำเนินการ</p>}
        </div>
        </div>
      </div>
      {previewImage && (
        <ImageLightbox
          open
          onOpenChange={(open) => !open && setPreviewImage(null)}
          src={previewImage.src}
          alt={previewImage.alt}
        />
      )}
    </>
  )
}
