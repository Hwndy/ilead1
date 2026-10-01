import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MAX_FAILS = 5;
const WINDOW_MIN = 10;
const LOCK_MIN = 15;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let raw: unknown;
  try { raw = (await req.json())?.admissionNumber; } catch { raw = null; }
  const admissionNumber = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  if (!admissionNumber || admissionNumber.length > 40 || !/^[A-Z0-9/\-_. ]+$/.test(admissionNumber)) {
    return json({ error: "Please enter a valid admission number.", code: "invalid_input" }, 400);
  }

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const ua = req.headers.get("user-agent")?.slice(0, 300) ?? "";

  // Rate limit by IP
  const since = new Date(Date.now() - WINDOW_MIN * 60_000).toISOString();
  const { count } = await admin
    .from("student_login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip).eq("success", false).gte("created_at", since);
  if ((count ?? 0) >= MAX_FAILS) {
    return json({ error: `Too many attempts. Please wait ${LOCK_MIN} minutes and try again.`, code: "rate_limited" }, 429);
  }

  const record = async (success: boolean, userId: string | null, reason?: string) => {
    await admin.from("student_login_attempts").insert({ ip, admission_number: admissionNumber, success });
    await admin.from("audit_logs").insert({
      actor_id: userId, actor_email: null,
      action: success ? "student_sign_in" : "student_sign_in_failed",
      table_name: "students", row_id: null,
      metadata: { admission_number: admissionNumber, ip, user_agent: ua, reason },
    });
  };

  const { data: rows } = await admin
    .from("students")
    .select("id, user_id, admission_number, status, portal_login_enabled")
    .ilike("admission_number", admissionNumber)
    .limit(2);
  const student = (rows ?? []).find((s: any) => s.user_id) as any;

  const notFound = () => json({ error: "Admission number not found. Please check with the school office.", code: "not_found" }, 404);
  if (!student) { await record(false, null, "not_found"); return notFound(); }
  const status = String(student.status ?? "active").toLowerCase();
  if (["archived", "withdrawn", "graduated", "inactive", "expelled"].includes(status)) {
    await record(false, student.user_id, `status_${status}`); return notFound();
  }
  if (student.portal_login_enabled === false) {
    await record(false, student.user_id, "disabled");
    return json({ error: "Portal sign-in is turned off for this student. Please contact the school office.", code: "disabled" }, 403);
  }

  const { data: authUser, error: userErr } = await admin.auth.admin.getUserById(student.user_id);
  const email = authUser?.user?.email;
  if (userErr || !email) { await record(false, student.user_id, "no_auth_user"); return notFound(); }

  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = (link as any)?.properties?.hashed_token;
  if (linkErr || !tokenHash) {
    console.error("generateLink failed", linkErr);
    return json({ error: "Sign-in is temporarily unavailable. Please try again.", code: "server_error" }, 500);
  }

  // Students have no password to change.
  await admin.from("profiles").update({ must_change_password: false }).eq("user_id", student.user_id);
  await record(true, student.user_id);
  return json({ token_hash: tokenHash });
});
