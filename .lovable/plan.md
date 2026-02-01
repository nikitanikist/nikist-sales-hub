

# Fix Group List: Hide Unusable Groups & Fix Scrolling

## Problems Identified

### Issue 1: Inactive/Unusable Groups Showing
Groups without invite links cannot be used for redirection, so there's no point showing them in the selection list. They just clutter the UI.

### Issue 2: Scroll Not Working
When you try to scroll the group list, the entire dialog scrolls instead. This happens because:
- `ScrollArea` with `h-auto max-h-64` doesn't create a proper scroll context
- Radix ScrollArea needs a fixed height on the container for scrolling to work
- The Viewport inside has `h-full` but with `h-auto` parent, it expands instead of scrolling

---

## Solution

### Fix 1: Only Show Groups with Invite Links
Remove the "No invite link" section entirely. Only display groups that can actually be selected and used.

**Before:**
```text
✓ Has invite link (7)
   Crypto Masterclass <> 1st February
   test amit
   
⚠ No invite link (3)         ← REMOVE THIS ENTIRE SECTION
   Old workshop group
```

**After:**
```text
Available Groups (7)
   Crypto Masterclass <> 1st February
   test amit
   Malasi amit workshop
```

If there are groups but none have invite links, show a helpful message: "No groups with invite links. Click Sync Groups to fetch invite links."

### Fix 2: Fix ScrollArea Height
Change from dynamic height to fixed height for proper scrolling:

| Current (Broken) | Fixed |
|------------------|-------|
| `h-auto max-h-64` | `h-64` (fixed 256px) |

This ensures:
- ScrollArea has a fixed boundary
- Viewport can scroll within that boundary
- Mouse wheel events stay within the group list

---

## Code Changes

### File: `src/components/operations/CreateLinkDialog.tsx`

| Location | Change |
|----------|--------|
| Line 94 | Remove `groupsWithoutInvite` - no longer needed |
| Line 333 | Change `h-auto max-h-64` to `h-64` |
| Lines 346-393 | Simplify to only show `groupsWithInvite`, remove "No invite link" section |
| Empty state | Update message when no groups have invite links |

---

## Updated Group List UI

```text
Select Group                                      [Sync Groups]
┌──────────────────────────────────────────────────────────────┐
│ 🔍 Search groups...                                          │
└──────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────┐
│  Available Groups (7)                                        │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 🟢 Crypto Masterclass <> 1st February          👥 230  │  │
│  │ 🟢 test amit                                   👥 1    │  │◀── Now scrollable!
│  │ 🟢 Malasi amit workshop                        👥 1    │  │
│  │ 🟢 Workshop Feb 2                              👥 156  │  │
│  │ 🟢 Trading Group                               👥 89   │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/operations/CreateLinkDialog.tsx` | Fix ScrollArea height, remove unusable groups section |

