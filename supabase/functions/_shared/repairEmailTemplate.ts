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
  route: 'approvals' | 'requests';
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
      accent: '#7c3aed', accentSoft: '#faf5ff', badge: 'รอจัดซื้อดำเนินการ',
      subject: `⏳ รอดำเนินการ (ฝ่ายจัดซื้อ): ${input.jobId}`,
      greeting: 'เรียน ผู้บริหารและผู้เกี่ยวข้อง',
      intro: 'ฝ่ายจัดซื้อได้รับทราบและกำลังดำเนินการสั่งซื้อ/ออก PO สำหรับรายการแจ้งซ่อมนี้เรียบร้อยแล้วค่ะ',
      ctaLabel: 'คลิกเข้าสู่ระบบ (เฉพาะผู้อนุมัติ)', route: 'approvals',
    },
    purchasing_in_progress: {
      accent: '#7c3aed', accentSoft: '#faf5ff', badge: 'จัดซื้อรับทราบแล้ว',
      subject: `✅ จัดซื้อรับทราบแล้ว: ${input.jobId}`,
      greeting: 'เรียน ผู้บริหารและผู้เกี่ยวข้อง',
      intro: 'ฝ่ายจัดซื้อได้รับทราบและกำลังดำเนินการสั่งซื้อ/ออก PO สำหรับรายการแจ้งซ่อมนี้เรียบร้อยแล้วค่ะ',
      ctaLabel: 'คลิกเข้าสู่ระบบเพื่อดูรายการ', route: 'requests',
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
    ctaLabel: 'เปิดระบบ Repair Request', route: 'requests',
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

  const historyHtml = actions.map((action) => `
    <div style="padding:11px 0;border-top:1px solid #e2e8f0">
      <div style="font-size:14px;color:#0f172a"><strong>${action.actorRole === 'purchasing' ? '📦' : '👤'} ${escapeEmailHtml(roleLabels[action.actorRole ?? ''] ?? 'ผู้ดำเนินการ')}:</strong> ${escapeEmailHtml(action.actorName)} (${escapeEmailHtml(actionStateLabel(action.action))})</div>
      <div style="margin-top:3px;font-size:13px;color:#475569"><strong>รายละเอียด:</strong> ${escapeEmailHtml(action.note?.trim() || '-')}</div>
    </div>`).join('');

  const rejectHtml = input.repairStatus === 'rejected' ? `
    <div style="margin-top:14px;padding:12px 14px;background:#fff1f2;border:1px solid #fecdd3;border-radius:10px;color:#991b1b">
      <strong>เหตุผลที่ไม่อนุมัติ:</strong> ${escapeEmailHtml(input.actionNote?.trim() || '-')}
    </div>` : '';

  const completionHtml = input.repairStatus === 'completed' ? `
    <div style="margin-top:14px;padding-top:14px;border-top:1px solid #bbf7d0">
      <div style="font-size:14px;font-weight:700;color:#166534">🏁 หมายเหตุปิดงาน</div>
      <div style="margin-top:7px;font-size:14px;color:#334155"><strong>ปิดงานโดย:</strong> ${escapeEmailHtml(input.actorName || '-')}</div>
      <div style="margin-top:4px;font-size:14px;color:#334155"><strong>รายละเอียด:</strong> ${escapeEmailHtml(input.actionNote?.trim() || '-')}</div>
      <div style="margin-top:4px;font-size:14px;color:#334155"><strong>วันที่/เวลา:</strong> ${escapeEmailHtml(displayDateTime(input.actionCreatedAt))}</div>
      <div style="margin-top:12px;font-size:16px;color:#0f172a"><strong>💰 ค่าใช้จ่ายในการซ่อม:</strong> ${escapeEmailHtml(cost || '0')} บาท</div>
    </div>` : '';

  const imageLinks = [
    input.beforeImageUrl ? `<div style="margin-top:10px"><strong>📷 ${input.repairStatus === 'completed' ? 'รูปภาพตอนแจ้ง (Before)' : 'รูปภาพประกอบ'}:</strong> <a href="${escapeEmailHtml(input.beforeImageUrl)}" style="color:#2563eb;font-weight:700">${input.repairStatus === 'completed' ? 'คลิกรูป' : 'คลิกเพื่อดูรูปภาพ'}</a></div>` : '',
    input.repairStatus === 'completed' && input.afterImageUrl ? `<div style="margin-top:10px"><strong>✅ รูปภาพหลังซ่อม (After):</strong> <a href="${escapeEmailHtml(input.afterImageUrl)}" style="color:#16a34a;font-weight:700">คลิกเพื่อดูรูปภาพงานที่เสร็จแล้ว</a></div>` : '',
  ].join('');

  const htmlBody = `
    <div style="margin:0;background:#f1f5f9;padding:22px 10px;font-family:Arial,'Noto Sans Thai',Tahoma,sans-serif;color:#0f172a;line-height:1.65">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,.08)">
        <div style="background:${stage.accent};color:#ffffff;padding:20px 24px">
          <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;opacity:.85">SMETALTECH · REPAIR REQUEST</div>
          <div style="margin-top:5px;font-size:23px;font-weight:700">${escapeEmailHtml(input.jobId)}</div>
          <div style="margin-top:8px;display:inline-block;border:1px solid rgba(255,255,255,.45);border-radius:999px;padding:3px 10px;font-size:12px;font-weight:700">${escapeEmailHtml(stage.badge)}</div>
        </div>
        <div style="padding:24px">
          <div style="font-size:17px;font-weight:700">${escapeEmailHtml(stage.greeting)}</div>
          <p style="margin:14px 0 18px;color:#334155">${escapeEmailHtml(stage.intro)}</p>
          <div style="background:${stage.accentSoft};border-left:5px solid ${stage.accent};padding:16px 18px;border-radius:4px 12px 12px 4px">
            <div style="font-size:20px;font-weight:700;color:#0f172a">รหัสแจ้งซ่อม: ${escapeEmailHtml(input.jobId)}</div>
            <div style="margin-top:13px;font-size:14px"><strong>แผนกที่แจ้ง:</strong> ${escapeEmailHtml(input.departmentName)}</div>
            <div style="margin-top:3px;font-size:14px;color:#475569"><strong>ผู้แจ้ง:</strong> ${escapeEmailHtml(input.requesterName)}</div>
            <div style="margin-top:13px;font-size:14px"><strong>เครื่องจักร/สถานที่:</strong> ${escapeEmailHtml(input.machineId)}</div>
            <div style="margin-top:13px;font-size:14px"><strong>อาการเสีย:</strong> ${escapeEmailHtml(input.issueDetails)}</div>
            ${historyHtml}
            ${rejectHtml}
            ${completionHtml}
            ${imageLinks}
          </div>
          <div style="margin-top:20px">
            <a href="${escapeEmailHtml(actionUrl)}" style="display:inline-block;background:${stage.accent};color:#ffffff;text-decoration:none;padding:11px 17px;border-radius:9px;font-size:14px;font-weight:700">👉 ${escapeEmailHtml(stage.ctaLabel)}</a>
          </div>
          <div style="margin-top:18px;padding-top:15px;border-top:1px solid #e2e8f0;font-size:13px;font-weight:700;color:${stage.accent}">สถานะปัจจุบัน: ${escapeEmailHtml(statusLabel)}</div>
          <p style="margin:8px 0 0;color:#64748b;font-size:11px">ลิงก์รูปภาพเปิดดูได้โดยไม่ต้องเข้าสู่ระบบและจะหมดอายุภายใน 30 วัน ส่วนรายละเอียดงานยังต้องเข้าสู่ระบบ</p>
        </div>
      </div>
    </div>`;

  return { subject: stage.subject, htmlBody, textBody: plainLines.join('\n') };
}
