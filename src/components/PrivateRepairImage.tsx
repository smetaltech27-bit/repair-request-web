import { ExternalLink, ImageOff, LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { downloadRepairImage } from '../lib/repairService'

interface PrivateRepairImageProps {
  storagePath?: string
  legacyDriveUrl?: string
  alt: string
}

export function PrivateRepairImage({ storagePath, legacyDriveUrl, alt }: PrivateRepairImageProps) {
  const [objectUrl, setObjectUrl] = useState('')
  const [isLoading, setIsLoading] = useState(Boolean(storagePath))
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    if (!storagePath) return
    let active = true
    let url = ''
    downloadRepairImage(storagePath)
      .then((blob) => {
        if (!active) return
        url = URL.createObjectURL(blob)
        setObjectUrl(url)
      })
      .catch(() => active && setHasError(true))
      .finally(() => active && setIsLoading(false))
    return () => {
      active = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [storagePath])

  if (isLoading) {
    return (
      <div className="grid aspect-[4/3] place-items-center rounded-2xl bg-slate-100">
        <LoaderCircle className="size-7 animate-spin text-teal-600" />
      </div>
    )
  }

  if (objectUrl) {
    return (
      <img
        src={objectUrl}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="aspect-[4/3] w-full rounded-2xl bg-slate-100 object-contain"
      />
    )
  }

  return (
    <div className="grid aspect-[4/3] place-items-center rounded-2xl bg-slate-100 p-4 text-center">
      <div>
        <ImageOff className="mx-auto size-7 text-slate-400" />
        <p className="mt-2 text-xs text-slate-500">{hasError ? 'ไม่สามารถโหลดรูปจากพื้นที่ส่วนตัวได้' : 'ยังไม่มีไฟล์รูปในระบบใหม่'}</p>
        {legacyDriveUrl && (
          <a
            href={legacyDriveUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-teal-700 hover:underline"
          >
            เปิดลิงก์สำรอง <ExternalLink className="size-3" />
          </a>
        )}
      </div>
    </div>
  )
}
