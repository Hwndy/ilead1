import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Export users request received');

    // Create admin client with service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify the requester is a super admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      console.error('User is not an admin');
      return new Response(
        JSON.stringify({ error: 'Only admins can export users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching all users with admin client');

    // Fetch all profiles
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('user_id, full_name, created_at')
      .order('created_at', { ascending: false });

    if (profilesError) {
      console.error('Profiles error:', profilesError);
      throw profilesError;
    }

    console.log(`Found ${profiles?.length || 0} profiles`);

    // Fetch all emails from auth.users using admin API
    const { data: authUsers, error: authUsersError } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 10000
    });

    if (authUsersError) {
      console.error('Auth users error:', authUsersError);
      throw authUsersError;
    }

    console.log(`Found ${authUsers?.users?.length || 0} auth users`);

    // Create email map
    const emailMap = new Map(authUsers?.users?.map(u => [u.id, u.email]) || []);

    // Fetch all user roles
    const userIds = profiles?.map(p => p.user_id) || [];
    const { data: rolesData } = await supabaseAdmin
      .from('user_roles')
      .select('user_id, role')
      .in('user_id', userIds);

    const roleMap = new Map(rolesData?.map(r => [r.user_id, r.role]) || []);

    // Fetch class assignments for students
    const { data: classAssignments } = await supabaseAdmin
      .from('class_assignments')
      .select('student_id, class_id, classes(name)')
      .in('student_id', userIds);

    const classMap = new Map(
      classAssignments?.map(ca => [ca.student_id, (ca.classes as any)?.name || 'Unknown']) || []
    );

    console.log(`Found ${classAssignments?.length || 0} class assignments`);

    // Build user data with all info
    const usersData = profiles?.map(profile => {
      const role = roleMap.get(profile.user_id) || 'student';
      const email = emailMap.get(profile.user_id) || '';
      const className = role === 'student' ? (classMap.get(profile.user_id) || 'Not Assigned') : 'N/A';

      return {
        full_name: profile.full_name,
        email,
        role,
        school: 'iVintage College',
        class_name: className,
        created_at: profile.created_at
      };
    }) || [];

    console.log(`Returning ${usersData.length} users`);

    return new Response(
      JSON.stringify({ users: usersData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Export users error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to export users' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
