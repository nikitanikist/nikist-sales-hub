
# Implementation Plan: SaaS Modular Architecture Redesign

## Executive Summary

This plan implements the product manager's vision to transform the CRM into a true multi-tenant SaaS platform with modular features, rich integration settings, and complete self-service onboarding.

---

## Current State Analysis

### What Already Exists (Don't Rebuild)
| Component | Status | Notes |
|-----------|--------|-------|
| `organization_integrations` table | **EXISTS** | Has Zoom, Calendly, WhatsApp configs for Nikist |
| `closer_integrations` table | **EXISTS** | Table exists but is EMPTY - critical fix needed |
| `OrganizationSettings.tsx` | **EXISTS** | Basic multi-integration UI already built |
| `IntegrationCard.tsx` | **EXISTS** | Shows integration details |
| `AddIntegrationDialog.tsx` | **EXISTS** | Add/edit integrations |
| `IntegrationSection.tsx` | **EXISTS** | Groups integrations by type |

### What Needs to Be Built
| Component | Priority | Status |
|-----------|----------|--------|
| `modules` + `organization_modules` tables | HIGH | NOT EXISTS |
| `organization_webhooks` table (Pabbly) | HIGH | NOT EXISTS (confirmed critical) |
| `useModules` hook | HIGH | NOT EXISTS |
| `ModuleGuard` component | HIGH | NOT EXISTS |
| Sidebar module filtering | HIGH | NOT IMPLEMENTED |
| Closer integrations seeding | CRITICAL | Table empty, edge functions failing |
| Enhanced WhatsApp templates UI | MEDIUM | Basic exists, needs template mapping |
| Pabbly webhooks UI | HIGH | NOT EXISTS |
| Module toggle UI (Super Admin) | HIGH | NOT EXISTS |

---

## Phase 1: Critical Database Setup

### Task 1.1: Create Module System Tables

```sql
-- modules table (system-wide definitions)
CREATE TABLE modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  is_premium BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- organization_modules (per-org enablement)
CREATE TABLE organization_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT false,
  enabled_at TIMESTAMPTZ,
  enabled_by UUID REFERENCES profiles(id),
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_org_module UNIQUE(organization_id, module_id)
);

-- Seed 4 modules
INSERT INTO modules (slug, name, description, icon, display_order) VALUES
  ('one-to-one-funnel', 'One-to-One Sales Funnel', 'Sales closers, call scheduling, Zoom/Calendly integration, WhatsApp reminders', 'Phone', 1),
  ('cohort-management', 'Cohort Management', 'Batches, students, EMI tracking, cohort insights', 'GraduationCap', 2),
  ('workshops', 'Workshops', 'Workshop management, registrations, and attendance tracking', 'Presentation', 3),
  ('daily-money-flow', 'Daily Money Flow', 'Revenue tracking, cash collection, and financial insights', 'DollarSign', 4);

-- Auto-enable ALL modules for Nikist
INSERT INTO organization_modules (organization_id, module_id, is_enabled, enabled_at)
SELECT '00000000-0000-0000-0000-000000000001', m.id, true, NOW()
FROM modules m;
```

### Task 1.2: Create Webhooks Table (Pabbly Critical)

```sql
CREATE TABLE organization_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  url TEXT,
  secret TEXT DEFAULT encode(gen_random_bytes(32), 'hex'),
  trigger_event TEXT,
  payload_template JSONB DEFAULT '{}',
  field_mappings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Task 1.3: Seed Closer Integrations (CRITICAL - Edge Functions Failing)

```sql
-- Adesh uses Zoom
INSERT INTO closer_integrations (organization_id, closer_id, integration_id)
SELECT
  '00000000-0000-0000-0000-000000000001',
  p.id,
  oi.id
FROM profiles p
CROSS JOIN organization_integrations oi
WHERE p.email = 'aadeshnikist@gmail.com'
  AND oi.organization_id = '00000000-0000-0000-0000-000000000001'
  AND oi.integration_type = 'zoom'
ON CONFLICT DO NOTHING;

-- Dipanshu uses Calendly
INSERT INTO closer_integrations (organization_id, closer_id, integration_id)
SELECT
  '00000000-0000-0000-0000-000000000001',
  p.id,
  oi.id
FROM profiles p
CROSS JOIN organization_integrations oi
WHERE p.email = 'nikistofficial@gmail.com'
  AND oi.organization_id = '00000000-0000-0000-0000-000000000001'
  AND oi.integration_type = 'calendly_dipanshu'
ON CONFLICT DO NOTHING;

-- Akansha uses Calendly
INSERT INTO closer_integrations (organization_id, closer_id, integration_id)
SELECT
  '00000000-0000-0000-0000-000000000001',
  p.id,
  oi.id
FROM profiles p
CROSS JOIN organization_integrations oi
WHERE p.email = 'akanshanikist@gmail.com'
  AND oi.organization_id = '00000000-0000-0000-0000-000000000001'
  AND oi.integration_type = 'calendly_akansha'
ON CONFLICT DO NOTHING;
```

---

## Phase 2: Frontend Module System

### Task 2.1: Create useModules Hook

**File:** `src/hooks/useModules.ts`

```text
- Query organization_modules with module details
- Provide isModuleEnabled(slug) helper function
- Provide getModuleConfig(slug) for module-specific settings
- Cache with React Query
```

### Task 2.2: Create ModuleGuard Component

**File:** `src/components/ModuleGuard.tsx`

```text
- Wrap route components
- Check if module is enabled for current org
- Show loading state while checking
- Redirect to "/" if module disabled
- Optional fallback UI for disabled modules
```

### Task 2.3: Update AppLayout Sidebar

**File:** `src/components/AppLayout.tsx`

```text
- Import useModules hook
- Define MENU_ITEM_MODULES mapping:
  '/sales-closers' -> 'one-to-one-funnel'
  '/calls' -> 'one-to-one-funnel'
  '/daily-money-flow' -> 'daily-money-flow'
  '/workshops' -> 'workshops'
  'Cohort Batches' submenu -> 'cohort-management'
- Filter menu items based on isModuleEnabled()
- Show loading state while modules load
```

### Task 2.4: Add Route Guards

**File:** `src/App.tsx`

Wrap module-specific routes with ModuleGuard:
- Sales Closers routes -> 'one-to-one-funnel'
- Calls route -> 'one-to-one-funnel'
- Daily Money Flow -> 'daily-money-flow'
- Workshops -> 'workshops'
- Cohort pages -> 'cohort-management'

---

## Phase 3: Enhanced Settings UI

### Task 3.1: Restructure OrganizationSettings with New Tabs

**Current:** Tabs for Zoom, Calendly, WhatsApp only
**New Structure:**
- General Tab (org name, logo)
- Modules Tab (Super Admin only - toggle modules)
- Integrations Tab (nested: WhatsApp, Zoom, Calendly, Pabbly)
- Team Tab (placeholder for future)

### Task 3.2: Create ModulesSettings Component (Super Admin Only)

**File:** `src/pages/settings/ModulesSettings.tsx`

```text
- List all modules with toggle switches
- Show module icon, name, description
- Badge for "Premium" modules
- Only visible to Super Admin (per your requirement)
- Toggle updates organization_modules table
```

### Task 3.3: Create Pabbly/Webhooks Integration Component

**File:** `src/pages/settings/PabblyIntegration.tsx`

```text
- Incoming Webhooks section:
  - Auto-generate webhook URL for org
  - Copy URL button for Pabbly setup
  - Show webhook secret
  - Field mapping configuration
  
- Outgoing Webhooks section:
  - Trigger event selector (lead.created, student.converted, etc.)
  - Destination URL input
  - Payload template editor
  - Test webhook button
  
- Active/Inactive toggle for each webhook
```

### Task 3.4: Enhance WhatsApp Integration

Update existing WhatsApp integration to support:
- Multiple WhatsApp accounts (per your requirement: Free Leads vs Paid Students)
- Full template mapping UI:
  - call_booked (with closer-specific templates: Dipanshu vs Akansha)
  - reminder_2_days through we_are_live
  - student_converted, free_student
- Video URL configuration per template
- Support number configuration
- Test message button

### Task 3.5: Create GeneralSettings Component

**File:** `src/pages/settings/GeneralSettings.tsx`

```text
- Organization name (editable)
- Slug (read-only)
- Logo URL
- Timezone (optional, future)
```

### Task 3.6: Create Closer-Integration Assignment UI

**File:** `src/components/settings/CloserAssignments.tsx`

```text
- List all closers in organization
- Show current integration assignment (Zoom/Calendly/None)
- Dropdown to assign/change integration
- Updates closer_integrations table
```

---

## Phase 4: Edge Function Updates

### Already Done (Confirmed Working)
- `create-zoom-link` - reads from organization_integrations
- `calendly-webhook` - routes by event_type_uri
- `send-whatsapp-reminder` - reads templates from config

### Needs Verification After Closer Seeding
- `reassign-call` - uses getCloserIntegration() helper
- `rebook-call` - uses getCloserIntegration() helper

These functions already have database-driven logic but will fail without closer_integrations data.

---

## File Summary

### New Files to Create
| File | Description |
|------|-------------|
| `src/hooks/useModules.ts` | Module system hook |
| `src/components/ModuleGuard.tsx` | Route protection component |
| `src/pages/settings/ModulesSettings.tsx` | Module toggle UI (Super Admin) |
| `src/pages/settings/PabblyIntegration.tsx` | Webhook management UI |
| `src/pages/settings/GeneralSettings.tsx` | Basic org settings |
| `src/components/settings/CloserAssignments.tsx` | Closer-integration mapping |

### Files to Modify
| File | Changes |
|------|---------|
| `src/components/AppLayout.tsx` | Add module filtering to sidebar |
| `src/App.tsx` | Add ModuleGuard wrappers to routes |
| `src/pages/OrganizationSettings.tsx` | Restructure with new tabs |
| `src/components/settings/AddIntegrationDialog.tsx` | Add WhatsApp template fields |

### Database Migrations
| Migration | Purpose |
|-----------|---------|
| `modules_system.sql` | Create modules + organization_modules |
| `webhooks_table.sql` | Create organization_webhooks |
| `seed_closer_integrations.sql` | Populate closer mappings for Nikist |

---

## Implementation Order

### Sprint 1: Critical Fixes (Unblocks Edge Functions)
1. Seed closer_integrations for Nikist closers
2. Verify reassign-call and rebook-call work

### Sprint 2: Module System Foundation
1. Create modules and organization_modules tables
2. Seed 4 modules and enable all for Nikist
3. Create useModules hook
4. Create ModuleGuard component
5. Update AppLayout sidebar with module filtering
6. Add ModuleGuard to App.tsx routes

### Sprint 3: Settings UI Enhancement
1. Create GeneralSettings component
2. Create ModulesSettings (Super Admin only)
3. Create PabblyIntegration component
4. Restructure OrganizationSettings with all tabs
5. Create CloserAssignments UI

### Sprint 4: Polish & Testing
1. Enhance WhatsApp template mapping UI
2. Add test connection buttons
3. End-to-end testing with Nikist data
4. Documentation for new org onboarding

---

## Testing Checklist

### Pre-Deployment
- [ ] closer_integrations has entries for Adesh, Dipanshu, Akansha
- [ ] modules table has 4 entries
- [ ] organization_modules has all modules enabled for Nikist
- [ ] WhatsApp reminder sends correctly with templates
- [ ] Reassign call works between Calendly closers
- [ ] Rebook call creates Zoom link for Adesh

### Post-Deployment
- [ ] Login as Nikist admin -> all sidebar items visible
- [ ] Login as Super Admin -> Modules tab visible in Settings
- [ ] Disable a module -> sidebar item hidden, route redirects
- [ ] Add incoming webhook -> URL generated and copyable
- [ ] Add outgoing webhook -> triggers on event

---

## Feedback on the Product Manager's Plan

### Strengths
1. Clear module definitions matching actual business features
2. Good separation between incoming/outgoing webhooks for Pabbly
3. Proper RLS policies included in all SQL
4. Maintains backward compatibility with Nikist

### Suggestions I'm Incorporating
1. **Simplified WhatsApp Config**: Instead of one shared WhatsApp with overrides, supporting fully independent WhatsApp integrations as requested
2. **Module Toggle Restriction**: Keeping Super Admin only as confirmed
3. **Auto-seeding Closers**: Will seed existing Nikist closers immediately while allowing manual edits via UI later
4. **Pabbly as Critical**: Including full webhook UI in initial implementation

### Risk Mitigations
1. **Empty closer_integrations**: This is causing edge function failures NOW - prioritized as Sprint 1
2. **Backward compatibility**: All existing Nikist integrations use `uses_env_secrets: true` pattern - preserving this while supporting direct values for new orgs
3. **Module defaults**: New orgs will need explicit module enablement - consider whether some modules should be enabled by default
