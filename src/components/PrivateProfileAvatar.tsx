import { useEffect, useState } from 'react'
import { downloadProfileAvatar } from '../lib/repairService'
import { cn } from '../lib/utils'

interface PrivateProfileAvatarProps {
  avatarPath?: string
  fullName?: string
  className?: string
  fallbackClassName?: string
}

export function PrivateProfileAvatar({
  avatarPath,
  fullName,
  className,
  fallbackClassName,
}: PrivateProfileAvatarProps) {
  const [loadedAvatar, setLoadedAvatar] = useState({ path: '', objectUrl: '' })

  useEffect(() => {
    if (!avatarPath) return

    let active = true
    let url = ''
    downloadProfileAvatar(avatarPath)
      .then((blob) => {
        if (!active) return
        url = URL.createObjectURL(blob)
        setLoadedAvatar({ path: avatarPath, objectUrl: url })
      })
      .catch(() => active && setLoadedAvatar({ path: avatarPath, objectUrl: '' }))

    return () => {
      active = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [avatarPath])

  const objectUrl = loadedAvatar.path === avatarPath ? loadedAvatar.objectUrl : ''
  const fallback = fullName?.trim().charAt(0) || '?'

  return (
    <div
      aria-label={objectUrl ? undefined : `รูปโปรไฟล์ ${fullName || 'ผู้ใช้งาน'}`}
      className={cn('relative grid shrink-0 place-items-center overflow-hidden', fallbackClassName, className)}
    >
      {objectUrl ? (
        <img
          src={objectUrl}
          alt={`รูปโปรไฟล์ ${fullName || 'ผู้ใช้งาน'}`}
          className="size-full object-cover"
        />
      ) : (
        fallback
      )}
    </div>
  )
}
