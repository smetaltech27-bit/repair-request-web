import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PrivateProfileAvatar } from './PrivateProfileAvatar'

vi.mock('../lib/repairService', () => ({
  downloadProfileAvatar: vi.fn(),
}))

describe('PrivateProfileAvatar', () => {
  it('shows the employee initial when no private avatar is available', () => {
    render(<PrivateProfileAvatar fullName="สมพล ว่องสิริชนม์" />)

    expect(screen.getByLabelText('รูปโปรไฟล์ สมพล ว่องสิริชนม์')).toHaveTextContent('ส')
  })
})
