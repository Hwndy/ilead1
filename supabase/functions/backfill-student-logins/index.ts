import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const alphabet = "abcdefghjkmnpqrstuvwxyz";
const digits = "23456789";
const pick = (src: string, n: number) =>
  Array.from({ length: n }, () => src[Math.floor(Math.random() * src.length)]).join("");
const tempPassword = () => `Alb${pick(alphabet, 5)}${pick(digits, 3)}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: roleData } = await supabase
      .from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Only admins can run this', code: 'forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: domainSetting } = await supabase
      .from('app_settings').select('setting_value').eq('setting_key', 'student_login_domain').maybeSingle();
    const portalUrl = `${(Deno.env.get('FRONTEND_URL') ?? 'https://ilead1.lovable.app').replace(/\/+$/, '')}/login?portal=true&role=parent`;

    const notifyParent = async (applicationId: string, payload: Record<string, unknown>) => {
      try {
        await supabase.functions.invoke('send-admission-notification', {
          body: {
            application_id: applicationId,
            notification_type: 'parent_welcome',
            additional_data: { portal_url: portalUrl, ...payload },
          },
        });
        return true;
      } catch (e) {
        console.error('parent welcome email failed', e);
        return false;
      }
    };

    const raw = domainSetting?.setting_value as unknown;
    const loginDomain = (typeof raw === 'string' ? raw : String(raw ?? '')) || 'students.ilead1.lovable.app';

    const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const users = list?.users ?? [];
    const byEmail = (email: string) =>
      users.find((u: any) => (u.email ?? '').toLowerCase() === email.toLowerCase()) ?? null;

    const { data: apps } = await supabase
      .from('admission_applications')
      .select('id, application_number, email, login_email, student_id, first_name, last_name, parent_guardian_info')
      .eq('status', 'enrolled');

    const results: any[] = [];

    for (const app of apps ?? []) {
      const row: any = { application_number: app.application_number, changes: [] };
      try {
        const { data: student } = await supabase
          .from('students').select('id, user_id, admission_number').eq('id', app.student_id).maybeSingle();
        if (!student) { row.error = 'student record missing'; results.push(row); continue; }
        row.student = `${app.first_name} ${app.last_name}`;
        row.admission_number = student.admission_number;

        // 1. Move the student off the (possibly shared) family email and onto a
        //    firstname.lastname school login.
        const slug = (value: string) =>
          String(value ?? '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '')
            .trim();
        const nameLocal = [slug(app.first_name), slug(app.last_name)].filter(Boolean).join('.');
        const admissionTail =
          (String(student.admission_number ?? '').match(/(\d+)\s*$/)?.[1] ?? '').toLowerCase();
        const local =
          nameLocal ||
          String(student.admission_number ?? app.application_number)
            .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

        let loginEmail = app.login_email as string | null;
        const needsRename = !loginEmail || (nameLocal && !loginEmail.startsWith(`${local}@`) && !loginEmail.startsWith(`${local}.`) && !loginEmail.startsWith(`${local}-`));
        if (needsRename) {
          let candidate = `${local}@${loginDomain}`;
          let attempt = 0;
          while (byEmail(candidate) && byEmail(candidate)!.id !== student.user_id) {
            attempt += 1;
            candidate = attempt === 1 && admissionTail
              ? `${local}.${admissionTail}@${loginDomain}`
              : `${local}-${attempt + 1}@${loginDomain}`;
          }
          const { error: updErr } = await supabase.auth.admin.updateUserById(student.user_id, {
            email: candidate,
            email_confirm: true,
          });
          if (updErr) throw updErr;
          loginEmail = candidate;
          await supabase.from('admission_applications').update({ login_email: candidate }).eq('id', app.id);
          row.changes.push('login_id_assigned');
        }
        row.login_email = loginEmail;

        // 2. Parent account on the family email.
        const parentEmail = String(app.email ?? '').trim().toLowerCase();
        if (parentEmail) {
          let parentUser = byEmail(parentEmail);
          let parentPassword: string | null = null;
          if (!parentUser) {
            const g = (app.parent_guardian_info ?? {}) as any;
            const parentName =
              g?.father?.name || g?.mother?.name || g?.guardian?.name || `${app.last_name} Family`;
            parentPassword = tempPassword();
            const { data: created, error: cErr } = await supabase.auth.admin.createUser({
              email: parentEmail,
              password: parentPassword,
              email_confirm: true,
              user_metadata: { full_name: parentName, role: 'parent' },
            });
            if (cErr) throw cErr;
            parentUser = created.user as any;
            users.push(created.user as any);
            await supabase.from('profiles').upsert(
              { user_id: created.user.id, full_name: parentName, must_change_password: true },
              { onConflict: 'user_id' },
            );
            row.changes.push('parent_account_created');
            row.parent_temporary_password = parentPassword;
            if (await notifyParent(app.id, {
              parent_email: parentEmail,
              parent_password: parentPassword,
              children: [`${app.first_name} ${app.last_name}`],
            })) row.changes.push('parent_credentials_emailed');
          } else if (!(parentUser as any).last_sign_in_at) {
            // Account exists but was never used — send a set-password link instead
            // of a password we cannot recover.
            const { data: linkData } = await supabase.auth.admin.generateLink({
              type: 'recovery',
              email: parentEmail,
              options: { redirectTo: `${(Deno.env.get('FRONTEND_URL') ?? 'https://ilead1.lovable.app').replace(/\/+$/, '')}/reset-password` },
            });
            const actionLink = (linkData as any)?.properties?.action_link;
            if (actionLink && await notifyParent(app.id, {
              parent_email: parentEmail,
              action_link: actionLink,
              children: [`${app.first_name} ${app.last_name}`],
            })) row.changes.push('parent_invite_emailed');
          }
          await supabase.from('user_roles')
            .insert({ user_id: parentUser!.id, role: 'parent', created_by: parentUser!.id })
            .select().maybeSingle();

          let { data: parentRow } = await supabase
            .from('parents').select('id').eq('user_id', parentUser!.id).maybeSingle();
          if (!parentRow) {
            const { data: inserted } = await supabase
              .from('parents').insert({ user_id: parentUser!.id }).select('id').single();
            parentRow = inserted;
          }
          if (parentRow) {
            const { data: link } = await supabase
              .from('student_parent_relationships').select('id')
              .eq('parent_id', parentRow.id).eq('student_id', student.id).maybeSingle();
            if (!link) {
              await supabase.from('student_parent_relationships').insert({
                student_id: student.id,
                parent_id: parentRow.id,
                relationship_type: 'parent',
                is_primary_contact: true,
                can_view_grades: true,
                can_view_attendance: true,
                can_view_fees: true,
                verified: true,
              });
              row.changes.push('parent_linked');
            }
          }
          row.parent_email = parentEmail;
        }
      } catch (e: any) {
        row.error = e?.message ?? String(e);
      }
      results.push(row);
    }

    return new Response(JSON.stringify({ success: true, count: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('backfill-student-logins error', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
