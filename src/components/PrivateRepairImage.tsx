import { ExternalLink, ImageOff, LoaderCircle, Maximize2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { downloadRepairImage } from '../lib/repairService'

interface PrivateRepairImageProps {
  storagePath?: string
  legacyDriveUrl?: string
  alt: string
  onPreview?: (src: string) => void
}

export function PrivateRepairImage({ storagePath, legacyDriveUrl, alt, onPreview }: PrivateRepairImageProps) {
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
    const image = (
      <img
        src={objectUrl}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="aspect-[4/3] w-full rounded-2xl bg-slate-100 object-contain"
      />
    )

    if (onPreview) {
      return (
        <button
          type="button"
          aria-label={`ดูรูปขนาดใหญ่ ${alt}`}
          onClick={() => onPreview(objectUrl)}
          className="group relative block w-full cursor-zoom-in rounded-2xl text-left outline-none transition focus-visible:ring-4 focus-visible:ring-teal-500/30"
        >
          {image}
          <span className="absolute right-2 top-2 grid size-9 place-items-center rounded-xl bg-slate-950/70 text-white shadow-lg backdrop-blur-sm transition group-hover:scale-105 group-hover:bg-teal-600">
            <Maximize2 className="size-4" aria-hidden="true" />
          </span>
        </button>
      )
    }

    return image
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
