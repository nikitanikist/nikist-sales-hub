
# Filter Duplicate Webhook Events

## Problem Analysis

The VPS sends each join/leave event from **two different sessions simultaneously**:

```text
2026-02-03T18:15:50Z - sessionId: wa_fd5cd67a-... → join 919963064165
2026-02-03T18:15:50Z - sessionId: wa_857bbdfb-... → join 919963064165
                         ↓
                  Same event, different sessions
                         ↓
            Both trigger upserts → 2 realtime events
```

While the database correctly handles this (upsert only keeps one record), **each webhook call triggers a Supabase Realtime event**, causing the UI to refresh multiple times.

---

## Solution: Add Deduplication with Time-Based Idempotency

Create a simple idempotency check using a composite key and time window:

| Field | Purpose |
|-------|---------|
| `event` | join or leave |
| `groupJid` | Which group |
| `phone_number` | Who joined/left |
| `timestamp` | When (rounded to 5-second window) |

If we receive an identical event within the same 5-second window, skip processing.

---

## Implementation

### Changes to `whatsapp-membership-webhook/index.ts`

**Add an in-memory deduplication cache** (simple Map with TTL):

```typescript
// Simple deduplication cache (in-memory per instance)
const processedEvents = new Map<string, number>();
const DEDUP_WINDOW_MS = 5000; // 5 seconds

function createEventKey(payload: WebhookPayload, normalizedPhone: string): string {
  // Round timestamp to 5-second window for grouping
  const timestamp = payload.timestamp ? new Date(payload.timestamp).getTime() : Date.now();
  const windowKey = Math.floor(timestamp / DEDUP_WINDOW_MS);
  return `${payload.event}:${payload.groupJid}:${normalizedPhone}:${windowKey}`;
}

function isDuplicateEvent(eventKey: string): boolean {
  const now = Date.now();
  // Clean old entries
  for (const [key, time] of processedEvents.entries()) {
    if (now - time > DEDUP_WINDOW_MS * 2) {
      processedEvents.delete(key);
    }
  }
  // Check if already processed
  if (processedEvents.has(eventKey)) {
    return true;
  }
  processedEvents.set(eventKey, now);
  return false;
}
```

**Add check before processing the event:**

```typescript
// After normalizing phone, before database operations:
const eventKey = createEventKey(payload, normalizedPhone);
if (isDuplicateEvent(eventKey)) {
  console.log(`Skipping duplicate event: ${eventKey}`);
  return new Response(
    JSON.stringify({ 
      success: true, 
      duplicate: true,
      message: "Event already processed" 
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

---

## How It Works

```text
First webhook arrives:
  sessionId: wa_fd5cd67a-...
  → Creates key: "join:120363423158005005@g.us:9963064165:12345"
  → Not in cache → Process → Add to cache
  → Database upsert ✓
  → Realtime event fired ✓

Second webhook arrives (4ms later):
  sessionId: wa_857bbdfb-...
  → Creates key: "join:120363423158005005@g.us:9963064165:12345"
  → Already in cache → Skip processing
  → Return success (no DB write)
  → No realtime event ✓
```

---

## File Changes

| File | Changes |
|------|---------|
| `supabase/functions/whatsapp-membership-webhook/index.ts` | Add deduplication logic (~30 lines) |

---

## Edge Cases Handled

| Scenario | Behavior |
|----------|----------|
| Same event from 2 sessions | Second is skipped |
| Legitimate rejoin after 10 seconds | Processed (different time window) |
| Different phone same time | Both processed (different keys) |
| Leave after join | Different event type, both processed |
| Edge function cold start | Cache is empty, first event wins |

---

## Alternative Considered

**Database-based deduplication** (using a `processed_events` table) would persist across cold starts, but adds:
- Extra DB write per event
- More latency
- Cleanup complexity

The in-memory approach is simpler and sufficient since duplicate events arrive within milliseconds of each other.
