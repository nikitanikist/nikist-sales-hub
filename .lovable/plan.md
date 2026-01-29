

# Fix Plan: Super Admin Features Tab - Migrate to Modules System

## Summary

The Super Admin Dashboard's Features tab currently displays legacy Nikist-specific feature names from a hardcoded `AVAILABLE_FEATURES` array and queries the old `organization_features` table. This needs to be updated to use the new `modules` and `organization_modules` tables which contain generic SaaS module names.

---

## Current Problem

### What's Wrong

| Current (Legacy) | Expected (New Modules) |
|-----------------|----------------------|
| Insider Crypto Club (`batch_icc`) | Cohort Management |
| High Future (`batch_high_future`) | (covered by Cohort Management) |
| Future Mentorship (`batch_futures`) | (covered by Cohort Management) |
| Sales Closers (`sales_closers`) | One-to-One Sales Funnel |
| Workshops | Workshops |
| Dashboard, Customers, etc. | (These are UI features, not modules) |

### Root Cause
1. **Hardcoded Array**: Lines 54-70 define `AVAILABLE_FEATURES` with Nikist-specific product names
2. **Wrong Table**: Lines 193-199 query `organization_features` instead of `organization_modules`
3. **No Modules Integration**: The dashboard doesn't use the `modules` table at all

---

## Database State Analysis

**`modules` table (new - correct):**
- One-to-One Sales Funnel (slug: `one-to-one-funnel`)
- Cohort Management (slug: `cohort-management`)
- Workshops (slug: `workshops`)
- Daily Money Flow (slug: `daily-money-flow`)

**`organization_features` table (legacy - to be deprecated):**
- Contains 15 feature flags like `batch_icc`, `batch_futures`, `batch_high_future`
- These are Nikist-specific and should not be shown

---

## Implementation Steps

### Step 1: Add Modules State and Fetch Logic

**File:** `src/pages/SuperAdminDashboard.tsx`

**Add new state variables:**
```typescript
// Add new interface for modules
interface Module {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  is_premium: boolean;
  display_order: number;
}

interface OrganizationModule {
  id: string;
  module_id: string;
  is_enabled: boolean;
  modules: Module;
}

// Add state
const [allModules, setAllModules] = useState<Module[]>([]);
const [orgModules, setOrgModules] = useState<OrganizationModule[]>([]);
```

**Add fetch functions:**
```typescript
// Fetch all available modules (call on mount)
const fetchAllModules = async () => {
  const { data, error } = await supabase
    .from("modules")
    .select("*")
    .order("display_order");
  
  if (!error && data) {
    setAllModules(data);
  }
};

// Update fetchOrgDetails to also fetch organization_modules
const fetchOrgModules = async (orgId: string) => {
  const { data, error } = await supabase
    .from("organization_modules")
    .select(`
      id,
      module_id,
      is_enabled,
      modules (*)
    `)
    .eq("organization_id", orgId);
  
  if (!error && data) {
    setOrgModules(data as OrganizationModule[]);
  }
};
```

### Step 2: Update fetchOrgDetails Function

**Lines 160-204:** Modify to fetch organization_modules instead of organization_features:

```typescript
const fetchOrgDetails = async (org: Organization) => {
  setSelectedOrg(org);

  try {
    // Fetch members (keep existing logic)
    // ...existing member fetching code...

    // Replace organization_features with organization_modules
    const { data: modules, error: modulesError } = await supabase
      .from("organization_modules")
      .select(`
        id,
        module_id,
        is_enabled,
        modules (*)
      `)
      .eq("organization_id", org.id);

    if (modulesError) throw modulesError;
    setOrgModules(modules as OrganizationModule[] || []);
  } catch (error) {
    console.error("Error fetching org details:", error);
    toast.error("Failed to load organization details");
  }
};
```

### Step 3: Update toggleFeature to toggleModule

**Lines 265-300:** Replace with module-based toggle:

```typescript
const toggleModule = async (moduleId: string) => {
  if (!selectedOrg) return;

  const existingOrgModule = orgModules.find((om) => om.module_id === moduleId);

  try {
    if (existingOrgModule) {
      // Update existing record
      const { error } = await supabase
        .from("organization_modules")
        .update({ 
          is_enabled: !existingOrgModule.is_enabled,
          enabled_at: !existingOrgModule.is_enabled ? new Date().toISOString() : null
        })
        .eq("id", existingOrgModule.id);

      if (error) throw error;
    } else {
      // Insert new record for this org + module
      const { error } = await supabase
        .from("organization_modules")
        .insert({
          organization_id: selectedOrg.id,
          module_id: moduleId,
          is_enabled: true,
          enabled_at: new Date().toISOString(),
        });

      if (error) throw error;
    }

    // Refresh modules for the selected org
    const { data: modules } = await supabase
      .from("organization_modules")
      .select(`
        id,
        module_id,
        is_enabled,
        modules (*)
      `)
      .eq("organization_id", selectedOrg.id);

    setOrgModules(modules as OrganizationModule[] || []);
    toast.success("Module updated");
  } catch (error) {
    console.error("Error toggling module:", error);
    toast.error("Failed to update module");
  }
};
```

### Step 4: Update Features Tab UI

**Lines 756-777:** Replace with module-based rendering:

```typescript
<TabsContent value="features">
  <div className="space-y-4">
    <p className="text-sm text-muted-foreground">
      Enable or disable modules for this organization
    </p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {allModules.map((module) => {
        const orgModule = orgModules.find(
          (om) => om.module_id === module.id
        );
        const isEnabled = orgModule?.is_enabled ?? false;

        return (
          <div
            key={module.id}
            className="flex items-center justify-between p-4 border rounded-lg"
          >
            <div className="space-y-1">
              <span className="text-sm font-medium">{module.name}</span>
              {module.description && (
                <p className="text-xs text-muted-foreground">
                  {module.description}
                </p>
              )}
            </div>
            <Switch
              checked={isEnabled}
              onCheckedChange={() => toggleModule(module.id)}
            />
          </div>
        );
      })}
    </div>
  </div>
</TabsContent>
```

### Step 5: Update Details Tab Stats

**Lines 599-604:** Update to show modules count:

```typescript
<div>
  <Label className="text-muted-foreground">Modules Enabled</Label>
  <p className="font-medium">
    {orgModules.filter((m) => m.is_enabled).length} / {allModules.length}
  </p>
</div>
```

### Step 6: Update createOrganization Function

**Lines 206-243:** When creating a new organization, enable all modules by default:

```typescript
const createOrganization = async () => {
  // ...existing validation...

  try {
    const { data, error } = await supabase
      .from("organizations")
      .insert({ name, slug })
      .select()
      .single();

    if (error) throw error;

    // Enable all modules for the new organization
    const defaultModules = allModules.map((m) => ({
      organization_id: data.id,
      module_id: m.id,
      is_enabled: true,
      enabled_at: new Date().toISOString(),
    }));

    await supabase.from("organization_modules").insert(defaultModules);

    // Remove old organization_features insert
    // ...rest of function...
  }
};
```

### Step 7: Remove Legacy Code

- Remove the `AVAILABLE_FEATURES` constant (lines 54-70)
- Remove `orgFeatures` state (line 78)
- Remove the `OrganizationFeature` interface (lines 48-52)

---

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/SuperAdminDashboard.tsx` | Replace organization_features with organization_modules throughout |

---

## Testing After Fix

1. **Login as Super Admin** and navigate to `/super-admin`
2. **Select Nikist Organization** and click the "Features" tab
3. **Verify Module Names:**
   - Should show: "One-to-One Sales Funnel", "Cohort Management", "Workshops", "Daily Money Flow"
   - Should NOT show: "Insider Crypto Club", "High Future", "Future Mentorship"
4. **Test Toggle:** Disable a module and verify it saves correctly
5. **Create New Organization:** Verify all modules are enabled by default
6. **Check Details Tab:** Verify "Modules Enabled" count is accurate

---

## Technical Notes

### Migration Strategy
- The old `organization_features` table will remain for now as a fallback
- The sidebar navigation may still reference legacy feature keys until a separate update
- Future cleanup should remove `organization_features` table entirely

### Module vs Feature Distinction
- **Modules** = Major product capabilities (One-to-One Funnel, Cohort Management)
- **Features** = UI-level toggles (Dashboard visibility, Customer insights)
- This fix focuses on modules; features can be handled separately if needed

