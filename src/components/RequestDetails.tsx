import { ImageIcon } from 'lucide-react'
import { formatCurrency, formatThaiDate } from '../lib/utils'
import { repairActionLabels } from '../lib/repairService'
import type { RepairRequest } from '../types/repair'
import { PrivateRepairImage } from './PrivateRepairImage'
import { StatusBadge } from './ui/StatusBadge'

export function RequestDetails({ request }: { request: RepairRequest }) {
  return (
    <div className="space-y-5 text-sm">
      <StatusBadge status={request.status} />

      <div className="grid gap-4 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2">
        <div><p className="text-xs font-semibold text-slate-500">ผู้แจ้ง</p><p className="mt-1 font-bold text-slate-900">{request.requesterName}</p></div>
        <div><p className="text-xs font-semibold text-slate-500">แผนก</p><p className="mt-1 font-bold text-slate-900">{request.department}</p></div>
        <div><p className="text-xs font-semibold text-slate-500">วันที่แจ้ง</p><p className="mt-1 text-slate-700">{formatThaiDate(request.createdAt)}</p></div>
        <div><p className="text-xs font-semibold text-slate-500">ค่าใช้จ่าย</p><p className="mt-1 text-slate-700">{formatCurrency(request.totalCost)}</p></div>
      </div>

      <div>
        <p className="font-semibold text-slate-500">รายละเอียดปัญหา</p>
        <p className="mt-2 whitespace-pre-wrap leading-7 text-slate-700">{request.issueDetails}</p>
      </div>

      {request.attachments.length > 0 && (
        <div>
          <p className="flex items-center gap-2 font-semibold text-slate-500"><ImageIcon className="size-4" /> รูปภาพประกอบ</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {request.attachments.map((attachment) => (
              <figure key={attachment.id}>
                <PrivateRepairImage
                  storagePath={attachment.storagePath}
                  legacyDriveUrl={attachment.legacyDriveUrl}
                  alt={`${attachment.kind === 'before' ? 'รูปก่อนซ่อม' : 'รูปหลังซ่อม'} ${request.jobId}`}
                />
                <figcaption className="mt-1.5 text-center text-xs font-semibold text-slate-500">
                  {attachment.kind === 'before' ? 'ก่อนซ่อม' : 'หลังซ่อม'}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="font-semibold text-slate-500">ลำดับการดำเนินการ</p>
        <div className="mt-3 space-y-4 border-l-2 border-teal-200 pl-4">
          {request.actions.map((action) => (
            <div key={action.id}>
              <p className="font-semibold text-slate-800">{repairActionLabels[action.action]}</p>
              <p className="mt-0.5 text-xs text-slate-500">{action.actorName} · {formatThaiDate(action.createdAt)}</p>
              {action.note && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{action.note}</p>}
            </div>
          ))}
          {request.actions.length === 0 && <p className="text-xs text-slate-500">ยังไม่มีประวัติการดำเนินการ</p>}
        </div>
      </div>
    </div>
  )
}
