import { createContext, useContext } from 'react'

export const NotificationReadContext = createContext<(requestId: string) => void>(() => undefined)

export function useNotificationRead() {
  return useContext(NotificationReadContext)
}
