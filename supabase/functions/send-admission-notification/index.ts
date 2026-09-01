import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const ALLOWED_EMAIL_DOMAIN = "ilead1.lovable.app";
const DEFAULT_SENDER_EMAIL = "admissions@ivintagecollege.com";
const DEFAULT_REPLY_TO_EMAIL = "admissions@ivintagecollege.com";
const SENDER_EMAIL = getSafeSchoolEmail("SENDER_EMAIL", DEFAULT_SENDER_EMAIL);
const REPLY_TO = getReplyToEmail("REPLY_TO_EMAIL", DEFAULT_REPLY_TO_EMAIL);

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

// Helper function to send email with retry logic
async function sendEmailWithRetry(resend: any, emailData: any, maxRetries = MAX_RETRIES): Promise<any> {
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await resend.emails.send(emailData);
      // Resend SDK returns { data, error } — treat error payload as a real failure.
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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface NotificationRequest {
  application_id: string;
  notification_type:
    | "submitted"
    | "under_review"
    | "interview_scheduled"
    | "accepted"
    | "rejected"
    | "enrolled"
    | "exam_result"
    | "exam_resit";
  additional_data?: any;
}

const SCHOOL_SIGNOFF = `
      <p style="margin-top:24px;">Yours faithfully,<br><br>
        <strong>Admissions Officer</strong><br>
        <span style="color:#6b7280;font-size:13px;">iVintage College, 1 iVintage Close, Behind UBA, Badagry Market Road, Badagry, Lagos &middot; 08028152097</span>
      </p>`;

const emailTemplates: Record<string, (data: any) => { subject: string; html: string }> = {
  submitted: (data: any) => ({
    subject: `Application received - ${data.application_number}`,
    html: `
      <p>Dear ${data.first_name} ${data.last_name},</p>
      <p>Your application to iVintage College has been received and entered into our records. Please quote the reference below in any correspondence.</p>
      <p><strong>Application number:</strong> ${data.application_number}</p>
      <p>The admissions team will review the application and contact you about the entrance assessment and interview. You can also check progress at any time using the application number on our website.</p>
      ${SCHOOL_SIGNOFF}
    `,
  }),
  under_review: (data: any) => ({
    subject: `Application under review - ${data.application_number}`,
    html: `
      <p>Dear ${data.first_name} ${data.last_name},</p>
      <p>Application ${data.application_number} is now with the admissions committee for review. No further action is required from you at this stage; we will write again once a date has been set for the next step.</p>
      ${SCHOOL_SIGNOFF}
    `,
  }),
  interview_scheduled: (data: any) => ({
    subject: `Interview appointment - ${data.application_number}`,
    html: `
      <p>Dear ${data.first_name} ${data.last_name},</p>
      <p>Your application has progressed to the interview stage. Details of the appointment are set out below.</p>
      <p>
        <strong>Date:</strong> ${data.interview_date || 'To be confirmed'}<br>
        <strong>Time:</strong> ${data.interview_time || 'To be confirmed'}<br>
        <strong>Venue:</strong> ${data.interview_location || 'iVintage College, Badagry, Lagos'}
      </p>
      <p>Please arrive fifteen minutes early with a valid means of identification, the original academic records and the birth certificate submitted with the application.</p>
      ${SCHOOL_SIGNOFF}
    `,
  }),
  accepted: (data: any) => ({
    subject: `Offer of provisional admission - ${data.application_number}`,
    html: `
      <p>Dear ${data.first_name} ${data.last_name},</p>
      <p>Following the assessment of your application, a place has been offered to you in ${data.class_name || 'the class applied for'} at iVintage College for the ${new Date().getFullYear()}/${new Date().getFullYear() + 1} academic session.</p>
      <p><strong>Application number:</strong> ${data.application_number}</p>
      <p>The offer is provisional until the acceptance fee is paid and your original documents are sighted at the school office. The formal offer letter, with the fee and the payment deadline, follows in a separate message.</p>
      ${SCHOOL_SIGNOFF}
    `,
  }),
  rejected: (data: any) => ({
    subject: `Outcome of your application - ${data.application_number}`,
    html: `
      <p>Dear ${data.first_name} ${data.last_name},</p>
      <p>Thank you for applying to iVintage College. After reviewing application ${data.application_number}, the admissions committee is unable to offer you a place for this session.</p>
      <p>The decision reflects the number of places available in the class applied for and does not prevent you from applying again in a future admission cycle. We wish you every success.</p>
      ${SCHOOL_SIGNOFF}
    `,
  }),
  enrolled: (data: any) => {
    const s = data.enrollment_settings || {};
    const portal = String(s.portal_url || "https://ilead1.lovable.app/login").replace(/\/$/, "");
    const actions: Array<{ label: string; url?: string }> = Array.isArray(s.required_actions) && s.required_actions.length
      ? s.required_actions
      : [
          { label: "Sign in and change the temporary password", url: portal },
          { label: "Complete the student profile", url: portal },
          { label: "Review the fee structure and payment schedule", url: portal },
        ];
    const password = data.temporary_password;
    const studentLogin = data.login_email || data.email;
    const contactEmail = data.contact_email || data.email;
    return {
      subject: `Enrolment confirmed - portal access for ${data.first_name} ${data.last_name}`,
      html: `
      <p>Dear ${data.first_name} ${data.last_name},</p>
      <p>${s.intro || "Enrolment is now complete. The portal details below give access to results, attendance, timetable and school fees."}</p>
      <div style="border:1px solid #d4d4d4;border-radius:6px;padding:16px;margin:16px 0;background:#f7faf3;">
        <p style="margin:0 0 8px;"><strong>Student portal</strong></p>
        <p style="margin:4px 0;">Address: <a href="${portal}">${portal}</a></p>
        <p style="margin:4px 0;">Login ID: ${studentLogin}</p>
        <p style="margin:4px 0;">Admission number: ${data.admission_number || "-"}</p>
        ${password
          ? `<p style="margin:4px 0;">Temporary password: <code style="font-size:15px;letter-spacing:1px;">${password}</code></p>
             <p style="margin:8px 0 0;color:#8a5300;">You will be asked to set a new password at first sign-in.</p>`
          : `<p style="margin:4px 0;">A password has already been set on this account. Use "Forgot password" at <a href="${portal}">${portal}</a> if it is needed again.</p>`}
        <p style="margin:10px 0 0;color:#555;font-size:13px;">The login ID is issued by the school for sign-in only; it does not receive email. School correspondence continues to go to ${contactEmail}.</p>
      </div>
      <p>
        <strong>Orientation:</strong> ${s.orientation_date || data.orientation_date || "To be announced"}<br>
        <strong>First day of school:</strong> ${s.first_day || data.first_day || "To be announced"}<br>
        <strong>Class:</strong> ${data.class_name || "As assigned"}
      </p>
      <p><strong>Before resumption, please:</strong></p>
      <ol>
        ${actions.map((a) => `<li>${a.url ? `<a href="${a.url}">${a.label}</a>` : a.label}</li>`).join("")}
      </ol>
      ${s.support_line ? `<p>${s.support_line}</p>` : ""}
      <p style="color:#555;font-size:13px;">Parents/guardians who wish to follow results, attendance and school fees can create their own parent account at <a href="${portal}">${portal}</a> and link the child using the admission number and date of birth.</p>
      ${SCHOOL_SIGNOFF}
    `,
    };
  },
};

const outcomeLabel: Record<string, string> = {
  pass: "Successful",
  fail: "Unsuccessful",
  resit: "Resit Required",
  pending: "Under Review",
};

const subjectTable = (data: any) => {
  const rows = Array.isArray(data.subject_scores) ? data.subject_scores : [];
  if (!rows.length) return "";
  return `
    <table cellpadding="6" cellspacing="0" border="1" style="border-collapse:collapse;margin:12px 0;">
      <thead>
        <tr><th align="left">Subject</th><th align="left">Score</th></tr>
      </thead>
      <tbody>
        ${rows.map((r: any) => `<tr><td>${r.subject}</td><td>${r.score ?? "-"} / ${r.max ?? "-"}</td></tr>`).join("")}
      </tbody>
    </table>`;
};

emailTemplates.parent_welcome = (data: any) => ({
  subject: "Access to the iVintage parent portal",
  html: `
    <p>Dear Parent/Guardian,</p>
    <p>A parent account has been created for you so that you can follow your ${
      (data.children?.length ?? 1) > 1 ? "children's" : "child's"
    } results, attendance and school fees in one place.</p>
    ${
      data.children?.length
        ? `<p><strong>Linked ${data.children.length > 1 ? "children" : "child"}:</strong></p><ul>${data.children
            .map((c: string) => `<li>${c}</li>`)
            .join("")}</ul>`
        : ""
    }
    ${
      data.parent_password
        ? `<p>Login email: ${data.parent_email}<br>Temporary password: ${data.parent_password}</p>
           <p>You will be asked to set your own password at first sign-in.</p>
           <p><a href="${data.portal_url}" style="background:#15803d;color:#fff;padding:12px 22px;border-radius:4px;text-decoration:none;display:inline-block">Sign in to the parent portal</a></p>`
        : `<p>Use the link below to set your password and activate the account.</p>
           <p><a href="${data.action_link}" style="background:#15803d;color:#fff;padding:12px 22px;border-radius:4px;text-decoration:none;display:inline-block">Set my password</a></p>`
    }
    <p>Where more than one of your children attends the school, they all appear inside this single account.</p>
    ${SCHOOL_SIGNOFF}
  `,
});

emailTemplates.exam_result = (data: any) => ({
  subject: `Entrance examination result - ${data.application_number}`,
  html: `
    <p>Dear ${data.first_name} ${data.last_name},</p>
    <p>The result of your ${data.exam_title || "entrance examination"} is recorded below.</p>
    ${subjectTable(data)}
    <p>
      <strong>Application number:</strong> ${data.application_number}<br>
      <strong>Total score:</strong> ${data.score ?? "-"}${data.max_score ? ` / ${data.max_score}` : ""}<br>
      <strong>Percentage:</strong> ${data.percentage != null ? `${data.percentage}%` : "-"}<br>
      <strong>Outcome:</strong> ${outcomeLabel[data.result_status] || "Under review"}
    </p>
    ${data.comment ? `<p><strong>Examiner's remark:</strong> ${data.comment}</p>` : ""}
    <p>The admissions office will write to you about the next stage of the process.</p>
    ${SCHOOL_SIGNOFF}
  `,
});

emailTemplates.exam_resit = (data: any) => ({
  subject: `Entrance examination resit - ${data.application_number}`,
  html: `
    <p>Dear ${data.first_name} ${data.last_name},</p>
    <p>Following your performance in the ${data.exam_title || "entrance examination"}, you have been invited to sit the examination a second time.</p>
    ${subjectTable(data)}
    <p>
      <strong>Application number:</strong> ${data.application_number}<br>
      ${data.score != null ? `<strong>Previous score:</strong> ${data.score}${data.max_score ? ` / ${data.max_score}` : ""}${data.percentage != null ? ` (${data.percentage}%)` : ""}<br>` : ""}
      <strong>Resit date:</strong> ${data.resit_date || "To be communicated"}<br>
      <strong>Venue:</strong> ${data.resit_venue || "iVintage College, Badagry, Lagos"}
    </p>
    ${data.comment ? `<p><strong>Examiner's remark:</strong> ${data.comment}</p>` : ""}
    <p>Please arrive thirty minutes early with a valid means of identification and your application number.</p>
    ${SCHOOL_SIGNOFF}
  `,
});

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { application_id, notification_type, additional_data }: NotificationRequest = await req.json();

    console.log(`Sending ${notification_type} notification for application:`, application_id);

    // Get application details
    const { data: application, error: appError } = await supabase
      .from("admission_applications")
      .select(`
        *,
        classes:applying_for_class_id (name)
      `)
      .eq("id", application_id)
      .single();

    if (appError || !application) {
      throw new Error("Application not found");
    }

    // Admin-editable enrollment email content
    let enrollmentSettings: Record<string, unknown> = {};
    if (notification_type === "enrolled") {
      const { data: rows } = await supabase
        .from("app_settings")
        .select("setting_key, setting_value")
        .like("setting_key", "enrollment_email_%");
      rows?.forEach((r: any) => {
        enrollmentSettings[String(r.setting_key).replace("enrollment_email_", "")] = r.setting_value;
      });
    }

    // Prepare email data
    const emailData = {
      ...application,
      class_name: application.classes?.name,
      enrollment_settings: enrollmentSettings,
      ...additional_data,
    };

    const template = emailTemplates[notification_type](emailData);

    // Log email attempt
    const emailLogData = {
      recipient_email: application.email,
      email_type: `admission_${notification_type}`,
      subject: template.subject,
      application_id: application_id,
      status: 'pending' as const,
    };

    let emailResult;
    try {
      // Send email with retry
      emailResult = await sendEmailWithRetry(resend, {
        from: `iVintage College <${SENDER_EMAIL}>`,
        to: [application.email],
        reply_to: REPLY_TO,
        subject: template.subject,
        html: template.html,
      });

      // Update log with success
      await logEmail(supabase, {
        ...emailLogData,
        status: 'sent' as const,
        resend_id: emailResult.id,
        sent_at: new Date().toISOString(),
      });

      console.log("Notification email sent successfully:", emailResult);
    } catch (emailError: any) {
      // Update log with failure
      await logEmail(supabase, {
        ...emailLogData,
        status: 'failed' as const,
        error_message: emailError.message,
        retry_count: MAX_RETRIES,
      });

      console.error("Failed to send notification email:", emailError);
      throw new Error(`Failed to send email: ${emailError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `${notification_type} notification sent successfully`,
        email_id: emailResult?.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in send-admission-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});