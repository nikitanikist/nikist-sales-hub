import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Default permissions by role
const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  admin: [
    'dashboard', 'daily_money_flow', 'customers', 'customer_insights',
    'call_schedule', 'sales_closers', 'batch_icc', 'batch_futures',
    'batch_high_future', 'workshops', 'sales', 'funnels', 'products', 'users'
  ],
  manager: [
    'daily_money_flow', 'customers', 'sales_closers', 'batch_icc',
    'batch_futures', 'batch_high_future', 'workshops'
  ],
  sales_rep: ['call_schedule', 'sales_closers', 'batch_icc'],
  viewer: [],
};

const ALL_PERMISSIONS = [
  'dashboard', 'daily_money_flow', 'customers', 'customer_insights',
  'call_schedule', 'sales_closers', 'batch_icc', 'batch_futures',
  'batch_high_future', 'workshops', 'sales', 'funnels', 'products', 'users'
];

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, user_id, email, full_name, phone, role, password, permissions } = await req.json();

    console.log(`manage-users called with action: ${action}`);

    // Create Supabase admin client
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

    if (action === 'create') {
      // Validate required fields
      if (!email || !full_name || !password) {
        return new Response(
          JSON.stringify({ error: 'Email, full_name, and password are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate role
      const validRoles = ['admin', 'sales_rep', 'viewer', 'manager'];
      if (!validRoles.includes(role)) {
        return new Response(
          JSON.stringify({ error: 'Invalid role. Must be admin, sales_rep, viewer, or manager' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Creating user: ${full_name} (${email}) with role: ${role}`);

      // Check if user already exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === email);

      if (existingUser) {
        return new Response(
          JSON.stringify({ error: 'A user with this email already exists' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create new auth user with the specified password
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name }
      });

      if (authError) {
        console.error('Error creating auth user:', authError);
        throw authError;
      }

      console.log(`Created auth user: ${authData.user.id}`);

      // Update profile with phone if provided
      if (phone) {
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .update({ phone, full_name })
          .eq('id', authData.user.id);

        if (profileError) {
          console.error('Error updating profile:', profileError);
        }
      }

      // The handle_new_user trigger creates 'viewer' role by default
      // Update to the requested role if different
      if (role !== 'viewer') {
        const { error: updateRoleError } = await supabaseAdmin
          .from('user_roles')
          .update({ role })
          .eq('user_id', authData.user.id);

        if (updateRoleError) {
          console.error('Error updating role:', updateRoleError);
          throw updateRoleError;
        }
      }

      // Create default permissions based on role (or custom if provided)
      const permissionsToSet = permissions || DEFAULT_PERMISSIONS[role] || [];
      
      // Insert permissions for all permission keys
      const permissionRecords = ALL_PERMISSIONS.map(key => ({
        user_id: authData.user.id,
        permission_key: key,
        is_enabled: permissionsToSet.includes(key),
      }));

      const { error: permError } = await supabaseAdmin
        .from('user_permissions')
        .insert(permissionRecords);

      if (permError) {
        console.error('Error creating permissions:', permError);
        // Don't throw - permissions are non-critical for user creation
      }

      console.log(`Successfully created user: ${full_name} (${email}) with role: ${role}`);

      return new Response(
        JSON.stringify({ 
          message: 'User created successfully',
          user_id: authData.user.id,
          email,
          full_name,
          role
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'update') {
      // Validate required fields
      if (!user_id) {
        return new Response(
          JSON.stringify({ error: 'user_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Updating user: ${user_id}`);

      // Update auth user if email or password changed
      const authUpdateData: any = {};
      if (email) authUpdateData.email = email;
      if (password) authUpdateData.password = password;

      if (Object.keys(authUpdateData).length > 0) {
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
          user_id,
          authUpdateData
        );

        if (authError) {
          console.error('Error updating auth user:', authError);
          throw authError;
        }
      }

      // Update profile
      const profileUpdateData: any = {};
      if (full_name) profileUpdateData.full_name = full_name;
      if (email) profileUpdateData.email = email;
      if (phone !== undefined) profileUpdateData.phone = phone;

      if (Object.keys(profileUpdateData).length > 0) {
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .update(profileUpdateData)
          .eq('id', user_id);

        if (profileError) {
          console.error('Error updating profile:', profileError);
          throw profileError;
        }
      }

      // Update role if changed
      if (role) {
        const validRoles = ['admin', 'sales_rep', 'viewer', 'manager'];
        if (!validRoles.includes(role)) {
          return new Response(
            JSON.stringify({ error: 'Invalid role. Must be admin, sales_rep, viewer, or manager' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Delete existing roles and add new one
        await supabaseAdmin
          .from('user_roles')
          .delete()
          .eq('user_id', user_id);

        const { error: roleError } = await supabaseAdmin
          .from('user_roles')
          .insert({ user_id, role });

        if (roleError) {
          console.error('Error updating role:', roleError);
          throw roleError;
        }
      }

      // Update permissions if provided
      if (permissions && Array.isArray(permissions)) {
        console.log('Updating permissions:', permissions);
        
        // Delete existing permissions
        await supabaseAdmin
          .from('user_permissions')
          .delete()
          .eq('user_id', user_id);

        // Insert new permissions
        const permissionRecords = ALL_PERMISSIONS.map(key => ({
          user_id,
          permission_key: key,
          is_enabled: permissions.includes(key),
        }));

        const { error: permError } = await supabaseAdmin
          .from('user_permissions')
          .insert(permissionRecords);

        if (permError) {
          console.error('Error updating permissions:', permError);
          throw permError;
        }
      }

      console.log(`Successfully updated user: ${user_id}`);

      return new Response(
        JSON.stringify({ message: 'User updated successfully', user_id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'delete') {
      // Validate required fields
      if (!user_id) {
        return new Response(
          JSON.stringify({ error: 'user_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Deleting user: ${user_id}`);

      // Delete user permissions first
      await supabaseAdmin
        .from('user_permissions')
        .delete()
        .eq('user_id', user_id);

      // Delete user roles
      await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', user_id);

      // Delete profile
      await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', user_id);

      // Delete auth user
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user_id);

      if (authError) {
        console.error('Error deleting auth user:', authError);
        throw authError;
      }

      console.log(`Successfully deleted user: ${user_id}`);

      return new Response(
        JSON.stringify({ message: 'User deleted successfully', user_id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'get_permissions') {
      // Get permissions for a specific user
      if (!user_id) {
        return new Response(
          JSON.stringify({ error: 'user_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: perms, error: permsError } = await supabaseAdmin
        .from('user_permissions')
        .select('permission_key, is_enabled')
        .eq('user_id', user_id);

      if (permsError) {
        console.error('Error fetching permissions:', permsError);
        throw permsError;
      }

      // Convert to object format
      const permissionsMap: Record<string, boolean> = {};
      perms?.forEach(p => {
        permissionsMap[p.permission_key] = p.is_enabled;
      });

      return new Response(
        JSON.stringify({ permissions: permissionsMap }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action. Must be create, update, delete, or get_permissions' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error in manage-users function:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
