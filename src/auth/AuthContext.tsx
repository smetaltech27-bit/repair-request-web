import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AppUser, UserRoleCode } from '../types/repair'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { legacyPasswordToAuthPassword, legacyUsernameToAuthEmail } from './authIdentity'

interface AuthContextValue {
  user: AppUser | null
  isDemoMode: boolean
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)
const STORAGE_KEY = 'repair-request-demo-user'

interface ProfileQueryRow {
  id: string
  legacy_username: string
  full_name: string
  role: string
  department_id: string | null
  repair_departments: { id: string; name: string } | { id: string; name: string }[] | null
}

function getStoredUser(): AppUser | null {
  const stored = sessionStorage.getItem(STORAGE_KEY)
  if (!stored) return null
  try {
    return JSON.parse(stored) as AppUser
  } catch {
    sessionStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(() => (import.meta.env.DEV ? getStoredUser() : null))
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured)
  const isDemoMode = !isSupabaseConfigured && import.meta.env.DEV

  const loadProfile = useCallback(async (authUserId: string) => {
    if (!supabase) return null
    const { data, error } = await supabase
      .from('repair_profiles')
      .select('id, legacy_username, full_name, role, department_id, repair_departments(id, name)')
      .eq('id', authUserId)
      .eq('is_active', true)
      .single()
    if (error) throw error

    const profile = data as unknown as ProfileQueryRow
    const roleLabels: Record<string, AppUser['role']> = {
      employee: 'พนักงาน',
      supervisor: 'หัวหน้างาน',
      department_manager: 'ผู้จัดการฝ่าย',
      factory_manager: 'ผู้จัดการโรงงาน',
      purchasing: 'จัดซื้อ',
    }
    const department = Array.isArray(profile.repair_departments)
      ? profile.repair_departments[0]?.name
      : profile.repair_departments?.name
    return {
      id: profile.id,
      username: profile.legacy_username,
      fullName: profile.full_name,
      role: roleLabels[profile.role] ?? 'พนักงาน',
      roleCode: profile.role as UserRoleCode,
      department: department ?? '-',
      departmentId: profile.department_id ?? undefined,
    } satisfies AppUser
  }, [])

  useEffect(() => {
    if (!supabase) return

    let active = true
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        try {
          const profile = data.session?.user ? await loadProfile(data.session.user.id) : null
          if (active) setUser(profile)
        } catch {
          if (active) setUser(null)
        } finally {
          if (active) setIsLoading(false)
        }
      })
      .catch(() => {
        if (active) {
          setUser(null)
          setIsLoading(false)
        }
      })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(async () => {
        try {
          const profile = session?.user ? await loadProfile(session.user.id) : null
          if (active) setUser(profile)
        } catch {
          if (active) setUser(null)
        }
      }, 0)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [loadProfile])

  const login = useCallback(async (username: string, password: string) => {
    if (!username.trim() || !password) throw new Error('กรุณากรอก Username และ Password')

    if (!isDemoMode) {
      if (!supabase) throw new Error('ระบบ Authentication ยังไม่ได้เชื่อมต่อ Supabase')
      const email = await legacyUsernameToAuthEmail(username)
      const authPassword = await legacyPasswordToAuthPassword(password)
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: authPassword })
      if (error) throw new Error('Username หรือ Password ไม่ถูกต้อง')
      const profile = await loadProfile(data.user.id)
      if (!profile) throw new Error('ไม่พบข้อมูลผู้ใช้งาน')
      setUser(profile)
      return
    }

    const demoUser: AppUser = {
      id: 'demo-user',
      username: username.trim(),
      fullName: 'สมชาย ใจดี',
      role: 'หัวหน้างาน',
      roleCode: 'supervisor',
      department: 'Machine',
      departmentId: 'demo-department',
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(demoUser))
    setUser(demoUser)
  }, [isDemoMode, loadProfile])

  const logout = useCallback(async () => {
    sessionStorage.removeItem(STORAGE_KEY)
    if (supabase) await supabase.auth.signOut()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, isDemoMode, isLoading, login, logout }),
    [user, isDemoMode, isLoading, login, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
