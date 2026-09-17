import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PAGE = 1000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Only admins can export users' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ---- profiles (paginated; Postgrest caps each request at 1000 rows) ----
    const profiles: Array<{ user_id: string; full_name: string | null; created_at: string }> = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('user_id, full_name, created_at')
        .order('created_at', { ascending: false })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      profiles.push(...((data as any[]) || []));
      if (!data || data.length < PAGE) break;
    }

    // ---- auth users (paginated) ----
    const emailMap = new Map<string, string>();
    for (let page = 1; page <= 100; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: PAGE });
      if (error) throw error;
      const users = data?.users || [];
      for (const u of users) if (u.email) emailMap.set(u.id, u.email);
      if (users.length < PAGE) break;
    }

    // ---- roles (paginated) ----
    const roleMap = new Map<string, string>();
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabaseAdmin
        .from('user_roles')
        .select('user_id, role')
        .range(from, from + PAGE - 1);
      if (error) throw error;
      for (const r of (data as any[]) || []) if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, r.role);
      if (!data || data.length < PAGE) break;
    }

    // ---- class assignments (paginated) ----
    const classMap = new Map<string, string>();
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabaseAdmin
        .from('class_assignments')
        .select('student_id, classes(name)')
        .range(from, from + PAGE - 1);
      if (error) throw error;
      for (const ca of (data as any[]) || []) {
        classMap.set(ca.student_id, (ca.classes as any)?.name || 'Unknown');
      }
      if (!data || data.length < PAGE) break;
    }

    const usersData = profiles.map((profile) => {
      const role = roleMap.get(profile.user_id) || 'student';
      return {
        user_id: profile.user_id,
        full_name: profile.full_name,
        email: emailMap.get(profile.user_id) || '',
        role,
        school: 'iVintage College',
        class_name: role === 'student' ? (classMap.get(profile.user_id) || 'Not Assigned') : 'N/A',
        created_at: profile.created_at,
      };
    });

    return new Response(JSON.stringify({ users: usersData, count: usersData.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Export users error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to export users' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
