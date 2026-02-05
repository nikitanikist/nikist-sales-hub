

# Fix Workshop WhatsApp Group - Wrong JID Linked

## Problem
The "Sync Members" button fails with `item-not-found` because the workshop is linked to the **Community Parent JID** instead of the **Announcement Group JID**.

**Evidence:**
- Workshop linked to: `120363405847177268@g.us` (Community Parent - no participants accessible)
- Correct group: `120363407949020306@g.us` (Announcement Group - has 184 participants)

Both groups have the same name "Crypto Wealth Masterclass (Sh1) <> 6TH February", but only the announcement group has queryable participants.

## Solution

### Part 1: Data Fix (Manual SQL)
Update the junction table to point to the correct announcement group:

```sql
UPDATE workshop_whatsapp_groups 
SET group_id = '4404c32d-8288-42be-9a05-036e7add8467'
WHERE workshop_id = 'bb58389d-e0eb-4314-ab06-87d54710f555';
```

This immediately fixes the 6th February workshop.

### Part 2: Verify Community Creation Logic
The `create-whatsapp-community` edge function should already be storing the announcement group JID based on the memory context. If this workshop was created before that fix, that explains the wrong link.

No code changes needed - just the data fix above.

---

## Technical Details

### Why This Happened
When a WhatsApp Community is created, it generates:
1. A **Community Parent JID** - used for the community structure
2. An **Announcement Group JID** - where members actually join and messages are sent

The workshop was linked to the parent JID (which cannot be queried for participants) instead of the announcement group JID (which contains the actual members).

### Database Records
| Group ID | JID | Type |
|----------|-----|------|
| `e48205e7-...` | `120363405847177268@g.us` | Community Parent (wrong) |
| `4404c32d-...` | `120363407949020306@g.us` | Announcement Group (correct) |

### After the Fix
- The workshop will be linked to the announcement group
- "Sync Members" will work and show the 184 participants
- Member tracking webhooks will function correctly

