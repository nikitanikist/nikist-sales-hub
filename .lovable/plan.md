
# Fix: WhatsApp Groups List Truncated at 1000 Rows

## Problem
The WhatsApp groups query in `useWhatsAppGroups.ts` already correctly filters to only show groups from connected sessions (via an `!inner` join). However, the `.limit(1000)` on line 97 truncates the results, hiding groups like "Nikist Times" that fall beyond the 1000th row alphabetically.

## Fix (1 file, 1 line)

**`src/hooks/useWhatsAppGroups.ts`** (line 97):

Replace `.limit(1000)` with `.range(0, 4999)` to reliably fetch up to 5000 groups. The `.range()` method uses the HTTP Range header, which is more reliable than `.limit()` for exceeding the default PostgREST 1000-row cap.

```text
// Before:
.limit(1000);

// After:
.range(0, 4999);
```

## What's already working
- The query already uses `whatsapp_sessions!inner(status)` with `.eq('session.status', 'connected')` -- so groups from disconnected sessions are already excluded
- The `is_active: true` filter is also in place
- No backend or database changes needed

## Result
After this change, all admin groups from connected sessions (currently 991 for Nikist) will load in the dashboard, and "Nikist Times" will appear in searches.
