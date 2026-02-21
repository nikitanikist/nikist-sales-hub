

# Add Super Admin Controls for Funnels and Operations

## Current Situation

- **Funnels**: The `funnels` permission key already exists and is listed in `PERMISSION_GROUPS` under "Funnels". However, the "Funnels" group also bundles `workshops` and `products` -- so toggling `funnels` only hides the "Active Funnels" sub-menu, not the entire Funnels section. The Super Admin should already see this toggle, so it may just need clarification.
- **Operations**: There is **no** `operations` permission key. The Operations sidebar items currently use `workshops` and `settings` as their permission keys, so there's no way to hide the Operations section independently.

## Changes

### 1. `src/lib/permissions.ts`

- Add `operations: 'operations'` to `PERMISSION_KEYS`
- Add `operations: 'Operations'` to `PERMISSION_LABELS`
- Add route mappings for `/operations/workshop-notification` and `/operations/dynamic-links` to the new `operations` key in `ROUTE_TO_PERMISSION`
- Add a new "Operations" group to `PERMISSION_GROUPS` containing just the `operations` permission
- Add `operations` to admin and manager `DEFAULT_PERMISSIONS`

### 2. `src/components/AppLayout.tsx`

- Change the `permissionKey` on the Operations sidebar children (`Workshop Notification` and `Dynamic Links`) from `'workshops'`/`'settings'` to `'operations'`
- This allows the entire Operations section to be hidden by disabling the single `operations` permission

### 3. No database changes needed

The `disabled_permissions` column is a text array, so adding `'operations'` to it works automatically.

## Result

After this change, the Super Admin will see an "Operations" toggle in the Feature Overrides panel. Disabling it will hide the entire Operations section (Workshop Notification and Dynamic Links) from the organization's users.

The "Funnels" toggle (`funnels` key under the existing "Funnels" group) already exists -- if the Super Admin wants to hide just "Active Funnels", they toggle that off. Workshops and Products have their own independent toggles in the same group.
