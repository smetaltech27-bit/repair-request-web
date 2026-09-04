import { createClient } from "npm:@supabase/supabase-js@2";
import { buildRepairEmail, type RepairEmailAction } from "../_shared/repairEmailTemplate.ts";

interface ClaimedEmail {
  notification_id: string;
  recipient_email: string;
  email_subject: string;
  notification_body: string;
  request_id: string;
  job_id: string;
  requester_name: string;
  department_name: string;
  machine_id: string;
  issue_details: string;
  repair_status: string;
  total_cost: number | string | null;
  action_code: string | null;
  actor_name: string | null;
  action_note: string | null;
}

interface RepairActionRow {
  request_id: string;
  action: RepairEmailAction['action'];
  actor_name_snapshot: string;
  actor_role_snapshot: RepairEmailAction['actorRole'];
  note: string | null;
  created_at: string;
}

interface RepairAttachmentRow {
  request_id: string;
  kind: 'before' | 'after';
  storage_path: string | null;
  legacy_drive_url: string | null;
  created_at: string;
}

interface RepairAttachmentLinks {
  before?: string;
  after?: string;
}

type RecipientRole = 'employee' | 'supervisor' | 'department_manager' | 'factory_manager' | 'purchasing';

interface RecipientProfileRow {
  email: string | null;
  role: RecipientRole;
}

interface TestEmailRouting {
  employee_machine: string;
  employee_other: string;
  supervisor: string;
  department_manager: string;
  factory_manager: string;
  purchasing: string;
}

function env(name: string) {
  return Deno.env.get(name)?.trim() ?? "";
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function parseTestEmailRouting(value: string): TestEmailRouting | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<TestEmailRouting>;
    const requiredKeys: Array<keyof TestEmailRouting> = [
      'employee_machine',
      'employee_other',
      'supervisor',
      'department_manager',
      'factory_manager',
      'purchasing',
    ];
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (requiredKeys.some((key) => !emailPattern.test(String(parsed[key] ?? '').trim()))) return null;
    return Object.fromEntries(
      requiredKeys.map((key) => [key, String(parsed[key]).trim().toLowerCase()]),
    ) as unknown as TestEmailRouting;
  } catch {
    return null;
  }
}

function resolveTestRecipient(
  routing: TestEmailRouting,
  role: RecipientRole,
  requestDepartment: string,
) {
  if (role === 'employee') {
    return requestDepartment.trim().toLowerCase() === 'machine'
      ? routing.employee_machine
      : routing.employee_other;
  }
  return routing[role];
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function hmacHex(secret: string, value: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const dispatchSecret = env("REPAIR_EMAIL_DISPATCH_SECRET");
  const authorization = request.headers.get("authorization") ?? "";
  const suppliedSecret = request.headers.get("x-repair-dispatch-secret")
    ?? (authorization.startsWith("Bearer ") ? authorization.slice(7) : "");
  if (!dispatchSecret || !safeEqual(suppliedSecret, dispatchSecret)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = env("SUPABASE_URL");
  const adminKey = env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  const gasUrl = env("REPAIR_EMAIL_GAS_URL");
  const sharedSecret = env("REPAIR_EMAIL_SHARED_SECRET");
  const appUrl = env("REPAIR_APP_URL") || "https://smetaltech27-bit.github.io/repair-request-web";
  const testMode = env('REPAIR_EMAIL_TEST_MODE').toLowerCase() === 'true';
  const testRouting = testMode ? parseTestEmailRouting(env('REPAIR_EMAIL_TEST_ROUTING')) : null;
  if (!supabaseUrl || !adminKey || !gasUrl || !sharedSecret) {
    return json({ error: "Email dispatcher is not configured" }, 500);
  }
  if (testMode && !testRouting) {
    return json({ error: 'Email dispatcher test routing is invalid' }, 500);
  }

  const admin = createClient(supabaseUrl, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const requestedLimit = Number(new URL(request.url).searchParams.get("limit") || "10");
  const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 10, 1), 25);
  const { data, error: claimError } = await admin.rpc("claim_repair_email_notifications", { p_limit: limit });
  if (claimError) return json({ error: "Unable to claim email notifications", detail: claimError.message }, 500);

  const claimed = (data ?? []) as ClaimedEmail[];
  const requestIds = [...new Set(claimed.map((item) => item.request_id))];
  const actionsByRequest = new Map<string, RepairEmailAction[]>();
  const attachmentLinksByRequest = new Map<string, RepairAttachmentLinks>();
  const recipientProfilesByEmail = new Map<string, RecipientProfileRow>();
  let supplementalError = '';

  if (requestIds.length > 0) {
    const recipientEmails = [...new Set(claimed.map((item) => item.recipient_email.toLowerCase()))];
    const [actionsResult, attachmentsResult, recipientsResult] = await Promise.all([
      admin
        .from('repair_request_actions')
        .select('request_id,action,actor_name_snapshot,actor_role_snapshot,note,created_at')
        .in('request_id', requestIds)
        .order('created_at', { ascending: true }),
      admin
        .from('repair_request_attachments')
        .select('request_id,kind,storage_path,legacy_drive_url,created_at')
        .in('request_id', requestIds)
        .order('created_at', { ascending: true }),
      admin
        .from('repair_profiles')
        .select('email,role')
        .in('email', recipientEmails),
    ]);

    supplementalError = actionsResult.error?.message
      || attachmentsResult.error?.message
      || recipientsResult.error?.message
      || '';
    for (const row of (actionsResult.data ?? []) as RepairActionRow[]) {
      const actions = actionsByRequest.get(row.request_id) ?? [];
      actions.push({
        action: row.action,
        actorName: row.actor_name_snapshot,
        actorRole: row.actor_role_snapshot,
        note: row.note,
        createdAt: row.created_at,
      });
      actionsByRequest.set(row.request_id, actions);
    }
    for (const row of (attachmentsResult.data ?? []) as RepairAttachmentRow[]) {
      let imageUrl = row.legacy_drive_url?.trim() ?? '';
      if (!imageUrl && row.storage_path) {
        const { data: signed, error: signedError } = await admin.storage
          .from('repair-images')
          .createSignedUrl(row.storage_path, 60 * 60 * 24 * 30);
        if (signedError || !signed?.signedUrl) {
          supplementalError ||= signedError?.message || 'Unable to create a signed image URL';
          continue;
        }
        imageUrl = signed.signedUrl;
      }
      if (imageUrl) {
        const links = attachmentLinksByRequest.get(row.request_id) ?? {};
        links[row.kind] = imageUrl;
        attachmentLinksByRequest.set(row.request_id, links);
      }
    }
    for (const row of (recipientsResult.data ?? []) as RecipientProfileRow[]) {
      if (row.email) recipientProfilesByEmail.set(row.email.toLowerCase(), row);
    }
  }

  let sent = 0;
  let failed = 0;
  const errors: Array<{ notificationId: string; message: string }> = [];

  for (const item of claimed) {
    let adapterAccepted = false;
    try {
      if (supplementalError) throw new Error(`Unable to load email details: ${supplementalError}`);
      const actions = actionsByRequest.get(item.request_id) ?? [];
      const currentAction = actions.at(-1);
      const attachmentLinks = attachmentLinksByRequest.get(item.request_id) ?? {};
      const recipientProfile = recipientProfilesByEmail.get(item.recipient_email.toLowerCase());
      if (!recipientProfile) throw new Error('Unable to resolve the intended email recipient profile');
      const recipientEmail = testMode
        ? resolveTestRecipient(testRouting as TestEmailRouting, recipientProfile.role, item.department_name)
        : item.recipient_email;
      const { subject, htmlBody, textBody } = buildRepairEmail({
        appUrl,
        notificationBody: item.notification_body,
        jobId: item.job_id,
        requesterName: item.requester_name,
        departmentName: item.department_name,
        machineId: item.machine_id,
        issueDetails: item.issue_details,
        repairStatus: item.repair_status,
        totalCost: item.total_cost,
        actionCode: item.action_code,
        actorName: item.actor_name,
        actionNote: item.action_note,
        actionCreatedAt: currentAction?.createdAt,
        actions,
        beforeImageUrl: attachmentLinks.before,
        afterImageUrl: attachmentLinks.after,
        isRequesterReceipt: item.email_subject.startsWith('รับรายการแจ้งซ่อม'),
      });
      const timestamp = Date.now().toString();
      const canonical = [timestamp, item.notification_id, recipientEmail, subject, htmlBody].join("\n");
      const signature = await hmacHex(sharedSecret, canonical);
      const response = await fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timestamp,
          notificationId: item.notification_id,
          to: recipientEmail,
          subject,
          textBody,
          htmlBody,
          signature,
        }),
        redirect: "follow",
      });
      const result = await response.json().catch(() => ({ ok: false, error: "Invalid adapter response" }));
      if (!response.ok || result.ok !== true) {
        throw new Error(String(result.error || `Email adapter returned HTTP ${response.status}`));
      }
      adapterAccepted = true;

      const { error: completeError } = await admin.rpc("complete_repair_email_notification", {
        p_notification_id: item.notification_id,
        p_sent: true,
        p_error: null,
      });
      if (completeError) throw completeError;
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown email delivery error";
      failed += 1;
      errors.push({ notificationId: item.notification_id, message });
      if (!adapterAccepted) {
        await admin.rpc("complete_repair_email_notification", {
          p_notification_id: item.notification_id,
          p_sent: false,
          p_error: message,
        });
      }
    }
  }

  return json({ claimed: claimed.length, sent, failed, testMode, errors });
});
