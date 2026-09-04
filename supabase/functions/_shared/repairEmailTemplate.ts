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
  actorName?: string | null;
  actionNote?: string | null;
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

export function buildRepairEmail(input: RepairEmailTemplateInput) {
  const statusLabel = statusLabels[input.repairStatus] ?? input.repairStatus;
  const normalizedBase = input.appUrl.replace(/\/+$/, '');
  const route = input.repairStatus.startsWith('pending_') ? '/#/approvals' : '/#/requests';
  const actionUrl = `${normalizedBase}${route}`;
  const cost = displayCost(input.totalCost);
  const plainLines = [
    input.notificationBody,
    `รหัสแจ้งซ่อม: ${input.jobId}`,
    `ผู้แจ้ง: ${input.requesterName}`,
    `แผนก: ${input.departmentName}`,
    `เครื่องจักร/สถานที่: ${input.machineId}`,
    `อาการเสีย: ${input.issueDetails}`,
    `สถานะ: ${statusLabel}`,
  ];
  if (input.actorName) plainLines.push(`ดำเนินการโดย: ${input.actorName}`);
  if (input.actionNote) plainLines.push(`หมายเหตุ: ${input.actionNote}`);
  if (cost) plainLines.push(`ค่าใช้จ่าย: ${cost} บาท`);
  plainLines.push(`เปิดระบบ: ${actionUrl}`);

  const optionalRows = [
    input.actorName ? `<p style="margin:6px 0"><strong>ดำเนินการโดย:</strong> ${escapeEmailHtml(input.actorName)}</p>` : '',
    input.actionNote ? `<p style="margin:6px 0"><strong>หมายเหตุ:</strong> ${escapeEmailHtml(input.actionNote)}</p>` : '',
    cost ? `<p style="margin:6px 0"><strong>ค่าใช้จ่าย:</strong> ${escapeEmailHtml(cost)} บาท</p>` : '',
  ].join('');

  const htmlBody = `
    <div style="font-family:Arial,'Noto Sans Thai',sans-serif;color:#0f172a;line-height:1.65;max-width:680px;margin:0 auto">
      <div style="background:#0f766e;color:#fff;padding:18px 22px;border-radius:14px 14px 0 0">
        <div style="font-size:12px;opacity:.85">REPAIR REQUEST</div>
        <div style="font-size:21px;font-weight:700">${escapeEmailHtml(input.jobId)}</div>
      </div>
      <div style="border:1px solid #cbd5e1;border-top:0;padding:22px;border-radius:0 0 14px 14px">
        <p style="margin:0 0 16px">${escapeEmailHtml(input.notificationBody).replaceAll('\n', '<br>')}</p>
        <div style="background:#f8fafc;border-left:4px solid #14b8a6;padding:14px 16px;margin-bottom:18px">
          <p style="margin:6px 0"><strong>ผู้แจ้ง:</strong> ${escapeEmailHtml(input.requesterName)}</p>
          <p style="margin:6px 0"><strong>แผนก:</strong> ${escapeEmailHtml(input.departmentName)}</p>
          <p style="margin:6px 0"><strong>เครื่องจักร/สถานที่:</strong> ${escapeEmailHtml(input.machineId)}</p>
          <p style="margin:6px 0"><strong>อาการเสีย:</strong> ${escapeEmailHtml(input.issueDetails)}</p>
          <p style="margin:6px 0"><strong>สถานะ:</strong> ${escapeEmailHtml(statusLabel)}</p>
          ${optionalRows}
        </div>
        <a href="${escapeEmailHtml(actionUrl)}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:10px 16px;border-radius:9px;font-weight:700">เปิดระบบ Repair Request</a>
        <p style="margin:18px 0 0;color:#64748b;font-size:12px">กรุณาเข้าสู่ระบบเพื่อดูรายละเอียดและรูปภาพ ซึ่งจัดเก็บแบบ Private</p>
      </div>
    </div>`;

  return { htmlBody, textBody: plainLines.join('\n') };
}
