import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to validate user authentication and admin role
// deno-lint-ignore no-explicit-any
async function validateAdminAccess(req: Request, supabaseAdmin: any): Promise<{ valid: boolean; error?: string; userId?: string }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing or invalid authorization header' };
  }

  const token = authHeader.replace('Bearer ', '');
  
  // Verify the JWT token
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  
  if (authError || !user) {
    return { valid: false, error: 'Invalid or expired token' };
  }

  // Check if user has admin role in any organization
  const { data: membership, error: memberError } = await supabaseAdmin
    .from('organization_members')
    .select('role, is_org_admin')
    .eq('user_id', user.id)
    .or('role.eq.admin,is_org_admin.eq.true')
    .limit(1)
    .maybeSingle();

  if (memberError || !membership) {
    // Also check for super admin
    const { data: superAdmin } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'super_admin')
      .maybeSingle();
    
    if (!superAdmin) {
      return { valid: false, error: 'Unauthorized: Admin access required' };
    }
  }

  return { valid: true, userId: user.id };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase admin client first for auth validation
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Validate authentication and admin access
    const authResult = await validateAdminAccess(req, supabaseAdmin);
    if (!authResult.valid) {
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, full_name, role = 'sales_rep' } = await req.json();

    // Validate required fields
    if (!email || !full_name) {
      console.error('Missing required fields:', { email, full_name });
      return new Response(
        JSON.stringify({ error: 'Email and full_name are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate role
    const validRoles = ['admin', 'sales_rep', 'viewer'];
    if (!validRoles.includes(role)) {
      console.error('Invalid role:', role);
      return new Response(
        JSON.stringify({ error: 'Invalid role. Must be admin, sales_rep, or viewer' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Creating closer: ${full_name} (${email}) with role: ${role} - requested by user: ${authResult.userId}`);

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    if (existingUser) {
      console.log(`User ${email} already exists, checking role...`);
      
      // Check if they already have the role
      const { data: existingRole } = await supabaseAdmin
        .from('user_roles')
        .select('*')
        .eq('user_id', existingUser.id)
        .eq('role', role)
        .single();

      if (existingRole) {
        return new Response(
          JSON.stringify({ 
            message: 'User already exists with this role',
            user_id: existingUser.id 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Add the new role
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({ user_id: existingUser.id, role });

      if (roleError) {
        console.error('Error adding role:', roleError);
        throw roleError;
      }

      console.log(`Added ${role} role to existing user ${email}`);
      return new Response(
        JSON.stringify({ 
          message: 'Role added to existing user',
          user_id: existingUser.id 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create new auth user with a temporary password
    const tempPassword = crypto.randomUUID();
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name }
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      throw authError;
    }

    console.log(`Created auth user: ${authData.user.id}`);

    // The handle_new_user trigger will create the profile and assign 'viewer' role
    // We need to update the role to the requested one if it's not 'viewer'
    if (role !== 'viewer') {
      // Update the existing viewer role to the requested role
      const { error: updateRoleError } = await supabaseAdmin
        .from('user_roles')
        .update({ role })
        .eq('user_id', authData.user.id);

      if (updateRoleError) {
        console.error('Error updating role:', updateRoleError);
        throw updateRoleError;
      }
      console.log(`Updated role to ${role} for user ${authData.user.id}`);
    }

    console.log(`Successfully created closer: ${full_name} (${email})`);

    return new Response(
      JSON.stringify({ 
        message: 'Closer created successfully',
        user_id: authData.user.id,
        email,
        full_name,
        role
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error in add-closer function:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
