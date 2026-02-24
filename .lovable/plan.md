
# Fix: Template Variables Not Being Replaced in Workshop/Webinar Messages

## The Problem

When you run a sequence for a workshop or webinar, variables like `{zoom_link}` are sent as literal text instead of being replaced with the actual Zoom link you entered. The database confirms this -- today's workshop messages all contain `{zoom_link}` as plain text.

## Root Cause

There are **three related bugs** causing this:

### Bug 1: Silent failure skips the variable dialog
When you click "Run the Messaging", the code fetches the sequence templates to check for variables. But if this database fetch fails for any reason, the error is silently ignored and the sequence runs immediately with **no variables at all**. The code does not check for errors:

```text
const { data: sequenceData } = await supabase...  // error is ignored!
if (sequenceData?.steps) { ... detect variables ... }
// Falls through to run with empty variables
```

### Bug 2: Saved variables are never reused
Even when a user has previously saved `zoom_link` for a workshop, re-running the sequence does NOT use those saved values. The `runMessaging` function only uses variables passed directly from the dialog -- it never looks up previously saved values from `workshop_sequence_variables`.

### Bug 3: Webinar variables are never saved
The webinar `handleVariablesSubmit` calls `runMessaging` but does NOT call `saveVariables`. So webinar variable values are lost after each run and cannot be reused.

## The Fix

### 1. Add error handling in variable detection (both Workshop and Webinar)

**Files: `src/components/operations/WorkshopDetailSheet.tsx` and `src/pages/webinar/WebinarDetailSheet.tsx`**

In `handleRunSequence`, check the error from the sequence data fetch. If it fails, show a toast error and stop -- do not silently fall through to running without variables.

### 2. Use saved variables as fallback in `runMessaging`

**Files: `src/hooks/useWorkshopNotification.ts` and `src/hooks/useWebinarNotification.ts`**

Before applying template variables, look up any previously saved values from `workshop_sequence_variables` (or `webinar_sequence_variables`). Merge them with the `manualVariables` parameter, with manual values taking priority. This ensures that if a user previously entered `zoom_link`, it gets used even on re-runs.

The updated flow in `runMessagingMutation`:
1. Fetch saved variables from the database for this workshop/webinar
2. Merge: `{ ...savedVariables, ...manualVariables }` (manual overrides saved)
3. Replace auto-filled variables (workshop_name, date, time)
4. Replace all merged manual variables

### 3. Save webinar variables in the dialog submit

**File: `src/pages/webinar/WebinarDetailSheet.tsx`**

Add `saveVariables` call in `handleVariablesSubmit`, matching the workshop implementation. Import and use `useSequenceVariables` (or a webinar-specific equivalent).

### 4. Add the campaign Send Notification variable replacement

**File: `src/pages/whatsapp/SendNotification.tsx`**

- Detect `{variable}` patterns in the message using `extractVariables`
- Show input fields for each variable in the confirmation step
- Replace variables before saving the campaign `message_content`

## Files to Change

- `src/components/operations/WorkshopDetailSheet.tsx` -- Add error handling for sequence fetch
- `src/pages/webinar/WebinarDetailSheet.tsx` -- Add error handling + save variables on submit
- `src/hooks/useWorkshopNotification.ts` -- Fetch and merge saved variables before replacement
- `src/hooks/useWebinarNotification.ts` -- Fetch and merge saved variables before replacement
- `src/pages/whatsapp/SendNotification.tsx` -- Add variable detection and replacement for campaigns
