import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const ALLOWED_EMAIL_DOMAIN = "ilead1.lovable.app";
const DEFAULT_SENDER_EMAIL = "admissions@ilead1.lovable.app";
const DEFAULT_REPLY_TO_EMAIL = "admissions@ilead1.lovable.app";

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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BulkEmailRequest {
  templateId: string;
  recipients: { user_id: string; full_name: string; email?: string }[];
  schoolId: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { templateId, recipients, schoolId }: BulkEmailRequest = await req.json();

    console.log(`Processing bulk email for template ${templateId} to ${recipients.length} recipients`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch template
    const { data: template, error: templateError } = await supabase
      .from("notification_templates")
      .select("*")
      .eq("id", templateId)
      .single();

    if (templateError || !template) {
      console.error("Template not found:", templateError);
      return new Response(
        JSON.stringify({ error: "Template not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch school info for branding
    const { data: school } = await supabase
      .from("schools")
      .select("name, email")
      .eq("id", schoolId)
      .single();

    const senderEmail = getSafeSchoolEmail("SENDER_EMAIL", DEFAULT_SENDER_EMAIL);
    const replyTo = getReplyToEmail("REPLY_TO_EMAIL", DEFAULT_REPLY_TO_EMAIL);
    const schoolName = school?.name || "School";

    // Process each recipient
    const results: { success: boolean; email?: string; error?: string }[] = [];
    
    for (const recipient of recipients) {
      try {
        // Get user email from auth if not provided
        let recipientEmail = recipient.email;
        if (!recipientEmail) {
          const { data: userData } = await supabase.auth.admin.getUserById(recipient.user_id);
          recipientEmail = userData?.user?.email;
        }

        if (!recipientEmail) {
          results.push({ success: false, error: "No email found for user" });
          continue;
        }

        // Replace template variables
        let body = template.body;
        let subject = template.subject || "Notification";
        
        body = body.replace(/\{\{student_name\}\}/g, recipient.full_name);
        body = body.replace(/\{\{parent_name\}\}/g, recipient.full_name);
        body = body.replace(/\{\{school_name\}\}/g, schoolName);
        
        subject = subject.replace(/\{\{student_name\}\}/g, recipient.full_name);
        subject = subject.replace(/\{\{school_name\}\}/g, schoolName);

        // Send email
        const emailResponse = await resend.emails.send({
          from: `${schoolName} <${senderEmail}>`,
          to: [recipientEmail],
          reply_to: replyTo,
          subject: subject,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background-color: #4F46E5; padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0;">${schoolName}</h1>
              </div>
              <div style="padding: 20px; background-color: #f9fafb;">
                ${body.replace(/\n/g, '<br>')}
              </div>
              <div style="padding: 15px; background-color: #e5e7eb; text-align: center; font-size: 12px; color: #6b7280;">
                This is an automated message from ${schoolName}
              </div>
            </div>
          `,
        });

        console.log(`Email sent to ${recipientEmail}:`, emailResponse);
        results.push({ success: true, email: recipientEmail });
      } catch (error: any) {
        console.error(`Error sending to recipient:`, error);
        results.push({ success: false, error: error.message });
      }
    }

    // Update queue status
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    // Find and update the queue entry
    const { error: updateError } = await supabase
      .from("notification_queue")
      .update({
        status: failCount === 0 ? "sent" : failCount === recipients.length ? "failed" : "sent",
        sent_at: new Date().toISOString(),
        error_message: failCount > 0 ? `${failCount} of ${recipients.length} failed` : null,
      })
      .eq("template_id", templateId)
      .eq("status", "processing");

    if (updateError) {
      console.error("Error updating queue:", updateError);
    }

    console.log(`Bulk email complete: ${successCount} sent, ${failCount} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: successCount, 
        failed: failCount,
        results 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-bulk-email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
