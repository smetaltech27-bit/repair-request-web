import { fireEvent, render, screen, within } from '@testing-library/react'
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
  beforeEach(() => sessionStorage.clear())

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
    expect(screen.getByText('Create by S Metal Tech Co., Ltd.')).toBeInTheDocument()
  })
})
