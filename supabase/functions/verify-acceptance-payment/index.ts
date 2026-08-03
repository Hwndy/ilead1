import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface VerifyRequest {
  reference: string;
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

    const { reference }: VerifyRequest = await req.json();

    console.log("Verifying acceptance payment:", reference);

    const paystackResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          "Authorization": `Bearer ${Deno.env.get("PAYSTACK_SECRET_KEY")}`,
        },
      }
    );

    if (!paystackResponse.ok) {
      throw new Error("Failed to verify payment with Paystack");
    }

    const paystackData = await paystackResponse.json();

    if (paystackData.status && paystackData.data.status === "success") {
      const { error: paymentError } = await supabase
        .from("admission_payments")
        .update({
          status: "completed",
          payment_method: paystackData.data.channel,
          paid_at: new Date().toISOString(),
        })
        .eq("transaction_id", reference);

      if (paymentError) {
        console.error("Error updating payment:", paymentError);
      }

      let enrollment: Record<string, unknown> | null = null;
      let enrollmentPending = false;

      try {
      const { data: payment } = await supabase
        .from("admission_payments")
        .select("application_id, amount")
        .eq("transaction_id", reference)
        .single();

      if (payment) {
        // Get application details
        const { data: application } = await supabase
          .from("admission_applications")
          .select("*")
          .eq("id", payment.application_id)
          .single();

        if (application) {
          // Idempotency: if the webhook (or an earlier verify call) already
          // enrolled this applicant, just return the existing details.
          if (application.student_id || application.status === "enrolled") {
            const { data: existingStudent } = await supabase
              .from("students")
              .select("admission_number")
              .eq("id", application.student_id)
              .maybeSingle();
            console.log("Application already enrolled, skipping creation");
            enrollment = {
              already_enrolled: true,
              admission_number: existingStudent?.admission_number ?? null,
              login_email: application.login_email ?? application.email,
              contact_email: application.email,
              application_number: application.application_number,
              student_name: `${application.first_name} ${application.last_name}`,
            };
          } else {
          // Allocate a collision-free admission number from the database.
          const { data: allocated, error: allocError } = await supabase.rpc(
            "next_admission_number"
          );
          if (allocError || !allocated) {
            console.error("Error allocating admission number:", allocError);
            throw allocError ?? new Error("Could not allocate an admission number");
          }
          const admissionNumber = String(allocated);

          // ---------------------------------------------------------------
          // School-issued student login ID.
          // Families often share ONE email across several children, so the
          // family email can never be the student's login. We mint a unique
          // login from the admission number instead; all correspondence still
          // goes to application.email (the parent).
          // ---------------------------------------------------------------
          const { data: domainSetting } = await supabase
            .from("app_settings")
            .select("setting_value")
            .eq("setting_key", "student_login_domain")
            .maybeSingle();
          const rawDomain = domainSetting?.setting_value;
          const loginDomain =
            (typeof rawDomain === "string" ? rawDomain : rawDomain?.toString?.()) ||
            "students.ilead1.lovable.app";
          const slug = (value: string) =>
            String(value ?? "")
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "")
              .trim();
          const nameLocal = [slug(application.first_name), slug(application.last_name)]
            .filter(Boolean)
            .join(".");
          const admissionTail = (admissionNumber.match(/(\d+)\s*$/)?.[1] ?? "").toLowerCase();
          const localPart =
            nameLocal ||
            admissionNumber.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
          let loginEmail = application.login_email || `${localPart}@${loginDomain}`;

          // Generate an unambiguous temporary password (no 0/O/1/l/I).
          const alphabet = "abcdefghjkmnpqrstuvwxyz";
          const digits = "23456789";
          const pick = (src: string, n: number) =>
            Array.from({ length: n }, () => src[Math.floor(Math.random() * src.length)]).join("");
          let password: string | null = `Alb${pick(alphabet, 5)}${pick(digits, 3)}`;

          // Create the student's own auth account on the school-issued login.
          let userId: string | null = null;
          for (let attempt = 0; attempt < 6 && !userId; attempt++) {
            // firstname.lastname → firstname.lastname.<admission tail> → -2, -3, ...
            const suffix =
              attempt === 0
                ? ""
                : attempt === 1 && admissionTail
                  ? `.${admissionTail}`
                  : `-${attempt + 1}`;
            const candidate = suffix ? loginEmail.replace("@", `${suffix}@`) : loginEmail;
            const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
              email: candidate,
              password: password,
              email_confirm: true,
              user_metadata: {
                full_name: `${application.first_name} ${application.last_name}`,
                role: "student",
              },
            });
            if (!authError) {
              userId = authUser.user.id;
              loginEmail = candidate;
              break;
            }
            console.warn("createUser failed for", candidate, authError.message);
            // Only a previous run of THIS application can legitimately own this
            // login (it is derived from this applicant's admission number).
            const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
            const existing = list?.users?.find(
              (u: any) => (u.email ?? "").toLowerCase() === candidate.toLowerCase()
            );
            // A login derived from this applicant's own name/admission number
            // may already exist from a previous failed attempt. Reuse it unless
            // another application has claimed it.
            let ownedByOther = false;
            if (existing && !application.login_email) {
              const { data: otherApp } = await supabase
                .from("admission_applications")
                .select("id")
                .ilike("login_email", candidate)
                .neq("id", payment.application_id)
                .maybeSingle();
              ownedByOther = Boolean(otherApp);
            }
            if (existing && !ownedByOther) {
              userId = existing.id;
              loginEmail = candidate;
              // The login already exists from an earlier (failed) enrolment run.
              // If the student has never signed in and set their own password,
              // issue a fresh temporary one so the welcome email always carries
              // working credentials. Otherwise leave their password alone.
              const { data: existingProfile } = await supabase
                .from("profiles")
                .select("must_change_password")
                .eq("user_id", userId)
                .maybeSingle();
              const neverSignedIn =
                !existingProfile || existingProfile.must_change_password !== false;
              if (neverSignedIn) {
                const { error: pwError } = await supabase.auth.admin.updateUserById(userId, {
                  password: password as string,
                  email_confirm: true,
                });
                if (pwError) {
                  console.error("Could not reset temporary password:", pwError.message);
                  password = null;
                }
              } else {
                password = null;
                await supabase.auth.admin.updateUserById(userId, { email_confirm: true });
              }
              break;
            }
            if (!existing) throw authError;
            // Someone else holds this login — try the next suffix.
          }
          if (!userId) throw new Error("Could not allocate a student login ID");

          // Remember the login on the application for admin/email re-sends.
          await supabase
            .from("admission_applications")
            .update({ login_email: loginEmail })
            .eq("id", payment.application_id);

          // Ensure the student role exists (trigger covers new users only).
          await supabase
            .from("user_roles")
            .insert({ user_id: userId, role: "student", created_by: userId })
            .select()
            .maybeSingle();

          // Ensure a profile exists and force a password change on first login.
          const { error: profileError } = await supabase
            .from("profiles")
            .upsert(
              {
                user_id: userId,
                full_name: `${application.first_name} ${application.middle_name ?? ""} ${application.last_name}`
                  .replace(/\s+/g, " ")
                  .trim(),
                must_change_password: true,
              },
              { onConflict: "user_id" }
            );
          if (profileError) {
            console.error("Error upserting student profile:", profileError);
            throw profileError;
          }

          // Reuse an existing student record if one was already created.
          const { data: priorStudent } = await supabase
            .from("students")
            .select("id, admission_number")
            .eq("user_id", userId)
            .maybeSingle();

          // Create the student record, retrying if another enrolment grabbed
          // the same admission number in the meantime.
          let newStudent: { id: string; admission_number: string } | null =
            (priorStudent as any) ?? null;
          let currentNumber = admissionNumber;
          for (let attempt = 0; attempt < 5 && !newStudent; attempt++) {
            const { data: inserted, error: studentError } = await supabase
              .from("students")
              .insert({
                user_id: userId,
                admission_number: currentNumber,
                date_of_birth: application.date_of_birth,
                gender: application.gender,
                blood_group: application.blood_group,
                address: application.address,
                emergency_contact: application.parent_guardian_info,
                medical_info: {
                  conditions: application.medical_conditions,
                  allergies: application.allergies,
                },
                admission_date: new Date().toISOString().split("T")[0],
                status: "active",
                is_boarder: application.boarding_interest ?? false,
              })
              .select()
              .single();
            if (!studentError) {
              newStudent = inserted as any;
              break;
            }
            if (studentError.code !== "23505") {
              console.error("Error creating student:", studentError);
              throw studentError;
            }
            console.warn("Admission number collision on", currentNumber, "- retrying");
            const { data: retryNumber } = await supabase.rpc("next_admission_number");
            if (!retryNumber) throw studentError;
            currentNumber = String(retryNumber);
          }
          if (!newStudent) throw new Error("Could not create the student record");
          const student = newStudent as { id: string; admission_number: string };
          const admissionNumberUsed = student.admission_number ?? currentNumber;
          const finalAdmissionNumber = admissionNumberUsed;

          // Credit the acceptance fee against the student's school fees so the
          // "deducted from school fees" promise on the offer holds true.
          const acceptanceAmount = Number(payment.amount ?? paystackData.data.amount / 100);
          if (Number.isFinite(acceptanceAmount) && acceptanceAmount > 0) {
            const { data: existingCredit } = await supabase
              .from("fee_payments")
              .select("id")
              .eq("transaction_id", reference)
              .maybeSingle();
            if (existingCredit) {
              console.log("Acceptance fee already credited for", reference);
            } else {
            // Attach the credit to the student's mandatory fee structure for
            // their class so it reduces the outstanding tuition balance.
            let creditStructureId: string | null = null;
            const creditClassId = application.admitted_to_class_id ?? application.applying_for_class_id;
            if (creditClassId) {
              const { data: structure } = await supabase
                .from("fee_structures")
                .select("id")
                .eq("class_id", creditClassId)
                .eq("is_mandatory", true)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();
              creditStructureId = structure?.id ?? null;
            }
            const { error: creditError } = await supabase.from("fee_payments").insert({
              student_id: student.id,
              fee_structure_id: creditStructureId,
              amount_paid: acceptanceAmount,
              payment_method: paystackData.data.channel || "paystack",
              transaction_id: reference,
              payment_reference: reference,
              status: "completed",
              paid_at: new Date().toISOString(),
              notes: "Acceptance fee credited towards school fees",
              metadata: { source: "acceptance_fee", application_id: payment.application_id },
            });
            if (creditError) {
              console.error("Error crediting acceptance fee to school fees:", creditError);
            }
            }
          }

          // Assign to class (class_assignments.student_id references profiles.user_id)
          const classId = application.admitted_to_class_id ?? application.applying_for_class_id;
          if (classId) {
            const { data: existingAssignment } = await supabase
              .from("class_assignments")
              .select("id")
              .eq("student_id", userId)
              .maybeSingle();
            if (!existingAssignment) {
              const { error: assignError } = await supabase.from("class_assignments").insert({
                student_id: userId,
                class_id: classId,
              });
              if (assignError) console.error("Error assigning student to class:", assignError);
            }
            if (!application.admitted_to_class_id) {
              await supabase
                .from("admission_applications")
                .update({ admitted_to_class_id: classId })
                .eq("id", payment.application_id);
            }
          }

          // Update application with student ID and status
          await supabase
            .from("admission_applications")
            .update({
              status: "enrolled",
              student_id: student.id,
            })
            .eq("id", payment.application_id);

          // No parent account is created here. Parents register themselves on
          // the portal and link the child with the admission number + date of
          // birth. The enrolment email carries student credentials only.
          const contactEmail = String(application.email ?? "").trim().toLowerCase();

          // Send welcome email
          try {
            let className: string | null = null;
            if (classId) {
              const { data: cls } = await supabase
                .from("classes")
                .select("name")
                .eq("id", classId)
                .maybeSingle();
              className = cls?.name ?? null;
            }
            await supabase.functions.invoke("send-admission-notification", {
              body: {
                application_id: payment.application_id,
                notification_type: "enrolled",
                additional_data: {
                  admission_number: finalAdmissionNumber,
                  login_email: loginEmail,
                  contact_email: contactEmail,
                  ...(password ? { temporary_password: password } : {}),
                  ...(className ? { class_name: className } : {}),
                },
              },
            });
          } catch (emailError) {
            console.error("Error sending welcome email:", emailError);
          }

          console.log("Student enrolled successfully:", finalAdmissionNumber);
          enrollment = {
            already_enrolled: false,
            admission_number: finalAdmissionNumber,
            login_email: loginEmail,
            contact_email: contactEmail,
            application_number: application.application_number,
            student_name: `${application.first_name} ${application.last_name}`,
          };
          }
        }
      }
      } catch (enrollError: any) {
        // The money is confirmed at this point — never fail the receipt because
        // a post-payment step broke. Flag it so admin can complete enrolment.
        console.error("Enrollment failed after successful payment:", enrollError);
        enrollmentPending = true;
      }

      return new Response(
        JSON.stringify({
          success: true,
          status: "completed",
          amount: paystackData.data.amount / 100,
          currency: paystackData.data.currency,
          payment_type: "acceptance_fee",
          reference,
          payment_method: paystackData.data.channel,
          paid_at: paystackData.data.paid_at ?? new Date().toISOString(),
          enrollment_pending: enrollmentPending,
          ...(enrollment ?? {}),
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          status: paystackData.data.status,
          message: "Payment verification failed",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }
  } catch (error: any) {
    console.error("Error in verify-acceptance-payment:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
