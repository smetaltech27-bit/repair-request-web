import {
  Bell,
  BellOff,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Gauge,
  Flag,
  LogOut,
  LoaderCircle,
  Menu,
  Plus,
  Settings2,
  UserRound,
  Wrench,
  X,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getUnreadNotificationCount, listNotifications, markNotificationRead } from '../lib/repairService'
import { cn, timeAgo } from '../lib/utils'
import type { RepairNotification } from '../types/repair'
import { PrivateProfileAvatar } from './PrivateProfileAvatar'
import { Button } from './ui/Button'

const desktopNavigation = [
  { label: 'แดชบอร์ด', to: '/', icon: Gauge },
  { label: 'แจ้งซ่อมใหม่', to: '/requests/new', icon: Plus },
  { label: 'รายการงาน', to: '/requests', icon: ClipboardList },
  { label: 'รออนุมัติ', to: '/approvals', icon: ClipboardCheck },
  { label: 'ปิดงาน', to: '/completion', icon: Flag },
  { label: 'ปิดงานแล้ว', to: '/requests?status=completed', icon: CheckCircle2 },
  { label: 'ตั้งค่า', to: '/settings', icon: Settings2 },
]

const mobileNavigation = [
  { label: 'หน้าหลัก', to: '/', icon: Gauge },
  { label: 'งานของฉัน', to: '/requests', icon: ClipboardList },
  { label: 'แจ้งซ่อม', to: '/requests/new', icon: Plus, primary: true },
  { label: 'อนุมัติ', to: '/approvals', icon: ClipboardCheck },
  { label: 'ปิดงาน', to: '/completion', icon: Flag },
  { label: 'โปรไฟล์', to: '/profile', icon: UserRound },
]

export function AppShell({ children }: { children: ReactNode }) {
  const { user, isDemoMode, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [notifications, setNotifications] = useState<RepairNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const canAccessCompletion = Boolean(user && user.roleCode !== 'employee')
  const visibleDesktopNavigation = desktopNavigation.filter(({ to }) => to !== '/completion' || canAccessCompletion)
  const visibleMobileNavigation = mobileNavigation.filter(({ to }) => to !== '/completion' || canAccessCompletion)

  useEffect(() => {
    if (!user || isDemoMode) return
    let active = true
    Promise.all([listNotifications(), getUnreadNotificationCount()])
      .then(([items, count]) => {
        if (!active) return
        setNotifications(items)
        setUnreadCount(count)
      })
      .catch(() => {
        if (active) setNotifications([])
      })
      .finally(() => active && setNotificationsLoading(false))
    return () => {
      active = false
    }
  }, [isDemoMode, location.pathname, user])

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  async function handleNotification(notification: RepairNotification) {
    if (!notification.readAt) {
      try {
        await markNotificationRead(notification.id)
        setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item))
        setUnreadCount((count) => Math.max(0, count - 1))
      } catch {
        // Navigation is still useful if the read receipt cannot be saved.
      }
    }
    setNotificationOpen(false)
    navigate('/requests')
  }

  return (
    <div className="min-h-svh bg-slate-50 text-slate-900">
      {sidebarOpen && (
        <button
          aria-label="ปิดเมนู"
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-slate-950 text-white shadow-2xl transition-transform duration-300 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-20 shrink-0 items-center justify-between border-b border-white/10 px-6">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-teal-500 text-white shadow-lg shadow-teal-500/25">
              <Wrench className="size-6" />
            </div>
            <div>
              <p className="text-base font-bold leading-tight">Repair Request</p>
              <p className="text-xs text-slate-400">Maintenance Center</p>
            </div>
          </div>
          <button
            aria-label="ปิดเมนู"
            className="grid size-10 place-items-center rounded-xl text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-6">
          <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">เมนูหลัก</p>
          {visibleDesktopNavigation.map(({ label, to, icon: Icon }) => (
            <NavLink
              key={label}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-300 transition',
                  isActive
                    ? 'bg-teal-500/15 text-teal-300 ring-1 ring-inset ring-teal-400/10'
                    : 'hover:bg-white/5 hover:text-white',
                )
              }
            >
              <Icon className="size-5 shrink-0" />
              <span className="flex-1">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="rounded-2xl bg-white/5 p-3">
            <p className="truncate text-sm font-semibold">{user?.fullName}</p>
            <p className="mt-0.5 truncate text-xs text-slate-400">
              {user?.role} · {user?.department}
            </p>
            <button
              onClick={handleLogout}
              className="mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white"
            >
              <LogOut className="size-4" /> ออกจากระบบ
            </button>
          </div>
        </div>
      </aside>

      <div className="min-h-svh lg:pl-72">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-xl sm:px-6 lg:h-20 lg:px-8">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              aria-label="เปิดเมนู"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="size-5" />
            </Button>
            {isDemoMode && (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 ring-1 ring-inset ring-amber-600/15">
                DEMO MODE
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative">
              <button
                aria-label={`การแจ้งเตือนที่ยังไม่อ่าน ${unreadCount} รายการ`}
                aria-expanded={notificationOpen}
                onClick={() => setNotificationOpen((open) => !open)}
                className="relative grid size-10 place-items-center rounded-xl text-slate-600 transition hover:bg-slate-100"
              >
                <Bell className="size-5" />
                {unreadCount > 0 && (
                  <span className="absolute right-0.5 top-0.5 grid min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
              {notificationOpen && (
                <div className="fixed left-3 right-3 top-16 z-50 max-h-[min(28rem,calc(100svh-5rem))] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-96">
                  <div className="flex items-center justify-between px-3 py-2">
                    <p className="font-bold text-slate-900">การแจ้งเตือน</p>
                    <span className="text-xs font-semibold text-slate-500">ยังไม่อ่าน {unreadCount}</span>
                  </div>
                  {notificationsLoading ? (
                    <div className="grid place-items-center py-8"><LoaderCircle className="size-6 animate-spin text-teal-600" /></div>
                  ) : notifications.length > 0 ? (
                    <div className="space-y-1">
                      {notifications.map((notification) => (
                        <button
                          key={notification.id}
                          onClick={() => void handleNotification(notification)}
                          className={cn(
                            'w-full rounded-xl p-3 text-left transition hover:bg-slate-50',
                            !notification.readAt && 'bg-teal-50/70',
                          )}
                        >
                          <div className="flex items-start gap-2">
                            {!notification.readAt && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-teal-500" />}
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-900">{notification.subject}</p>
                              <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-500">{notification.body}</p>
                              <p className="mt-1 text-[11px] text-slate-400">{timeAgo(notification.createdAt)}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <BellOff className="mx-auto size-7 text-slate-300" />
                      <p className="mt-2 text-xs text-slate-500">ยังไม่มีการแจ้งเตือน</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="hidden h-8 w-px bg-slate-200 sm:block" />
            <button className="flex items-center gap-3 rounded-xl p-1.5 transition hover:bg-slate-100">
              <PrivateProfileAvatar
                avatarPath={user?.avatarPath}
                fullName={user?.fullName}
                className="size-12 rounded-2xl"
                fallbackClassName="bg-gradient-to-br from-teal-500 to-cyan-600 text-base font-bold text-white"
              />
              <div className="hidden text-left sm:block">
                <p className="max-w-36 truncate text-sm font-bold text-slate-900">{user?.fullName}</p>
                <p className="text-xs text-slate-500">{user?.role}</p>
              </div>
              <ChevronDown className="hidden size-4 text-slate-400 sm:block" />
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:hidden">
        <div className={cn('grid h-16 items-center px-1', canAccessCompletion ? 'grid-cols-6' : 'grid-cols-5')}>
          {visibleMobileNavigation.map(({ label, to, icon: Icon, primary }) => (
            <NavLink
              key={label}
              to={to}
              className={({ isActive }) =>
                cn(
                  'relative flex h-full flex-col items-center justify-center gap-1 text-[10px] font-semibold transition',
                  isActive ? 'text-teal-600' : 'text-slate-500',
                )
              }
            >
              <span
                className={cn(
                  'grid place-items-center',
                  primary && '-mt-5 size-12 rounded-2xl bg-teal-600 text-white shadow-lg shadow-teal-600/30',
                )}
              >
                <Icon className={cn('size-5', primary && 'size-6')} />
              </span>
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
