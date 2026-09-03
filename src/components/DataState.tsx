import { AlertCircle, Inbox, LoaderCircle, RotateCw } from 'lucide-react'
import { Button } from './ui/Button'
import { Card } from './ui/Card'

export function DataLoading({ label = 'กำลังโหลดข้อมูล…' }: { label?: string }) {
  return (
    <Card className="p-10 text-center">
      <LoaderCircle className="mx-auto size-9 animate-spin text-teal-600" />
      <p className="mt-3 text-sm font-medium text-slate-500">{label}</p>
    </Card>
  )
}

export function DataError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="border-red-200 bg-red-50/50 p-8 text-center">
      <AlertCircle className="mx-auto size-9 text-red-500" />
      <h2 className="mt-3 font-bold text-red-900">โหลดข้อมูลไม่สำเร็จ</h2>
      <p className="mt-1 text-sm text-red-700">{message}</p>
      <Button variant="secondary" className="mt-4" onClick={onRetry}>
        <RotateCw className="size-4" /> ลองอีกครั้ง
      </Button>
    </Card>
  )
}

export function DataEmpty({ title, description }: { title: string; description: string }) {
  return (
    <Card className="p-10 text-center">
      <Inbox className="mx-auto size-10 text-slate-300" />
      <h2 className="mt-3 font-bold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </Card>
  )
}
