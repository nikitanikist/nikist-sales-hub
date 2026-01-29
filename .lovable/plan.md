

# Plan: Complete Remaining Multi-Tenant Edge Function Migration

## Summary

The tester's review is **partially correct**. After verifying the codebase:

- **70% of the work IS complete**: Frontend dialogs, core edge functions (create-zoom-link, calendly-webhook, send-whatsapp-reminder), integration tables, and the Settings UI are properly implemented with database-driven integrations.
- **30% still needs work**: Two edge functions (reassign-call, rebook-call) and the Leads.tsx page still contain hardcoded email constants.

---

## Remaining Work

### 1. Fix reassign-call Edge Function

**File:** `supabase/functions/reassign-call/index.ts`

**Current Issues (Lines 14-16):**
```
const DIPANSHU_EMAIL = "nikistofficial@gmail.com";
const AKANSHA_EMAIL = "akanshanikist@gmail.com";
const ADESH_EMAIL = "aadeshnikist@gmail.com";
```

**Changes Required:**
- Remove hardcoded email constants
- Add database lookup for closer integrations
- Replace email comparisons with integration type checks

**Technical approach:**
```typescript
// Query closer's integration from database
const { data: closerIntegration } = await supabase
  .from('closer_integrations')
  .select('integration_id, organization_integrations!inner(integration_type, config)')
  .eq('closer_id', new_closer_id)
  .eq('organization_id', appointment.organization_id)
  .maybeSingle();

const integrationType = closerIntegration?.organization_integrations?.integration_type;
const useCalendly = integrationType === 'calendly';
const useZoom = integrationType === 'zoom';

// Get credentials from config instead of env vars
const integrationConfig = closerIntegration?.organization_integrations?.config;
```

---

### 2. Fix rebook-call Edge Function

**File:** `supabase/functions/rebook-call/index.ts`

**Current Issues (Lines 14-16):**
```
const DIPANSHU_EMAIL = "nikistofficial@gmail.com";
const AKANSHA_EMAIL = "akanshanikist@gmail.com";
const ADESH_EMAIL = "aadeshnikist@gmail.com";
```

**Changes Required:**
- Remove hardcoded email constants
- Query closer's integration type from database
- Use organization's integration config for Calendly tokens and Zoom credentials

---

### 3. Fix Leads.tsx Schedule Call Dropdown

**File:** `src/pages/Leads.tsx`

**Current Issues (Lines 1194, 1347):**
```typescript
const isAdesh = closer.email?.toLowerCase() === "aadeshnikist@gmail.com";
```

**Changes Required:**
- Import and use `useOrgIntegrations` and `hasIntegrationForCloser`
- Replace email check with integration-based check
- Enable scheduling for closers with Zoom OR Calendly integration

**Updated logic:**
```typescript
// Check if closer has any scheduling integration
const hasSchedulingIntegration = 
  hasIntegrationForCloser(integrations, closer.email, 'zoom') ||
  hasIntegrationForCloser(integrations, closer.email, 'calendly');
```

---

### 4. (Optional) Legacy Edge Functions

The following edge functions are person-specific by design and may need review:

| Function | Purpose | Recommendation |
|----------|---------|----------------|
| `calendly-webhook-akansha` | Akansha-specific Calendly webhook | Keep as legacy or deprecate once main webhook handles all orgs |
| `schedule-adesh-call` | Adesh-specific scheduling | Keep as legacy or deprecate |
| `schedule-calendly-call` | Dipanshu-specific Calendly | Keep as legacy or deprecate |

These were intentionally created for specific closers before the multi-tenant architecture. The main `calendly-webhook` already handles organization routing, so these may be deprecated.

---

## Files to Modify

| File | Priority | Changes |
|------|----------|---------|
| `supabase/functions/reassign-call/index.ts` | HIGH | Remove hardcoded emails, add integration lookups |
| `supabase/functions/rebook-call/index.ts` | HIGH | Remove hardcoded emails, add integration lookups |
| `src/pages/Leads.tsx` | HIGH | Replace email checks with integration checks |

---

## Testing After Changes

1. Reassign a call between closers with different integration types
2. Rebook a call for a Calendly closer
3. Rebook a call for a Zoom closer
4. Schedule call from Leads page for different closer types
5. Verify all closers with integrations appear enabled in dropdowns

