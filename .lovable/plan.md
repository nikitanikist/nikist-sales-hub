

# Fix: Show Group IDs to Distinguish Same-Name Groups

## Problem Identified
After investigating the database, the "duplicates" you're seeing are actually **different WhatsApp groups with identical names**. Each group has a unique ID (JID) from WhatsApp - for example:
- "10th August <> Ethical Hacking & Bug Hunting Masterclass" - JID ending in `...144910`
- "10th August <> Ethical Hacking & Bug Hunting Masterclass" - JID ending in `...421925`

These are real, separate groups on WhatsApp that happen to share the same name.

## Solution
Based on your preference, I'll always display a short group identifier under every group name so you can tell them apart.

## Visual Result

**Before (confusing):**
```
○ 10th August <> Ethical Hacking & Bug Hunting Masterclass
   👥 0 members

○ 10th August <> Ethical Hacking & Bug Hunting Masterclass
   👥 0 members
```

**After (clear):**
```
○ 10th August <> Ethical Hacking & Bug Hunting Masterclass
   👥 0 members · #144910

○ 10th August <> Ethical Hacking & Bug Hunting Masterclass
   👥 0 members · #421925
```

## Changes Required

### 1. Update MultiGroupSelect Component
**File:** `src/components/operations/MultiGroupSelect.tsx`

- Extract last 6 digits from `group_jid` as a short identifier
- Display the ID after the member count: `👥 0 members · #144910`
- Use a muted color for the ID to keep focus on the group name

### 2. Update Linked Groups Summary (Optional Enhancement)
**File:** `src/components/operations/WorkshopDetailSheet.tsx`

- In the "Groups Linked" summary section, also show the short ID when listing selected groups
- This helps confirm you've selected the right group when names are identical

---

## Technical Details

### Short ID Extraction
```typescript
// Extract last 6 chars from JID (before @g.us)
// "120363301378144910@g.us" → "144910"
const shortId = group.group_jid.split('@')[0].slice(-6);
```

### Updated GroupItem Display
```
┌────────────────────────────────────────────────────┐
│ ○ 10th August <> Ethical Hacking...               │
│   👥 0 members · #144910                           │
└────────────────────────────────────────────────────┘
```

### Files to Modify

| File | Change |
|------|--------|
| `src/components/operations/MultiGroupSelect.tsx` | Add short ID display in GroupItem component |
| `src/components/operations/WorkshopDetailSheet.tsx` | Add short ID in linked groups summary |

## Implementation Steps

1. Update `GroupItem` component to extract and display short JID
2. Style the ID in a muted color with a `#` prefix for clarity
3. Update the linked groups summary to include the short ID
4. Test that groups with identical names are now distinguishable

