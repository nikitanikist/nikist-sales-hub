
# Fix Plan: Integration Edit & Pabbly Display Issues

## Summary

Two separate issues were identified:
1. **WhatsApp/Zoom/Calendly Edit Dialog Bug** - Form fields appear empty when editing because state doesn't sync with prop changes
2. **Pabbly Data Missing** - Webhooks table is empty; legacy env-based configs need migration to the database

---

## Issue 1: Integration Edit Dialog State Sync

### Problem
The `AddIntegrationDialog.tsx` component initializes its state only once when the component mounts. Since the Dialog component stays mounted (just hidden), clicking "Edit" on different integrations doesn't update the form fields.

### Solution
Add a `useEffect` hook to synchronize state when `existingIntegration` or `open` props change.

### File: `src/components/settings/AddIntegrationDialog.tsx`

**Add after line 110 (after the useState declarations):**

```typescript
import { useState, useEffect } from "react";

// Add this useEffect after the useState declarations (around line 110):
useEffect(() => {
  if (open) {
    if (existingIntegration) {
      // Sync name
      setName(existingIntegration.integration_name || "");
      
      // Sync config fields
      const existingConfig = existingIntegration.config || {};
      const newConfig: Record<string, string> = {};
      fields.forEach((field) => {
        if (existingConfig.uses_env_secrets && existingConfig[`${field.key}_secret`]) {
          newConfig[field.key] = `[Env: ${existingConfig[`${field.key}_secret`]}]`;
        } else {
          const value = existingConfig[field.key];
          newConfig[field.key] = typeof value === "string" ? value : "";
        }
      });
      setConfig(newConfig);
      
      // Sync templates (for WhatsApp)
      if (existingConfig.templates) {
        setTemplates(existingConfig.templates as Record<string, unknown>);
      } else {
        setTemplates({});
      }
    } else {
      // Reset form for new integration
      setName("");
      setConfig({});
      setTemplates({});
    }
  }
}, [open, existingIntegration?.id]);
```

---

## Issue 2: Pabbly Webhook Data Migration

### Problem
The `organization_webhooks` table is empty. Nikist's Pabbly integration works via legacy environment variables (`PABBLY_STATUS_WEBHOOK_URL`), but the new UI only displays database records.

### Solution
Seed the existing Pabbly configuration into the `organization_webhooks` table for the Nikist organization.

### Database Insert Required

```sql
-- Insert the existing Pabbly outgoing webhook for Nikist organization
INSERT INTO organization_webhooks (
  organization_id,
  name,
  direction,
  url,
  trigger_event,
  is_active
) VALUES (
  '00000000-0000-0000-0000-000000000001',  -- Nikist org ID
  'Pabbly Call Status Sync',
  'outgoing',
  '[Will be populated from PABBLY_STATUS_WEBHOOK_URL env secret]',
  'call.status_changed',
  true
);
```

**Note:** Since the actual URL is stored in an environment secret, we have two options:
1. Store a reference pattern (like we do for other integrations)
2. Or store the actual URL if provided

### Alternative Approach: Show Legacy Config in UI

Add a note in `PabblyIntegration.tsx` that shows when legacy environment-based webhooks are detected:

```typescript
// Add a section that detects if PABBLY_STATUS_WEBHOOK_URL is configured
// Show: "Legacy Pabbly webhook is active via environment configuration"
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/settings/AddIntegrationDialog.tsx` | Add `useEffect` to sync state when dialog opens with existing integration |

## Database Operations

| Operation | Description |
|-----------|-------------|
| Insert into `organization_webhooks` | Migrate Nikist's Pabbly webhook configuration |

---

## Testing After Fix

1. **WhatsApp Edit Test:**
   - Go to Settings → Integrations → WhatsApp
   - Click Edit on "Main WhatsApp" integration
   - Verify fields show: Name = "Main WhatsApp", API Key = "[Env: AISENSY_API_KEY]", etc.
   - Verify templates section shows the configured templates

2. **Zoom/Calendly Edit Test:**
   - Click Edit on "Adesh Zoom" integration
   - Verify Account ID shows "[Env: ZOOM_ADESH_ACCOUNT_ID]"

3. **Pabbly Display Test:**
   - After database insert, go to Settings → Integrations → Pabbly
   - Verify "Pabbly Call Status Sync" appears in Outgoing Webhooks section

---

## Technical Notes

- The `useEffect` depends on `open` and `existingIntegration?.id` to avoid unnecessary re-renders
- The `fields` variable is stable per integration type, so it's safe to reference in the effect
- Legacy env-based integrations show `[Env: SECRET_NAME]` format to indicate they use secrets
- For Pabbly, we may want to add a `uses_env_secret: true` and `url_secret` pattern similar to other integrations
