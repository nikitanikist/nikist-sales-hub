

# Dynamic Progress Button for Workshop Notification Sequence

## Overview

Replace the static "Run Sequence" button with a dynamic progress button that shows real-time message delivery status. The button will change color (green for progress, red for errors) and display a progress counter (e.g., "1/8 sent").

## Current Architecture

The Workshop Notification page has three places where the "Run Sequence" button appears:
1. **Today's Workshop Card** - Hero card at the top for today's workshop
2. **Table Actions** - "Run" button in each workshop row
3. **Detail Sheet Footer** - "Run the Sequence" button in the side panel

All three need to be enhanced with the new progress tracking behavior.

## Solution

### 1. Create New SequenceProgressButton Component

A new reusable component that:
- Shows different states: idle, scheduling, running (with progress), completed, error
- Displays progress counter like "3/8 sent"
- Uses green color when messages are being sent
- Uses red color when any message has failed
- Subscribes to real-time message updates

**File:** `src/components/operations/SequenceProgressButton.tsx`

**States and Appearance:**

| State | Color | Content |
|-------|-------|---------|
| Idle (no messages) | Primary (purple) | "Run Sequence" |
| Scheduling | Primary (purple) | Spinner + "Scheduling..." |
| Running (progress) | Green (success) | "3/8 sent" with mini progress bar |
| Completed | Green (success) | Checkmark + "8/8 sent" |
| Has Errors | Red (destructive) | "5/8 sent · 2 failed" |

### 2. Track Messages Per Workshop

Need to fetch and subscribe to messages for each workshop that has scheduled messages. 

**Logic:**
```typescript
const stats = {
  total: messages.length,
  sent: messages.filter(m => m.status === 'sent').length,
  failed: messages.filter(m => m.status === 'failed').length,
  pending: messages.filter(m => m.status === 'pending').length,
  sending: messages.filter(m => m.status === 'sending').length,
};

const hasActiveSequence = stats.total > 0 && (stats.pending > 0 || stats.sending > 0);
const hasFailures = stats.failed > 0;
const isComplete = stats.total > 0 && stats.pending === 0 && stats.sending === 0;
```

### 3. Update Affected Components

**A. WhatsAppGroupTab.tsx (Table Actions)**

Replace the current "Run" button with `SequenceProgressButton`:
- Pass workshop ID to the button
- The button will internally subscribe to message updates
- Show progress for workshops with active sequences

**B. TodaysWorkshopCard.tsx (Hero Card)**

Replace the current "Run Sequence" button with `SequenceProgressButton`:
- Same behavior as table
- Larger visual prominence for the hero section

**C. MessagingActions.tsx (Detail Sheet)**

The button in the detail sheet should also show progress:
- Since the sheet already subscribes to messages, pass the messages as props
- The button shows real-time progress

### 4. Visual Design

**Idle State (Purple/Primary):**
```
+---------------------------+
|  ▶  Run Sequence          |
+---------------------------+
```

**Scheduling State (Purple, Loading):**
```
+---------------------------+
|  ⟳  Scheduling...         |
+---------------------------+
```

**Running State (Green with Progress):**
```
+---------------------------+
|  ███░░░░░  3/8 sent       |
+---------------------------+
```

**Completed State (Green with Checkmark):**
```
+---------------------------+
|  ✓  8/8 sent              |
+---------------------------+
```

**Error State (Red):**
```
+---------------------------+
|  ⚠  5/8 sent · 2 failed   |
+---------------------------+
```

---

## Implementation Steps

| Step | File | Change |
|------|------|--------|
| 1 | `src/components/operations/SequenceProgressButton.tsx` | Create new component with all states |
| 2 | `src/components/operations/index.ts` | Export the new component |
| 3 | `src/components/operations/notification-channels/WhatsAppGroupTab.tsx` | Replace "Run" button with `SequenceProgressButton` |
| 4 | `src/components/operations/TodaysWorkshopCard.tsx` | Replace "Run Sequence" button with `SequenceProgressButton` |
| 5 | `src/components/operations/MessagingActions.tsx` | Add progress display to "Run the Sequence" button |

---

## Technical Details

### SequenceProgressButton Props

```typescript
interface SequenceProgressButtonProps {
  workshopId: string;
  workshop: WorkshopWithDetails;
  groupIds: string[];
  isSetupComplete: boolean;
  onRun: () => void;
  isScheduling?: boolean;
  // Optional: pass messages if parent already subscribes
  messages?: ScheduledMessage[];
  subscribeToMessages?: (workshopId: string) => () => void;
  variant?: 'default' | 'compact';
}
```

### Real-time Updates

The component will use:
```typescript
useEffect(() => {
  if (!workshopId || !subscribeToMessages) return;
  return subscribeToMessages(workshopId);
}, [workshopId, subscribeToMessages]);
```

### Button Variant Classes

```typescript
const buttonClasses = cn(
  'w-full gap-2',
  hasActiveSequence && !hasFailures && 'bg-emerald-500 hover:bg-emerald-600',
  hasFailures && 'bg-destructive hover:bg-destructive/90',
);
```

---

## User Experience Flow

1. User clicks "Run Sequence" on any workshop
2. Button shows "Scheduling..." with spinner
3. Once scheduled, button turns **green** and shows "0/8 sent"
4. As messages are sent, counter updates: "1/8", "2/8", etc.
5. If a message fails, button turns **red** showing "3/8 sent · 1 failed"
6. When complete, button shows checkmark + "8/8 sent"
7. User can click the button again to view details (opens sheet)

