import { fireEvent, render, screen } from '@testing-library/react'
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
    expect(await screen.findByText('กรุณากรอก Username')).toBeInTheDocument()
    expect(await screen.findByText('กรุณากรอก Password')).toBeInTheDocument()
  })
})
