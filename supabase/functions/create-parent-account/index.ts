import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.75.0";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
import { z } from "npm:zod@3.23.8";

const BodySchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(255),
  phone: z.string().trim().min(7).max(20),
  studentId: z.string().uuid().optional(),
  relationshipType: z.enum(["parent", "mother", "father", "guardian", "other"]).default("parent"),
  canViewGrades: z.boolean().default(true),
  canViewAttendance: z.boolean().default(true),
  canViewFees: z.boolean().default(true),
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const callerClient = createClient(url, publishableKey, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.slice(7);
    const { data: claimsData, error: claimsError } = await callerClient.auth.getClaims(token);
    const callerId = claimsData?.claims?.sub;
    if (claimsError || !callerId) return json({ error: "Unauthorized" }, 401);

    const adminClient = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: role } = await adminClient.from("user_roles").select("role").eq("user_id", callerId).eq("role", "admin").maybeSingle();
    if (!role) return json({ error: "Only administrators can create parent accounts" }, 403);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Invalid parent details", fields: parsed.error.flatten().fieldErrors }, 400);
    const input = parsed.data;

    if (input.studentId) {
      const { data: student } = await adminClient.from("students").select("id").eq("id", input.studentId).maybeSingle();
      if (!student) return json({ error: "Selected student was not found" }, 404);
    }

    const redirectTo = `${req.headers.get("origin") || "https://ilead1.lovable.app"}/login`;
    const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(input.email, {
      redirectTo,
      data: { full_name: input.fullName, role: "parent", phone: input.phone },
    });
    if (inviteError || !invited.user) {
      const message = inviteError?.message?.toLowerCase().includes("already")
        ? "An account already exists for this email"
        : inviteError?.message || "Could not create parent account";
      return json({ error: message }, 400);
    }

    const userId = invited.user.id;
    const { data: parent, error: parentError } = await adminClient
      .from("parents")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (parentError || !parent) {
      await adminClient.auth.admin.deleteUser(userId);
      return json({ error: "Parent profile provisioning failed; no account was retained" }, 500);
    }

    if (input.studentId) {
      const { error: linkError } = await adminClient.from("student_parent_relationships").insert({
        parent_id: parent.id,
        student_id: input.studentId,
        relationship_type: input.relationshipType,
        is_primary_contact: true,
        can_view_grades: input.canViewGrades,
        can_view_attendance: input.canViewAttendance,
        can_view_fees: input.canViewFees,
        verified: true,
      });
      if (linkError) {
        await adminClient.auth.admin.deleteUser(userId);
        return json({ error: "Child linking failed; no account was retained" }, 500);
      }
    }

    return json({ success: true, userId, invitationSent: true, childLinked: Boolean(input.studentId) });
  } catch (error) {
    console.error("create-parent-account", error);
    return json({ error: "An unexpected error occurred" }, 500);
  }
});