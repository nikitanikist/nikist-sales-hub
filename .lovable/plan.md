

# Multi-Group WhatsApp Selection with Admin Status

## Overview

Currently, the workshop detail sheet only allows selecting **one** WhatsApp group. You want to:
1. Select **multiple** WhatsApp groups to send the sequence to
2. See which groups you are an **admin** of (since you can only send messages to groups where you're an admin)

## Current Limitation

Right now:
- Workshops table has a single `whatsapp_group_id` column (one-to-one relationship)
- Group selection uses a `<Select>` dropdown (single selection only)
- The VPS returns group data during sync, but we don't capture admin status

## Implementation Plan

### Phase 1: Database Changes

#### 1.1 Add `is_admin` column to `whatsapp_groups` table

```sql
ALTER TABLE public.whatsapp_groups 
ADD COLUMN is_admin boolean DEFAULT false;
```

This will store whether you're an admin for each group.

#### 1.2 Create junction table for multi-group support

```sql
CREATE TABLE public.workshop_whatsapp_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.whatsapp_groups(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(workshop_id, group_id)
);

-- Enable RLS
ALTER TABLE public.workshop_whatsapp_groups ENABLE ROW LEVEL SECURITY;

-- RLS policies (similar to existing patterns)
CREATE POLICY "Users can view workshop groups in their org"
  ON public.workshop_whatsapp_groups FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.workshops w 
    WHERE w.id = workshop_id 
    AND (w.organization_id = ANY(get_user_organization_ids()) OR is_super_admin(auth.uid()))
  ));

CREATE POLICY "Admins can manage workshop groups"
  ON public.workshop_whatsapp_groups FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.workshops w 
    WHERE w.id = workshop_id 
    AND ((w.organization_id = ANY(get_user_organization_ids()) 
         AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')))
        OR is_super_admin(auth.uid()))
  ));
```

### Phase 2: Update VPS Proxy to Capture Admin Status

#### 2.1 Modify `vps-whatsapp-proxy/index.ts` sync-groups action

The Baileys library typically returns group metadata including:
- `participants[]` with each participant's role (admin, superadmin, member)
- The VPS likely already sends this data, we just need to extract it

Update the group mapping to capture admin status:

```typescript
const groupsToUpsert = vpsGroups.map((g: any) => {
  // Check if the connected session user is admin
  // Baileys returns participants with roles
  const myJid = responseData?.myJid || sessionPhoneNumber;
  const myParticipant = g.participants?.find((p: any) => 
    p.id === myJid || p.id?.includes(myJid?.split('@')[0])
  );
  const isAdmin = myParticipant?.admin === 'admin' || 
                  myParticipant?.admin === 'superadmin' ||
                  myParticipant?.isAdmin === true;

  return {
    // ... existing fields
    is_admin: isAdmin,
  };
});
```

### Phase 3: Frontend Changes

#### 3.1 Update `useWhatsAppGroups.ts` hook

Add `is_admin` to the interface and return data:

```typescript
interface WhatsAppGroup {
  // ... existing fields
  is_admin: boolean;
}
```

#### 3.2 Create new multi-select component

Replace the single `<Select>` with a checkbox-based multi-select:

**File: `src/components/operations/MultiGroupSelect.tsx`**

- Shows all groups with checkboxes
- Admin groups show a badge/icon (like a crown or shield)
- Non-admin groups show a warning indicator and are optionally disabled
- "Select All Admin Groups" quick action

#### 3.3 Update `WorkshopDetailSheet.tsx`

Changes:
- Replace single group Select with new MultiGroupSelect component
- Track selected groups as an array: `selectedGroupIds: string[]`
- Update the "Linked" display to show count of linked groups
- Pass multiple group IDs to `runMessaging`

#### 3.4 Update `useWorkshopNotification.ts` hook

**updateGroupsMutation** (new):
- Accept array of group IDs
- Insert into `workshop_whatsapp_groups` junction table
- Remove any groups that were deselected

**runMessagingMutation**:
- Fetch all linked groups from junction table
- Create scheduled messages for **each group** (loop)
- Each message row links to its specific group_id

#### 3.5 Update `useWorkshopMessages` query

- Join with `workshop_whatsapp_groups` to get group info
- Show which group each message was sent to in the checkpoints

### Phase 4: Update Message Queue Processing

#### 4.1 Modify `runMessaging` logic

Instead of creating one message per step, create one message per step **per group**:

```typescript
for (const step of sequenceData.steps) {
  for (const groupId of selectedGroupIds) {
    messagesToCreate.push({
      // ... existing fields
      group_id: groupId,  // Each group gets its own message
      message_type: `${typeKey}_${groupId}`,  // Unique per group
    });
  }
}
```

### UI Mockup (Text Description)

```
WhatsApp Groups
[Button: Sync]

[ ] Select All Admin Groups

Available Groups:
[x] Workshop Group A        (150) [Admin badge]
[x] Workshop Group B        (200) [Admin badge]  
[ ] Random Family Group     (45)  [Not admin - grayed]
[x] Trading Community       (500) [Admin badge]
[ ] College Friends         (30)  [Not admin - grayed]

3 groups selected (all admin)

[Linked Groups:]
- Workshop Group A (150 members)
- Workshop Group B (200 members)  
- Trading Community (500 members)
```

### Summary of Changes

| Component | Change |
|-----------|--------|
| Database | Add `is_admin` column, create `workshop_whatsapp_groups` junction table |
| VPS Proxy | Capture admin status during group sync |
| useWhatsAppGroups | Include `is_admin` in group interface |
| MultiGroupSelect | New component with checkbox list and admin indicators |
| WorkshopDetailSheet | Replace single Select with MultiGroupSelect |
| useWorkshopNotification | New mutation for multi-group linking, update runMessaging to loop groups |
| Message Checkpoints | Show which group each message was sent to |

### Migration Path

The existing `whatsapp_group_id` on workshops table will be kept temporarily for backwards compatibility. New groups will use the junction table, and we'll migrate existing single-group links during rollout.

