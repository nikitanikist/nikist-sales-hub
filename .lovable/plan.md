
# Fix: Add Member Edge Function Error

## Problem Identified

When trying to add a member to an organization from the Super Admin Dashboard, the edge function fails with a non-2xx status code because:

1. **Missing `organization_id`**: The frontend is not passing `organization_id` to the `manage-users` edge function, but the function requires it (returns 400 error when undefined)

2. **Duplicate insert attempt**: The code structure shows a flawed pattern:
   - The edge function (`manage-users`) already inserts into `organization_members` table when `action: 'create'` is called
   - The frontend then tries to insert again after the function returns
   - This would cause a duplicate key error if the first issue were fixed

## Root Cause

In `src/pages/SuperAdminDashboard.tsx` (lines 361-370):
```typescript
const { data, error: fnError } = await supabase.functions.invoke('manage-users', {
  body: {
    action: 'create',
    email: newUserEmail.trim(),
    full_name: newUserName.trim(),
    phone: newUserPhone.trim() || null,
    password: newUserPassword,
    role: newMemberRole,
    // organization_id is MISSING!
  }
});
```

The edge function checks for `organization_id` and returns error 400 when undefined:
```typescript
if (!organization_id) {
  return new Response(
    JSON.stringify({ error: 'organization_id is required' }),
    { status: 400, headers: {...} }
  );
}
```

## Solution

Update the `addMemberToOrg` function in `SuperAdminDashboard.tsx`:

1. **Add `organization_id` to the edge function call** - Pass `selectedOrg.id` as `organization_id`

2. **Remove the duplicate insert** - The edge function already handles adding the user to `organization_members`, so we don't need Step 2

3. **Pass `is_org_admin` to the edge function** - The function uses this to set the `is_org_admin` field

### Code Change

**Before (lines 360-390):**
```typescript
// Step 1: Create the user via edge function
const { data, error: fnError } = await supabase.functions.invoke('manage-users', {
  body: {
    action: 'create',
    email: newUserEmail.trim(),
    full_name: newUserName.trim(),
    phone: newUserPhone.trim() || null,
    password: newUserPassword,
    role: newMemberRole,
  }
});

if (fnError) throw fnError;
if (data?.error) throw new Error(data.error);

const userId = data?.user_id;
if (!userId) {
  throw new Error("Failed to create user - no user ID returned");
}

// Step 2: Add to organization_members
const { error: memberError } = await supabase
  .from("organization_members")
  .insert({
    organization_id: selectedOrg.id,
    user_id: userId,
    role: newMemberRole,
    is_org_admin: newMemberIsOrgAdmin,
  });

if (memberError) throw memberError;
```

**After:**
```typescript
// Create user and add to organization via edge function
const { data, error: fnError } = await supabase.functions.invoke('manage-users', {
  body: {
    action: 'create',
    organization_id: selectedOrg.id,  // ADD THIS
    email: newUserEmail.trim(),
    full_name: newUserName.trim(),
    phone: newUserPhone.trim() || null,
    password: newUserPassword,
    role: newMemberRole,
  }
});

if (fnError) throw fnError;
if (data?.error) throw new Error(data.error);

// Edge function already adds user to organization_members,
// so we just need to update is_org_admin if different from default
if (newMemberIsOrgAdmin && newMemberRole !== 'admin') {
  // Edge function sets is_org_admin = true only for admin role
  // If user wants org admin but different role, update it
  await supabase
    .from("organization_members")
    .update({ is_org_admin: true })
    .eq("user_id", data.user_id)
    .eq("organization_id", selectedOrg.id);
}
```

## Additional Enhancement (Optional)

The edge function currently determines `is_org_admin` based on whether `role === 'admin'`. To support the "Make Organization Admin" toggle for non-admin roles, we should also update the edge function to accept an explicit `is_org_admin` parameter.

### Edge Function Update

In `supabase/functions/manage-users/index.ts`, line 163-164:
```typescript
// Before:
is_org_admin: role === 'admin',

// After:
is_org_admin: is_org_admin !== undefined ? is_org_admin : (role === 'admin'),
```

And extract `is_org_admin` from the request body (line 47):
```typescript
const { 
  action, 
  user_id, 
  organization_id, 
  membership_id,
  email, 
  full_name, 
  phone, 
  role, 
  password, 
  permissions,
  is_org_admin  // ADD THIS
} = await req.json();
```

## Files to Modify

1. `src/pages/SuperAdminDashboard.tsx` - Add `organization_id` to edge function call, remove duplicate insert
2. `supabase/functions/manage-users/index.ts` - Accept `is_org_admin` parameter explicitly

## Testing

After fix:
1. Navigate to Super Admin Dashboard
2. Select an organization
3. Click "Add Member"
4. Fill in all fields (Name, Email, Phone, Password, Role)
5. Toggle "Make Organization Admin" on/off
6. Click "Create"
7. Verify user is created and added to organization without errors
