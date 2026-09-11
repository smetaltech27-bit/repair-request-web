import { ImageIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNotificationRead } from '../lib/NotificationReadContext'
import { cn, formatCurrency, formatThaiDate } from '../lib/utils'
import { repairActionLabels } from '../lib/repairService'
import type { LegacyRepairActionMetadata, RepairRequest } from '../types/repair'
import { ImageLightbox } from './ImageLightbox'
import { PrivateRepairImage } from './PrivateRepairImage'
import { StatusBadge } from './ui/StatusBadge'

function legacyHistoryItems(metadata: LegacyRepairActionMetadata) {
  return [
    { label: 'หัวหน้างาน', actor: metadata.supervisorInfo, note: metadata.supervisorNote },
    { label: 'ผู้จัดการฝ่าย', actor: metadata.departmentManagerInfo, note: metadata.departmentManagerNote },
    { label: 'ผู้จัดการโรงงาน', actor: metadata.factoryManagerInfo, note: metadata.factoryManagerNote },
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
      <div className={cn('space-y-5 text-sm', desktopReadable && 'lg:space-y-6 lg:text-base')}>
        <StatusBadge
          status={request.status}
          className={desktopReadable ? 'lg:px-3 lg:py-1.5 lg:text-sm' : undefined}
        />

      <div className={cn('grid gap-4 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2', desktopReadable && 'lg:gap-5 lg:p-5')}>
        <div><p className={cn('text-xs font-semibold text-slate-500', desktopReadable && 'lg:text-sm')}>ผู้แจ้ง</p><p className="mt-1 font-bold text-slate-900">{request.requesterName}</p></div>
        <div><p className={cn('text-xs font-semibold text-slate-500', desktopReadable && 'lg:text-sm')}>แผนก</p><p className="mt-1 font-bold text-slate-900">{request.department}</p></div>
        <div><p className={cn('text-xs font-semibold text-slate-500', desktopReadable && 'lg:text-sm')}>วันที่แจ้ง</p><p className="mt-1 text-slate-700">{formatThaiDate(request.createdAt)}</p></div>
        <div><p className={cn('text-xs font-semibold text-slate-500', desktopReadable && 'lg:text-sm')}>ค่าใช้จ่าย</p><p className="mt-1 text-slate-700">{formatCurrency(request.totalCost)}</p></div>
      </div>

      <div>
        <p className={cn('font-semibold text-slate-500', desktopReadable && 'lg:text-base')}>รายละเอียดปัญหา</p>
        <p className={cn('mt-2 whitespace-pre-wrap leading-7 text-slate-700', desktopReadable && 'lg:text-base lg:leading-8')}>{request.issueDetails}</p>
      </div>

      {request.attachments.length > 0 && (
        <div>
          <p className={cn('flex items-center gap-2 font-semibold text-slate-500', desktopReadable && 'lg:text-base')}><ImageIcon className={cn('size-4', desktopReadable && 'lg:size-5')} /> รูปภาพประกอบ</p>
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
                  <figcaption className={cn('mt-1.5 text-center text-xs font-semibold text-slate-500', desktopReadable && 'lg:text-sm')}>
                    {attachment.kind === 'before' ? 'ก่อนซ่อม' : 'หลังซ่อม'}
                  </figcaption>
                </figure>
              )
            })}
          </div>
        </div>
      )}

      <div>
        <p className={cn('font-semibold text-slate-500', desktopReadable && 'lg:text-base')}>ลำดับการดำเนินการ</p>
        <div className="mt-3 space-y-4 border-l-2 border-teal-200 pl-4">
          {request.actions.map((action) => {
            const importedHistory = action.legacyMetadata ? legacyHistoryItems(action.legacyMetadata) : []

            return (
              <div key={action.id}>
                <p className={cn('font-semibold text-slate-800', desktopReadable && 'lg:text-base')}>{repairActionLabels[action.action]}</p>
                <p className={cn('mt-0.5 text-xs text-slate-500', desktopReadable && 'lg:text-sm')}>{action.actorName} · {formatThaiDate(action.createdAt)}</p>
                {action.note && <p className={cn('mt-1 whitespace-pre-wrap text-sm text-slate-600', desktopReadable && 'lg:text-base')}>{action.note}</p>}
                {importedHistory.length > 0 && (
                  <div className={cn('mt-3 space-y-3 rounded-xl bg-slate-50 p-3', desktopReadable && 'lg:p-4')}>
                    <p className={cn('text-xs font-bold text-teal-700', desktopReadable && 'lg:text-sm')}>ความคิดเห็นจากประวัติเดิม</p>
                    {importedHistory.map((item) => (
                      <div key={item.label}>
                        <p className={cn('text-xs font-bold text-slate-700', desktopReadable && 'lg:text-sm')}>{item.label}</p>
                        {item.actor && <p className={cn('mt-0.5 text-xs text-slate-500', desktopReadable && 'lg:text-sm')}>{item.actor}</p>}
                        {item.note && <p className={cn('mt-1 whitespace-pre-wrap text-sm text-slate-700', desktopReadable && 'lg:text-base')}>{item.note}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          {request.actions.length === 0 && <p className={cn('text-xs text-slate-500', desktopReadable && 'lg:text-sm')}>ยังไม่มีประวัติการดำเนินการ</p>}
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
