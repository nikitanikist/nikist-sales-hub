

# Reduce IVR Audio Delay — Optimize `ivr-call-answer` Response Time

## The Problem

When VoBiz calls the `ivr-call-answer` webhook, it waits for the XML response before playing audio. Currently the function runs **4 sequential database calls** before returning XML:

1. Update call status to "answered"
2. Check voicemail detection + update
3. Fetch call record (get campaign_id)
4. Fetch campaign (get audio_url)
5. Increment counter

Each DB round-trip adds ~500ms-1s. That's **3-5 seconds of dead air** before the person hears anything.

## The Fix

Restructure to return XML as fast as possible:

1. **Single query with join** — Fetch call + campaign audio URL in one query instead of two
2. **Fire-and-forget** — Move status updates and counter increments to run AFTER the response is returned (non-blocking)
3. **Pre-fetch audio URL in process-ivr-queue** — Store the audio URL directly on the call record when creating it, so `ivr-call-answer` doesn't need to look up the campaign at all

### Optimized Flow
```text
Before (5 DB calls, sequential):
  VoBiz → update status → check voicemail → fetch call → fetch campaign → increment → return XML
  ~3-5 seconds

After (1 DB call, rest fire-and-forget):
  VoBiz → fetch call+audio_url (single join) → return XML immediately
           └── async: update status + increment counter
  ~0.5-1 second
```

## Files Changed

**`supabase/functions/ivr-call-answer/index.ts`**
- Replace two separate queries (call record + campaign) with a single query: `ivr_campaign_calls.select("campaign_id, ivr_campaigns(audio_opening_url)")` 
- Return the XML response immediately after getting the audio URL
- Move status update ("answered") and counter increment into a non-blocking `Promise` that runs after `return`
- Keep voicemail detection before the response (it needs to return `<Hangup/>` instead)

**`supabase/functions/process-ivr-queue/index.ts`** — No changes needed

