import { Building2, LogOut, Settings2, ShieldCheck, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'

export function ProfilePage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div>
        <p className="text-sm font-semibold text-teal-600">Account</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">โปรไฟล์ของฉัน</h1>
      </div>
      <Card className="mt-6 overflow-hidden">
        <div className="bg-gradient-to-br from-slate-950 to-slate-800 p-6 text-white sm:p-8">
          <div className="grid size-16 place-items-center rounded-2xl bg-teal-500 text-2xl font-bold shadow-lg shadow-teal-500/20">{user?.fullName.charAt(0)}</div>
          <h2 className="mt-4 text-xl font-bold">{user?.fullName}</h2>
          <p className="mt-1 text-sm text-slate-300">@{user?.username}</p>
        </div>
        <div className="space-y-4 p-5 sm:p-6">
          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4"><UserRound className="size-5 text-teal-600" /><div><p className="text-xs text-slate-500">ตำแหน่ง</p><p className="font-bold text-slate-900">{user?.role}</p></div></div>
          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4"><Building2 className="size-5 text-teal-600" /><div><p className="text-xs text-slate-500">แผนก</p><p className="font-bold text-slate-900">{user?.department}</p></div></div>
          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4"><ShieldCheck className="size-5 text-teal-600" /><div><p className="text-xs text-slate-500">สิทธิ์การใช้งาน</p><p className="font-bold text-slate-900">Active</p></div></div>
          <Button variant="secondary" className="w-full" onClick={() => navigate('/settings')}><Settings2 className="size-4" /> ตั้งค่าและจัดการรายการ</Button>
          <Button variant="secondary" className="w-full" onClick={handleLogout}><LogOut className="size-4" /> ออกจากระบบ</Button>
        </div>
      </Card>
    </div>
  )
}
