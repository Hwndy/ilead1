import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const ALLOWED_EMAIL_DOMAIN = "ivintage.vercel.app";
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
  // Reply-to can be any valid email (e.g. a Gmail inbox the school actually reads).
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configured)) {
    console.error(`${envName} is not a valid email (${configured}). Falling back to ${fallback}.`);
    return fallback;
  }
  return configured;
}

// Helper function to send email with retry logic
async function sendEmailWithRetry(emailData: any, maxRetries = MAX_RETRIES): Promise<any> {
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await resend.emails.send(emailData);
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
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendOTPRequest {
  email: string;
  type: 'reset_password' | 'email_verification';
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, type }: SendOTPRequest = await req.json();
    
    if (!email || !type) {
      return new Response(
        JSON.stringify({ error: 'Email and type are required' }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store OTP in database with 10-minute expiration
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    
    const { error: dbError } = await supabase
      .from('password_reset_otps')
      .upsert({
        email: email.toLowerCase(),
        otp_code: otp,
        expires_at: expiresAt,
        used: false,
        created_at: new Date().toISOString()
      });

    if (dbError) {
      console.error('Database error:', dbError);
      return new Response(
        JSON.stringify({ error: 'Failed to store OTP' }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Prepare email content based on type
    let subject: string;
    let htmlContent: string;
    
    if (type === 'reset_password') {
      subject = "Password Reset Code - IVINTAGE CBT System";
      htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Password Reset Code</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; padding: 20px 0;">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #059669, #10b981); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
                <span style="color: white; font-size: 32px; font-weight: bold;">A</span>
              </div>
              <h1 style="color: #059669; margin: 0;">IVINTAGE CBT System</h1>
              <p style="color: #6b7280; margin: 5px 0 30px;">Computer Based Test System</p>
            </div>
            
            <div style="background: #f9fafb; border-radius: 8px; padding: 30px; margin: 20px 0;">
              <h2 style="color: #1f2937; margin-top: 0;">Password Reset Code</h2>
              <p style="margin: 15px 0;">We received a request to reset your password. Use the verification code below to complete the password reset process:</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <div style="background: white; border: 2px solid #059669; border-radius: 8px; padding: 20px; display: inline-block;">
                  <div style="font-size: 32px; font-weight: bold; color: #059669; letter-spacing: 8px; font-family: monospace;">${otp}</div>
                </div>
              </div>
              
              <p style="margin: 15px 0;"><strong>This code will expire in 10 minutes.</strong></p>
              <p style="margin: 15px 0;">If you didn't request a password reset, please ignore this email or contact your administrator if you have concerns.</p>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0;">
                This is an automated message from IVINTAGE CBT System.<br>
                Please do not reply to this email.
              </p>
            </div>
          </body>
        </html>
      `;
    } else {
      subject = "Email Verification Code - IVINTAGE CBT System";
      htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Email Verification Code</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; padding: 20px 0;">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #059669, #10b981); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
                <span style="color: white; font-size: 32px; font-weight: bold;">A</span>
              </div>
              <h1 style="color: #059669; margin: 0;">IVINTAGE CBT System</h1>
              <p style="color: #6b7280; margin: 5px 0 30px;">Computer Based Test System</p>
            </div>
            
            <div style="background: #f9fafb; border-radius: 8px; padding: 30px; margin: 20px 0;">
              <h2 style="color: #1f2937; margin-top: 0;">Verify Your Email</h2>
              <p style="margin: 15px 0;">Please use the verification code below to verify your email address:</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <div style="background: white; border: 2px solid #059669; border-radius: 8px; padding: 20px; display: inline-block;">
                  <div style="font-size: 32px; font-weight: bold; color: #059669; letter-spacing: 8px; font-family: monospace;">${otp}</div>
                </div>
              </div>
              
              <p style="margin: 15px 0;"><strong>This code will expire in 10 minutes.</strong></p>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0;">
                This is an automated message from IVINTAGE CBT System.<br>
                Please do not reply to this email.
              </p>
            </div>
          </body>
        </html>
      `;
    }

    // Log email attempt
    const emailLogData = {
      recipient_email: email,
      email_type: `otp_${type}`,
      subject: subject,
      status: 'pending' as const,
    };

    try {
      // Send email with retry via Resend
      const emailResponse = await sendEmailWithRetry({
        from: `iVintage College <${SENDER_EMAIL}>`,
        to: [email],
        reply_to: REPLY_TO,
        subject: subject,
        html: htmlContent,
      });

      // Update log with success
      await logEmail(supabase, {
        ...emailLogData,
        status: 'sent' as const,
        resend_id: emailResponse.id,
        sent_at: new Date().toISOString(),
      });

      console.log("OTP email sent successfully:", emailResponse);
    } catch (emailError: any) {
      // Update log with failure
      await logEmail(supabase, {
        ...emailLogData,
        status: 'failed' as const,
        error_message: emailError.message,
        retry_count: MAX_RETRIES,
      });

      console.error("Failed to send OTP email:", emailError);
      throw new Error(`Failed to send OTP email: ${emailError.message}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'OTP sent successfully',
        expires_in: 600 // 10 minutes
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in send-otp function:", error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);