import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import smtLogo from '../assets/smt-logo.jpg'
import { useAuth } from '../auth/AuthContext'
import { Button } from '../components/ui/Button'

const loginSchema = z.object({
  username: z.string().trim().min(1, 'กรุณากรอกอีเมลหรือชื่อผู้ใช้'),
  password: z.string().min(1, 'กรุณากรอกรหัสผ่าน'),
})

type LoginForm = z.infer<typeof loginSchema>

const REMEMBERED_USERNAME_KEY = 'mrs-remembered-username'

export function LoginPage() {
  const { user, login, isDemoMode, isLoading } = useAuth()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [rememberPassword, setRememberPassword] = useState(() => Boolean(localStorage.getItem(REMEMBERED_USERNAME_KEY)))
  const [showForgotPasswordMessage, setShowForgotPasswordMessage] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: localStorage.getItem(REMEMBERED_USERNAME_KEY) ?? '',
      password: '',
    },
  })

  if (isLoading) return <div className="grid min-h-svh place-items-center text-sm text-slate-500">กำลังตรวจสอบ Session…</div>
  if (user) return <Navigate to="/" replace />

  async function onSubmit(values: LoginForm) {
    setSubmitError('')
    try {
      await login(values.username, values.password)
      if (rememberPassword) localStorage.setItem(REMEMBERED_USERNAME_KEY, values.username.trim())
      else localStorage.removeItem(REMEMBERED_USERNAME_KEY)
      navigate('/', { replace: true })
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'เข้าสู่ระบบไม่สำเร็จ')
    }
  }

  return (
    <main className="min-h-svh min-w-0 bg-slate-50">
      <section className="flex min-h-svh min-w-0 items-center justify-center bg-slate-50 px-4 py-8 sm:px-8 sm:py-10">
        <div className="min-w-0 w-full max-w-lg">
          <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/10 sm:p-8 lg:p-9">
            <div role="group" aria-label="แบรนด์ SMT" className="flex min-w-0 items-center justify-center gap-3 sm:gap-4">
              <img
                src={smtLogo}
                alt="SMT"
                className="size-16 shrink-0 object-contain sm:size-20"
              />
              <p className="min-w-0 max-w-xs text-sm font-bold leading-snug text-slate-950 min-[360px]:text-base sm:text-xl">
                Maintenance Request System (MRS)
              </p>
            </div>

            <div className="mt-7 text-center sm:mt-8">
              <h2 className="text-3xl font-bold tracking-tight text-slate-950">เข้าสู่ระบบ</h2>
            </div>

            {isDemoMode && (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <strong>โหมดพัฒนา:</strong> กรอก Username และ Password ใดก็ได้เพื่อดูตัวอย่าง UI
              </div>
            )}

            <form className="mt-7 space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
              <div>
                <label htmlFor="username" className="mb-2 block text-sm font-semibold text-slate-700">
                  อีเมลหรือชื่อผู้ใช้
                </label>
                <input
                  id="username"
                  autoComplete="username"
                  placeholder="กรอกอีเมลหรือชื่อผู้ใช้"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
                  {...register('username')}
                />
                {errors.username && <p className="mt-1.5 text-xs font-medium text-red-600">{errors.username.message}</p>}
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-700">
                  รหัสผ่าน
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="กรอกรหัสผ่าน"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-4 pr-12 text-sm outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
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

              <div className="-mt-1 flex items-center justify-between gap-3">
                <label htmlFor="remember-password" className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-600">
                  <input
                    id="remember-password"
                    type="checkbox"
                    className="peer sr-only"
                    checked={rememberPassword}
                    onChange={(event) => {
                      const checked = event.target.checked
                      setRememberPassword(checked)
                      if (!checked) localStorage.removeItem(REMEMBERED_USERNAME_KEY)
                    }}
                  />
                  <span className="relative h-5 w-9 shrink-0 rounded-full bg-slate-300 transition peer-checked:bg-teal-600 peer-focus-visible:ring-4 peer-focus-visible:ring-teal-500/20 after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-4" />
                  <span>จดจำรหัสผ่าน</span>
                </label>
                <button
                  type="button"
                  className="shrink-0 text-sm font-semibold text-teal-600 transition hover:text-teal-700 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/20"
                  onClick={() => setShowForgotPasswordMessage(true)}
                >
                  ลืมรหัสผ่าน?
                </button>
              </div>

              {showForgotPasswordMessage && (
                <p role="status" className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2.5 text-sm font-semibold text-teal-800">
                  กรุณาติดต่อฝ่ายบุคคล
                </p>
              )}

              {submitError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{submitError}</p>}

              <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
              </Button>
            </form>

            <p className="mt-7 border-t border-slate-100 pt-5 text-center text-xs font-semibold text-teal-600">
              Create by S Metal Tech Co., Ltd.
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">กรุณาติดต่อผู้ดูแลระบบหากไม่สามารถเข้าสู่ระบบได้</p>
        </div>
      </section>
    </main>
  )
}
