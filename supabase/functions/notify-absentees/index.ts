import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const today = new Date().toISOString().slice(0, 10);

    const { data: sessions } = await supabase.from("attendance_sessions").select("id").eq("date", today);
    const sessionIds = (sessions || []).map((s: any) => s.id);
    if (!sessionIds.length) return new Response(JSON.stringify({ sent: 0, note: "no sessions today" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: absents } = await supabase.from("student_attendance").select("student_id").in("attendance_session_id", sessionIds).eq("status", "absent");
    const studentIds = Array.from(new Set((absents || []).map((a: any) => a.student_id)));
    if (!studentIds.length) return new Response(JSON.stringify({ sent: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: students } = await supabase.from("students").select("id, user_id, admission_number").in("id", studentIds);
    const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", (students || []).map((s: any) => s.user_id).filter(Boolean));
    const nameMap = new Map((profs || []).map((p: any) => [p.user_id, p.full_name]));

    const { data: rels } = await supabase.from("student_parent_relationships").select("student_id, parent_id").in("student_id", studentIds);
    const parentIds = Array.from(new Set((rels || []).map((r: any) => r.parent_id)));
    const { data: parents } = parentIds.length ? await supabase.from("parents").select("id, user_id").in("id", parentIds) : { data: [] as any };
    const parentUidById = new Map((parents || []).map((p: any) => [p.id, p.user_id]));

    const from = `iVintage College <admissions@ivintagecollege.com>`;
    const replyTo = Deno.env.get("REPLY_TO_EMAIL")?.trim() || "suleayo04@gmail.com";
    let sent = 0;

    for (const r of rels || []) {
      const uid = parentUidById.get(r.parent_id);
      if (!uid) continue;
      const { data: u } = await supabase.auth.admin.getUserById(uid);
      const email = u?.user?.email;
      if (!email) continue;
      const stu = (students || []).find((s: any) => s.id === r.student_id);
      const name = nameMap.get(stu?.user_id) || stu?.admission_number || "your child";
      try {
        await resend.emails.send({
          from, to: [email], reply_to: replyTo,
          subject: `Absence notice — ${name} (${today})`,
          html: `<p>Dear Parent/Guardian,</p><p>This is to inform you that <strong>${name}</strong> was marked absent from school today, ${today}.</p><p>If this is unexpected, please contact the school.</p><p>iVintage College</p>`,
        });
        sent++;
      } catch (_) { /* continue */ }
    }

    return new Response(JSON.stringify({ sent, date: today }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});