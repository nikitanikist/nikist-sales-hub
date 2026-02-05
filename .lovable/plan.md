
# Fix Workshop WhatsApp Group Display

## Problem
The "6TH February" workshop shows "No WhatsApp Group Linked" even though there IS a WhatsApp group connected via the `workshop_whatsapp_groups` junction table.

**Root Cause:** The `WorkshopDetail.tsx` page checks the legacy `workshops.whatsapp_group_id` column (which is `null`) instead of querying the junction table where the relationship actually exists.

## Data Evidence
- Workshop `bb58389d-e0eb-4314-ab06-87d54710f555` has `whatsapp_group_id: null`
- Junction table `workshop_whatsapp_groups` HAS a record linking this workshop to group `e48205e7-4d36-4d4d-ae00-606ded577683` with JID `120363405847177268@g.us`

## Solution
Update the workshop detail query to fetch WhatsApp group(s) from the junction table instead of the legacy column.

---

## Technical Details

### File to Modify
`src/pages/WorkshopDetail.tsx`

### Change Required (Lines 74-98)
Replace the current query that checks `workshopData.whatsapp_group_id`:

```typescript
// Current (broken):
let whatsappGroup = null;
if (workshopData.whatsapp_group_id) {
  const { data: groupData } = await supabase
    .from("whatsapp_groups")
    .select("id, group_jid, group_name, session_id")
    .eq("id", workshopData.whatsapp_group_id)
    .single();
  whatsappGroup = groupData;
}
```

With a query that uses the junction table:

```typescript
// Fixed:
let whatsappGroup = null;
const { data: linkedGroup } = await supabase
  .from("workshop_whatsapp_groups")
  .select(`
    group_id,
    whatsapp_groups!inner (
      id, group_jid, group_name, session_id
    )
  `)
  .eq("workshop_id", workshopId)
  .limit(1)
  .maybeSingle();

if (linkedGroup?.whatsapp_groups) {
  whatsappGroup = linkedGroup.whatsapp_groups;
}
```

### Why This Works
- Uses the `workshop_whatsapp_groups` junction table (the source of truth)
- Falls back gracefully if no group is linked
- Maintains compatibility with rest of the component since it returns the same data structure
