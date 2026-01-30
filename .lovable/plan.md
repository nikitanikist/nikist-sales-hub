

# Enhance Workshop Notification: Cancel Messages, Group Search, and Simplified Group List

## Overview
Three improvements to the Workshop Notification page to enhance usability:
1. Add ability to cancel scheduled messages
2. Add search functionality for WhatsApp groups
3. Simplify group list by removing admin/non-admin separation

---

## 1. Cancel Scheduled Messages

### Current State
- The `cancelMessage` function already exists in the hook but is not exposed in the UI
- Messages show status (pending, sent, failed, cancelled) but users cannot cancel pending ones

### Changes Required

**File: `src/components/operations/MessageCheckpoints.tsx`**

Add a cancel button for each pending message:

- Add `onCancel` prop to receive the cancel handler
- Add `isCancelling` prop for loading state
- For messages with status `pending`, show a small "Cancel" button/icon (X icon)
- Disable the button while cancellation is in progress
- Confirm before cancelling (optional - or just do it directly since it's easy to re-run)

**UI Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ ○ 11:00 AM   Morning Reminder      [Scheduled] [✕]     │
│ ○  1:00 PM   Afternoon Reminder    [Scheduled] [✕]     │
│ ✓  6:00 PM   1 Hour Before         [Sent]              │
│ ✗  6:30 PM   30 Min Before         [Cancelled]         │
└─────────────────────────────────────────────────────────┘
```

**File: `src/components/operations/WorkshopDetailSheet.tsx`**

Pass the cancel handler down to MessageCheckpoints:
- Destructure `cancelMessage` and `isCancellingMessage` from `useWorkshopNotification`
- Pass these to `MessageCheckpoints` component

---

## 2. Search WhatsApp Groups

### Current State
- Groups are listed in a ScrollArea with no filtering
- Users must manually scroll through all groups to find the one they want

### Changes Required

**File: `src/components/operations/MultiGroupSelect.tsx`**

Add a search input at the top of the groups list:

- Add `searchQuery` state
- Add a search Input field with search icon
- Filter `sessionGroups` based on search query (case-insensitive match on group name)
- Clear search when session changes

**UI Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ WhatsApp Groups                              [⟳ Sync]   │
├─────────────────────────────────────────────────────────┤
│ [☐ Select All (24)]    [Clear (3)]                     │
├─────────────────────────────────────────────────────────┤
│ 🔍 [Search groups...                               ]    │
├─────────────────────────────────────────────────────────┤
│ ☑ Crypto Masterclass - Jan 2025          234 members   │
│ ☑ Trading Workshop Q1                    156 members   │
│ ☐ Options Basics Group                   89 members    │
│ ☐ Futures Community                      312 members   │
└─────────────────────────────────────────────────────────┘
│ 3 groups selected                                       │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Simplify Group List (Remove Admin/Non-Admin Separation)

### Current State
- Groups are separated into "Admin Groups" and "Not Admin" sections
- Non-admin groups have reduced opacity and warning styling
- "Select All Admin" button only selects admin groups

### Changes Required

**File: `src/components/operations/MultiGroupSelect.tsx`**

Remove the admin/non-admin categorization:

- Remove `adminGroups` and `nonAdminGroups` computed values
- Show all groups in a single flat list (alphabetically sorted)
- Change "Select All Admin" button to "Select All" (selects all groups)
- Remove the admin badge and warning styling from individual items
- Remove the "without admin rights" warning in the selection summary
- Keep participant count display for each group

**Simplified UI:**
```
┌─────────────────────────────────────────────────────────┐
│ WhatsApp Groups                              [⟳ Sync]   │
├─────────────────────────────────────────────────────────┤
│ [☐ Select All (24)]    [Clear (3)]                     │
├─────────────────────────────────────────────────────────┤
│ 🔍 [Search groups...                               ]    │
├─────────────────────────────────────────────────────────┤
│ ☑ Crypto Masterclass - Jan 2025          234 members   │
│ ☑ Futures Community                       312 members   │
│ ☐ Options Basics Group                    89 members   │
│ ☑ Trading Workshop Q1                     156 members   │
└─────────────────────────────────────────────────────────┘
│ 3 groups selected                                       │
└─────────────────────────────────────────────────────────┘
```

---

## Technical Details

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/operations/MessageCheckpoints.tsx` | Add `onCancel` prop, render cancel button for pending messages |
| `src/components/operations/WorkshopDetailSheet.tsx` | Pass cancel handler to MessageCheckpoints |
| `src/components/operations/MultiGroupSelect.tsx` | Add search input, remove admin/non-admin separation, simplify Select All |

### MessageCheckpoints Props Update
```typescript
interface MessageCheckpointsProps {
  checkpoints: Checkpoint[];
  isLoading?: boolean;
  timezone?: string;
  onCancel?: (messageId: string) => void;  // NEW
  isCancelling?: boolean;                   // NEW
}
```

### MultiGroupSelect State Addition
```typescript
const [searchQuery, setSearchQuery] = useState('');

const filteredGroups = useMemo(() => 
  sessionGroups.filter(g => 
    g.group_name.toLowerCase().includes(searchQuery.toLowerCase())
  ),
  [sessionGroups, searchQuery]
);
```

---

## Summary

| Feature | What Users Get |
|---------|---------------|
| **Cancel Messages** | Click X next to any scheduled (pending) message to cancel it |
| **Search Groups** | Type to filter groups by name instead of scrolling |
| **Simplified List** | All groups shown equally without admin/non-admin distinction |

