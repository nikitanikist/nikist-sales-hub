
# Fix: WhatsApp Groups Still Truncated at 1000 Rows (PostgREST Server Limit)

## Problem
The previous fix changed `.limit(1000)` to `.range(0, 4999)`, but this only sets `offset=0&limit=5000` as query parameters. The **PostgREST server** has a hard-coded max of **1000 rows per request** that cannot be changed via client-side parameters. With 1060 groups, "Nikist Times" falls beyond the 1000th row alphabetically and is still not returned.

## Solution
Implement **client-side pagination** in the `useWhatsAppGroups` hook to fetch all groups in batches of 1000, then combine them.

## Changes (1 file)

**`src/hooks/useWhatsAppGroups.ts`** — Replace the single query with a paginated fetch loop:

```typescript
queryFn: async () => {
  if (!currentOrganization) return [];
  
  const PAGE_SIZE = 1000;
  let allData: any[] = [];
  let page = 0;
  
  while (true) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    
    const { data, error } = await supabase
      .from('whatsapp_groups')
      .select(`
        id, group_jid, group_name, organization_id, session_id, participant_count,
        workshop_id, synced_at, is_active, is_admin, is_community, is_community_announce, invite_link,
        session:whatsapp_sessions!inner(status)
      `)
      .eq('organization_id', currentOrganization.id)
      .eq('is_active', true)
      .eq('session.status', 'connected')
      .order('group_name', { ascending: true })
      .range(from, to);

    if (error) throw error;
    
    allData = allData.concat(data || []);
    
    // If we got fewer than PAGE_SIZE rows, we've reached the end
    if (!data || data.length < PAGE_SIZE) break;
    page++;
  }
  
  return allData.map(({ session, ...group }) => group) as WhatsAppGroup[];
},
```

This will make 2 requests for 1060 groups (1000 + 60), ensuring "Nikist Times" is included. The loop is safe — it stops as soon as a page returns fewer than 1000 rows.

## Why `.range(0, 4999)` didn't work
PostgREST enforces a server-side `max-rows` setting (default 1000). Even if the client requests 5000 rows, the server silently caps the response at 1000. The only way around this without server config changes is pagination.
