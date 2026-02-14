

# TagFunnel System Hardening — Implementation Plan (with Verification Checklist)

This plan addresses all issues from the system audit, organized into 6 phases. Each phase includes a verification checklist to confirm fixes actually work before moving on.

---

## Phase 1: Security Fixes (Day 1)

### 1A. Move hardcoded webhook API key to environment secret
- Replace `nikist-whatsapp-2024-secure-key` with `Deno.env.get('WEBHOOK_SECRET_KEY')` in all 3 webhook files
- Add guard if env var is missing (return 500)
- Store same key value as a secret so nothing breaks; rotate later

### 1B. Stop logging customer PII in edge functions
- Add sanitization helper to `calendly-webhook-akansha` that masks email/phone/name before logging
- Audit all other edge functions for PII in `console.log` and sanitize or remove

### 1C. Fix useToast memory leak
- `src/hooks/use-toast.ts`: change `[state]` dependency to `[]`

### Verification — Phase 1
- [ ] Search entire codebase for `nikist-whatsapp-2024-secure-key` — zero results
- [ ] Search for any other hardcoded API keys or secrets in edge functions
- [ ] Call each webhook with the same API key via curl — should still return 200
- [ ] Call each webhook WITHOUT the key — should return 401
- [ ] Check edge function logs after a Calendly webhook — no customer emails/phones/names visible
- [ ] Open browser DevTools, trigger 20+ toasts rapidly, check Memory tab — should stay flat

---

## Phase 2: Reliability Fixes (Days 2-3)

### 2A. Create shared fetch utility with timeout and retry
- New file: `supabase/functions/_shared/fetchWithRetry.ts`
- Update all edge functions calling external APIs to use it
- Timeouts: 10s for WhatsApp/AiSensy, 15s for Calendly/Zoom

### 2B. Add Calendly webhook idempotency
- Database: unique constraint on `call_appointments.calendly_event_uri` (deduplicate first)
- Update webhook to use `upsert` with `onConflict: 'calendly_event_uri'`

### 2C. Add React Error Boundary
- New component: `src/components/ErrorBoundary.tsx`
- Wrap every page route in `App.tsx`

### Verification — Phase 2
- [ ] Simulate slow/down WhatsApp VPS — function should retry 3 times then fail gracefully, not hang
- [ ] Send duplicate Calendly webhook — should NOT create duplicate appointment
- [ ] Force a render error in any page component — should show ErrorBoundary fallback, not white screen
- [ ] Verify all edge functions still deploy and respond correctly after fetchWithRetry integration

---

## Phase 3: Database Performance (Day 4)

### 3A. Add critical indexes
- Indexes on `leads`, `call_appointments`, `emi_payments`, `lead_assignments`, `workshops`, `call_reminders`, `scheduled_whatsapp_messages`, `organization_members`
- All created with `CONCURRENTLY`
- Run `ANALYZE` afterward

### 3B. Enable RLS on notification_campaign_reads
- Enable RLS + add SELECT/INSERT policies scoped to org membership

### Verification — Phase 3
- [ ] Run `EXPLAIN ANALYZE` on leads list query — should use index scan, not sequential scan
- [ ] Check RLS: `SELECT relrowsecurity FROM pg_class WHERE relname = 'notification_campaign_reads'` — should return `true`
- [ ] Verify existing queries still return correct data (RLS not blocking legitimate access)

---

## Phase 4: Frontend Performance (Day 5 + Week 2)

### 4A. Configure React Query defaults
- `staleTime: 5 min`, `gcTime: 10 min`, `retry: 2`, `refetchOnWindowFocus: false`

### 4B. Add safety limits to list queries
- Add `.limit(1000)` to all list-fetching queries

### 4C. Add loading states to mutation buttons
- Destructure `isPending` from every `useMutation`, disable button + show loading text

### 4D. Fix useEffect dependency warnings
- Remove eslint-disable comments, fix with `useCallback`/`useMemo`/`useRef` as needed

### Verification — Phase 4
- [ ] Tab away and back on any page — should NOT trigger a refetch
- [ ] Click any Save/Send/Create button — should show loading state and prevent double-click
- [ ] Load leads page — should complete in under 3 seconds
- [ ] Run `npx eslint src/` — zero `react-hooks/exhaustive-deps` warnings

---

## Phase 5: Component Refactoring (Week 2)

### 5A. Split large page files
- `Leads.tsx` (~1987 lines) into `src/pages/leads/` (index, table, filters, dialogs, hooks)
- `Batches.tsx` into `src/pages/batches/`
- `Workshops.tsx` into `src/pages/workshops/`
- `FuturesMentorship.tsx` into `src/pages/futures-mentorship/`
- All table rows wrapped with `React.memo`, filtered data wrapped with `useMemo`

### Verification — Phase 5
- [ ] No single file in `src/pages/` exceeds 500 lines
- [ ] All page routes still wrapped in ErrorBoundary
- [ ] All existing functionality works identically (no regressions)
- [ ] Table rows use `React.memo` (check with React DevTools Profiler)

---

## Phase 6: Server-Side Pagination + Dead Letter Queue (Week 3)

### 6A. Implement server-side pagination
- `useLeadsData` hook using `.range()` with `{ count: 'exact' }`
- Pagination UI (Previous/Next, "X of Y")
- Apply same pattern to Workshops, Batches, Calls

### 6B. Add dead letter queue for failed messages
- New table: `message_dead_letter_queue` with RLS
- `process-whatsapp-queue` inserts into DLQ after max retries

### Verification — Phase 6
- [ ] Leads page shows pagination controls
- [ ] Navigating pages loads new data from server (check Network tab — new request per page)
- [ ] Intentionally fail a WhatsApp message after max retries — should appear in `message_dead_letter_queue`
- [ ] DLQ records are scoped by org (RLS working)

---

## What stays untouched
- `link-redirect` edge function (public by design)
- All existing user flows
- Database data (only additive changes)
- Auto-generated files (`client.ts`, `types.ts`, `.env`, `config.toml`)

## Implementation order
```text
Day 1:  1A + 1B + 1C → run Phase 1 checklist
Day 2:  2A → verify retries work
Day 3:  2B + 2C → run Phase 2 checklist
Day 4:  3A + 3B → run Phase 3 checklist
Day 5:  4A + 4B + 4C → run Phase 4 checklist (partial)
Week 2: 4D + 5A-5D → run Phase 4 + 5 checklists
Week 3: 6A + 6B → run Phase 6 checklist
```

