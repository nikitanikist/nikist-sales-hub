

# Feature: Manual WhatsApp Community Creation + Invite Link Visibility

## Overview

Adding two features to the Workshop Detail Sheet in the Operations > Workshop Notification page:

1. **Create WhatsApp Group Button**: For old workshops without a community group, add a button to manually trigger the `create-whatsapp-community` edge function
2. **View Invite Link**: For workshops with linked groups, display the WhatsApp community invite link so users can copy/share it

---

## Current State Analysis

| Aspect | Current Implementation |
|--------|----------------------|
| Automatic creation | Works for new workshops when `community_session_id` is configured |
| Old workshops | No way to create community groups manually |
| Invite links | Stored in `whatsapp_groups.invite_link` but not displayed anywhere |
| Group data | `useWhatsAppGroups` hook doesn't include `invite_link` in return type |

---

## Implementation Plan

### 1. Update WhatsApp Groups Hook

**File**: `src/hooks/useWhatsAppGroups.ts`

- Add `invite_link` to the `WhatsAppGroup` interface
- Include `invite_link` in the select query
- Add a mutation to create a community group for a workshop

```typescript
interface WhatsAppGroup {
  // ... existing fields
  invite_link: string | null;  // Add this
}
```

### 2. Update Workshop Detail Sheet

**File**: `src/components/operations/WorkshopDetailSheet.tsx`

Add to the WhatsApp Settings section:

**A) "Create WhatsApp Group" Button**
- Visible when: No groups are linked AND a session is selected
- Calls the `create-whatsapp-community` edge function
- Shows loading state during creation
- Automatically links the new group to the workshop

**B) "View Invite Link" Display**
- Visible when: Workshop has linked groups with invite links
- Shows a clickable link with copy button for each group that has an invite_link
- Display format: Group name with invite link underneath

### 3. Add Create Community Mutation

**File**: `src/hooks/useWorkshopNotification.ts` (or new hook)

Add a mutation that:
1. Calls `create-whatsapp-community` edge function
2. Passes `workshopId`, `workshopName`, `organizationId`
3. Invalidates relevant queries on success
4. Shows success/error toast

---

## UI Design

### WhatsApp Settings Section (Updated)

```
┌─────────────────────────────────────────┐
│ WhatsApp Settings           [Complete] ✓│
├─────────────────────────────────────────┤
│ Account                                 │
│ ┌─────────────────────────────────────┐ │
│ │ Shankha's WhatsApp            ▾   │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ WhatsApp Groups                         │
│ ┌─────────────────────────────────────┐ │
│ │ [Search groups...]                  │ │
│ │ ☑ Crypto Masterclass <> 1st Feb    │ │
│ │   👥 45 members · #936625          │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─ No community group? ──────────────┐  │
│ │ [➕ Create WhatsApp Group]         │  │
│ └────────────────────────────────────┘  │
│                                         │
│ ┌─ Group Invite Links ───────────────┐  │
│ │ 🔗 Crypto Masterclass <> 1st Feb   │  │
│ │    https://chat.whatsapp.com/...   │  │
│ │    [📋 Copy]                       │  │
│ └────────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useWhatsAppGroups.ts` | Add `invite_link` to interface and query |
| `src/hooks/useWorkshopNotification.ts` | Add `createCommunityGroup` mutation |
| `src/components/operations/WorkshopDetailSheet.tsx` | Add create button and invite link display |
| `src/components/operations/MultiGroupSelect.tsx` | Pass `invite_link` in group data (optional) |

---

## Technical Details

### Create Community Button Logic

```typescript
const handleCreateCommunity = async () => {
  if (!workshop || !selectedSessionId) return;
  
  createCommunityGroup({
    workshopId: workshop.id,
    workshopName: workshop.title,
    organizationId: currentOrganization.id,
  });
};
```

Button visibility conditions:
- `selectedSessionId` is set (account selected)
- `selectedGroupIds.length === 0` (no groups linked)
- OR always show but in different state (create new vs already exists)

### Invite Link Display Logic

1. From `sessionGroups`, filter to only those in `selectedGroupIds`
2. Further filter to those with non-null `invite_link`
3. Display each with copy-to-clipboard functionality

---

## Edge Cases Handled

| Scenario | Behavior |
|----------|----------|
| No session selected | Create button disabled with tooltip |
| Groups already linked | Show "Create Additional Group" option (optional) |
| Invite link is null | Don't show link section for that group |
| Creation fails | Show error toast with details from edge function |
| Multiple groups with links | Show all invite links in a list |

