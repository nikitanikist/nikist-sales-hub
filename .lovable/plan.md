
# Add Admin/Member to Organization Feature

## Problem
When a Super Admin creates an organization, it starts empty with 0 members. The current dashboard has:
- A view of existing members with org admin toggle
- **No way to add new members/admins to an organization**

The `manage-users` edge function creates users but doesn't assign them to organizations.

---

## Solution
Add an "Add Member" feature to the Super Admin Dashboard that allows:
1. Selecting an existing user from a dropdown
2. Setting their role within the organization
3. Optionally making them an Org Admin
4. Creating the `organization_members` record

---

## Implementation

### Changes to `src/pages/SuperAdminDashboard.tsx`

**1. Add new state variables:**
```typescript
const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
const [availableUsers, setAvailableUsers] = useState<{id: string, full_name: string, email: string}[]>([]);
const [selectedUserId, setSelectedUserId] = useState("");
const [newMemberRole, setNewMemberRole] = useState<string>("viewer");
const [newMemberIsOrgAdmin, setNewMemberIsOrgAdmin] = useState(false);
```

**2. Add function to fetch available users (those not already in the organization):**
```typescript
const fetchAvailableUsers = async () => {
  // Get all profiles
  const { data: allProfiles } = await supabase
    .from("profiles")
    .select("id, full_name, email");
  
  // Filter out users already in the organization
  const existingMemberIds = orgMembers.map(m => m.user_id);
  const available = (allProfiles || []).filter(
    p => !existingMemberIds.includes(p.id)
  );
  
  setAvailableUsers(available);
};
```

**3. Add function to add member to organization:**
```typescript
const addMemberToOrg = async () => {
  if (!selectedOrg || !selectedUserId) {
    toast.error("Please select a user");
    return;
  }

  try {
    const { error } = await supabase
      .from("organization_members")
      .insert({
        organization_id: selectedOrg.id,
        user_id: selectedUserId,
        role: newMemberRole,
        is_org_admin: newMemberIsOrgAdmin,
      });

    if (error) throw error;

    toast.success("Member added successfully");
    setShowAddMemberDialog(false);
    setSelectedUserId("");
    setNewMemberRole("viewer");
    setNewMemberIsOrgAdmin(false);
    fetchOrgDetails(selectedOrg); // Refresh members list
    fetchOrganizations(); // Update member counts
  } catch (error: any) {
    console.error("Error adding member:", error);
    toast.error(error.message || "Failed to add member");
  }
};
```

**4. Add "Add Member" button to the Members tab (above the table):**
```typescript
<TabsContent value="members">
  <div className="flex justify-end mb-4">
    <Dialog open={showAddMemberDialog} onOpenChange={(open) => {
      setShowAddMemberDialog(open);
      if (open) fetchAvailableUsers();
    }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Member to {selectedOrg?.name}</DialogTitle>
          <DialogDescription>
            Select an existing user to add to this organization
          </DialogDescription>
        </DialogHeader>
        {/* Form with Select for user, role dropdown, org admin switch */}
        <DialogFooter>
          <Button onClick={addMemberToOrg}>Add Member</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
  <Table>...</Table>
</TabsContent>
```

**5. Add Select component import and role options:**
```typescript
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } 
  from "@/components/ui/select";

const ROLE_OPTIONS = [
  { value: "viewer", label: "Viewer" },
  { value: "sales_rep", label: "Sales Rep" },
  { value: "manager", label: "Manager" },
  { value: "admin", label: "Admin" },
];
```

---

## Technical Details

### Files to Modify
| File | Changes |
|------|---------|
| `src/pages/SuperAdminDashboard.tsx` | Add member dialog, state, and functions |

### RLS Verification
The existing policy "Super admins can manage org members" with `USING (is_super_admin(auth.uid()))` should allow INSERT. However, we should add a `WITH CHECK` clause for better security:

```sql
DROP POLICY IF EXISTS "Super admins can manage org members" ON public.organization_members;
CREATE POLICY "Super admins can manage org members" 
ON public.organization_members 
FOR ALL 
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));
```

---

## Expected Result
1. Super Admin can click "Add Member" button in the Members tab
2. A dialog opens with:
   - Dropdown of available users (not already in org)
   - Role selection (viewer, sales_rep, manager, admin)
   - Org Admin toggle switch
3. Clicking "Add Member" creates the organization_members record
4. Member appears in the table immediately
5. Member count updates on the organization card
