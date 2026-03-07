

# Fix: Address 5 Senior Developer Review Items

## Status of Each Point

| # | Item | Current Status | Action Needed |
|---|------|---------------|---------------|
| 1 | VoBiz Auth Token in org_integrations | Already correct — credentials resolved from `organization_integrations.config` in all edge functions | **None** |
| 2 | Cron job setup | **Missing** — no `cron.schedule` SQL was ever executed | **Create cron job** |
| 3 | Audio bucket public | Already public (`is_public: true`) | **None** |
| 4 | call_id in query params | Already threaded through answer_url → action → hangup_url in all functions | **None** |
| 5 | Module gating | **Missing** — IVR routes have no `ModuleGuard`, no `ivr-campaigns` module entry | **Add module + guards** |

---

## Changes Required

### 1. Create Cron Job (Data Insert — not migration)

Insert a `cron.schedule` entry using the existing pg_cron + pg_net pattern to hit `process-ivr-queue` every minute (pg_cron minimum interval):

```sql
SELECT cron.schedule(
  'process-ivr-queue-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://swnpxkovxhinxzprxviz.supabase.co/functions/v1/process-ivr-queue',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer <anon_key>"}'::jsonb,
    body:='{"time":"' || now()::text || '"}'::jsonb
  ) as request_id;
  $$
);
```

### 2. Add `ivr-campaigns` Module Entry (Data Insert)

Insert into `modules` table so it appears in the Modules settings page and can be toggled per organization:

```sql
INSERT INTO modules (slug, name, description, is_default_enabled)
VALUES ('ivr-campaigns', 'IVR Campaigns', 'Ultra-low-cost bulk voice campaigns using VoBiz IVR with speech detection', false);
```

### 3. Add `ModuleGuard` to IVR Routes (App.tsx)

Wrap all 4 IVR routes with `<ModuleGuard moduleSlug="ivr-campaigns">`:

```tsx
<Route path="/ivr/dashboard" element={<ProtectedRoute><ModuleGuard moduleSlug="ivr-campaigns"><ErrorBoundary><IvrDashboard /></ErrorBoundary></ModuleGuard></ProtectedRoute>} />
// ... same for /ivr/campaigns, /ivr/campaigns/:campaignId, /ivr/audio-library
```

### 4. Gate Sidebar Items (AppLayout.tsx)

The IVR sidebar items currently use `permissionKey: 'calling'`. Add a `moduleSlug: 'ivr-campaigns'` field (if the sidebar filtering supports it) or use a separate condition. Looking at the existing pattern, sidebar items are filtered by `permissionKey` and modules are checked at route level — so the route-level `ModuleGuard` is sufficient. No sidebar change needed if the pattern matches other modules like `cohort-management` (which also gates at route level).

### Files Modified

- **`src/App.tsx`** — Wrap 4 IVR routes with `ModuleGuard`
- **Database (insert)** — Create cron job + insert module entry

