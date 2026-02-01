
# Fix SMS Sequence Variables & Add Test Message Feature

## Problems Identified

1. **Run Sequence skips variable input** - When clicking "Run Sequence" for SMS, it immediately schedules all messages without prompting for dynamic variables (Zoom link, WhatsApp group link, etc.)

2. **Cancel doesn't reflect properly** - After cancelling SMS notifications, the button still shows "Already Scheduled" instead of allowing to run again

3. **No "Send Message Now" for testing** - WhatsApp has this feature but SMS doesn't, making it hard to test before running the full sequence

## Solution Overview

```text
Current SMS Flow:
Click Run Sequence → Messages Immediately Scheduled (No variable prompt!)

New SMS Flow:
Click Run Sequence → Check for manual variables
                   ↓
         ┌─ No variables needed ─→ Schedule messages
         └─ Variables found ────→ Show Variables Dialog
                                         ↓
                                  Enter values
                                         ↓
                                  Save & Schedule
```

---

## Technical Changes

### 1. Create SMS Variables Dialog Component

**New File:** `src/components/operations/SMSSequenceVariablesDialog.tsx`

A dialog specifically for SMS template variables that:
- Displays all manual variables from the sequence's SMS templates
- Shows auto-filled values (workshop name, date, time)
- Requires all fields to be filled before proceeding
- Saves variables to database for this workshop

### 2. Update SMSTab to Show Variables Dialog

**File:** `src/components/operations/notification-channels/SMSTab.tsx`

Changes:
- Add state for variables dialog
- Before running sequence, fetch SMS sequence steps and extract all variables
- If manual variables exist, open the dialog instead of running immediately
- Pass variable values to the `runSMSSequence` function

### 3. Fix Cancel State Display

**File:** `src/components/operations/notification-channels/SMSTab.tsx`

The `hasScheduled` check currently includes `sent` messages, so even after cancelling all pending messages, the button shows "Already Scheduled" if any were previously sent.

Change:
```typescript
// Current (incorrect)
const hasScheduled = messages.some(m => m.status === 'pending' || m.status === 'sent');

// Fixed (only check pending)
const hasPendingMessages = messages.some(m => m.status === 'pending');
const hasAnyScheduled = messages.some(m => m.status === 'pending' || m.status === 'sent');
```

Show different states:
- Has pending → "Already Scheduled" (disabled)
- No pending but has sent → "Add More Messages" or "Run Again"  
- Nothing → "Run SMS Sequence"

### 4. Create Send SMS Now Dialog

**New File:** `src/components/operations/SendSMSNowDialog.tsx`

Similar to `SendMessageNowDialog` for WhatsApp but for SMS:
- Select an SMS template from the list
- Enter values for template variables
- Preview the final message with variables replaced
- Send immediately to all registrants with phone numbers

### 5. Add Send Now Mutation to Hook

**File:** `src/hooks/useSMSNotification.ts`

Add new mutation:
```typescript
sendSMSNow: async ({ workshopId, templateId, variableValues }) => {
  // Get registrants with phone numbers
  // Create scheduled_sms_messages with scheduled_for = now
  // They will be picked up by the next cron run
}
```

### 6. Extract Variables from SMS Templates

**File:** `src/lib/templateVariables.ts` (or new function)

SMS templates store variables as `{ key, label }` array, not extracted from content. Need helper:
```typescript
function extractSMSSequenceVariables(
  steps: Array<{ template?: { variables: Array<{ key: string; label: string }> } | null }>
): { autoFilled: string[]; manual: string[] }
```

---

## UI Changes Summary

### WorkshopSMSPanel Updates

```text
┌──────────────────────────────────────────┐
│  Workshop Title                    [Tag] │
│  Mon, Feb 2 · 7:00 PM                    │
├──────────────────────────────────────────┤
│  Tag: Crypto insider workshop            │
│  SMS Sequence: Insider crypto (4 msgs)   │
│  Registrations: 206                      │
├──────────────────────────────────────────┤
│  [Run SMS Sequence]  [Send Test SMS]     │  ← New test button
├──────────────────────────────────────────┤
│  Message Checkpoints:                    │
│  ○ 12:00 PM - 0/206 sent    [Cancel All] │
│  ○ 4:00 PM  - 0/206 sent    [Cancel All] │
│  ...                                     │
│                                          │
│  [Run Sequence Again]  ← If all cancelled│
└──────────────────────────────────────────┘
```

### New SMS Variables Dialog

```text
┌────────────────────────────────────────────┐
│  Configure SMS Variables                   │
│  Crypto Wealth Masterclass                 │
├────────────────────────────────────────────┤
│  ✓ Auto-filled from workshop data          │
│  ┌────────────────────────────────────┐    │
│  │ Workshop Name: Crypto Wealth...    │    │
│  │ Date: February 2, 2025             │    │
│  │ Time: 7:00 PM                      │    │
│  └────────────────────────────────────┘    │
│                                            │
│  Enter values for these variables:         │
│                                            │
│  Zoom Link *                               │
│  ┌────────────────────────────────────┐    │
│  │ https://zoom.us/j/...              │    │
│  └────────────────────────────────────┘    │
│                                            │
│  WhatsApp Group Link *                     │
│  ┌────────────────────────────────────┐    │
│  │ https://chat.whatsapp.com/...      │    │
│  └────────────────────────────────────┘    │
│                                            │
│  ℹ Values used for all SMS in sequence     │
├────────────────────────────────────────────┤
│              [Cancel] [Save & Run]         │
└────────────────────────────────────────────┘
```

---

## Implementation Steps

1. **Create helper to extract SMS template variables**
   - Add function in `templateVariables.ts` for SMS variable extraction

2. **Create SMSSequenceVariablesDialog component**
   - Similar to existing `SequenceVariablesDialog`
   - Works with SMS template variable format `{ key, label }`

3. **Update SMSTab with variable dialog flow**
   - Add dialog state management
   - Fetch sequence steps before running
   - Extract and categorize variables
   - Show dialog if manual variables exist

4. **Fix cancel state logic**
   - Separate `hasPending` from `hasAny`
   - Allow re-running if no pending messages

5. **Create SendSMSNowDialog component**
   - Template selection dropdown
   - Variable inputs based on template
   - Preview with variables replaced
   - Send button

6. **Add sendSMSNow mutation**
   - Create messages with current timestamp
   - Will be sent on next cron execution

7. **Integrate Send Now into SMSTab**
   - Add "Send Test SMS" button next to Run Sequence
   - Open SendSMSNowDialog

---

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/templateVariables.ts` | Modify | Add SMS variable extraction helper |
| `src/components/operations/SMSSequenceVariablesDialog.tsx` | Create | Dialog for SMS variable input |
| `src/components/operations/SendSMSNowDialog.tsx` | Create | Dialog for sending test SMS |
| `src/components/operations/notification-channels/SMSTab.tsx` | Modify | Add variable flow, fix cancel state, add send now |
| `src/hooks/useSMSNotification.ts` | Modify | Add sendSMSNow mutation |
| `src/components/operations/index.ts` | Modify | Export new components |
