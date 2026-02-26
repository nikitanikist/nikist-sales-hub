
# Fix: Bolna Rejects JavaScript ISO Date Format

## Problem
Bolna's API (Python-based) returns: `Invalid isoformat string: '2026-02-26T12:21:46.408Z'`

Python's `datetime.fromisoformat()` does not accept the `Z` suffix or milliseconds that JavaScript's `.toISOString()` produces. It expects `+00:00` instead of `Z`.

## Fix (1 file, 1 line)

**`supabase/functions/start-voice-campaign/index.ts`** — line 122:

Replace:
```
const scheduleTime = campaign.scheduled_at || new Date(Date.now() + 150000).toISOString();
```

With:
```
const rawTime = campaign.scheduled_at || new Date(Date.now() + 150000).toISOString();
const scheduleTime = rawTime.replace(/\.\d{3}Z$/, '+00:00').replace(/Z$/, '+00:00');
```

This converts `2026-02-26T12:21:46.408Z` to `2026-02-26T12:21:46+00:00`, which Python's `fromisoformat()` accepts.
