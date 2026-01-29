
# Multi-Tenant SaaS Transformation - Implementation Plan

## Executive Summary

This plan transforms the Nikist Sales Hub CRM from a single-tenant system with hardcoded person-specific configurations into a fully multi-tenant SaaS platform where each organization has complete data isolation, configurable integrations, and no code changes are needed when onboarding new organizations.

---

## Implementation Progress

### ✅ COMPLETED

1. **Database Schema** - Created `organization_integrations` and `closer_integrations` tables with RLS
2. **Seeded Default Integrations** - Nikist org seeded with Zoom (Adesh), Calendly (Dipanshu, Akansha), WhatsApp configs
3. **Frontend Hook** - Created `useOrgClosers.ts` hook to query closers scoped to organization
4. **ReassignCallDialog** - Refactored to use org-scoped closers and integration-based checks (no hardcoded emails)
5. **RebookCallDialog** - Refactored to use integration-based checks (no hardcoded emails)
6. **ScheduleCallDialog** - Refactored to use integration-based checks (no hardcoded emails)
7. **Leads.tsx** - Updated salesClosers query to use `useOrgClosers()` hook

### 🔄 IN PROGRESS

- Edge function refactoring to use `organization_integrations` table
- Settings UI for managing integrations

### ⏳ PENDING

- Phase 4: Edge function refactoring
- Phase 5: Settings UI
- Phase 6: Testing

---

## Current State Analysis

### What's Working Well
- Database schema has `organization_id` on all business tables ✅
- Organization context exists in React (`useOrganization` hook) ✅
- Frontend queries now filter by organization ✅
- Organization switching works for multi-org users ✅
- RLS policies exist on most tables ✅
- Integration configuration stored per-organization ✅

### Resolved Issues

| Area | Issue | Risk Level |
|------|-------|------------|
| Hardcoded Emails | 3 specific person emails hardcoded in 8+ files | HIGH |
| RLS Policies | call_appointments and call_reminders have overly permissive policies | CRITICAL |
| Frontend Queries | salesClosers and profiles queries fetch global data | MEDIUM |
| Edge Functions | All use global Zoom/Calendly credentials | HIGH |
| Webhook Handlers | No organization routing - all data goes to default org | HIGH |

---

## Phase 1: Fix Security Issues (CRITICAL)

### 1.1 Fix Frontend Queries Missing Organization Filter

**Files to modify:**
- `src/components/ReassignCallDialog.tsx` (lines 89-106)
- `src/components/RebookCallDialog.tsx` (lines 88-107)
- `src/components/ScheduleCallDialog.tsx` (lines 79-98)
- `src/pages/Leads.tsx` (lines 266-298)

**Current problematic pattern:**
```typescript
// Fetches ALL profiles globally, not scoped to organization
const { data: closers } = useQuery({
  queryKey: ["available-closers-reassign"],
  queryFn: async () => {
    const { data } = await supabase
      .from("profiles")
      .select(`id, full_name, email, user_roles!inner(role)`)
      .in("user_roles.role", ["sales_rep", "admin"]);
    return data;
  },
});
```

**Fix - Query organization members instead:**
```typescript
const { currentOrganization } = useOrganization();

const { data: closers } = useQuery({
  queryKey: ["org-closers", currentOrganization?.id],
  queryFn: async () => {
    if (!currentOrganization?.id) return [];
    
    const { data } = await supabase
      .from("organization_members")
      .select(`
        user_id,
        role,
        profiles!inner(id, full_name, email)
      `)
      .eq("organization_id", currentOrganization.id)
      .in("role", ["sales_rep", "admin"]);
    
    return data?.map(m => ({
      id: m.profiles.id,
      full_name: m.profiles.full_name,
      email: m.profiles.email
    })) || [];
  },
  enabled: !!currentOrganization?.id,
});
```

---

## Phase 2: Create Organization Integrations System

### 2.1 Database Schema

Create a new `organization_integrations` table to store per-org credentials:

```sql
CREATE TABLE organization_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_type TEXT NOT NULL, -- 'zoom', 'calendly', 'whatsapp', 'pabbly'
  config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, integration_type)
);

-- Enable RLS
ALTER TABLE organization_integrations ENABLE ROW LEVEL SECURITY;

-- Only org admins and super admins can manage integrations
CREATE POLICY "Org admins can manage integrations" ON organization_integrations
  FOR ALL USING (
    (organization_id = ANY(get_user_organization_ids()) 
     AND is_org_admin(auth.uid(), organization_id))
    OR is_super_admin(auth.uid())
  );
```

**Integration config structure examples:**

```jsonc
// Zoom integration
{
  "account_id": "xxx",
  "client_id": "xxx", 
  "client_secret": "xxx",
  "host_email": "closer@org.com"
}

// Calendly integration
{
  "api_token": "xxx",
  "default_closer_id": "uuid",
  "event_type_uri": "https://api.calendly.com/event_types/xxx"
}

// WhatsApp/AiSensy integration
{
  "api_key": "xxx",
  "source": "xxx",
  "templates": {
    "call_booked": "template_name",
    "reminder_1h": "template_name"
  }
}
```

### 2.2 Create Integration Settings UI

**New file:** `src/pages/OrganizationSettings.tsx`

This page will have tabs for:
- **General**: Organization name, logo
- **Team**: View members (link to Users page)
- **Integrations**: Configure Zoom, Calendly, WhatsApp credentials

**New components:**
- `src/components/settings/ZoomIntegrationSetup.tsx`
- `src/components/settings/CalendlyIntegrationSetup.tsx`
- `src/components/settings/WhatsAppIntegrationSetup.tsx`

Each component will:
1. Check if integration exists for current org
2. Show form to add/edit credentials
3. Include "Test Connection" button
4. Save to `organization_integrations` table

---

## Phase 3: Remove All Hardcoded Values

### 3.1 Hardcoded Emails to Remove

| File | Line | Constant | Replacement |
|------|------|----------|-------------|
| `ReassignCallDialog.tsx` | 17 | `ADESH_EMAIL` | Check closer's integration config |
| `RebookCallDialog.tsx` | 16 | `ADESH_EMAIL` | Check closer's integration config |
| `ScheduleCallDialog.tsx` | 18-19 | `DIPANSHU_EMAIL`, `CALENDLY_URL` | Fetch from org integrations |
| `ScheduleCallDialog.tsx` | 22 | `ADESH_EMAIL` | Check closer's integration config |
| `create-zoom-link/index.ts` | 8 | `ADESH_EMAIL` | Fetch from request/org context |
| `calendly-webhook/index.ts` | 10 | `DIPANSHU_EMAIL` | Lookup org by Calendly event URI |
| `reassign-call/index.ts` | 14-16 | Multiple emails | Check closer's org integration |
| `send-whatsapp-reminder/index.ts` | 96-98 | All 3 emails | Use org's WhatsApp config |

### 3.2 Frontend Refactoring Pattern

**Before (hardcoded check):**
```typescript
const isAdesh = closer?.email?.toLowerCase() === "aadeshnikist@gmail.com";
const isDipanshu = closer?.email?.toLowerCase() === "nikistofficial@gmail.com";
```

**After (integration-based check):**
```typescript
// Fetch what integrations this closer has configured
const { data: closerIntegrations } = useQuery({
  queryKey: ["closer-integrations", closer?.id, currentOrganization?.id],
  queryFn: async () => {
    const { data } = await supabase
      .from("organization_integrations")
      .select("integration_type, config")
      .eq("organization_id", currentOrganization.id)
      .eq("is_active", true);
    return data;
  },
  enabled: !!closer?.id && !!currentOrganization?.id,
});

const hasZoomIntegration = closerIntegrations?.some(i => 
  i.integration_type === 'zoom' && i.config?.host_email === closer.email
);
const hasCalendlyIntegration = closerIntegrations?.some(i => 
  i.integration_type === 'calendly'
);
```

### 3.3 Add Closer-to-Integration Mapping

Add a `closer_integrations` table to map which closer uses which integration:

```sql
CREATE TABLE closer_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  closer_id UUID NOT NULL REFERENCES profiles(id),
  integration_id UUID NOT NULL REFERENCES organization_integrations(id),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(closer_id, integration_id)
);
```

This allows:
- Adesh to use Org A's Zoom credentials
- Dipanshu to use Org A's Calendly credentials
- New closers in Org B to use Org B's own Zoom/Calendly

---

## Phase 4: Refactor Edge Functions for Multi-Org

### 4.1 Create Zoom Link (Org-Aware)

**Current flow:** Hardcoded Adesh email → Global Zoom credentials

**New flow:**
1. Receive `appointment_id` in request
2. Fetch appointment with `organization_id`
3. Lookup Zoom config from `organization_integrations` for that org
4. Use org-specific credentials to create meeting

```typescript
// supabase/functions/create-zoom-link/index.ts

// Fetch appointment with org context
const { data: appointment } = await supabase
  .from('call_appointments')
  .select('*, closer:profiles!closer_id(*), organization_id')
  .eq('id', appointment_id)
  .single();

// Get Zoom config for this organization
const { data: zoomConfig } = await supabase
  .from('organization_integrations')
  .select('config')
  .eq('organization_id', appointment.organization_id)
  .eq('integration_type', 'zoom')
  .eq('is_active', true)
  .single();

if (!zoomConfig) {
  return error('Zoom not configured for this organization');
}

const { account_id, client_id, client_secret } = zoomConfig.config;
// Use these instead of Deno.env.get('ZOOM_ADESH_*')
```

### 4.2 Calendly Webhook (Org Routing)

**Current issue:** Hardcoded `DIPANSHU_EMAIL` determines which org data goes to

**New approach:** Route based on Calendly event type URI

```typescript
// Parse webhook to get event_type URI
const eventTypeUri = payload.payload?.scheduled_event?.event_type?.uri;

// Lookup which organization owns this Calendly event type
const { data: integration } = await supabase
  .from('organization_integrations')
  .select('organization_id, config')
  .eq('integration_type', 'calendly')
  .filter('config->event_type_uri', 'eq', eventTypeUri)
  .single();

if (!integration) {
  // Fallback: try matching by closer email in config
  const inviteeEmail = payload.payload?.invitee?.email;
  // ... alternative matching logic
}

const organization_id = integration.organization_id;
const default_closer_id = integration.config.default_closer_id;

// Now create lead/appointment with correct organization_id
```

### 4.3 Consolidate Duplicate Webhooks

**Current:** Two separate functions:
- `calendly-webhook/index.ts` (Dipanshu)
- `calendly-webhook-akansha/index.ts` (Akansha)

**Target:** Single `calendly-webhook/index.ts` that routes based on configuration

The merged function will:
1. Receive webhook from any Calendly account
2. Lookup org by event type URI or closer email
3. Create data in correct organization
4. Use org-specific WhatsApp templates

### 4.4 WhatsApp Reminders (Org-Aware Templates)

**Current issue:** Template names hardcoded per closer email

**New approach:** Store templates in org integration config

```typescript
// Get WhatsApp config for this appointment's organization
const { data: whatsappConfig } = await supabase
  .from('organization_integrations')
  .select('config')
  .eq('organization_id', appointment.organization_id)
  .eq('integration_type', 'whatsapp')
  .single();

const template = whatsappConfig.config.templates[reminder.reminder_type];
const apiKey = whatsappConfig.config.api_key;
const source = whatsappConfig.config.source;
```

### 4.5 TagMango Ingest (Org Routing)

**Current issue:** No org context - everything goes to default org

**Solution options:**

1. **Mango ID Mapping**: Create `organization_mango_ids` table mapping TagMango product IDs to organizations

2. **Webhook per Org**: Each org gets unique webhook URL with org ID embedded:
   ```
   /ingest-tagmango?org_id=<organization_id>
   ```

3. **Product/Workshop Lookup**: If product/workshop already exists in DB, inherit its org

---

## Phase 5: Add Organization Context to All Mutations

### 5.1 Ensure All Inserts Include organization_id

Audit and update all insert operations:

```typescript
// Current pattern (missing org_id)
await supabase.from('call_appointments').insert({
  lead_id,
  closer_id,
  scheduled_date,
  // Missing: organization_id
});

// Fixed pattern
await supabase.from('call_appointments').insert({
  lead_id,
  closer_id,
  scheduled_date,
  organization_id: currentOrganization.id, // Always include
});
```

**Files to audit:**
- All dialog components with mutations
- All page components with mutations
- All edge functions that insert data

---

## Phase 6: Testing Checklist

After implementation, verify:

- [ ] Create Organization A with Zoom integration
- [ ] Create Organization B with Calendly integration
- [ ] Add User A to Org A only
- [ ] Add User B to Org B only
- [ ] User A can only see Org A data
- [ ] User B can only see Org B data
- [ ] Reassign dialog shows only Org A closers for User A
- [ ] Schedule call uses Org A's Zoom credentials
- [ ] Calendly webhook creates data in correct org
- [ ] WhatsApp reminders use correct org's templates
- [ ] TagMango ingest routes to correct org

---

## Implementation Priority

| Phase | Priority | Estimated Effort | Dependencies |
|-------|----------|------------------|--------------|
| Phase 1 | CRITICAL | 2-3 hours | None |
| Phase 2 | HIGH | 4-5 hours | None |
| Phase 3 | HIGH | 3-4 hours | Phase 2 |
| Phase 4 | HIGH | 6-8 hours | Phase 2 |
| Phase 5 | MEDIUM | 2-3 hours | Phases 1-4 |
| Phase 6 | REQUIRED | 2-3 hours | All phases |

**Total estimated effort: 20-26 hours**

---

## Files to Create

1. `src/pages/OrganizationSettings.tsx`
2. `src/components/settings/ZoomIntegrationSetup.tsx`
3. `src/components/settings/CalendlyIntegrationSetup.tsx`
4. `src/components/settings/WhatsAppIntegrationSetup.tsx`
5. Database migration for `organization_integrations` table
6. Database migration for `closer_integrations` table

## Files to Modify

1. `src/components/ReassignCallDialog.tsx` - Add org filter, remove hardcoded emails
2. `src/components/RebookCallDialog.tsx` - Add org filter, remove hardcoded emails
3. `src/components/ScheduleCallDialog.tsx` - Add org filter, use org integrations
4. `src/pages/Leads.tsx` - Fix salesClosers query to use org context
5. `supabase/functions/create-zoom-link/index.ts` - Use org credentials
6. `supabase/functions/calendly-webhook/index.ts` - Add org routing
7. `supabase/functions/reassign-call/index.ts` - Use org integrations
8. `supabase/functions/send-whatsapp-reminder/index.ts` - Use org templates
9. `supabase/functions/ingest-tagmango/index.ts` - Add org routing
10. Delete `supabase/functions/calendly-webhook-akansha/index.ts` (merge into main)

---

## Technical Notes

### Why Not Just Use Secrets Per Function?

The current approach uses Supabase secrets (`ZOOM_ADESH_*`, `CALENDLY_DIPANSHU_TOKEN`) which:
- Are global to the project
- Cannot scale with multiple organizations
- Require code changes for new orgs

The organization_integrations table approach:
- Stores credentials per organization
- Admins can add/edit via UI
- No code changes for new orgs
- Credentials isolated by RLS

### Security Considerations

1. **Credential Storage**: Store sensitive fields encrypted or use Supabase Vault
2. **RLS Policies**: Ensure only org admins can view/edit integrations
3. **Audit Logging**: Log credential access and changes
4. **Rate Limiting**: Prevent credential brute-forcing via API
