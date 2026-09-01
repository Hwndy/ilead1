import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_EMAIL_DOMAIN = "ilead1.lovable.app";
const DEFAULT_SENDER_EMAIL = "admissions@ivintagecollege.com";
const DEFAULT_REPLY_TO_EMAIL = "suleayo04@gmail.com";

function safeSender(): string {
  const v = Deno.env.get("SENDER_EMAIL")?.trim() || DEFAULT_SENDER_EMAIL;
  const domain = v.split("@").pop()?.toLowerCase();
  return domain === ALLOWED_EMAIL_DOMAIN ? v : DEFAULT_SENDER_EMAIL;
}
function safeReplyTo(): string {
  const v = Deno.env.get("REPLY_TO_EMAIL")?.trim() || DEFAULT_REPLY_TO_EMAIL;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : DEFAULT_REPLY_TO_EMAIL;
}

interface Body {
  student_ids: string[];
  class_id: string;
  session_id: string;
  term: string; // "First Term" | ...
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { student_ids, class_id, session_id, term } = (await req.json()) as Body;

    if (!Array.isArray(student_ids) || !student_ids.length || !class_id || !session_id || !term) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const [{ data: sess }, { data: cls }, { data: school }] = await Promise.all([
      supabase.from("admission_sessions").select("session_name, academic_year").eq("id", session_id).maybeSingle(),
      supabase.from("classes").select("name").eq("id", class_id).maybeSingle(),
      supabase.from("school_info").select("name, email, phone").limit(1).maybeSingle(),
    ]);

    const schoolName = school?.name || "iVintage College";
    const from = `${schoolName} <${safeSender()}>`;
    const replyTo = safeReplyTo();

    let sent = 0, failed = 0; const errors: any[] = [];

    for (const student_id of student_ids) {
      try {
        // Look up student + parents
        const { data: student } = await supabase.from("students").select("id, user_id, admission_number").eq("id", student_id).maybeSingle();
        if (!student) { failed++; continue; }
        const { data: prof } = await supabase.from("profiles").select("full_name").eq("user_id", student.user_id).maybeSingle();
        const { data: rels } = await supabase.from("student_parent_relationships").select("parent_id").eq("student_id", student_id);
        const parentIds = (rels || []).map((r: any) => r.parent_id);
        if (!parentIds.length) { failed++; errors.push({ student_id, reason: "no linked parent" }); continue; }
        const { data: parents } = await supabase.from("parents").select("user_id").in("id", parentIds);
        const parentUserIds = (parents || []).map((p: any) => p.user_id);

        const emails: string[] = [];
        for (const uid of parentUserIds) {
          const { data: u } = await supabase.auth.admin.getUserById(uid);
          if (u?.user?.email) emails.push(u.user.email);
        }
        if (!emails.length) { failed++; errors.push({ student_id, reason: "parents have no email" }); continue; }

        const link = `${Deno.env.get("SUPABASE_URL")?.replace(/\.supabase\.co.*/, "") || ""}`; // placeholder
        const html = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#141C2B;color:#fff;padding:20px;text-align:center">
              <h2 style="margin:0">${schoolName}</h2>
              <p style="margin:4px 0 0">${sess?.session_name || ""} • ${term}</p>
            </div>
            <div style="padding:20px">
              <p>Dear Parent/Guardian,</p>
              <p>The report card for <strong>${prof?.full_name || "your child"}</strong> (${student.admission_number || ""}) — ${cls?.name || ""} — for <strong>${term}</strong> has been published.</p>
              <p>Please log in to the Parent Portal to download the official PDF:</p>
              <p><a href="https://ilead1.lovable.app" style="background:#141C2B;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Open Parent Portal</a></p>
              <p style="color:#666;font-size:12px;margin-top:24px">If you did not expect this message, please contact ${school?.email || replyTo}.</p>
            </div>
          </div>`;

        await resend.emails.send({
          from, to: emails, reply_to: replyTo,
          subject: `${term} Report Card — ${prof?.full_name || student.admission_number}`,
          html,
        });

        await supabase.from("email_logs").insert({
          recipient_email: emails.join(","), subject: `${term} Report Card`, status: "sent",
          email_type: "report_card", sent_at: new Date().toISOString(),
        } as any).select().maybeSingle();

        sent++;
      } catch (e: any) {
        failed++; errors.push({ student_id, reason: e.message });
      }
    }

    return new Response(JSON.stringify({ sent, failed, errors }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});