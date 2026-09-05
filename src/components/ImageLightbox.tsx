import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

interface ImageLightboxProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  src: string
  alt: string
}

export function ImageLightbox({ open, onOpenChange, src, alt }: ImageLightboxProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-slate-950/85 backdrop-blur-sm" />
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-hidden px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:items-center sm:p-6">
          <Dialog.Content className="flex h-[calc(100svh-2rem)] max-h-[calc(100svh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/20 bg-slate-950 shadow-2xl shadow-slate-950/50 focus:outline-none sm:h-[calc(100svh-3rem)] sm:max-h-[calc(100svh-3rem)]">
            <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <Dialog.Title className="font-bold text-white">ดูรูปขนาดใหญ่</Dialog.Title>
                <Dialog.Description className="mt-0.5 truncate text-xs text-slate-300 sm:text-sm">
                  {alt}
                </Dialog.Description>
              </div>
              <Dialog.Close
                aria-label="ปิดรูปขนาดใหญ่"
                className="grid size-10 shrink-0 place-items-center rounded-xl text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-400/30"
              >
                <X className="size-5" aria-hidden="true" />
              </Dialog.Close>
            </header>
            <div className="min-h-0 flex-1 overflow-auto overscroll-contain p-2 sm:p-4">
              <img
                src={src}
                alt={alt}
                className="h-full w-full object-contain"
              />
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
