
# Create New Client User for Organization

## Problem Identified

The current "Add Member" dialog has a fundamental design flaw:

1. **Shows users from ALL organizations** - When you click "Add Member", it fetches all profiles from the database (including Nikist users) and filters only those already in the current org
2. **No way to create NEW users** - A new client doesn't exist in the system yet, so they can't be selected from a dropdown
3. **Wrong for client onboarding** - The Super Admin needs to CREATE the client's account, not select from existing users

## Solution

Redesign the "Add Member" dialog to support **creating a brand new user** specifically for the organization:

### New Workflow
1. Super Admin clicks "Add Member" on a new organization
2. Dialog shows form fields to CREATE a new user:
   - Full Name
   - Email
   - Phone Number
   - Password (Super Admin sets this)
3. Role defaults to "Admin" for the first member
4. The "Org Admin" toggle is automatically ON for the first member
5. On submit:
   - Call the `manage-users` edge function to create the auth user + profile
   - Insert into `organization_members` linking them to the organization
   - The new client can now log in and manage their own team

---

## Implementation

### 1. Update State Variables in SuperAdminDashboard.tsx

Replace the "select existing user" state with "create new user" state:

```typescript
// Remove these:
const [availableUsers, setAvailableUsers] = useState<...>([]);
const [selectedUserId, setSelectedUserId] = useState("");

// Add these:
const [newUserName, setNewUserName] = useState("");
const [newUserEmail, setNewUserEmail] = useState("");
const [newUserPhone, setNewUserPhone] = useState("");
const [newUserPassword, setNewUserPassword] = useState("");
```

### 2. Update the addMemberToOrg Function

New logic to:
1. Call `manage-users` edge function with `action: 'create'` to create the user
2. Insert into `organization_members` with the returned `user_id`

```typescript
const addMemberToOrg = async () => {
  if (!selectedOrg || !newUserName || !newUserEmail || !newUserPassword) {
    toast.error("Please fill in all required fields");
    return;
  }

  setAddingMember(true);
  try {
    // Step 1: Create the user via edge function
    const { data, error: fnError } = await supabase.functions.invoke('manage-users', {
      body: {
        action: 'create',
        email: newUserEmail,
        full_name: newUserName,
        phone: newUserPhone,
        password: newUserPassword,
        role: newMemberRole, // admin by default for first member
      }
    });

    if (fnError) throw fnError;
    if (data.error) throw new Error(data.error);

    // Step 2: Add to organization_members
    const { error: memberError } = await supabase
      .from("organization_members")
      .insert({
        organization_id: selectedOrg.id,
        user_id: data.user_id,
        role: newMemberRole,
        is_org_admin: true, // First member is always org admin
      });

    if (memberError) throw memberError;

    toast.success("Client admin created successfully");
    // Reset form and refresh
    ...
  } catch (error) {
    ...
  }
};
```

### 3. Redesign the Dialog UI

Replace the "Select User" dropdown with input fields:

```
+------------------------------------------+
|    Add Member to Test Organization        |
+------------------------------------------+
|  Create a new user account for this org   |
+------------------------------------------+
|                                          |
|  Full Name *                             |
|  [____________________________]          |
|                                          |
|  Email *                                 |
|  [____________________________]          |
|                                          |
|  Phone Number                            |
|  [____________________________]          |
|                                          |
|  Password *                              |
|  [____________________________]          |
|                                          |
|  Role                                    |
|  [ Admin ▼ ]                             |
|                                          |
|  [x] Make Organization Admin             |
|                                          |
+------------------------------------------+
|           [Cancel]  [Create User]        |
+------------------------------------------+
```

### 4. Smart Defaults for First Member

When the organization has 0 members:
- Default role to "Admin"
- Default "Org Admin" toggle to ON
- Show helper text: "This will be the primary admin for this organization"

---

## Technical Details

### Files to Modify
| File | Changes |
|------|---------|
| `src/pages/SuperAdminDashboard.tsx` | Replace "select user" flow with "create user" form |

### No Edge Function Changes Needed
The existing `manage-users` edge function already supports `action: 'create'` with all required fields (email, full_name, phone, password, role).

### Security Consideration
Only Super Admins can access this page (protected by `isSuperAdmin` check), so only they can create new client accounts.

---

## Expected Result

1. Super Admin creates organization "Test Organization"
2. Clicks "Add Member"
3. Enters client details: Name, Email, Phone, Password
4. Role defaults to "Admin", Org Admin is ON
5. Clicks "Create User"
6. System creates:
   - Auth user in Supabase
   - Profile record
   - User role record (admin)
   - Organization member record (linked to Test Organization)
7. Client can now log in with their email/password and manage their organization
