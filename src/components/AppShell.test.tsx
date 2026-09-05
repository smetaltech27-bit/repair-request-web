import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useNotificationRead } from '../lib/NotificationReadContext'
import { AppShell } from './AppShell'

const serviceMocks = vi.hoisted(() => ({
  getUnreadNotificationCount: vi.fn(),
  listNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markRequestNotificationsRead: vi.fn(),
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      fullName: 'ผู้ทดสอบ',
      role: 'หัวหน้างาน',
      roleCode: 'supervisor',
      department: 'Machine',
    },
    isDemoMode: false,
    logout: vi.fn(),
  }),
}))

vi.mock('../lib/repairService', () => ({
  getUnreadNotificationCount: serviceMocks.getUnreadNotificationCount,
  listNotifications: serviceMocks.listNotifications,
  markNotificationRead: serviceMocks.markNotificationRead,
  markRequestNotificationsRead: serviceMocks.markRequestNotificationsRead,
}))

const notifications = [
  {
    id: 'notification-1',
    requestId: 'request-1',
    subject: 'แจ้งเตือนรายการที่หนึ่ง',
    body: 'รายละเอียดรายการที่หนึ่ง',
    createdAt: '2026-09-05T01:00:00.000Z',
  },
  {
    id: 'notification-2',
    requestId: 'request-2',
    subject: 'แจ้งเตือนรายการที่สอง',
    body: 'รายละเอียดรายการที่สอง',
    createdAt: '2026-09-05T02:00:00.000Z',
  },
]

function RequestReadButton() {
  const markRequestRead = useNotificationRead()
  return <button onClick={() => markRequestRead('request-1')}>เปิดรายละเอียดงานที่หนึ่ง</button>
}

function LocationProbe() {
  const location = useLocation()
  return <p data-testid="location">{location.pathname}{location.search}</p>
}

function renderShell() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <AppShell>
        <RequestReadButton />
        <LocationProbe />
      </AppShell>
    </MemoryRouter>,
  )
}

describe('AppShell notifications', () => {
  beforeEach(() => {
    serviceMocks.listNotifications.mockReset().mockResolvedValue(notifications)
    serviceMocks.getUnreadNotificationCount.mockReset().mockResolvedValueOnce(2).mockResolvedValue(1)
    serviceMocks.markNotificationRead.mockReset().mockResolvedValue(undefined)
    serviceMocks.markRequestNotificationsRead.mockReset().mockResolvedValue(['notification-1'])
  })

  it('updates the unread state immediately when request details are opened elsewhere', async () => {
    const user = userEvent.setup()
    renderShell()

    expect(await screen.findByRole('button', { name: 'การแจ้งเตือนที่ยังไม่อ่าน 2 รายการ' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'เปิดรายละเอียดงานที่หนึ่ง' }))

    expect(screen.getByRole('button', { name: 'การแจ้งเตือนที่ยังไม่อ่าน 1 รายการ' })).toBeInTheDocument()
    await waitFor(() => expect(serviceMocks.markRequestNotificationsRead).toHaveBeenCalledWith('request-1'))
  })

  it('opens the matching request details route from the bell list', async () => {
    const user = userEvent.setup()
    renderShell()

    await user.click(await screen.findByRole('button', { name: 'การแจ้งเตือนที่ยังไม่อ่าน 2 รายการ' }))
    await user.click(screen.getByRole('button', { name: /แจ้งเตือนรายการที่หนึ่ง/ }))

    expect(screen.getByTestId('location')).toHaveTextContent('/requests?request=request-1')
    expect(serviceMocks.markRequestNotificationsRead).toHaveBeenCalledWith('request-1')
  })

  it('does not render the removed mobile bottom navigation', async () => {
    renderShell()

    await screen.findByRole('button', { name: 'การแจ้งเตือนที่ยังไม่อ่าน 2 รายการ' })
    expect(screen.getAllByRole('navigation')).toHaveLength(1)
    expect(screen.queryByRole('link', { name: 'งานของฉัน' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'โปรไฟล์' })).toBeInTheDocument()
  })
})
