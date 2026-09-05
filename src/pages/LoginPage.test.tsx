import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import { AuthProvider } from '../auth/AuthContext'
import { LoginPage } from './LoginPage'

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: null,
}))

function renderPage() {
  return render(
    <HashRouter>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </HashRouter>,
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  it('shows validation errors when submitted empty', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }))
    expect(await screen.findByText('กรุณากรอกอีเมลหรือชื่อผู้ใช้')).toBeInTheDocument()
    expect(await screen.findByText('กรุณากรอกรหัสผ่าน')).toBeInTheDocument()
  })

  it('shows the SMT brand inside the login card', () => {
    renderPage()
    const brand = screen.getByRole('group', { name: 'แบรนด์ SMT' })
    expect(within(brand).getByRole('img', { name: 'SMT' })).toBeInTheDocument()
    expect(within(brand).getByText('Maintenance Request System (MRS)')).toBeInTheDocument()
    expect(screen.getByLabelText('อีเมลหรือชื่อผู้ใช้')).toBeInTheDocument()
    expect(screen.getByLabelText('รหัสผ่าน')).toBeInTheDocument()
    expect(screen.getByLabelText('จดจำรหัสผ่าน')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ลืมรหัสผ่าน?' })).toBeInTheDocument()
    expect(screen.queryByText('Welcome back')).not.toBeInTheDocument()
    expect(screen.queryByText('ใช้บัญชีพนักงานเดิมเพื่อเข้าสู่ระบบ')).not.toBeInTheDocument()
    expect(screen.getByText('Create by S Metal Tech Co., Ltd.')).toBeInTheDocument()
    expect(screen.queryByText('ดูแลงานซ่อม')).not.toBeInTheDocument()
    expect(screen.queryByText('Industrial Clarity · Responsive for every screen')).not.toBeInTheDocument()
  })

  it('asks the employee to contact HR when password is forgotten', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'ลืมรหัสผ่าน?' }))
    expect(screen.getByRole('status')).toHaveTextContent('กรุณาติดต่อฝ่ายบุคคล')
  })

  it('remembers only the username after a successful login', async () => {
    renderPage()
    fireEvent.change(screen.getByLabelText('อีเมลหรือชื่อผู้ใช้'), { target: { value: 'employee01' } })
    fireEvent.change(screen.getByLabelText('รหัสผ่าน'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByLabelText('จดจำรหัสผ่าน'))
    fireEvent.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }))

    await waitFor(() => expect(localStorage.getItem('mrs-remembered-username')).toBe('employee01'))
    expect(localStorage.length).toBe(1)
  })
})
