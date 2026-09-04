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
      actionCreatedAt: '2026-08-17T01:29:00.000Z',
      beforeImageUrl: 'https://example.com/signed/before.jpg?token=before',
      afterImageUrl: 'https://example.com/signed/after.jpg?token=after',
      actions: [
        { action: 'approve', actorName: 'หัวหน้า A', actorRole: 'supervisor', note: 'อนุมัติ' },
        { action: 'approve', actorName: 'ผู้จัดการ A', actorRole: 'department_manager', note: 'เปลี่ยนอะไหล่' },
        { action: 'acknowledge', actorName: 'จัดซื้อ A', actorRole: 'purchasing', note: 'รับทราบค่ะ' },
      ],
    })

    expect(email.subject).toBe('🛠️ [CLOSE JOB] แจ้งซ่อมเสร็จเรียบร้อย: REQ-260904-002')
    expect(email.textBody).toContain('ค่าใช้จ่ายในการซ่อม: 1,250.5 บาท')
    expect(email.textBody).toContain('เปิดระบบ: https://example.com/repair/#/requests?job=REQ-260904-002')
    expect(email.textBody).toContain('หัวหน้างาน: หัวหน้า A (อนุมัติ)')
    expect(email.textBody).toContain('ฝ่ายจัดซื้อ: จัดซื้อ A (รับทราบรายการ)')
    expect(email.textBody).toContain('รูปภาพตอนแจ้ง (Before)')
    expect(email.textBody).toContain('รูปภาพหลังซ่อม (After)')
    expect(email.htmlBody).toContain('https://example.com/signed/before.jpg?token=before')
    expect(email.htmlBody).toContain('https://example.com/signed/after.jpg?token=after')
    expect(email.htmlBody).toContain('เปิดดูได้โดยไม่ต้องเข้าสู่ระบบ')
    expect(email.htmlBody).toContain('ทดสอบแล้ว')
  })

  it.each([
    ['pending_supervisor', '🔔 มีรายการแจ้งซ่อมใหม่รอดำเนินการ:', 'เรียน หัวหน้างานแผนก Machine'],
    ['pending_department_manager', '🔔 รออนุมัติ (ผู้จัดการฝ่าย):', 'เรียน ผู้จัดการฝ่าย MA'],
    ['pending_factory_manager', '🔔 รออนุมัติ (ผู้จัดการโรงงาน):', 'เรียน ผู้จัดการโรงงาน'],
    ['pending_purchasing', '🔔 รอดำเนินการ (ฝ่ายจัดซื้อ) :', 'เรียนฝ่ายจัดซื้อ'],
    ['purchasing_in_progress', '✅ จัดซื้อรับทราบแล้ว:', 'เรียน ผู้บริหารและผู้เกี่ยวข้อง'],
    ['completed', '🛠️ [CLOSE JOB] แจ้งซ่อมเสร็จเรียบร้อย:', 'เรียน ทีมบริหารและผู้เกี่ยวข้องทุกท่าน'],
  ])('preserves the legacy email wording for %s', (repairStatus, subjectPrefix, greeting) => {
    const email = buildRepairEmail({
      appUrl: 'https://example.com/repair',
      notificationBody: 'อัปเดตงานซ่อม',
      jobId: 'REQ-260711-020',
      requesterName: 'จันทิมา สิทธิสินธุ์',
      departmentName: 'Machine',
      machineId: '# okk4',
      issueDetails: 'เครื่องจักรคีบขณะรับงาน',
      repairStatus,
      totalCost: 143190,
      actorName: 'ช่างซ่อม A',
      actionNote: 'ดำเนินการเปลี่ยน servo module เรียบร้อยแล้ว',
      actionCreatedAt: '2026-08-17T01:29:00.000Z',
    })

    expect(email.subject).toContain(subjectPrefix)
    expect(email.textBody).toContain(greeting)
    expect(email.textBody).toContain('รหัสแจ้งซ่อม: REQ-260711-020')
    expect(email.textBody).toContain('เครื่องจักร/สถานที่: # okk4')
    expect(email.textBody).toContain('อาการเสีย: เครื่องจักรคีบขณะรับงาน')
  })

  it('asks purchasing to proceed only after the factory manager approval', () => {
    const email = buildRepairEmail({
      appUrl: 'https://example.com/repair',
      notificationBody: 'อัปเดตงานซ่อม',
      jobId: 'REQ-260711-020',
      requesterName: 'จันทิมา สิทธิสินธุ์',
      departmentName: 'Machine',
      machineId: '# okk4',
      issueDetails: 'เครื่องจักรคีบขณะรับงาน',
      repairStatus: 'pending_purchasing',
    })

    expect(email.textBody).toContain(
      'รายการแจ้งซ่อมผ่านการอนุมัติจากผู้จัดการโรงงานแล้ว รอดำเนินการจากท่านค่ะ:',
    )
    expect(email.textBody).not.toContain('ฝ่ายจัดซื้อได้รับทราบและกำลังดำเนินการสั่งซื้อ/ออก PO')
  })

  it('links the purchasing acknowledgement email to the completion inbox', () => {
    const email = buildRepairEmail({
      appUrl: 'https://example.com/repair',
      notificationBody: 'จัดซื้อรับทราบแล้ว',
      jobId: 'REQ-260711-020',
      requesterName: 'จันทิมา สิทธิสินธุ์',
      departmentName: 'Machine',
      machineId: '# okk4',
      issueDetails: 'เครื่องจักรคีบขณะรับงาน',
      repairStatus: 'purchasing_in_progress',
    })

    expect(email.textBody).toContain(
      'เปิดระบบ: https://example.com/repair/#/completion?job=REQ-260711-020',
    )
  })

  it('escapes all HTML-sensitive characters', () => {
    expect(escapeEmailHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;')
  })
})
