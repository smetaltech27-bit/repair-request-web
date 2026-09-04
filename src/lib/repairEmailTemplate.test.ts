import { describe, expect, it } from 'vitest'
import { buildRepairEmail, escapeEmailHtml } from '../../supabase/functions/_shared/repairEmailTemplate'

describe('repair email template', () => {
  it('escapes user-provided content and links pending work to approvals', () => {
    const email = buildRepairEmail({
      appUrl: 'https://example.com/repair/',
      notificationBody: 'มีงานรออนุมัติ',
      jobId: 'REQ-260904-001',
      requesterName: '<script>alert(1)</script>',
      departmentName: 'Machine',
      machineId: 'CNC-01',
      issueDetails: 'มอเตอร์ <b>หยุด</b>',
      repairStatus: 'pending_supervisor',
    })

    expect(email.htmlBody).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(email.htmlBody).toContain('มอเตอร์ &lt;b&gt;หยุด&lt;/b&gt;')
    expect(email.htmlBody).toContain('https://example.com/repair/#/approvals')
    expect(email.htmlBody).not.toContain('<script>')
  })

  it('includes completion details and formats cost', () => {
    const email = buildRepairEmail({
      appUrl: 'https://example.com/repair',
      notificationBody: 'ปิดงานแล้ว',
      jobId: 'REQ-260904-002',
      requesterName: 'นาย A',
      departmentName: 'Machine',
      machineId: 'CNC-02',
      issueDetails: 'เปลี่ยนอะไหล่',
      repairStatus: 'completed',
      totalCost: 1250.5,
      actorName: 'หัวหน้างาน',
      actionNote: 'ทดสอบแล้ว',
    })

    expect(email.textBody).toContain('ค่าใช้จ่าย: 1,250.5 บาท')
    expect(email.textBody).toContain('เปิดระบบ: https://example.com/repair/#/requests')
    expect(email.htmlBody).toContain('ทดสอบแล้ว')
  })

  it('escapes all HTML-sensitive characters', () => {
    expect(escapeEmailHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;')
  })
})
