import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.75.0";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
import { z } from "npm:zod@3.23.8";

const BodySchema = z.object({
  student_id: z.string().uuid(),
  fee_structure_id: z.string().uuid().optional(),
  fee_installment_id: z.string().uuid().optional(),
  invoice_id: z.string().uuid().optional(),
  amount: z.number().positive().max(10000000),
  label: z.string().trim().min(1).max(120),
  callback_url: z.string().url().max(500),
}).refine(
  v => [v.fee_structure_id, v.fee_installment_id, v.invoice_id].filter(Boolean).length === 1,
  "Choose one fee item",
);

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: claims, error: claimsError } = await userClient.auth.getClaims(authHeader.slice(7));
    const userId = claims?.claims?.sub;
    const email = claims?.claims?.email;
    if (claimsError || !userId || typeof email !== "string") return json({ error: "Unauthorized" }, 401);
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Invalid payment details" }, 400);
    const input = parsed.data;
    const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

    const { data: linked } = await service.from("student_parent_relationships")
      .select("id,parents!inner(user_id)")
      .eq("student_id", input.student_id).eq("parents.user_id", userId).eq("can_view_fees", true).maybeSingle();
    if (!linked) return json({ error: "You cannot pay fees for this student" }, 403);

    if (input.invoice_id) {
      const { data: invoice } = await service.from("student_invoices")
        .select("id,total_amount,amount_paid,status,student_id")
        .eq("id", input.invoice_id).eq("student_id", input.student_id).maybeSingle();
      if (!invoice || invoice.status === "cancelled") return json({ error: "Invoice not found" }, 400);
      const due = Number(invoice.total_amount || 0) - Number(invoice.amount_paid || 0);
      if (input.amount > due + 0.5) return json({ error: "Invalid invoice amount" }, 400);
    } else if (input.fee_structure_id) {
      const { data: fee } = await service.from("fee_structures").select("id,amount").eq("id", input.fee_structure_id).maybeSingle();
      if (!fee || input.amount > Number(fee.amount)) return json({ error: "Invalid fee amount" }, 400);
    } else {
      const { data: installment } = await service.from("fee_installments").select("id,amount,paid_amount,plan_id,fee_installment_plans!inner(student_id)")
        .eq("id", input.fee_installment_id!).eq("fee_installment_plans.student_id", input.student_id).maybeSingle();
      if (!installment || input.amount > Number(installment.amount) - Number(installment.paid_amount || 0)) return json({ error: "Invalid installment amount" }, 400);
    }

    const reference = `FEE-${crypto.randomUUID()}`;
    const paystack = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("PAYSTACK_SECRET_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email, amount: Math.round(input.amount * 100), currency: "NGN", reference, callback_url: input.callback_url,
        metadata: { payment_type: "school_fee", student_id: input.student_id, fee_structure_id: input.fee_structure_id, fee_installment_id: input.fee_installment_id, invoice_id: input.invoice_id, parent_user_id: userId, label: input.label } }),
    });
    const payload = await paystack.json();
    if (!paystack.ok || !payload?.status) return json({ error: payload?.message || "Payment provider rejected the request" }, 502);
    const { error: insertError } = await service.from("fee_payments").insert({ student_id: input.student_id, fee_structure_id: input.fee_structure_id,
      fee_installment_id: input.fee_installment_id, invoice_id: input.invoice_id, amount_paid: input.amount, payment_method: "paystack", transaction_id: reference,
      payment_reference: reference, status: "pending", parent_user_id: userId, metadata: { label: input.label } });
    if (insertError) return json({ error: "Could not save payment request" }, 500);
    return json({ success: true, authorization_url: payload.data.authorization_url, reference });
  } catch (error) {
    console.error("initialize-fee-payment", error);
    return json({ error: "Could not initialize payment" }, 500);
  }
});
