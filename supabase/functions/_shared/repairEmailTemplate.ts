export interface RepairEmailAction {
  action: 'create' | 'import' | 'approve' | 'reject' | 'acknowledge' | 'complete';
  actorName: string;
  actorRole?: 'employee' | 'supervisor' | 'department_manager' | 'factory_manager' | 'purchasing' | null;
  note?: string | null;
  createdAt?: string | null;
}

export interface RepairEmailTemplateInput {
  appUrl: string;
  notificationBody: string;
  jobId: string;
  requesterName: string;
  departmentName: string;
  machineId: string;
  issueDetails: string;
  repairStatus: string;
  totalCost?: number | string | null;
  actionCode?: RepairEmailAction['action'] | null;
  actorName?: string | null;
  actionNote?: string | null;
  actionCreatedAt?: string | null;
  actions?: RepairEmailAction[];
  beforeImageUrl?: string | null;
  afterImageUrl?: string | null;
  isRequesterReceipt?: boolean;
}

interface StageContent {
  accent: string;
  accentSoft: string;
  badge: string;
  subject: string;
  greeting: string;
  intro: string;
  ctaLabel: string;
  route: 'approvals' | 'completion' | 'requests';
}

const statusLabels: Record<string, string> = {
  pending_supervisor: 'รอหัวหน้างานอนุมัติ',
  pending_department_manager: 'รอผู้จัดการฝ่ายอนุมัติ',
  pending_factory_manager: 'รอผู้จัดการโรงงานอนุมัติ',
  pending_purchasing: 'รอจัดซื้อดำเนินการ',
  purchasing_in_progress: 'กำลังดำเนินการจัดซื้อ',
  completed: 'ซ่อมเสร็จเรียบร้อย (ปิดงาน)',
  rejected: 'ไม่อนุมัติ (ตีกลับ)',
};

const roleLabels: Record<string, string> = {
  supervisor: 'หัวหน้างาน',
  department_manager: 'ผู้จัดการฝ่าย',
  factory_manager: 'ผู้จัดการโรงงาน',
  purchasing: 'ฝ่ายจัดซื้อ',
};

export function escapeEmailHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function displayCost(value: RepairEmailTemplateInput['totalCost']) {
  if (value === null || value === undefined || value === '') return '';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(numeric);
}

function displayDateTime(value: string | null | undefined) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(date);
}

function getStageContent(input: RepairEmailTemplateInput): StageContent {
  if (input.isRequesterReceipt) {
    return {
      accent: '#0f766e', accentSoft: '#f0fdfa', badge: 'รับรายการแล้ว',
      subject: `✅ รับรายการแจ้งซ่อม ${input.jobId} แล้ว`,
      greeting: `เรียน คุณ${input.requesterName}`,
      intro: `ระบบได้รับรายการแจ้งซ่อมของคุณแล้ว ขณะนี้อยู่ในสถานะ ${statusLabels[input.repairStatus] ?? input.repairStatus} ค่ะ`,
      ctaLabel: 'เปิดดูรายการแจ้งซ่อม', route: 'requests',
    };
  }

  const factoryManagerPreviousRole = input.actions?.some(
    (action) => action.action === 'approve' && action.actorRole === 'department_manager',
  ) ? 'ผู้จัดการฝ่าย' : 'หัวหน้างาน';
  const stages: Record<string, StageContent> = {
    pending_supervisor: {
      accent: '#d9a400', accentSoft: '#fffbeb', badge: 'รายการใหม่',
      subject: `🔔 มีรายการแจ้งซ่อมใหม่รอดำเนินการ: ${input.jobId} (${input.machineId})`,
      greeting: `เรียน หัวหน้างานแผนก ${input.departmentName}`,
      intro: 'มีรายการแจ้งซ่อมใหม่รอการพิจารณาจากท่านค่ะ ดังรายละเอียดต่อไปนี้:',
      ctaLabel: 'คลิกที่นี่เพื่อเข้าสู่หน้าตรวจสอบและอนุมัติ', route: 'approvals',
    },
    pending_department_manager: {
      accent: '#f97316', accentSoft: '#fff7ed', badge: 'รออนุมัติ',
      subject: `🔔 รออนุมัติ (ผู้จัดการฝ่าย): ${input.jobId}`,
      greeting: 'เรียน ผู้จัดการฝ่าย MA',
      intro: 'รายการแจ้งซ่อมผ่านการอนุมัติจากหัวหน้างานแล้ว รอการพิจารณาจากท่านค่ะ',
      ctaLabel: 'คลิกเข้าสู่ระบบ (เฉพาะผู้อนุมัติ)', route: 'approvals',
    },
    pending_factory_manager: {
      accent: '#7c3aed', accentSoft: '#faf5ff', badge: 'รออนุมัติ',
      subject: `🔔 รออนุมัติ (ผู้จัดการโรงงาน): ${input.jobId}`,
      greeting: 'เรียน ผู้จัดการโรงงาน',
      intro: `รายการแจ้งซ่อมผ่านการอนุมัติจาก${factoryManagerPreviousRole}แล้ว รอการพิจารณาจากท่านค่ะ`,
      ctaLabel: 'คลิกเข้าสู่ระบบ (เฉพาะผู้อนุมัติ)', route: 'approvals',
    },
    pending_purchasing: {
      accent: '#7c3aed', accentSoft: '#faf5ff', badge: 'รอดำเนินการ',
      subject: `🔔 รอดำเนินการ (ฝ่ายจัดซื้อ) : ${input.jobId}`,
      greeting: 'เรียนฝ่ายจัดซื้อ',
      intro: 'รายการแจ้งซ่อมผ่านการอนุมัติจากผู้จัดการโรงงานแล้ว รอดำเนินการจากท่านค่ะ:',
      ctaLabel: 'คลิกเข้าสู่ระบบ (เฉพาะผู้อนุมัติ)', route: 'approvals',
    },
    purchasing_in_progress: {
      accent: '#7c3aed', accentSoft: '#faf5ff', badge: 'จัดซื้อรับทราบแล้ว',
      subject: `✅ จัดซื้อรับทราบแล้ว: ${input.jobId}`,
      greeting: 'เรียน ผู้บริหารและผู้เกี่ยวข้อง',
      intro: 'ฝ่ายจัดซื้อได้รับทราบและกำลังดำเนินการสั่งซื้อ/ออก PO สำหรับรายการแจ้งซ่อมนี้เรียบร้อยแล้วค่ะ',
      ctaLabel: 'คลิกเข้าสู่หน้าปิดงาน', route: 'completion',
    },
    completed: {
      accent: '#16a34a', accentSoft: '#f0fdf4', badge: 'ปิดงานแล้ว',
      subject: `🛠️ [CLOSE JOB] แจ้งซ่อมเสร็จเรียบร้อย: ${input.jobId}`,
      greeting: 'เรียน ทีมบริหารและผู้เกี่ยวข้องทุกท่าน',
      intro: 'รายการแจ้งซ่อมบำรุง/ปรับปรุง ต่อไปนี้ได้รับการแก้ไข เสร็จสิ้นและปิดงาน เรียบร้อยแล้วค่ะ:',
      ctaLabel: 'เปิดดูรายละเอียดงานที่ปิดแล้ว', route: 'requests',
    },
    rejected: {
      accent: '#dc2626', accentSoft: '#fef2f2', badge: 'ไม่อนุมัติ',
      subject: `❌ แจ้งไม่อนุมัติรายการแจ้งซ่อม: ${input.jobId}`,
      greeting: 'เรียน ผู้แจ้งและผู้เกี่ยวข้อง',
      intro: `รายการแจ้งซ่อมนี้ถูกไม่อนุมัติ (ตีกลับ) โดย ${input.actorName || 'ผู้อนุมัติ'} ค่ะ`,
      ctaLabel: 'เปิดดูรายละเอียดรายการ', route: 'requests',
    },
  };

  return stages[input.repairStatus] ?? {
    accent: '#0f766e', accentSoft: '#f0fdfa', badge: 'อัปเดตสถานะ',
    subject: `อัปเดตงานซ่อม ${input.jobId}`,
    greeting: 'เรียน ผู้เกี่ยวข้อง', intro: input.notificationBody,
    ctaLabel: 'เปิดระบบ Maintenance Request System (MRS)', route: 'requests',
  };
}

function relevantHistory(actions: RepairEmailAction[]) {
  return actions.filter((item) => item.action === 'approve' || item.action === 'acknowledge');
}

function actionStateLabel(action: RepairEmailAction['action']) {
  if (action === 'approve') return 'อนุมัติ';
  if (action === 'acknowledge') return 'รับทราบรายการ';
  return action;
}

export function buildRepairEmail(input: RepairEmailTemplateInput) {
  const stage = getStageContent(input);
  const statusLabel = statusLabels[input.repairStatus] ?? input.repairStatus;
  const normalizedBase = input.appUrl.replace(/\/+$/, '');
  const encodedJobId = encodeURIComponent(input.jobId);
  const actionUrl = `${normalizedBase}/#/${stage.route}?job=${encodedJobId}`;
  const cost = displayCost(input.totalCost);
  const actions = relevantHistory(input.actions ?? []);

  const plainLines = [
    stage.greeting,
    '',
    stage.intro,
    '',
    `รหัสแจ้งซ่อม: ${input.jobId}`,
    `แผนกที่แจ้ง: ${input.departmentName}`,
    `ผู้แจ้ง: ${input.requesterName}`,
    `เครื่องจักร/สถานที่: ${input.machineId}`,
    `อาการเสีย: ${input.issueDetails}`,
  ];

  for (const action of actions) {
    plainLines.push(`${roleLabels[action.actorRole ?? ''] ?? 'ผู้ดำเนินการ'}: ${action.actorName} (${actionStateLabel(action.action)})`);
    plainLines.push(`รายละเอียด: ${action.note?.trim() || '-'}`);
  }

  if (input.repairStatus === 'rejected') {
    plainLines.push(`เหตุผลที่ไม่อนุมัติ: ${input.actionNote?.trim() || '-'}`);
  }
  if (input.repairStatus === 'completed') {
    plainLines.push('หมายเหตุปิดงาน:');
    plainLines.push(`ปิดงานโดย: ${input.actorName || '-'}`);
    plainLines.push(`รายละเอียด: ${input.actionNote?.trim() || '-'}`);
    plainLines.push(`วันที่/เวลา: ${displayDateTime(input.actionCreatedAt)}`);
    plainLines.push(`ค่าใช้จ่ายในการซ่อม: ${cost || '0'} บาท`);
  }
  if (input.beforeImageUrl) {
    plainLines.push(`${input.repairStatus === 'completed' ? 'รูปภาพตอนแจ้ง (Before)' : 'รูปภาพประกอบ'}: ${input.beforeImageUrl}`);
  }
  if (input.repairStatus === 'completed' && input.afterImageUrl) {
    plainLines.push(`รูปภาพหลังซ่อม (After): ${input.afterImageUrl}`);
  }
  plainLines.push(`สถานะปัจจุบัน: ${statusLabel}`);
  plainLines.push(`เปิดระบบ: ${actionUrl}`);

  const emailFont = 'Tahoma,Arial,sans-serif';
  const cellTextStyle = `font-family:${emailFont};font-size:14px;line-height:22px;color:#0f172a;mso-line-height-rule:exactly`;

  const historyHtml = actions.map((action) => `
    <tr>
      <td style="${cellTextStyle};padding:11px 0 0;border-top:1px solid #e2e8f0">
        <strong>${escapeEmailHtml(roleLabels[action.actorRole ?? ''] ?? 'ผู้ดำเนินการ')}:</strong> ${escapeEmailHtml(action.actorName)} (${escapeEmailHtml(actionStateLabel(action.action))})
      </td>
    </tr>
    <tr>
      <td style="font-family:${emailFont};font-size:13px;line-height:20px;color:#475569;padding:3px 0 11px;mso-line-height-rule:exactly">
        <strong>รายละเอียด:</strong> ${escapeEmailHtml(action.note?.trim() || '-')}
      </td>
    </tr>`).join('');

  const rejectHtml = input.repairStatus === 'rejected' ? `
    <tr>
      <td style="padding:14px 0 0">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse">
          <tr>
            <td bgcolor="#fff1f2" style="font-family:${emailFont};font-size:14px;line-height:22px;color:#991b1b;padding:12px 14px;border:1px solid #fecdd3;mso-line-height-rule:exactly">
              <strong>เหตุผลที่ไม่อนุมัติ:</strong> ${escapeEmailHtml(input.actionNote?.trim() || '-')}
            </td>
          </tr>
        </table>
      </td>
    </tr>` : '';

  const completionHtml = input.repairStatus === 'completed' ? `
    <tr>
      <td style="font-family:${emailFont};font-size:14px;line-height:22px;font-weight:700;color:#166534;padding:14px 0 0;border-top:1px solid #bbf7d0;mso-line-height-rule:exactly">
        หมายเหตุปิดงาน
      </td>
    </tr>
    <tr><td style="${cellTextStyle};padding:7px 0 0"><strong>ปิดงานโดย:</strong> ${escapeEmailHtml(input.actorName || '-')}</td></tr>
    <tr><td style="${cellTextStyle};padding:4px 0 0"><strong>รายละเอียด:</strong> ${escapeEmailHtml(input.actionNote?.trim() || '-')}</td></tr>
    <tr><td style="${cellTextStyle};padding:4px 0 0"><strong>วันที่/เวลา:</strong> ${escapeEmailHtml(displayDateTime(input.actionCreatedAt))}</td></tr>
    <tr><td style="font-family:${emailFont};font-size:16px;line-height:24px;color:#0f172a;padding:12px 0 0;mso-line-height-rule:exactly"><strong>ค่าใช้จ่ายในการซ่อม:</strong> ${escapeEmailHtml(cost || '0')} บาท</td></tr>` : '';

  const imageLinks = [
    input.beforeImageUrl ? `<tr><td style="${cellTextStyle};padding:10px 0 0"><strong>${input.repairStatus === 'completed' ? 'รูปภาพตอนแจ้ง (Before)' : 'รูปภาพประกอบ'}:</strong> <a href="${escapeEmailHtml(input.beforeImageUrl)}" style="font-family:${emailFont};color:#2563eb;font-weight:700;text-decoration:underline">${input.repairStatus === 'completed' ? 'คลิกรูป' : 'คลิกเพื่อดูรูปภาพ'}</a></td></tr>` : '',
    input.repairStatus === 'completed' && input.afterImageUrl ? `<tr><td style="${cellTextStyle};padding:10px 0 0"><strong>รูปภาพหลังซ่อม (After):</strong> <a href="${escapeEmailHtml(input.afterImageUrl)}" style="font-family:${emailFont};color:#16a34a;font-weight:700;text-decoration:underline">คลิกเพื่อดูรูปภาพงานที่เสร็จแล้ว</a></td></tr>` : '',
  ].join('');

  const htmlBody = `<!doctype html>
<html lang="th">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="x-apple-disable-message-reformatting">
    <title>${escapeEmailHtml(stage.subject)}</title>
    <style type="text/css">
      body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
      table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
      table { border-collapse:collapse; }
      @media only screen and (max-width:700px) {
        .email-shell { width:100% !important; }
        .email-pad { padding-left:18px !important; padding-right:18px !important; }
      }
    </style>
    <!--[if mso]>
      <style type="text/css">body, table, td, a { font-family:Tahoma,Arial,sans-serif !important; }</style>
    <![endif]-->
  </head>
  <body bgcolor="#f1f5f9" style="margin:0;padding:0;width:100%;background-color:#f1f5f9">
    <center style="width:100%;background-color:#f1f5f9">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f1f5f9" style="width:100%;background-color:#f1f5f9">
        <tr>
          <td align="center" valign="top" style="padding:22px 10px">
            <!--[if mso]>
            <table role="presentation" width="680" cellspacing="0" cellpadding="0" border="0"><tr><td>
            <![endif]-->
            <table class="email-shell" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:680px;background-color:#ffffff;border:1px solid #e2e8f0;border-collapse:separate;border-spacing:0;border-radius:12px;overflow:hidden">
              <tr>
                <td bgcolor="${stage.accent}" class="email-pad" style="font-family:${emailFont};color:#ffffff;background-color:${stage.accent};padding:20px 24px">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                    <tr><td style="font-family:${emailFont};font-size:11px;line-height:16px;font-weight:700;letter-spacing:1px;color:#ffffff;mso-line-height-rule:exactly">SMETALTECH &middot; MAINTENANCE REQUEST SYSTEM (MRS)</td></tr>
                    <tr><td style="font-family:${emailFont};font-size:23px;line-height:30px;font-weight:700;color:#ffffff;padding:5px 0 0;mso-line-height-rule:exactly">${escapeEmailHtml(input.jobId)}</td></tr>
                    <tr>
                      <td style="padding:8px 0 0">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                          <tr><td bgcolor="${stage.accent}" style="font-family:${emailFont};font-size:12px;line-height:18px;font-weight:700;color:#ffffff;padding:3px 10px;border:1px solid #ffffff;border-radius:12px;mso-line-height-rule:exactly">${escapeEmailHtml(stage.badge)}</td></tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td bgcolor="#ffffff" class="email-pad" style="font-family:${emailFont};background-color:#ffffff;padding:24px">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                    <tr><td style="font-family:${emailFont};font-size:17px;line-height:26px;font-weight:700;color:#0f172a;mso-line-height-rule:exactly">${escapeEmailHtml(stage.greeting)}</td></tr>
                    <tr><td style="font-family:${emailFont};font-size:14px;line-height:23px;color:#334155;padding:14px 0 18px;mso-line-height-rule:exactly">${escapeEmailHtml(stage.intro)}</td></tr>
                    <tr>
                      <td>
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse">
                          <tr>
                            <td width="5" bgcolor="${stage.accent}" style="width:5px;background-color:${stage.accent};font-size:0;line-height:0">&nbsp;</td>
                            <td bgcolor="${stage.accentSoft}" style="background-color:${stage.accentSoft};padding:16px 18px">
                              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr><td style="font-family:${emailFont};font-size:20px;line-height:28px;font-weight:700;color:#0f172a;mso-line-height-rule:exactly">รหัสแจ้งซ่อม: ${escapeEmailHtml(input.jobId)}</td></tr>
                                <tr><td style="${cellTextStyle};padding:13px 0 0"><strong>แผนกที่แจ้ง:</strong> ${escapeEmailHtml(input.departmentName)}</td></tr>
                                <tr><td style="font-family:${emailFont};font-size:14px;line-height:22px;color:#475569;padding:3px 0 0;mso-line-height-rule:exactly"><strong>ผู้แจ้ง:</strong> ${escapeEmailHtml(input.requesterName)}</td></tr>
                                <tr><td style="${cellTextStyle};padding:13px 0 0"><strong>เครื่องจักร/สถานที่:</strong> ${escapeEmailHtml(input.machineId)}</td></tr>
                                <tr><td style="${cellTextStyle};padding:13px 0 11px"><strong>อาการเสีย:</strong> ${escapeEmailHtml(input.issueDetails)}</td></tr>
                                ${historyHtml}
                                ${rejectHtml}
                                ${completionHtml}
                                ${imageLinks}
                              </table>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:20px 0 0">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                          <tr>
                            <td align="center" bgcolor="${stage.accent}" style="background-color:${stage.accent};padding:11px 17px;border-radius:7px;mso-padding-alt:11px 17px">
                              <a href="${escapeEmailHtml(actionUrl)}" style="font-family:${emailFont};font-size:14px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;display:inline-block;mso-line-height-rule:exactly">${escapeEmailHtml(stage.ctaLabel)}</a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr><td height="18" style="height:18px;font-size:0;line-height:0">&nbsp;</td></tr>
                    <tr><td style="font-family:${emailFont};font-size:13px;line-height:21px;font-weight:700;color:${stage.accent};padding:15px 0 0;border-top:1px solid #e2e8f0;mso-line-height-rule:exactly">สถานะปัจจุบัน: ${escapeEmailHtml(statusLabel)}</td></tr>
                    <tr><td style="font-family:${emailFont};font-size:11px;line-height:18px;color:#64748b;padding:8px 0 0;mso-line-height-rule:exactly">ลิงก์รูปภาพเปิดดูได้โดยไม่ต้องเข้าสู่ระบบและจะหมดอายุภายใน 30 วัน ส่วนรายละเอียดงานยังต้องเข้าสู่ระบบ</td></tr>
                  </table>
                </td>
              </tr>
            </table>
            <!--[if mso]>
            </td></tr></table>
            <![endif]-->
          </td>
        </tr>
      </table>
    </center>
  </body>
</html>`;

  return { subject: stage.subject, htmlBody, textBody: plainLines.join('\n') };
}
