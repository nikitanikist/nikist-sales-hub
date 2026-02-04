
# Fix All Closer Calls Page - Closer Dropdown

## Summary
Replace the direct `user_roles` table query with the existing `useOrgClosers` hook to fix the empty closer dropdown caused by the new RLS policy.

## What's Happening
The closer filter dropdown on the All Closer Calls page is empty for non-super-admin users because it directly queries the `user_roles` table, which now restricts visibility due to recent security hardening.

## The Fix
Use the existing `useOrgClosers` hook that already queries `organization_members` instead of `user_roles`.

---

## Technical Details

### File to Modify
`src/pages/AllCloserCalls.tsx`

### Changes Required

1. **Add import for the hook** (around line 27):
   ```typescript
   import { useOrgClosers } from "@/hooks/useOrgClosers";
   ```

2. **Replace the closers query** (lines 305-326):
   
   **Current code (broken):**
   ```typescript
   const { data: closers } = useQuery({
     queryKey: ["all-closers-dropdown"],
     queryFn: async () => {
       const { data: userRoles, error: rolesError } = await supabase
         .from("user_roles")
         .select("user_id")
         .eq("role", "sales_rep");
       // ... profiles query
     },
   });
   ```

   **Replace with:**
   ```typescript
   const { data: closers } = useOrgClosers();
   ```

### Why This Works
- The `useOrgClosers` hook queries `organization_members` which has proper RLS allowing authenticated users to see members of their organization
- It's already scoped to the current organization (multi-tenant safe)
- Returns the same data structure (`id`, `full_name`) needed by the dropdown
- Follows existing project patterns for organization-scoped data

### No Other Changes Needed
The rest of the component already works with the `closers` data structure returned by the hook since both return objects with `id` and `full_name` properties.
