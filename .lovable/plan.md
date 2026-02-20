

# Fix: Update `participant_count` in Real-Time After Join/Leave Events

## Problem

The membership webhook correctly records join/leave events in the `workshop_group_members` table (2 members are there), but it **never updates** the `participant_count` column in `whatsapp_groups`. The UI reads from `whatsapp_groups.participant_count`, which remains at the initial value of `1`.

## Solution

After every successful join or leave event in the webhook, recalculate the active member count from `workshop_group_members` and update the `participant_count` on the corresponding `whatsapp_groups` row.

## Technical Details

### File: `supabase/functions/whatsapp-membership-webhook/index.ts`

After each successful join upsert or leave update, add a count query and update:

```typescript
// After join/leave processing, update participant_count
const { count } = await supabase
  .from("workshop_group_members")
  .select("*", { count: "exact", head: true })
  .eq("group_jid", payload.groupJid)
  .eq("status", "active");

if (group?.id) {
  await supabase
    .from("whatsapp_groups")
    .update({ participant_count: count || 0 })
    .eq("id", group.id);
}
```

This needs to be added in **both** code paths (the matched-session fallback path starting at line 161, and the direct-session path starting at line 248) after each join/leave block.

### No other changes needed

- Real-time subscription on `whatsapp_groups` is already enabled (previous migration).
- The `useWebinarNotification` hook already listens for `UPDATE` events on `whatsapp_groups` and invalidates the query.
- So once `participant_count` is updated in the DB, the UI will auto-refresh.

### Summary of changes

- **1 file modified**: `supabase/functions/whatsapp-membership-webhook/index.ts` -- add participant count recalculation after join/leave events in both code paths.

