

# Fix Organization Name Display and Verify Multi-Tenant Implementation

## Problem Summary

1. **Hardcoded "Nikist CRM" branding** - The sidebar header and main header display "Nikist CRM" instead of the user's organization name
2. **Frontend queries don't filter by organization** - While RLS is now in place, the frontend queries don't explicitly filter by `organization_id`, which affects performance and could cause issues
3. **Onboarding page has hardcoded "Nikist" branding** - The customer insights form shows "Nikist" instead of the organization name

---

## Solution Overview

### Phase 1: Fix Organization Name Display (AppLayout.tsx)

**Current Code (lines 72-74):**
```typescript
<h2 className="text-lg font-semibold text-sidebar-foreground">
  {isSuperAdmin ? "Super Admin" : "Nikist CRM"}
</h2>
```

**Updated Code:**
```typescript
<h2 className="text-lg font-semibold text-sidebar-foreground">
  {isSuperAdmin ? "Super Admin" : currentOrganization?.name || "CRM"}
</h2>
```

**Current Code (line 288):**
```typescript
<h1 className="text-lg sm:text-xl font-semibold hidden sm:block">Nikist CRM</h1>
```

**Updated Code:**
```typescript
<h1 className="text-lg sm:text-xl font-semibold hidden sm:block">
  {currentOrganization?.name || "CRM"}
</h1>
```

---

### Phase 2: Update Frontend Queries to Filter by Organization

Even though RLS now handles security, adding explicit `organization_id` filtering improves:
- **Performance** - Less data transferred
- **Clarity** - Code explicitly shows what data is expected
- **Reliability** - Defense in depth

**Example Pattern for Dashboard.tsx:**

```typescript
import { useOrganization } from "@/hooks/useOrganization";

const Dashboard = () => {
  const { currentOrganization } = useOrganization();
  
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return null;
      
      const [leadsResult, workshopsResult, salesResult] = await Promise.all([
        supabase.from("leads")
          .select("*", { count: "exact" })
          .eq("organization_id", currentOrganization.id),
        supabase.from("workshops")
          .select("*", { count: "exact" })
          .eq("organization_id", currentOrganization.id),
        supabase.from("sales")
          .select("amount")
          .eq("organization_id", currentOrganization.id),
      ]);
      // ...
    },
    enabled: !!currentOrganization,
  });
```

---

### Phase 3: Fix Onboarding Page Branding (Onboarding.tsx)

The onboarding page currently shows hardcoded "Nikist" branding. Since this page is accessed within AppLayout (after login), we can use the organization context.

**Current Code (lines 418-423):**
```typescript
<div className="inline-flex items-center gap-2 mb-4">
  <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
    <Sparkles className="h-6 w-6 text-primary-foreground" />
  </div>
  <span className="text-2xl font-bold text-foreground">Nikist</span>
</div>
```

**Updated Code:**
```typescript
const { currentOrganization } = useOrganization();
// ...
<div className="inline-flex items-center gap-2 mb-4">
  <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
    <Sparkles className="h-6 w-6 text-primary-foreground" />
  </div>
  <span className="text-2xl font-bold text-foreground">
    {currentOrganization?.name || "Welcome"}
  </span>
</div>
```

---

### Phase 4: Update Insert Operations to Set Organization ID

When creating new records, ensure `organization_id` is set. Example for leads insert in Onboarding.tsx:

```typescript
const { currentOrganization } = useOrganization();

// When inserting lead
const { data: leadData, error: leadError } = await supabase
  .from("leads")
  .insert({
    contact_name: data.full_name,
    email: data.email,
    organization_id: currentOrganization?.id, // ADD THIS
    // ...other fields
  })
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/AppLayout.tsx` | Replace hardcoded "Nikist CRM" with `currentOrganization?.name` |
| `src/pages/Dashboard.tsx` | Add organization filtering to queries |
| `src/pages/Leads.tsx` | Add organization filtering to queries + insert |
| `src/pages/Workshops.tsx` | Add organization filtering |
| `src/pages/Calls.tsx` | Add organization filtering |
| `src/pages/Batches.tsx` | Add organization filtering |
| `src/pages/Sales.tsx` | Add organization filtering |
| `src/pages/DailyMoneyFlow.tsx` | Add organization filtering |
| `src/pages/FuturesMentorship.tsx` | Add organization filtering |
| `src/pages/HighFuture.tsx` | Add organization filtering |
| `src/pages/Users.tsx` | Add organization filtering |
| `src/pages/Onboarding.tsx` | Replace hardcoded branding + add org_id to inserts |
| `vite.config.ts` | Update PWA manifest name (optional - can keep as product name) |

---

## Implementation Priority

**High Priority:**
1. Fix AppLayout.tsx branding (immediate visual fix)
2. Fix Onboarding.tsx branding

**Medium Priority:**
3. Add organization filtering to Dashboard.tsx, Leads.tsx, Calls.tsx
4. Add organization_id to insert operations

**Lower Priority:**
5. Add filtering to remaining pages (already protected by RLS)

---

## Expected Result

After implementation:
1. When `test@nikist.in` logs in, they see "Test org" in the sidebar and header
2. New data created is automatically associated with their organization
3. Queries explicitly filter by organization for clarity and performance
4. Each organization has fully isolated data and branding

