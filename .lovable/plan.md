

# Fix "Link Not Found" Error for Dynamic Links

## The Problem

The dynamic link `whatsappicc` is failing because:

| Field | Value |
|-------|-------|
| Link slug | `whatsappicc` |
| Status | Active (702 clicks recorded) |
| Destination URL | `null` |
| WhatsApp Group ID | `4da7c6af-7f84-4ba7-958c-67f165e22562` |
| Group Name | "Crypto Wealth Masterclass (Sh1) <> 4TH February" |
| Group Invite Link | `null` (missing!) |

The redirect logic looks up the WhatsApp group's invite link, but since it's `null`, no destination URL can be returned.

---

## Solution: Auto-Fetch Missing Invite Links

Update the `link-redirect` edge function to automatically fetch the invite link from the VPS when:
- The link points to a WhatsApp group
- But the group has no invite link stored

This makes the redirect system self-healing and prevents future "Link Not Found" errors for WhatsApp group links.

---

## Implementation

### Edge Function: `supabase/functions/link-redirect/index.ts`

**Current Flow:**
1. Call `increment_link_click` RPC
2. Return destination_url or invite_link
3. If neither exists → return "not_found"

**New Flow:**
1. Call `increment_link_click` RPC
2. If destination exists → return it
3. If WhatsApp group but no invite link:
   - Fetch group details (session_id, group_jid)
   - Call VPS to get invite link
   - Update the group's invite_link in database
   - Return the fetched invite link
4. If nothing works → return "not_found"

### Code Changes

```typescript
// In link-redirect/index.ts

// If we have a destination URL or invite link, return it immediately
if (result.destination_url || result.invite_link) {
  return new Response(JSON.stringify({ url: result.destination_url || result.invite_link }), ...);
}

// If we have a WhatsApp group ID but no invite link, try to fetch it
if (result.whatsapp_group_id) {
  // Fetch group details
  const { data: group } = await supabase
    .from('whatsapp_groups')
    .select('session_id, group_jid')
    .eq('id', result.whatsapp_group_id)
    .single();

  if (group) {
    // Get session's VPS session ID
    const { data: session } = await supabase
      .from('whatsapp_sessions')
      .select('vps_session_id')
      .eq('id', group.session_id)
      .eq('status', 'connected')
      .single();

    if (session?.vps_session_id) {
      // Fetch invite link from VPS
      const vpsResponse = await fetch(
        `${VPS_URL}/groups/${session.vps_session_id}/${group.group_jid}/invite`,
        { headers: { 'X-API-Key': VPS_API_KEY } }
      );
      
      const vpsData = await vpsResponse.json();
      
      if (vpsData.inviteLink) {
        // Save to database for future use
        await supabase
          .from('whatsapp_groups')
          .update({ invite_link: vpsData.inviteLink })
          .eq('id', result.whatsapp_group_id);
        
        // Return the invite link
        return new Response(JSON.stringify({ url: vpsData.inviteLink }), ...);
      }
    }
  }
}
```

---

## Database Function Update

The `increment_link_click` RPC needs to return the `whatsapp_group_id` so the edge function knows which group to fetch:

```sql
CREATE OR REPLACE FUNCTION public.increment_link_click(link_slug text)
RETURNS TABLE(destination_url text, invite_link text, whatsapp_group_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  link_record RECORD;
BEGIN
  UPDATE public.dynamic_links
  SET click_count = click_count + 1, updated_at = now()
  WHERE slug = link_slug AND is_active = true
  RETURNING 
    dynamic_links.destination_url,
    dynamic_links.whatsapp_group_id
  INTO link_record;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  IF link_record.whatsapp_group_id IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      NULL::text as destination_url,
      wg.invite_link,
      link_record.whatsapp_group_id  -- NEW: return group ID for fallback fetch
    FROM public.whatsapp_groups wg
    WHERE wg.id = link_record.whatsapp_group_id;
  ELSE
    RETURN QUERY
    SELECT 
      link_record.destination_url,
      NULL::text as invite_link,
      NULL::uuid as whatsapp_group_id;
  END IF;
END;
$function$
```

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/link-redirect/index.ts` | Add VPS fallback fetch when invite_link is null |
| Database migration | Update `increment_link_click` to return `whatsapp_group_id` |

---

## Benefits

1. **Self-Healing** — Links automatically fix themselves when accessed
2. **No Manual Intervention** — Users don't need to re-edit links to fetch invite codes
3. **Transparent** — Works for all existing and future WhatsApp group links
4. **Cached** — Once fetched, invite link is stored for instant future redirects

---

## Alternative: Quick Manual Fix

If you need this specific link working immediately while I implement the code fix:

1. Go to **Operations → Dynamic Links**
2. Find and edit the `whatsappicc` link
3. Re-select the same WhatsApp group
4. The system will auto-fetch the invite link
5. Save the link

This will populate the invite link and the redirect will work.

---

## Technical Notes

- The VPS endpoint for getting invite links is: `GET /groups/:sessionId/:groupJid/invite`
- The edge function already has access to VPS credentials via environment variables
- Performance impact is minimal — the fetch only happens once per group, then it's cached
- Timeout handling should be added to prevent slow redirects if VPS is unresponsive

