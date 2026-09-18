import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

interface Body {
  fullName?: string;
  email?: string;
  password?: string;
  role?: 'teacher' | 'admin';
  department?: string;
  designation?: string;
  employmentType?: string;
  joinDate?: string;
  phone?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    // Caller must be a signed-in admin.
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) return json({ error: 'unauthorized', message: 'Please sign in again.' }, 401);

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return json({ error: 'unauthorized', message: 'Please sign in again.' }, 401);
    }
    const { data: roleRow } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id)
      .eq('role', 'admin')
      .maybeSingle();
    if (!roleRow) {
      return json({ error: 'forbidden', message: 'Only administrators can create staff accounts.' }, 403);
    }

    const body = (await req.json()) as Body;
    const fullName = (body.fullName || '').trim();
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';
    const role = body.role === 'admin' ? 'admin' : 'teacher';

    if (fullName.length < 2 || fullName.length > 120) {
      return json({ error: 'invalid_name', message: 'Enter a valid full name.' }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
      return json({ error: 'invalid_email', message: 'Enter a valid email address.' }, 400);
    }
    if (password.length < 8 || password.length > 200) {
      return json({ error: 'invalid_password', message: 'The password must be at least 8 characters.' }, 400);
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (createError || !created?.user) {
      const msg = createError?.message || 'Could not create the account.';
      const already = /already|registered|exists/i.test(msg);
      return json(
        {
          error: already ? 'email_taken' : 'create_failed',
          message: already ? 'An account with this email address already exists.' : msg,
        },
        already ? 409 : 400,
      );
    }

    const userId = created.user.id;

    // Scope the new staff member to the same school as the administrator
    // (super admins have no school, so fall back to the only/default school).
    const { data: callerProfile } = await admin
      .from('profiles')
      .select('school_id')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    let schoolId: string | null = callerProfile?.school_id ?? null;
    if (!schoolId) {
      const { data: school } = await admin
        .from('schools')
        .select('id')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      schoolId = school?.id ?? null;
    }

    // The signup trigger only ever grants student; replace it with the staff role.
    await admin.from('user_roles').delete().eq('user_id', userId).eq('role', 'student');
    const { error: roleError } = await admin
      .from('user_roles')
      .upsert({ user_id: userId, role, created_by: userData.user.id }, { onConflict: 'user_id,role' });
    if (roleError) {
      await admin.auth.admin.deleteUser(userId);
      return json({ error: 'role_failed', message: roleError.message }, 500);
    }

    const { error: profileError } = await admin
      .from('profiles')
      .upsert(
        {
          user_id: userId,
          full_name: fullName,
          ...(schoolId ? { school_id: schoolId } : {}),
          ...(body.phone ? { phone: body.phone } : {}),
        },
        { onConflict: 'user_id' },
      );
    if (profileError) {
      await admin.auth.admin.deleteUser(userId);
      return json({ error: 'profile_failed', message: profileError.message }, 500);
    }

    const { error: staffError } = await admin.from('staff_details').insert({
      user_id: userId,
      ...(schoolId ? { school_id: schoolId } : {}),
      department: body.department || (role === 'admin' ? 'Administration' : 'Academics'),
      designation: body.designation || (role === 'admin' ? 'Administrator' : 'Teacher'),
      employment_type: body.employmentType || 'full-time',
      join_date: body.joinDate || null,
      status: 'active',
    });

    return json({
      success: true,
      user_id: userId,
      staff_record: !staffError,
      staff_error: staffError?.message ?? null,
    });
  } catch (err) {
    console.error('create-staff-user error', err);
    return json({ error: 'unexpected', message: err instanceof Error ? err.message : 'Unexpected error' }, 500);
  }
});
