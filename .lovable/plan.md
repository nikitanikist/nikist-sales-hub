
# Fix: Template Save Redirects to Wrong Tab

## Problem

After saving a new template in the Template Editor, the user is redirected to the **General** settings tab instead of the **Templates** tab. This forces users to manually navigate back to templates when they want to add more.

## Root Cause

The navigation flow has a **two-level tab problem**:

1. **TemplateEditor.tsx** navigates to `/settings?tab=templates` after saving
2. **OrganizationSettings.tsx** has nested tabs:
   - **Main tabs**: General, Modules, Integrations, Team, **Notifications**
   - **Inside Notifications tab**: Templates, Sequences, Tags
3. The main tabs use `defaultValue="general"` and **ignore the URL query parameter**
4. So `?tab=templates` is never read by the parent, and it always shows "General"

```
OrganizationSettings
├── General ← Always opens here (defaultValue="general")
├── Modules
├── Integrations
├── Team
└── Notifications
    ├── Templates ← Where user WANTS to go
    ├── Sequences
    └── Tags
```

## Solution

Update **OrganizationSettings.tsx** to:
1. Read the `tab` query parameter from the URL
2. If `tab` is `templates`, `sequences`, or `tags`, automatically switch to the "notifications" main tab
3. Pass the sub-tab value down to `WorkshopNotificationSettings`

## Files to Change

| File | Change |
|------|--------|
| `src/pages/OrganizationSettings.tsx` | Read URL params and set correct default tab |

## Implementation Details

### OrganizationSettings.tsx Changes

**Add imports:**
```typescript
import { useSearchParams } from "react-router-dom";
```

**Read URL params and determine correct main tab:**
```typescript
const [searchParams] = useSearchParams();
const urlTab = searchParams.get('tab');

// Map sub-tabs to their parent main tab
const getMainTab = (urlTab: string | null): string => {
  // If url tab is templates, sequences, or tags → go to notifications
  if (urlTab && ['templates', 'sequences', 'tags'].includes(urlTab)) {
    return 'notifications';
  }
  // Otherwise check if it's a valid main tab
  const mainTabs = ['general', 'modules', 'integrations', 'team', 'notifications'];
  if (urlTab && mainTabs.includes(urlTab)) {
    return urlTab;
  }
  return 'general';
};

const defaultMainTab = getMainTab(urlTab);
```

**Update the Tabs component:**
```typescript
<Tabs defaultValue={defaultMainTab} className="space-y-4">
```

## User Experience After Fix

1. User creates a new template and clicks "Create Template"
2. Template is saved successfully
3. User is redirected to `/settings?tab=templates`
4. OrganizationSettings sees `tab=templates`
5. Main tabs open on "Notifications" (since templates is inside notifications)
6. WorkshopNotificationSettings reads `tab=templates` and shows Templates sub-tab
7. User lands directly on the Templates tab, ready to create another

## Verification

After the fix, verify by:
1. Creating a new template
2. Confirming redirect lands on the Templates tab
3. Testing that direct URL `/settings?tab=sequences` works correctly
4. Testing that `/settings?tab=general` still works as expected
