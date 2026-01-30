

# Workshop Notification UX Improvements - Implementation Plan

## Overview

This plan implements a series of UX enhancements to make the Workshop Notification system more intuitive for daily operations. The focus is on reducing scrolling, providing clear guidance, and surfacing important information at the right time.

## Priority 1 (High Impact, Low-Medium Effort)

### 1. Today's Workshop Priority Card

**Goal:** Show today's workshop prominently at the top of the page with setup progress and actionable warnings.

**New Component:** `src/components/operations/TodaysWorkshopCard.tsx`

| Feature | Description |
|---------|-------------|
| Filter logic | Show workshops where `start_date` is today (in org timezone) |
| Progress bar | Visual indicator showing setup completion percentage |
| Missing items | Specific warnings like "Select WhatsApp groups" |
| Quick actions | "Complete Setup" or "Run Sequence" buttons |
| Multiple workshops | If multiple today, show primary with a "+X more" indicator |

**Progress Calculation:**
- Step 1: Tag assigned (25%)
- Step 2: Tag has sequence linked (25%)
- Step 3: WhatsApp account selected (25%)
- Step 4: Groups selected (25%)

---

### 2. Accordion Layout for Side Sheet

**Goal:** Replace vertical scrolling with collapsible sections that auto-expand incomplete steps.

**File:** `src/components/operations/WorkshopDetailSheet.tsx`

**Changes:**
| Section | Collapsed State | Expanded State |
|---------|-----------------|----------------|
| Overview | Date, time, registrations (one line) | Full grid with details |
| Workshop Tag | Current tag name + sequence status | Tag selector |
| WhatsApp Settings | Account + group count summary | Full account/group selection |
| Message Checkpoints | "X/Y messages scheduled" summary | Full checkpoint list |

**Auto-expand Logic:**
- If no tag selected: expand "Workshop Tag"
- If no account/groups: expand "WhatsApp Settings"
- If messages exist: expand "Message Checkpoints"
- All other sections show summary in collapsed state

**UI Pattern:** Using existing `Collapsible` component from `@radix-ui/react-collapsible`

---

### 3. Actionable Status Badges

**Goal:** Replace generic "Pending/Partial/Ready" with specific action-oriented text.

**File:** `src/pages/operations/WorkshopNotification.tsx`

**Current vs. Improved:**
| Current Badge | Improved Badge |
|---------------|----------------|
| `Pending` | `Assign Tag` or `Select Groups` |
| `Partial` | `Run Sequence` |
| `Ready` | `Ready` (with green checkmark) |

**Logic:**
```
if (!tag_id) → "Assign Tag"
if (!whatsapp_session_id) → "Select Account"
if (!groups linked) → "Select Groups"
if (!messages_scheduled) → "Run Sequence"
else → "Ready"
```

---

## Priority 2 (Medium Impact, Low-Medium Effort)

### 4. Quick Actions in Table Row

**Goal:** Add inline action buttons to the table so users can act without opening the sheet.

**File:** `src/pages/operations/WorkshopNotification.tsx`

**Changes to Actions column:**
| State | Buttons Shown |
|-------|---------------|
| Fully setup | `[Run]` `[View]` |
| Incomplete | `[Setup]` `[View]` |

- "Run" button triggers `runMessaging` directly
- "Setup" button opens sheet (same as View but conveys intent)
- Both save one click compared to current flow

---

### 5. Sticky CTA Button in Side Sheet

**Goal:** Keep the main action button always visible at the bottom of the sheet.

**File:** `src/components/operations/WorkshopDetailSheet.tsx`

**Changes:**
- Move `MessagingActions` to a sticky footer
- Show disabled reason inline when button is disabled
- Add visual emphasis (gradient, shadow) to draw attention

---

### 6. Real-time Progress Banner (Optional Enhancement)

**Goal:** Show a floating progress banner when messages are actively being sent.

**New Component:** `src/components/operations/MessagingProgressBanner.tsx`

| Feature | Description |
|---------|-------------|
| Display | Fixed banner at top of page |
| Content | "Sending: 2/5 messages sent" with progress bar |
| Trigger | When any message status is "sending" |
| Dismiss | Auto-hide when complete, or manual dismiss |
| Real-time | Uses existing Supabase subscription |

---

## Implementation Details

### TodaysWorkshopCard Component

```
+-----------------------------------------------------------+
|  Today's Workshop                                          |
+-----------------------------------------------------------+
|  [Icon] Crypto Masterclass - Jan 31, 7:00 PM              |
|                                                            |
|  Registrations: 570        Tag: [Evening Workshop]        |
|                                                            |
|  Setup Progress:                                           |
|  [████████░░] 75% Complete                                |
|                                                            |
|  [!] Missing: WhatsApp group not selected                 |
|                                                            |
|  [Complete Setup]  [View Details]                         |
+-----------------------------------------------------------+
```

### Accordion Section Structure

```
+-----------------------------------------------------------+
|  Workshop Title                                   [Close]  |
+-----------------------------------------------------------+
|                                                            |
|  [v] Overview                              Jan 31, 7:00 PM |
|      ├─ 570 registrations                                 |
|      └─ Evening Workshop                                  |
|                                                            |
|  [v] Workshop Tag                               [Complete] |
|      └─ Evening Workshop → Has sequence (5 messages)      |
|                                                            |
|  [>] WhatsApp Settings                      [!] Incomplete |
|      └─ Account: Not selected                             |
|      └─ Groups: 0 selected                                |
|                                                            |
|  [v] Message Checkpoints                          0/5 sent |
|      └─ No messages scheduled yet                         |
|                                                            |
+-----------------------------------------------------------+
|  [    Run the Sequence (Disabled)    ]                    |
|  Complete WhatsApp settings first                         |
+-----------------------------------------------------------+
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/operations/TodaysWorkshopCard.tsx` | Hero card for today's workshop |
| `src/components/operations/CollapsibleSection.tsx` | Reusable accordion section wrapper |
| `src/components/operations/MessagingProgressBanner.tsx` | (P2) Real-time sending indicator |

## Files to Modify

| File | Changes |
|------|---------|
| `WorkshopNotification.tsx` | Add TodaysWorkshopCard, update status badges, add quick actions |
| `WorkshopDetailSheet.tsx` | Refactor to accordion layout with sticky footer |
| `MessagingActions.tsx` | Adapt for sticky footer positioning |

---

## Technical Considerations

### Date Filtering for "Today's Workshop"
- Use org timezone from `useWorkshopNotification().orgTimezone`
- Compare workshop `start_date` using `date-fns` `isSameDay` in org timezone
- Handle edge case: multiple workshops on same day (show first chronologically)

### Accordion State Management
- Track expanded sections in local state: `Set<string>`
- On mount, calculate which sections are incomplete and auto-expand
- Allow user to manually expand/collapse any section

### Progress Calculation Helper
```typescript
function calculateProgress(workshop: WorkshopWithDetails): {
  percent: number;
  missing: string[];
} {
  const steps = [
    { done: !!workshop.tag_id, label: 'Assign a workshop tag' },
    { done: !!workshop.tag?.template_sequence_id, label: 'Tag needs a template sequence' },
    { done: !!workshop.whatsapp_session_id, label: 'Select WhatsApp account' },
    { done: workshop.automation_status?.whatsapp_group_linked, label: 'Select WhatsApp groups' },
  ];
  
  const completed = steps.filter(s => s.done).length;
  const missing = steps.filter(s => !s.done).map(s => s.label);
  
  return { percent: (completed / steps.length) * 100, missing };
}
```

---

## Out of Scope (P3 - Future)

The following improvements from the prompt are deferred for a future iteration:

1. **Progress Stepper** - More complex than accordion, accordion achieves similar goal
2. **Visual Sequence Timeline** in Settings - Significant refactor of sequence editor
3. **Inline Step Adding** - Nice-to-have enhancement for settings page
4. **Drag-to-reorder steps** - Requires additional state management

---

## Summary

| Component | Status | Effort |
|-----------|--------|--------|
| TodaysWorkshopCard | New | Medium |
| Accordion layout | Refactor | Medium |
| Actionable badges | Update | Low |
| Quick actions | Update | Low |
| Sticky CTA | Update | Low |
| Progress banner | New (optional) | Medium |

Total estimated effort: **Medium** - mostly UI refactoring with existing data patterns.

