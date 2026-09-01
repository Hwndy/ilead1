import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";
import { jsPDF } from "npm:jspdf@2.5.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const FRONTEND_URL = (Deno.env.get("FRONTEND_URL") || "https://ilead1.lovable.app").replace(/\/+$/, "");
// NOTE: the custom domain serves index.html for /__l5e/* paths, so assets must be
// loaded from the Lovable asset host (or an explicit ASSET_BASE_URL secret).
const ASSET_BASE_URL = (Deno.env.get("ASSET_BASE_URL") || "https://id-preview--def176ba-5aaa-4bf2-a711-588b116fc44e.lovable.app").replace(/\/+$/, "");
const LETTERHEAD_URL = `${ASSET_BASE_URL}/__l5e/assets-v1/f210aa1b-7164-4673-a0da-2e0eb697e3a9/ivintage-letterhead.png`;
const ALLOWED_EMAIL_DOMAIN = "ilead1.lovable.app";
const DEFAULT_SENDER_EMAIL = "admissions@ivintagecollege.com";
const DEFAULT_REPLY_TO_EMAIL = "admissions@ivintagecollege.com";
const SENDER_EMAIL = getSafeSchoolEmail("SENDER_EMAIL", DEFAULT_SENDER_EMAIL);
const REPLY_TO = getReplyToEmail("REPLY_TO_EMAIL", DEFAULT_REPLY_TO_EMAIL);
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

function getSafeSchoolEmail(envName: string, fallback: string): string {
  const configured = Deno.env.get(envName)?.trim() || fallback;
  const domain = configured.split("@").pop()?.toLowerCase();

  if (domain !== ALLOWED_EMAIL_DOMAIN) {
    console.error(`${envName} is misconfigured. Expected @${ALLOWED_EMAIL_DOMAIN}, received @${domain || "unknown"}. Falling back to ${fallback}.`);
    return fallback;
  }

  return configured;
}

function getReplyToEmail(envName: string, fallback: string): string {
  const configured = Deno.env.get(envName)?.trim() || fallback;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configured)) {
    console.error(`${envName} is not a valid email (${configured}). Falling back to ${fallback}.`);
    return fallback;
  }
  return configured;
}

interface OfferLetterRequest {
  application_id: string;
  acceptance_deadline: string;
  acceptance_fee?: number;
  admitted_class_id?: string | null;
  class_change_note?: string | null;
}

// Helper function to send email with retry logic
async function sendEmailWithRetry(emailData: any, maxRetries = MAX_RETRIES): Promise<any> {
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await resend.emails.send(emailData);
      if (result && (result as any).error) {
        const err = (result as any).error;
        const message = err.message || err.name || JSON.stringify(err);
        throw new Error(`Resend error: ${message}`);
      }
      return result;
    } catch (error) {
      console.error(`Email send attempt ${attempt + 1} failed:`, error);
      lastError = error;
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

// Helper function to log email attempts
async function logEmail(supabase: any, logData: any) {
  try {
    await supabase.from('email_logs').insert(logData);
  } catch (error) {
    console.error('Failed to log email:', error);
  }
}

// Fetch letterhead PNG once and cache as base64 data URL for jsPDF
let cachedLetterhead: string | null = null;
async function getLetterheadDataUrl(): Promise<string | null> {
  if (cachedLetterhead) return cachedLetterhead;
  try {
    const res = await fetch(LETTERHEAD_URL);
    if (!res.ok) {
      console.error("Failed to fetch letterhead:", res.status);
      return null;
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    // Guard: some hosts return an SPA index.html with a 200 status.
    const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (buf.length < 8 || PNG_SIG.some((b, i) => buf[i] !== b)) {
      console.error("Letterhead URL did not return a PNG:", res.headers.get("content-type"));
      return null;
    }
    let binary = "";
    for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
    cachedLetterhead = `data:image/png;base64,${btoa(binary)}`;
    return cachedLetterhead;
  } catch (e) {
    console.error("Letterhead fetch error:", e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Offer letter PDF — the letter is typeset INSIDE the official letterhead page.
// The letterhead PNG is a full-page design (crest + address band at the top,
// watermark in the middle, colour bars at the foot), so it is drawn as the page
// background and all text is laid out inside a safe area between the two.
// ---------------------------------------------------------------------------
const PAGE_FORMAT = "letter";      // 215.9mm x 279.4mm — matches the artwork ratio
const SAFE_TOP = 60;               // below the address band
const SAFE_BOTTOM = 258;           // above the footer colour bars
const SAFE_LEFT = 25;
const SAFE_RIGHT = 25;

function fmtDate(value: string | number | Date) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

async function generateOfferLetterPDF(
  application: any,
  acceptanceDeadline: string,
  acceptanceFee: number,
  acceptanceFeeNote: string,
  classInfo: { appliedClassName: string; admittedClassName: string; changed: boolean; note?: string | null },
): Promise<Uint8Array> {
  const doc = new jsPDF({ unit: "mm", format: PAGE_FORMAT });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - SAFE_LEFT - SAFE_RIGHT;

  const letterhead = await getLetterheadDataUrl();

  const paintBackground = () => {
    if (letterhead) {
      try {
        doc.addImage(letterhead, "PNG", 0, 0, pageWidth, pageHeight, undefined, "FAST");
        return true;
      } catch (e) {
        console.error("Failed to draw letterhead:", e);
      }
    }
    // Fallback stationery if the artwork cannot be fetched.
    doc.setFillColor(21, 128, 61);
    doc.rect(0, 0, pageWidth, 26, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("IVINTAGE COLLEGE", pageWidth / 2, 16, { align: "center" });
    doc.setTextColor(0, 0, 0);
    doc.setFillColor(21, 128, 61);
    doc.rect(0, pageHeight - 10, pageWidth, 10, "F");
    return false;
  };

  paintBackground();
  let y = SAFE_TOP;

  const ensureSpace = (needed: number) => {
    if (y + needed <= SAFE_BOTTOM) return;
    doc.addPage(PAGE_FORMAT);
    paintBackground();
    y = SAFE_TOP;
  };

  const write = (
    text: string,
    opts: { size?: number; bold?: boolean; align?: "left" | "center" | "right"; gap?: number; colour?: [number, number, number] } = {},
  ) => {
    const size = opts.size ?? 10.5;
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(size);
    const [r, g, b] = opts.colour ?? [17, 24, 39];
    doc.setTextColor(r, g, b);
    const lines = doc.splitTextToSize(text, contentWidth);
    const lineHeight = size * 0.5;
    ensureSpace(lines.length * lineHeight);
    const x = opts.align === "center" ? pageWidth / 2 : opts.align === "right" ? pageWidth - SAFE_RIGHT : SAFE_LEFT;
    doc.text(lines, x, y, opts.align ? { align: opts.align } : undefined);
    y += lines.length * lineHeight + (opts.gap ?? 4);
  };

  const detailRow = (label: string, value: string) => {
    ensureSpace(6);
    doc.setFontSize(10.5);
    doc.setTextColor(17, 24, 39);
    doc.setFont("helvetica", "normal");
    doc.text(label, SAFE_LEFT, y);
    doc.setFont("helvetica", "bold");
    doc.text(value, SAFE_LEFT + 52, y);
    y += 6;
  };

  const today = fmtDate(new Date());
  const deadline = fmtDate(acceptanceDeadline);
  const session = `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;
  const className = classInfo.admittedClassName;
  const candidate = `${application.first_name} ${application.last_name}`.replace(/\s+/g, " ").trim();

  // Reference line and date
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(75, 85, 99);
  doc.text(`Ref: ${application.application_number}`, SAFE_LEFT, y);
  doc.text(today, pageWidth - SAFE_RIGHT, y, { align: "right" });
  y += 12;

  write(candidate, { bold: true, gap: 0 });
  if (application.email) write(application.email, { size: 10, colour: [75, 85, 99], gap: 8 });

  write("OFFER OF PROVISIONAL ADMISSION", { bold: true, size: 12, gap: 1 });
  doc.setDrawColor(21, 128, 61);
  doc.setLineWidth(0.4);
  doc.line(SAFE_LEFT, y - 1, SAFE_LEFT + 78, y - 1);
  y += 4;

  write(`Dear ${application.first_name},`, { gap: 3 });

  write(
    `Following the assessment of your application, I am pleased to confirm that you have been admitted to ${className} at iVintage College for the ${session} academic session. The offer is provisional until the acceptance fee is paid and your original documents are sighted at the school office.`,
    { gap: classInfo.changed ? 3 : 5 },
  );

  if (classInfo.changed) {
    write(
      `Following your performance in the entrance assessment, the school is offering admission into ${classInfo.admittedClassName} rather than ${classInfo.appliedClassName}.${classInfo.note ? ` ${classInfo.note}` : ""}`,
      { gap: 5 },
    );
  }

  write("Particulars of the offer", { bold: true, size: 11, gap: 3 });
  detailRow("Application number", String(application.application_number));
  detailRow("Class applied for", String(classInfo.appliedClassName));
  detailRow("Class admitted to", String(classInfo.admittedClassName));
  detailRow("Academic session", session);
  detailRow("Acceptance fee", `NGN ${Number(acceptanceFee || 0).toLocaleString("en-NG")}`);
  detailRow("Payment deadline", deadline);
  y += 2;

  if (acceptanceFeeNote) {
    write(acceptanceFeeNote, { size: 10, colour: [75, 85, 99], gap: 5 });
  }

  write(
    `To take up the place, please accept the offer online using the link in the accompanying email and pay the acceptance fee on or before ${deadline}. Offers that are not accepted by that date are released to candidates on the waiting list.`,
    { gap: 3 },
  );

  write(
    "When payment is confirmed the school will issue an admission number and portal login details for the student, along with parent portal access for results, attendance and fees. Please bring the originals of your uploaded documents, two passport photographs and this letter on resumption day.",
    { gap: 5 },
  );

  ensureSpace(26);
  write("Yours faithfully,", { gap: 12 });
  write("Admissions Officer", { bold: true, gap: 1 });
  write("For: iVintage College, Badagry, Lagos", { size: 10, colour: [75, 85, 99], gap: 0 });

  return doc.output("arraybuffer") as Uint8Array;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const {
      application_id,
      acceptance_deadline,
      acceptance_fee,
      admitted_class_id,
      class_change_note,
    }: OfferLetterRequest = await req.json();

    // Resolve fee + note: explicit request value wins, otherwise fall back to admin settings.
    const { data: settingsRows } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["acceptance_fee_amount", "acceptance_fee_note"]);

    const settings = Object.fromEntries(
      (settingsRows ?? []).map((r: any) => [r.setting_key, r.setting_value])
    );
    const acceptanceFee = Number(
      acceptance_fee ?? settings.acceptance_fee_amount ?? 50000
    );
    const acceptanceFeeNote = String(
      settings.acceptance_fee_note ??
        "This acceptance fee will be deducted from your child's school fees."
    );

    if (!Number.isFinite(acceptanceFee) || acceptanceFee <= 0) {
      throw new Error("Invalid acceptance fee amount");
    }

    console.log("Sending offer letter for:", application_id);

    const { data: application, error: appError } = await supabase
      .from("admission_applications")
      .select(`
        *,
        classes:applying_for_class_id(name)
      `)
      .eq("id", application_id)
      .single();

    if (appError || !application) {
      throw new Error("Application not found");
    }

    // Resolve applied vs admitted class. Admins may admit a candidate into a
    // different (usually lower) class than the one applied for.
    const appliedClassId: string | null = application.applying_for_class_id ?? null;
    const admittedClassId: string | null =
      admitted_class_id || application.admitted_to_class_id || appliedClassId;

    const classIds = [...new Set([appliedClassId, admittedClassId].filter(Boolean))] as string[];
    const { data: classRows } = classIds.length
      ? await supabase.from("classes").select("id, name").in("id", classIds)
      : { data: [] as { id: string; name: string }[] };
    const classNameById = new Map((classRows ?? []).map((c: any) => [c.id, c.name]));

    const appliedClassName =
      classNameById.get(appliedClassId as string) || application.classes?.name || "the class applied for";
    const admittedClassName = classNameById.get(admittedClassId as string) || appliedClassName;
    const classChanged = Boolean(
      appliedClassId && admittedClassId && appliedClassId !== admittedClassId
    );
    const classInfo = {
      appliedClassName,
      admittedClassName,
      changed: classChanged,
      note: class_change_note?.trim() || null,
    };

    if (admittedClassId && admittedClassId !== application.admitted_to_class_id) {
      const { error: admitError } = await supabase
        .from("admission_applications")
        .update({ admitted_to_class_id: admittedClassId })
        .eq("id", application_id);
      if (admitError) console.error("Failed to store admitted class:", admitError);
    }

    // Check if offer already exists
    const { data: existingOffer, error: offerCheckError } = await supabase
      .from("admission_offers")
      .select('id, offer_letter_url, acceptance_token')
      .eq("application_id", application_id)
      .maybeSingle();

    let acceptanceToken: string;
    let offerLetterUrl: string;
    let pdfFileName: string;

    // Generate PDF
    console.log("Generating offer letter PDF...");
    const pdfBuffer = await generateOfferLetterPDF(
      application,
      acceptance_deadline,
      acceptanceFee,
      acceptanceFeeNote,
      classInfo,
    );
    
    if (existingOffer) {
      console.log("Offer already exists, updating instead of creating new one");
      
      // Preserve a valid existing link when re-sending; repair older rows without one.
      acceptanceToken = existingOffer.acceptance_token?.trim() || crypto.randomUUID();
      
      // Delete old PDF if exists
      if (existingOffer.offer_letter_url) {
        const oldFileName = existingOffer.offer_letter_url.split('/').pop();
        if (oldFileName) {
          await supabase.storage
            .from('admission-documents')
            .remove([`offer-letters/${oldFileName}`]);
        }
      }
      
      // Upload new PDF with timestamp
      pdfFileName = `${application.application_number}_offer_letter_${Date.now()}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from('admission-documents')
        .upload(`offer-letters/${pdfFileName}`, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: true
        });
        
      if (uploadError) {
        console.error("Error uploading PDF:", uploadError);
        throw new Error(`PDF upload failed: ${uploadError.message}`);
      }
      
      const { data: urlData } = supabase.storage
        .from('admission-documents')
        .getPublicUrl(`offer-letters/${pdfFileName}`);
      
      offerLetterUrl = urlData.publicUrl;
      console.log("New PDF uploaded successfully:", offerLetterUrl);
      
      // UPDATE existing offer instead of INSERT
      const { error: updateError } = await supabase
        .from("admission_offers")
        .update({
          acceptance_deadline,
          acceptance_token: acceptanceToken,
          acceptance_fee: acceptanceFee,
          offer_letter_url: offerLetterUrl,
          status: "sent",
          updated_at: new Date().toISOString()
        })
        .eq('id', existingOffer.id);
        
      if (updateError) {
        console.error("Error updating offer:", updateError);
        throw new Error(`Failed to update offer: ${updateError.message}`);
      }
      
      console.log("Offer updated successfully");
    } else {
      // Create new offer - original flow
      console.log("Creating new offer");
      
      acceptanceToken = crypto.randomUUID();
      
      // Upload PDF to storage
      pdfFileName = `${application.application_number}_offer_letter.pdf`;
      const { error: uploadError } = await supabase
        .storage
        .from('admission-documents')
        .upload(`offer-letters/${pdfFileName}`, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (uploadError) {
        console.error("Error uploading PDF:", uploadError);
        throw new Error(`Failed to upload PDF: ${uploadError.message}`);
      }

      // Get public URL for the PDF
      const { data: urlData } = supabase
        .storage
        .from('admission-documents')
        .getPublicUrl(`offer-letters/${pdfFileName}`);

      offerLetterUrl = urlData.publicUrl;
      console.log("PDF uploaded successfully:", offerLetterUrl);

      // Create offer record with acceptance fee and PDF URL
      const { error: offerError } = await supabase
        .from("admission_offers")
        .insert({
          application_id,
          acceptance_deadline,
          acceptance_token: acceptanceToken,
          acceptance_fee: acceptanceFee,
          status: "sent",
          offer_letter_url: offerLetterUrl,
        });

      if (offerError) {
        console.error("Error creating offer:", offerError);
        throw new Error(`Failed to create offer: ${offerError.message}`);
      }
      
      console.log("Offer created successfully");
    }

    const acceptanceUrl = `${FRONTEND_URL}/website/accept-offer/${acceptanceToken}`;
    
    const emailSubject = `Offer of provisional admission - ${application.application_number}`;
    const prettyDeadline = new Date(acceptance_deadline).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin:0;padding:24px 0;background-color:#eef0ee;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr><td align="center">
            <!-- Plain branded email. The official letterhead lives on the attached PDF. -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="620"
                   style="width:620px;max-width:100%;background-color:#ffffff;border-radius:6px;overflow:hidden;font-family:Georgia,'Times New Roman',serif;color:#111827;">
              <tr><td style="background:#15803d;padding:22px 56px;font-family:Arial,Helvetica,sans-serif;color:#ffffff;">
                <div style="font-size:18px;font-weight:bold;letter-spacing:0.3px;">iVintage College</div>
                <div style="font-size:12px;opacity:0.9;margin-top:4px;">Office of Admissions &middot; Badagry, Lagos</div>
              </td></tr>
              <tr><td style="padding:24px 56px 8px 56px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#4b5563;">
                Ref: ${application.application_number}
                <span style="float:right;">${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}</span>
              </td></tr>
              <tr><td style="padding:16px 56px 0 56px;font-size:15px;line-height:1.65;">
                <p style="margin:0 0 4px 0;font-weight:bold;">${application.first_name} ${application.last_name}</p>
                <p style="margin:0 0 22px 0;font-size:13px;color:#6b7280;">${application.email}</p>

                <p style="margin:0 0 6px 0;font-weight:bold;letter-spacing:0.4px;">OFFER OF PROVISIONAL ADMISSION</p>
                <div style="height:2px;width:180px;background:#15803d;margin-bottom:20px;"></div>

                <p style="margin:0 0 16px 0;">Dear ${application.first_name},</p>

                <p style="margin:0 0 18px 0;">
                  Following the assessment of your application, I am pleased to confirm that you have been admitted to
                  <strong>${admittedClassName}</strong> at iVintage College for the
                  ${new Date().getFullYear()}/${new Date().getFullYear() + 1} academic session. The offer is provisional
                  until the acceptance fee is paid and your original documents are sighted at the school office.
                </p>

                ${classChanged ? `<p style="margin:0 0 18px 0;">
                  Following your performance in the entrance assessment, the school is offering admission into
                  <strong>${admittedClassName}</strong> rather than <strong>${appliedClassName}</strong>.${classInfo.note ? ` ${classInfo.note}` : ""}
                </p>` : ""}

                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
                       style="font-family:Arial,Helvetica,sans-serif;font-size:14px;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;margin:0 0 18px 0;">
                  <tr><td style="padding:10px 0;color:#6b7280;">Application number</td><td style="padding:10px 0;font-weight:bold;text-align:right;">${application.application_number}</td></tr>
                  <tr><td style="padding:10px 0;color:#6b7280;">Class applied for</td><td style="padding:10px 0;font-weight:bold;text-align:right;">${appliedClassName}</td></tr>
                  <tr><td style="padding:10px 0;color:#6b7280;">Class admitted to</td><td style="padding:10px 0;font-weight:bold;text-align:right;">${admittedClassName}</td></tr>
                  <tr><td style="padding:10px 0;color:#6b7280;">Acceptance fee</td><td style="padding:10px 0;font-weight:bold;text-align:right;">&#8358;${acceptanceFee.toLocaleString("en-NG")}</td></tr>
                  <tr><td style="padding:10px 0;color:#6b7280;">Payment deadline</td><td style="padding:10px 0;font-weight:bold;text-align:right;">${prettyDeadline}</td></tr>
                </table>

                <p style="margin:0 0 18px 0;font-size:13px;color:#4b5563;">${acceptanceFeeNote}</p>

                <p style="margin:0 0 18px 0;">
                  To take up the place, accept the offer using the link below and pay the acceptance fee on or before
                  <strong>${prettyDeadline}</strong>. Offers not accepted by that date are released to candidates on the waiting list.
                </p>

                <p style="margin:0 0 26px 0;">
                  <a href="${acceptanceUrl}" style="display:inline-block;background:#15803d;color:#ffffff;padding:13px 30px;text-decoration:none;border-radius:4px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;">Accept the offer</a>
                </p>

                <p style="margin:0 0 18px 0;">
                  The signed offer letter, on the official school letterhead, is attached to this message as a PDF. Any question about
                  the offer should be sent to
                  <a href="mailto:admissions@ivintagecollege.com" style="color:#15803d;">admissions@ivintagecollege.com</a>.
                </p>

                <p style="margin:0 0 32px 0;">Yours faithfully,<br><br>
                  <strong>Admissions Officer</strong><br>
                  <span style="font-size:13px;color:#6b7280;">For: iVintage College, Badagry, Lagos</span>
                </p>
              </td></tr>
              <tr><td style="padding:16px 56px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#6b7280;">
                iVintage College &middot; admissions@ivintagecollege.com
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `;

    // Log email attempt
    const emailLogData = {
      recipient_email: application.email,
      email_type: 'admission_offer',
      subject: emailSubject,
      application_id: application_id,
      status: 'pending',
    };
    
    let emailResult;
    try {
      // Convert PDF buffer to base64 for email attachment
      const pdfBytes = new Uint8Array(pdfBuffer);
      let pdfBinary = "";
      const CHUNK = 0x8000;
      for (let i = 0; i < pdfBytes.length; i += CHUNK) {
        pdfBinary += String.fromCharCode(...pdfBytes.subarray(i, i + CHUNK));
      }
      const pdfBase64 = btoa(pdfBinary);
      
      emailResult = await sendEmailWithRetry({
        from: `iVintage College <${SENDER_EMAIL}>`,
        to: [application.email],
        reply_to: REPLY_TO,
        subject: emailSubject,
        html: emailHtml,
        attachments: [
          {
            filename: pdfFileName,
            content: pdfBase64,
            type: 'application/pdf',
          },
        ],
      });

      // Update log with success
      await logEmail(supabase, {
        ...emailLogData,
        status: 'sent',
        resend_id: emailResult.id,
        sent_at: new Date().toISOString(),
      });

      console.log("Offer letter sent successfully:", emailResult);
    } catch (error: any) {
      // Update log with failure
      await logEmail(supabase, {
        ...emailLogData,
        status: 'failed',
        error_message: error.message,
        retry_count: MAX_RETRIES,
      });
      
      console.error("Failed to send offer letter after retries:", error);
      throw new Error(`Failed to send email: ${error.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Offer letter sent successfully",
        acceptance_url: acceptanceUrl,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in send-offer-letter:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
