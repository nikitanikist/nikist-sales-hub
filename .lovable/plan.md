

# Simplify Dynamic Links: Store URL Directly, No Foreign Key

## Summary

Your approach is spot-on: treat the WhatsApp group selection as just a **convenient way to populate a custom URL**. The dynamic link should store the actual `https://chat.whatsapp.com/xxx` URL directly, with no reference to `whatsapp_group_id`.

---

## Current State vs Your Desired State

| Aspect | Current | Your Desired Flow |
|--------|---------|-------------------|
| Dynamic Link stores | `whatsapp_group_id` (foreign key reference) | `destination_url` (the actual invite URL) |
| Redirect lookup | Joins `whatsapp_groups` table to get invite link | Reads `destination_url` directly |
| WhatsApp selection | Sets `whatsapp_group_id` | Copies invite link into `destination_url` field |
| Sync impact | If groups table changes, links can break | No impact - URL is self-contained |

---

## What's Already Done (Good News!)

Looking at the code, `CreateLinkDialog.tsx` is **already halfway there**:
- Lines 198-207 set `whatsapp_group_id: null` and store the invite link as `destination_url`

---

## What Needs to Change

### 1. Edge Function: Use Upsert Instead of Delete + Insert

Remove the delete statement (lines 620-631) and rely on the existing upsert logic. This preserves group records while still updating them with fresh data.

**Changes:**
- Remove the `DELETE` statement before syncing
- The upsert with `onConflict: 'session_id,group_jid'` already handles updates

### 2. Database: Simplify the `increment_link_click` Function

Current function tries to join `whatsapp_groups` table when `whatsapp_group_id` is set. Since we'll only use `destination_url`, simplify it:

```sql
CREATE OR REPLACE FUNCTION public.increment_link_click(link_slug text)
RETURNS TABLE(destination_url text)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.dynamic_links
  SET click_count = click_count + 1, updated_at = now()
  WHERE slug = link_slug AND is_active = true
  RETURNING dynamic_links.destination_url;
END;
$$;
```

### 3. Frontend: Clean Up Edit Flow

When editing a link, don't try to match `whatsapp_group_id` - just load the `destination_url` as a custom URL:

```typescript
// In useEffect when opening edit dialog
if (editingLink) {
  setSlug(editingLink.slug);
  setDestinationType('url');  // Always treat as custom URL
  setDestinationUrl(editingLink.destination_url || '');
  setSelectedGroupId(null);
  setFetchedInviteLink(null);
}
```

### 4. Hook: Remove `whatsapp_group` Join

The `useDynamicLinks` hook no longer needs to join `whatsapp_groups`:

```typescript
const { data, error } = await supabase
  .from('dynamic_links')
  .select('*')  // No join needed
  .eq('organization_id', currentOrganization.id)
  .order('created_at', { ascending: false });
```

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/vps-whatsapp-proxy/index.ts` | Remove DELETE before sync, keep upsert |
| `src/components/operations/CreateLinkDialog.tsx` | Simplify edit flow - always treat as custom URL |
| `src/hooks/useDynamicLinks.ts` | Remove `whatsapp_groups` join from select |
| Database migration | Simplify `increment_link_click` function |

---

## Technical Details

### Edge Function Change

```typescript
// REMOVE these lines (620-631):
// const { error: deleteError } = await supabase
//   .from('whatsapp_groups')
//   .delete()
//   .eq('session_id', localSessionIdForDb);
```

The existing upsert on lines 687-692 will:
- **Update** existing groups (same `session_id` + `group_jid`) with fresh data including new `invite_link`
- **Insert** new groups

### CreateLinkDialog Change

```typescript
// Simplified edit effect
useEffect(() => {
  if (open && editingLink) {
    setSlug(editingLink.slug);
    // All links are treated as custom URLs now
    setDestinationType('url');
    setDestinationUrl(editingLink.destination_url || '');
    setSelectedGroupId(null);
    setFetchedInviteLink(null);
  }
}, [open, editingLink]);
```

### Database Migration

```sql
CREATE OR REPLACE FUNCTION public.increment_link_click(link_slug text)
RETURNS TABLE(destination_url text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.dynamic_links
  SET click_count = click_count + 1, updated_at = now()
  WHERE slug = link_slug AND is_active = true
  RETURNING dynamic_links.destination_url;
END;
$$;
```

---

## Flow After Changes

```text
User creates dynamic link
  ├── Option 1: Paste custom URL → Stored in destination_url
  └── Option 2: Select WhatsApp group → invite_link copied to destination_url

Both options result in:
  → destination_url = actual URL
  → whatsapp_group_id = NULL
  → Self-contained, no dependencies
```

---

## Benefits

1. **Decoupled**: Dynamic links don't depend on `whatsapp_groups` table
2. **Faster redirects**: No join needed, just read `destination_url`
3. **Sync-safe**: Syncing groups never affects existing dynamic links
4. **Simpler logic**: One code path for all link types

