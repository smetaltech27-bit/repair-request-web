import { clsx, type ClassValue } from 'clsx'
import { format, formatDistanceToNow } from 'date-fns'
import { th } from 'date-fns/locale'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatThaiDate(value: string | Date) {
  return format(new Date(value), 'd MMM yyyy HH:mm', { locale: th })
}

export function timeAgo(value: string | Date) {
  return formatDistanceToNow(new Date(value), { addSuffix: true, locale: th })
}

export function formatCurrency(value?: number) {
  if (value === undefined) return '—'
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 2,
  }).format(value)
}
