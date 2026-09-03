import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, LockKeyhole, ShieldCheck, UserRound, Wrench } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { useAuth } from '../auth/AuthContext'
import { Button } from '../components/ui/Button'

const loginSchema = z.object({
  username: z.string().trim().min(1, 'กรุณากรอก Username'),
  password: z.string().min(1, 'กรุณากรอก Password'),
})

type LoginForm = z.infer<typeof loginSchema>

export function LoginPage() {
  const { user, login, isDemoMode, isLoading } = useAuth()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  if (isLoading) return <div className="grid min-h-svh place-items-center text-sm text-slate-500">กำลังตรวจสอบ Session…</div>
  if (user) return <Navigate to="/" replace />

  async function onSubmit(values: LoginForm) {
    setSubmitError('')
    try {
      await login(values.username, values.password)
      navigate('/', { replace: true })
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'เข้าสู่ระบบไม่สำเร็จ')
    }
  }

  return (
    <main className="grid min-h-svh bg-slate-950 lg:grid-cols-[1.15fr_0.85fr]">
      <section className="relative hidden overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(13,148,136,0.28),transparent_34%),radial-gradient(circle_at_80%_70%,rgba(14,165,233,0.18),transparent_34%)]" />
        <div className="absolute -bottom-44 -left-24 size-[32rem] rounded-full border border-teal-400/10" />
        <div className="absolute -bottom-28 -left-10 size-[24rem] rounded-full border border-teal-400/10" />
        <div className="relative flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-teal-500 shadow-lg shadow-teal-500/25">
            <Wrench className="size-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Repair Request</h1>
            <p className="text-sm text-slate-400">Maintenance Management System</p>
          </div>
        </div>

        <div className="relative max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-teal-400/10 px-4 py-2 text-sm font-semibold text-teal-300 ring-1 ring-inset ring-teal-300/15">
            <ShieldCheck className="size-4" /> ปลอดภัย · ติดตามได้ · ใช้งานง่าย
          </span>
          <h2 className="mt-6 text-5xl font-bold leading-[1.15] tracking-tight">
            ดูแลงานซ่อม
            <br />
            ให้เป็นเรื่องง่าย
          </h2>
          <p className="mt-5 max-w-lg text-lg leading-8 text-slate-300">
            แจ้งปัญหา อนุมัติ ติดตามสถานะ และตรวจสอบประวัติงานซ่อมได้จากทุกอุปกรณ์
          </p>
        </div>

        <p className="relative text-xs text-slate-500">Industrial Clarity · Responsive for every screen</p>
      </section>

      <section className="flex min-h-svh items-center justify-center bg-slate-50 px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="grid size-11 place-items-center rounded-2xl bg-teal-600 text-white shadow-lg shadow-teal-600/20">
              <Wrench className="size-6" />
            </div>
            <div>
              <p className="font-bold text-slate-950">Repair Request</p>
              <p className="text-xs text-slate-500">Maintenance Management System</p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-8">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-600">Welcome back</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">เข้าสู่ระบบ</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">ใช้ Username และ Password เดิมของพนักงาน</p>
            </div>

            {isDemoMode && (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <strong>โหมดพัฒนา:</strong> กรอก Username และ Password ใดก็ได้เพื่อดูตัวอย่าง UI
              </div>
            )}

            <form className="mt-7 space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
              <div>
                <label htmlFor="username" className="mb-2 block text-sm font-semibold text-slate-700">
                  Username
                </label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
                  <input
                    id="username"
                    autoComplete="username"
                    placeholder="กรอก Username"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
                    {...register('username')}
                  />
                </div>
                {errors.username && <p className="mt-1.5 text-xs font-medium text-red-600">{errors.username.message}</p>}
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-700">
                  Password
                </label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="กรอก Password"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-12 text-sm outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'ซ่อน Password' : 'แสดง Password'}
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </div>
                {errors.password && <p className="mt-1.5 text-xs font-medium text-red-600">{errors.password.message}</p>}
              </div>

              {submitError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{submitError}</p>}

              <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
              </Button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">กรุณาติดต่อผู้ดูแลระบบหากไม่สามารถเข้าสู่ระบบได้</p>
        </div>
      </section>
    </main>
  )
}
