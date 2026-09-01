import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.75.0";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const PAYSTACK = "https://api.paystack.co";

const ListSchema = z.object({ action: z.literal("list"), from: z.string().min(4), to: z.string().min(4) });
const VerifySchema = z.object({ action: z.literal("verify"), reference: z.string().min(3).max(160) });
const ApplySchema = z.object({ action: z.literal("apply"), reference: z.string().min(3).max(160) });
const MarkFailedSchema = z.object({ action: z.literal("mark_failed"), payment_id: z.string().uuid(), reason: z.string().max(500).optional() });
const BodySchema = z.discriminatedUnion("action", [ListSchema, VerifySchema, ApplySchema, MarkFailedSchema]);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const paystackKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackKey) return json({ error: "PAYSTACK_SECRET_KEY not configured" }, 500);

    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(authHeader.slice(7));
    const userId = claims?.claims?.sub;
    if (claimsErr || !userId) return json({ error: "Unauthorized" }, 401);

    const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: isAdmin } = await service.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) return json({ error: "Admin access required" }, 403);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
    const body = parsed.data;

    if (body.action === "list") {
      const rows: any[] = [];
      let page = 1;
      while (page <= 50) {
        const qs = new URLSearchParams({ from: body.from, to: body.to, perPage: "100", page: String(page) });
        const r = await fetch(`${PAYSTACK}/transaction?${qs}`, { headers: { Authorization: `Bearer ${paystackKey}` } });
        if (!r.ok) {
          const t = await r.text();
          console.error("paystack list", r.status, t);
          return json({ error: "Paystack list failed", status: r.status, details: t }, r.status);
        }
        const j = await r.json();
        const items = (j?.data ?? []) as any[];
        for (const t of items) {
          rows.push({
            reference: t.reference,
            amount: Number(t.amount) / 100,
            status: t.status,
            paid_at: t.paid_at ?? t.paidAt ?? null,
            customer_email: t.customer?.email ?? null,
            channel: t.channel ?? null,
            currency: t.currency ?? null,
          });
        }
        const meta = j?.meta;
        if (!meta || items.length < 100 || page * 100 >= (meta.total ?? 0)) break;
        page++;
      }
      return json({ transactions: rows });
    }

    if (body.action === "verify") {
      const r = await fetch(`${PAYSTACK}/transaction/verify/${encodeURIComponent(body.reference)}`, {
        headers: { Authorization: `Bearer ${paystackKey}` },
      });
      const j = await r.json();
      if (!r.ok) return json({ error: "Verify failed", details: j }, r.status);
      const d = j?.data;
      return json({
        transaction: d ? {
          reference: d.reference, amount: Number(d.amount) / 100, status: d.status,
          paid_at: d.paid_at ?? null, customer_email: d.customer?.email ?? null, channel: d.channel ?? null,
        } : null,
      });
    }

    if (body.action === "apply") {
      const { data: payment } = await service.from("fee_payments").select("*").eq("payment_reference", body.reference).maybeSingle();
      if (!payment) return json({ error: "Payment record not found for reference" }, 404);

      const r = await fetch(`${PAYSTACK}/transaction/verify/${encodeURIComponent(body.reference)}`, {
        headers: { Authorization: `Bearer ${paystackKey}` },
      });
      const j = await r.json();
      if (!r.ok || j?.data?.status !== "success") {
        return json({ error: "Paystack did not confirm success", details: j }, 400);
      }
      const expectedKobo = Math.round(Number(payment.amount_paid) * 100);
      const actualKobo = Number(j.data.amount);
      if (expectedKobo !== actualKobo) {
        return json({ error: `Amount mismatch: expected ${expectedKobo} kobo, Paystack reports ${actualKobo}` }, 400);
      }
      const paidAt = j.data.paid_at || new Date().toISOString();
      const receipt = payment.receipt_number || `REC-${new Date().getFullYear()}-${body.reference.slice(-8).toUpperCase()}`;
      const note = `${payment.notes ? payment.notes + "\n" : ""}Reconciled from Paystack by admin ${userId} @ ${new Date().toISOString()}`;

      const { error: updErr } = await service.from("fee_payments").update({
        status: "completed", paid_at: paidAt, payment_date: paidAt.slice(0, 10),
        receipt_number: receipt, notes: note,
      }).eq("id", payment.id);
      if (updErr) return json({ error: "Update failed", details: updErr.message }, 500);

      if (payment.fee_installment_id) {
        await service.from("fee_installments").update({
          paid_amount: payment.amount_paid, status: "paid", paid_at: paidAt, payment_id: payment.id,
        }).eq("id", payment.fee_installment_id);
      }
      return json({ success: true, receipt_number: receipt, payment_id: payment.id });
    }

    if (body.action === "mark_failed") {
      const { data: payment } = await service.from("fee_payments").select("id, notes").eq("id", body.payment_id).maybeSingle();
      if (!payment) return json({ error: "Payment not found" }, 404);
      const note = `${payment.notes ? payment.notes + "\n" : ""}Marked failed by admin ${userId} @ ${new Date().toISOString()}${body.reason ? `  ${body.reason}` : ""}`;
      const { error: updErr } = await service.from("fee_payments").update({ status: "failed", notes: note }).eq("id", body.payment_id);
      if (updErr) return json({ error: "Update failed", details: updErr.message }, 500);
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("paystack-reconcile", e);
    return json({ error: (e as Error).message || "Server error" }, 500);
  }
});