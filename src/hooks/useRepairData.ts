import { useCallback, useEffect, useState } from 'react'
import { listDepartments, listRepairRequests } from '../lib/repairService'
import type { RepairDepartment, RepairRequest } from '../types/repair'

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'ไม่สามารถโหลดข้อมูลได้'
}

export function useRepairRequests() {
  const [requests, setRequests] = useState<RepairRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      setRequests(await listRepairRequests())
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void refresh(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [refresh])

  return { requests, isLoading, error, refresh }
}

export function useDepartments() {
  const [departments, setDepartments] = useState<RepairDepartment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    listDepartments()
      .then((items) => active && setDepartments(items))
      .catch((loadError) => active && setError(errorMessage(loadError)))
      .finally(() => active && setIsLoading(false))
    return () => {
      active = false
    }
  }, [])

  return { departments, isLoading, error }
}
