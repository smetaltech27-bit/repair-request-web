import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ||
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ||
  "";
const SUPABASE_ADMIN_KEY =
  Deno.env.get("SUPABASE_SECRET_KEY") ||
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  "";

const AVATAR_BUCKET = "repair-avatars";
const INTERNAL_AUTH_DOMAIN = "repair-request.internal";
const ALLOWED_ROLES = new Set([
  "employee",
  "supervisor",
  "department_manager",
  "factory_manager",
  "purchasing",
]);
const PROFILE_COLUMNS =
  "id, legacy_uid, legacy_username, full_name, email, department_id, role, is_active, avatar_path, created_at, updated_at, repair_departments(name)";

function isAllowedOrigin(origin: string) {
  if (!origin) return false;
  if (origin === "https://smetaltech27-bit.github.io") return true;
  try {
    const url = new URL(origin);
    return url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin : "https://smetaltech27-bit.github.io",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function jsonResponse(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function normalizeText(value: unknown, maxLength = 200) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function normalizeUsername(value: unknown) {
  return String(value ?? "").trim().toLowerCase().slice(0, 120);
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function usernameToAuthEmail(username: string) {
  if (isEmail(username)) return username;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(username));
  const hash = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `legacy-${hash.slice(0, 32)}@${INTERNAL_AUTH_DOMAIN}`;
}

async function passwordToAuthPassword(password: string) {
  if (!/^\d{4}$/.test(password)) return password;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`repair-legacy-v1:${password}`),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function validatePassword(value: unknown, required: boolean) {
  const password = String(value ?? "");
  if (!password && !required) return "";
  if (!password) throw new Error("กรุณากำหนด Password สำหรับพนักงานใหม่");
  if (/^\d{4}$/.test(password)) return password;
  const characterLength = Array.from(password).length;
  const byteLength = new TextEncoder().encode(password).length;
  if (characterLength < 6 || byteLength > 72) {
    throw new Error("ใช้ตัวเลข 4 หลัก หรือ Password ตั้งแต่ 6 ตัวอักษรและไม่เกิน 72 bytes");
  }
  return password;
}

function decodeAvatar(dataUrl: unknown) {
  if (!dataUrl) return null;
  const match = String(dataUrl).match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("รูปพนักงานต้องเป็นไฟล์ JPG, PNG หรือ WebP");
  const mimeType = match[1];
  const binary = atob(match[2]);
  if (binary.length > 8 * 1024 * 1024) throw new Error("รูปพนักงานต้องมีขนาดไม่เกิน 8 MB");
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  return { bytes, mimeType, extension };
}

function departmentName(value: unknown) {
  if (Array.isArray(value)) return normalizeText(value[0]?.name, 200) || null;
  if (value && typeof value === "object" && "name" in value) {
    return normalizeText((value as { name?: unknown }).name, 200) || null;
  }
  return null;
}

async function presentProfiles(admin: ReturnType<typeof createClient>, rows: Array<Record<string, unknown>>) {
  const paths = rows.map((row) => String(row.avatar_path || "")).filter(Boolean);
  const signedUrlByPath = new Map<string, string>();
  if (paths.length) {
    const { data } = await admin.storage.from(AVATAR_BUCKET).createSignedUrls(paths, 60 * 60);
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) signedUrlByPath.set(item.path, item.signedUrl);
    }
  }
  return rows.map((row) => ({
    id: row.id,
    legacy_uid: row.legacy_uid,
    username: row.legacy_username,
    full_name: row.full_name,
    email: row.email,
    department_id: row.department_id,
    department_name: departmentName(row.repair_departments),
    role: row.role,
    is_active: row.is_active,
    avatar_path: row.avatar_path,
    avatar_url: signedUrlByPath.get(String(row.avatar_path || "")) || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return jsonResponse(request, { error: "Method not allowed" }, 405);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_ADMIN_KEY) {
    return jsonResponse(request, { error: "Edge Function secrets are not configured" }, 500);
  }

  const authorization = request.headers.get("authorization") || "";
  const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!accessToken) return jsonResponse(request, { error: "กรุณา Login ใหม่ก่อนเข้า Settings" }, 401);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "Invalid JSON body" }, 400);
  }

  const sessionToken = String(body.sessionToken ?? "");
  const action = normalizeText(body.action, 20);
  const caller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const admin = createClient(SUPABASE_URL, SUPABASE_ADMIN_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: authorizationRows, error: authorizationError } = await caller.rpc(
    "authorize_repair_employee_admin",
    { p_session_token: sessionToken },
  );
  const actor = authorizationRows?.[0];
  if (authorizationError || !actor) {
    return jsonResponse(request, { error: "Settings Session หมดอายุ กรุณากรอก Password อีกครั้ง" }, 403);
  }

  try {
    if (action === "list") {
      const { data, error } = await admin
        .from("repair_profiles")
        .select(PROFILE_COLUMNS)
        .order("full_name");
      if (error) throw error;
      return jsonResponse(request, { employees: await presentProfiles(admin, data as Array<Record<string, unknown>>) });
    }

    if (action !== "create" && action !== "update") {
      return jsonResponse(request, { error: "Unsupported action" }, 400);
    }

    const employee = (body.employee && typeof body.employee === "object")
      ? body.employee as Record<string, unknown>
      : {};
    const username = normalizeUsername(employee.username);
    const fullName = normalizeText(employee.fullName, 200);
    const notificationEmail = normalizeText(employee.email, 320).toLowerCase();
    const departmentId = normalizeText(employee.departmentId, 50);
    const role = normalizeText(employee.roleCode, 40);
    const isActive = employee.isActive !== false;

    if (!username || /\s/.test(username)) throw new Error("Username ต้องไม่ว่างและไม่มีช่องว่าง");
    if (!fullName) throw new Error("กรุณากรอกชื่อ–นามสกุล");
    if (notificationEmail && !isEmail(notificationEmail)) throw new Error("รูปแบบ Email ไม่ถูกต้อง");
    if (!/^[0-9a-f-]{36}$/i.test(departmentId)) throw new Error("กรุณาเลือกแผนก");
    if (!ALLOWED_ROLES.has(role)) throw new Error("Role ไม่ถูกต้อง");

    const { data: department, error: departmentError } = await admin
      .from("repair_departments")
      .select("id")
      .eq("id", departmentId)
      .eq("is_active", true)
      .maybeSingle();
    if (departmentError || !department) throw new Error("ไม่พบแผนกที่เลือก");

    const avatar = decodeAvatar(employee.avatarDataUrl);
    const password = validatePassword(employee.password, action === "create");
    const authEmail = await usernameToAuthEmail(username);

    if (action === "create") {
      let createdAuthUserId = "";
      let avatarPath = "";
      try {
        const { data: createdAuth, error: createAuthError } = await admin.auth.admin.createUser({
          email: authEmail,
          password: await passwordToAuthPassword(password),
          email_confirm: true,
          user_metadata: { legacy_username: username, full_name: fullName },
        });
        if (createAuthError || !createdAuth.user) throw createAuthError || new Error("สร้างบัญชี Login ไม่สำเร็จ");
        createdAuthUserId = createdAuth.user.id;

        if (avatar) {
          avatarPath = `${createdAuthUserId}/admin-avatar-${crypto.randomUUID()}.${avatar.extension}`;
          const { error: avatarError } = await admin.storage.from(AVATAR_BUCKET).upload(avatarPath, avatar.bytes, {
            contentType: avatar.mimeType,
            cacheControl: "86400",
            upsert: false,
          });
          if (avatarError) throw avatarError;
        }

        const { data: createdProfile, error: profileError } = await admin
          .from("repair_profiles")
          .insert({
            id: createdAuthUserId,
            legacy_username: username,
            full_name: fullName,
            email: notificationEmail || (isEmail(username) ? username : null),
            department_id: departmentId,
            role,
            is_active: isActive,
            avatar_path: avatarPath || null,
          })
          .select(PROFILE_COLUMNS)
          .single();
        if (profileError || !createdProfile) throw profileError || new Error("สร้างข้อมูลพนักงานไม่สำเร็จ");

        const { error: auditError } = await admin.rpc("record_repair_employee_admin_audit", {
          p_actor_id: actor.actor_id,
          p_target_profile_id: createdAuthUserId,
          p_action: "create",
          p_before_data: null,
          p_after_data: {
            username,
            full_name: fullName,
            email: notificationEmail || null,
            department_id: departmentId,
            role,
            is_active: isActive,
            password_changed: true,
            avatar_changed: Boolean(avatar),
          },
        });
        if (auditError) throw auditError;

        const [presented] = await presentProfiles(admin, [createdProfile as Record<string, unknown>]);
        return jsonResponse(request, { employee: presented }, 201);
      } catch (error) {
        if (avatarPath) await admin.storage.from(AVATAR_BUCKET).remove([avatarPath]);
        if (createdAuthUserId) await admin.auth.admin.deleteUser(createdAuthUserId);
        throw error;
      }
    }

    const id = normalizeText(employee.id, 50);
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("ไม่พบรหัสพนักงาน");
    const { data: existing, error: existingError } = await admin
      .from("repair_profiles")
      .select(PROFILE_COLUMNS)
      .eq("id", id)
      .single();
    if (existingError || !existing) throw existingError || new Error("ไม่พบพนักงาน");
    if (id === actor.actor_id && !isActive) throw new Error("ไม่สามารถปิดบัญชีที่กำลังใช้จัดการ Settings ได้");

    let newAvatarPath = "";
    if (avatar) {
      newAvatarPath = `${id}/admin-avatar-${crypto.randomUUID()}.${avatar.extension}`;
      const { error: avatarError } = await admin.storage.from(AVATAR_BUCKET).upload(newAvatarPath, avatar.bytes, {
        contentType: avatar.mimeType,
        cacheControl: "86400",
        upsert: false,
      });
      if (avatarError) throw avatarError;
    }

    const profilePayload = {
      legacy_username: username,
      full_name: fullName,
      email: notificationEmail || (isEmail(username) ? username : null),
      department_id: departmentId,
      role,
      is_active: isActive,
      avatar_path: newAvatarPath || existing.avatar_path,
    };

    try {
      const { data: updatedProfile, error: profileError } = await admin
        .from("repair_profiles")
        .update(profilePayload)
        .eq("id", id)
        .select(PROFILE_COLUMNS)
        .single();
      if (profileError || !updatedProfile) throw profileError || new Error("บันทึกข้อมูลพนักงานไม่สำเร็จ");

      const authAttributes = password
        ? {
          email: authEmail,
          email_confirm: true,
          user_metadata: { legacy_username: username, full_name: fullName },
          password: await passwordToAuthPassword(password),
        }
        : {
          email: authEmail,
          email_confirm: true,
          user_metadata: { legacy_username: username, full_name: fullName },
        };
      const { error: authError } = await admin.auth.admin.updateUserById(id, authAttributes);
      if (authError) {
        await admin.from("repair_profiles").update({
          legacy_username: existing.legacy_username,
          full_name: existing.full_name,
          email: existing.email,
          department_id: existing.department_id,
          role: existing.role,
          is_active: existing.is_active,
          avatar_path: existing.avatar_path,
        }).eq("id", id);
        if (newAvatarPath) await admin.storage.from(AVATAR_BUCKET).remove([newAvatarPath]);
        throw authError;
      }

      const { error: auditError } = await admin.rpc("record_repair_employee_admin_audit", {
        p_actor_id: actor.actor_id,
        p_target_profile_id: id,
        p_action: "update",
        p_before_data: {
          username: existing.legacy_username,
          full_name: existing.full_name,
          email: existing.email,
          department_id: existing.department_id,
          role: existing.role,
          is_active: existing.is_active,
          avatar_path: existing.avatar_path,
        },
        p_after_data: {
          username,
          full_name: fullName,
          email: profilePayload.email,
          department_id: departmentId,
          role,
          is_active: isActive,
          avatar_path: profilePayload.avatar_path,
          password_changed: Boolean(password),
          avatar_changed: Boolean(avatar),
        },
      });
      if (auditError) throw auditError;

      if (newAvatarPath && existing.avatar_path && existing.avatar_path !== newAvatarPath) {
        await admin.storage.from(AVATAR_BUCKET).remove([existing.avatar_path]);
      }
      const [presented] = await presentProfiles(admin, [updatedProfile as Record<string, unknown>]);
      return jsonResponse(request, { employee: presented });
    } catch (error) {
      if (newAvatarPath) await admin.storage.from(AVATAR_BUCKET).remove([newAvatarPath]);
      throw error;
    }
  } catch (error) {
    console.error("repair-admin-user error", error);
    const message = error instanceof Error ? error.message : String(error || "จัดการพนักงานไม่สำเร็จ");
    const duplicate = message.includes("duplicate key") || message.includes("already been registered");
    return jsonResponse(request, { error: duplicate ? "Username นี้ถูกใช้งานแล้ว" : message }, 400);
  }
});
