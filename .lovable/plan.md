
# Fix Manager Permission Display Issue

## Problem Summary
The manager user `suman@nikist.in` is only seeing 3 sidebar menu items (Customers, Sales Closers, All Workshops) instead of the full manager menu because:

1. **Custom permissions exist in database**: The `user_permissions` table has stored permissions for this user that were set BEFORE the recent manager role update
2. **Stored permissions override defaults**: In `useUserRole.tsx`, when custom permissions exist in the database (lines 140-152), they are used INSTEAD of the `DEFAULT_PERMISSIONS[role]` defaults
3. **Old permission keys**: The stored permissions use legacy keys like `batch_icc`, `batch_futures`, `batch_high_future` instead of the unified `cohort_batches` key
4. **Missing new permissions**: The stored data has `dashboard`, `customer_insights`, `call_schedule`, `sales`, `funnels`, `products` all set to `false`

### Current Stored Permissions for suman@nikist.in:
| Permission Key | Stored Value | Expected for Manager |
|----------------|-------------|---------------------|
| dashboard | false ❌ | true |
| daily_money_flow | false | false ✅ |
| customers | true | true ✅ |
| customer_insights | false ❌ | true |
| call_schedule | false ❌ | true |
| sales_closers | true | true ✅ |
| cohort_batches | NOT PRESENT ❌ | true |
| workshops | true | true ✅ |
| sales | false ❌ | true |
| funnels | false ❌ | true |
| products | false ❌ | true |
| users | false | false ✅ |

## Solution
Update the stored permissions in the database to match the new manager role defaults, and remove the legacy batch permission keys.

---

## Implementation Steps

### Step 1: Database Migration
Delete the old permission records and insert new ones with correct manager permissions:

```sql
-- Delete old permissions for the manager user
DELETE FROM user_permissions 
WHERE user_id = (SELECT id FROM profiles WHERE email = 'suman@nikist.in');

-- Insert new manager permissions with correct values
INSERT INTO user_permissions (user_id, permission_key, is_enabled, organization_id)
SELECT 
  p.id as user_id,
  key.permission_key,
  CASE 
    WHEN key.permission_key IN ('dashboard', 'customers', 'customer_insights', 'call_schedule', 
                                 'sales_closers', 'cohort_batches', 'workshops', 'sales', 
                                 'funnels', 'products') THEN true
    ELSE false
  END as is_enabled,
  '00000000-0000-0000-0000-000000000001' as organization_id
FROM profiles p
CROSS JOIN (
  VALUES 
    ('dashboard'), ('daily_money_flow'), ('customers'), ('customer_insights'),
    ('call_schedule'), ('sales_closers'), ('cohort_batches'), ('workshops'),
    ('sales'), ('funnels'), ('products'), ('users')
) AS key(permission_key)
WHERE p.email = 'suman@nikist.in';
```

### Step 2: Alternative - Delete Custom Permissions
A simpler approach: Delete all custom permissions for the manager so the system falls back to `DEFAULT_PERMISSIONS.manager`:

```sql
DELETE FROM user_permissions 
WHERE user_id = (SELECT id FROM profiles WHERE email = 'suman@nikist.in');
```

This will make `useUserRole.tsx` use the default manager permissions we defined in `permissions.ts`.

---

## Why This Happened
The permission system has two layers:
1. **Custom permissions** (stored in `user_permissions` table) - takes priority
2. **Default role permissions** (defined in `DEFAULT_PERMISSIONS` in `permissions.ts`) - fallback

When we updated `DEFAULT_PERMISSIONS.manager` in the previous change, it only affects users WITHOUT custom stored permissions. Users with existing `user_permissions` records continue to use those stored values.

## Recommended Approach
**Option A (Recommended)**: Delete the custom permissions for this manager so they use role defaults
- Pros: Simple, uses the role system correctly
- Cons: Any future manual customization would need to be re-done

**Option B**: Update the stored permissions to match manager defaults
- Pros: Preserves the custom permission structure  
- Cons: More complex, needs to be done for each affected user

## Files to Modify
None - this is a database-only fix via migration.

## Post-Fix Verification
After applying the migration:
1. Manager should see: Dashboard, Customers, Customer Insights, 1:1 Call Schedule, Sales Closers, Cohort Batches, All Workshops, Sales, Active Funnels, Products
2. Manager should NOT see: Daily Money Flow, Users
3. The "No organization selected" message should not appear if the organization loads properly
