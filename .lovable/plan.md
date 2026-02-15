

# Fix: Delivered Count Stuck at 0 + Audience 0 + Status Stuck on "Sending"

## Three Bugs Found

### Bug 1: Delivered count can never increase (CRITICAL)

The `increment_delivered_count` and `increment_read_count` database functions use:
```sql
LEAST(COALESCE(delivered_count, 0) + 1, COALESCE(member_count, 999999))
```

When `member_count = 0`, this computes `LEAST(1, 0) = 0`. The count is **capped at member_count**, so when member_count is 0, delivered and read counts can NEVER increase via this RPC.

Read counts still work because the webhook uses a different path -- it counts rows from `notification_campaign_reads` table and does a direct UPDATE, bypassing the capped RPC entirely.

**Fix**: Change both RPC functions to use `GREATEST(member_count, 999999)` instead of `member_count` as the cap, or simply remove the cap since it's causing more harm than good. A simpler approach: use `COALESCE(member_count, 0)` but only cap when `member_count > 0`.

```sql
-- Fix: Only cap if member_count is actually set (> 0)
SET delivered_count = CASE
  WHEN COALESCE(member_count, 0) > 0
    THEN LEAST(COALESCE(delivered_count, 0) + 1, member_count)
  ELSE COALESCE(delivered_count, 0) + 1
END
```

Same fix for `increment_read_count`.

### Bug 2: Audience = 0 (member_count not populated)

When a campaign is created in `SendNotification.tsx`, line 240 sets:
```typescript
member_count: g.participant_count || 0
```

The `participant_count` in `whatsapp_groups` is `0` for communities created via the CRM tool because the creation flow doesn't fetch participants after creation.

**Fix**: After community creation in `vps-whatsapp-proxy`, fetch the participant count from the VPS and update `whatsapp_groups.participant_count`. Fall back to `1` (the admin) if the fetch fails.

### Bug 3: Campaign status badge stuck on "Sending"

The campaign query in `CampaignDetail.tsx` (line 20-33) has NO `refetchInterval`. The groups query refreshes every 5 seconds, but the campaign status badge never updates.

**Fix**: Add `refetchInterval` to the campaign query, matching the groups pattern (5s while sending, 30s otherwise). Also add a realtime subscription for instant updates.

## File Changes

| File | Change |
|------|--------|
| Database migration | Fix `increment_delivered_count` and `increment_read_count` RPCs to not cap at 0 |
| `supabase/functions/vps-whatsapp-proxy/index.ts` | After community creation, fetch participant count from VPS and update `whatsapp_groups.participant_count` |
| `src/pages/whatsapp/CampaignDetail.tsx` | Add `refetchInterval` to campaign query + realtime subscription; remove `(g as any)` casts for `delivered_count` |

## Technical Details

### Database Migration

Replace both RPC functions:

```sql
CREATE OR REPLACE FUNCTION public.increment_delivered_count(p_group_id uuid)
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  UPDATE notification_campaign_groups
  SET delivered_count = CASE
    WHEN COALESCE(member_count, 0) > 0
      THEN LEAST(COALESCE(delivered_count, 0) + 1, member_count)
    ELSE COALESCE(delivered_count, 0) + 1
  END
  WHERE id = p_group_id
  RETURNING delivered_count;
$$;

CREATE OR REPLACE FUNCTION public.increment_read_count(p_group_id uuid)
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  UPDATE notification_campaign_groups
  SET read_count = CASE
    WHEN COALESCE(member_count, 0) > 0
      THEN LEAST(COALESCE(read_count, 0) + 1, member_count)
    ELSE COALESCE(read_count, 0) + 1
  END
  WHERE id = p_group_id
  RETURNING read_count;
$$;
```

### VPS Proxy Change

In the `create-community-standalone` handler, after inserting the group into `whatsapp_groups`, make a follow-up call:
```
GET /groups/{vpsSessionId}/{announcementGroupJid}/participants
```
Then update `participant_count` with the array length (minimum 1).

### CampaignDetail.tsx Change

Add `refetchInterval` to the campaign query:
```typescript
refetchInterval: campaign?.status === "sending" ? 5000 : 30000,
```

Add a realtime subscription on `notification_campaigns` filtered by `campaignId` to invalidate the query on UPDATE.

Remove `(g as any).delivered_count` casts on lines 78 and 186-187, using `g.delivered_count` directly.
