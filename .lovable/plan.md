
# Fix Plan: SaaS Modular Architecture Review Issues

## Summary

The testing team found **7 valid issues** (plus 1 design verification). I've cross-checked each against the codebase and confirm they are real bugs that need fixing before going live.

---

## Issue Priority Matrix

| Issue | Severity | Impact |
|-------|----------|--------|
| Issue 1: Template Structure Mismatch | CRITICAL | WhatsApp reminders will fail |
| Issue 2 & 8: Video URL Missing | HIGH | Video templates won't work |
| Issue 3: Org Switch State Bug | MEDIUM | Stale data on org switch |
| Issue 4: Wrong Icon | LOW | UX confusion only |
| Issue 5: Module Permissions | N/A | Design decision (already per spec) |
| Issue 7: Pabbly Webhook URL | HIGH | Incoming webhooks non-functional |

---

## Fix 1: WhatsApp Template Structure (CRITICAL)

**File:** `src/components/settings/WhatsAppTemplateConfig.tsx`

**Current (WRONG):**
```typescript
interface TemplateConfig {
  template_name: string;
  video_url?: string;
}
```

**Fix to:**
```typescript
interface TemplateConfig {
  name: string;
  isVideo: boolean;
}
```

Changes needed:
- Update interface to use `name` instead of `template_name`
- Add `isVideo` boolean flag
- Update `TEMPLATE_INFO` to include `isVideo` for each template type
- Update `handleTemplateChange` to set `isVideo` based on template type
- Remove per-template video URL field (move to integration level)

---

## Fix 2: Add Video URL to WhatsApp Integration Form

**File:** `src/components/settings/AddIntegrationDialog.tsx`

Add video_url field to the WhatsApp field list:

```typescript
case "whatsapp":
  return [
    { key: "api_key", label: "AiSensy API Key", placeholder: "Enter AiSensy API Key", secret: true },
    { key: "source", label: "Source Number", placeholder: "919266395637", secret: false },
    { key: "support_number", label: "Support Number", placeholder: "+919266395637", secret: false },
    { key: "video_url", label: "Video URL for Call Booking", placeholder: "https://...video.mp4", secret: false },
  ];
```

This ensures video URL is saved at the config root level where the edge function expects it.

---

## Fix 3: GeneralSettings Org Sync

**File:** `src/pages/settings/GeneralSettings.tsx`

Add useEffect to sync state when organization changes:

```typescript
import { useState, useEffect } from "react";

// After useState declarations, add:
useEffect(() => {
  if (currentOrganization) {
    setName(currentOrganization.name);
    setLogoUrl(currentOrganization.logo_url || "");
  }
}, [currentOrganization?.id]);
```

---

## Fix 4: ModuleGuard Icon

**File:** `src/components/ModuleGuard.tsx`

Change the import and icon in `DisabledModuleFallback`:

```typescript
import { Lock } from "lucide-react";  // Instead of Loader2

// In DisabledModuleFallback:
<Lock className="h-8 w-8 text-muted-foreground" />
```

---

## Fix 5: Pabbly Webhook URL (Two Options)

**Option A (Recommended):** Update URL to use existing endpoint with documentation

Update `PabblyIntegration.tsx` to:
1. Point incoming webhook URLs to the existing `ingest-tagmango` endpoint
2. Add a note explaining that incoming webhooks use the standard TagMango flow
3. The webhook_id can be passed as query param for future routing

```typescript
const getIncomingWebhookUrl = (webhookId: string) => {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL || window.location.origin;
  return `${baseUrl}/functions/v1/ingest-tagmango?source=pabbly&webhook_id=${webhookId}`;
};
```

**Option B (Future):** Create a dedicated `pabbly-webhook` edge function that:
- Reads webhook config by ID
- Applies field mappings
- Routes to appropriate handlers

For now, Option A is faster and maintains backward compatibility.

---

## Issue 5 Clarification: Module Permissions

**No code change needed.** This was explicitly designed as "Super Admin only" per the approved plan. The RLS policy correctly restricts module toggling to Super Admins.

If org admins should also toggle modules in the future, both the RLS policy and the `ModulesSettings.tsx` visibility check need updating.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/settings/WhatsAppTemplateConfig.tsx` | Fix template structure to match edge function |
| `src/components/settings/AddIntegrationDialog.tsx` | Add video_url field for WhatsApp |
| `src/pages/settings/GeneralSettings.tsx` | Add useEffect for org sync |
| `src/components/ModuleGuard.tsx` | Change icon from Loader2 to Lock |
| `src/pages/settings/PabblyIntegration.tsx` | Fix webhook URL generation |

---

## Testing After Fixes

1. Create new WhatsApp integration with templates - verify saved structure matches `{ name, isVideo }`
2. Enter video URL in WhatsApp config - verify it saves at root level
3. Switch between organizations - verify GeneralSettings updates
4. Navigate to disabled module route - verify Lock icon shows (not spinner)
5. Create incoming webhook - verify URL uses existing endpoint
6. Schedule a test call - verify WhatsApp reminder sends correctly

---

## Technical Notes

- All fixes are isolated to their respective files with no cascading dependencies
- Edge function `send-whatsapp-reminder` does NOT need changes - it already handles the correct structure
- Backward compatibility is maintained - existing env-based WhatsApp configs still work via fallback
