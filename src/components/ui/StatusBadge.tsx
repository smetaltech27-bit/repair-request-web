import type { RepairStatus } from '../../types/repair'
import { cn } from '../../lib/utils'

const statusStyles: Record<RepairStatus, string> = {
  'รอหัวหน้างานอนุมัติ': 'bg-amber-50 text-amber-700 ring-amber-600/15',
  'รอผู้จัดการฝ่ายอนุมัติ': 'bg-orange-50 text-orange-700 ring-orange-600/15',
  'รอผู้จัดการโรงงานอนุมัติ': 'bg-violet-50 text-violet-700 ring-violet-600/15',
  'รอจัดซื้อดำเนินการ': 'bg-sky-50 text-sky-700 ring-sky-600/15',
  'กำลังดำเนินการจัดซื้อ': 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  'ซ่อมเสร็จเรียบร้อย (ปิดงาน)': 'bg-teal-50 text-teal-700 ring-teal-600/15',
  'ไม่อนุมัติ (ตีกลับ)': 'bg-red-50 text-red-700 ring-red-600/15',
}

const shortLabels: Record<RepairStatus, string> = {
  'รอหัวหน้างานอนุมัติ': 'รอหัวหน้างาน',
  'รอผู้จัดการฝ่ายอนุมัติ': 'รอผู้จัดการฝ่าย',
  'รอผู้จัดการโรงงานอนุมัติ': 'รอผู้จัดการโรงงาน',
  'รอจัดซื้อดำเนินการ': 'รอจัดซื้อ',
  'กำลังดำเนินการจัดซื้อ': 'กำลังดำเนินการ',
  'ซ่อมเสร็จเรียบร้อย (ปิดงาน)': 'ปิดงานแล้ว',
  'ไม่อนุมัติ (ตีกลับ)': 'ตีกลับ',
}

export function StatusBadge({ status, className }: { status: RepairStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
        statusStyles[status],
        className,
      )}
    >
      {shortLabels[status]}
    </span>
  )
}
