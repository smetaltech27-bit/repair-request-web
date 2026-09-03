import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
}

export function Modal({ open, onOpenChange, title, description, children, footer }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-sm" />
        <div className="modal-positioner fixed inset-0 z-50 flex items-start justify-center overflow-hidden px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:items-center sm:p-6">
          <Dialog.Content className="modal-panel flex max-h-[calc(100svh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/60 bg-white shadow-2xl shadow-slate-950/25 focus:outline-none sm:max-h-[calc(100svh-3rem)]">
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <Dialog.Title className="text-lg font-bold text-slate-950">{title}</Dialog.Title>
                {description && (
                  <Dialog.Description className="mt-1 text-sm text-slate-500">{description}</Dialog.Description>
                )}
              </div>
              <Dialog.Close className="grid size-10 shrink-0 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">
                <X className="size-5" />
                <span className="sr-only">ปิด</span>
              </Dialog.Close>
            </header>
            <div className="modal-body min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>
            {footer && <footer className="shrink-0 border-t border-slate-100 bg-white px-5 py-4">{footer}</footer>}
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
