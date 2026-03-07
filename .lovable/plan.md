

# VoBiz IVR Voice Campaign System — Implementation Plan

This is a large feature that adds an ultra-low-cost bulk voice campaign system using VoBiz XML API with speech recognition. It integrates alongside the existing Bolna AI Calling module.

## Scope Summary

- **3 new database tables** + 3 atomic RPC functions
- **6 new edge functions** (5 webhook handlers + 1 cron processor)
- **4 new frontend pages** + 1 dialog + 3 hooks
- **1 new storage bucket** for audio files
- **Sidebar navigation** update
- **Route registration** in App.tsx

---

## Phase 1: Database Schema + Storage

**Migration SQL** — create tables, RLS policies, indexes, realtime, and RPC functions:

1. `ivr_campaigns` — campaign config (audio URLs, speech detection config, VoBiz settings, counters, retry config, optional workshop/webinar link)
2. `ivr_campaign_calls` — individual call records (contact info, VoBiz data, speech transcript, WhatsApp action tracking, retry tracking)
3. `ivr_audio_library` — reusable pre-recorded audio clips

RLS follows existing pattern using `get_user_organization_ids()`. Realtime enabled on both campaign tables.

3 atomic RPC functions:
- `increment_ivr_campaign_counter` — same pattern as existing `increment_campaign_counter`
- `add_ivr_campaign_cost` — atomic cost + duration update
- `transition_ivr_call` — atomic status transition preventing double-processing

**Storage bucket**: `ivr-audio` (public, so VoBiz can access audio URLs)

---

## Phase 2: Edge Functions — Webhook Handlers

### `ivr-call-answer` (Answer URL)
- VoBiz POSTs when call is answered
- Extracts `call_id` from query params
- Detects voicemail via `MachineDetection` → returns `<Hangup/>` XML
- Looks up campaign for audio URLs and speech config
- Returns XML: `<Play>` opening audio + `<Gather inputType="speech">` with language/hints from campaign config
- Includes fallback: repeat audio + second Gather, then goodbye + Hangup

### `ivr-call-response` (Action URL — after speech captured)
- Receives `Speech`, `SpeechConfidenceScore`, `InputType` from VoBiz
- Keyword matching against campaign's `positive_keywords` / `negative_keywords`
- If interested + `on_yes_action = 'send_whatsapp'`: fires AiSensy API (same credential resolution as existing system)
- Updates call via `transition_ivr_call` RPC
- Increments campaign counters
- Returns appropriate XML (thankyou/not_interested/retry audio)

### `ivr-call-hangup` (Hangup URL)
- Receives `Duration`, `HangupCause`, `CallStatus`
- Maps hangup cause to call status (NO_ANSWER, USER_BUSY, etc.)
- Updates call via RPC with duration and cost
- Handles retry logic: if no_answer + retries enabled → queues for retry
- Checks if all calls terminal → marks campaign completed

All three functions: `verify_jwt = false` in config.toml (VoBiz webhooks, no JWT).

---

## Phase 3: Edge Functions — Campaign Control

### `start-ivr-campaign`
- Auth: Supabase JWT
- Validates campaign is in draft/scheduled
- Updates status to `running`, sets `started_at`
- Marks all pending calls as `queued`

### `stop-ivr-campaign`
- Auth: Supabase JWT
- Updates campaign to `cancelled`
- Marks pending/queued calls as `cancelled`

### `process-ivr-queue` (Cron — every 30 seconds)
- Finds running campaigns
- Picks queued calls (batch based on `calls_per_second`)
- Fires VoBiz Make Call API for each with answer_url, hangup_url
- Stores `vobiz_call_uuid`, updates status to `initiated`
- Handles retry-eligible calls (no_answer + retry_count < max + next_retry_at <= now)
- Resolves VoBiz credentials from `organization_integrations` (integration_type = 'vobiz')

**Cron setup**: pg_cron + pg_net schedule hitting `process-ivr-queue` every 30 seconds.

---

## Phase 4: Frontend

### New Files

| File | Purpose |
|------|---------|
| `src/pages/ivr/IvrDashboard.tsx` | Overview stats + recent campaigns |
| `src/pages/ivr/IvrCampaigns.tsx` | Campaign list table + create button |
| `src/pages/ivr/IvrCampaignDetail.tsx` | Stats cards, progress bar, calls table, realtime |
| `src/pages/ivr/IvrAudioLibrary.tsx` | Upload/manage audio clips |
| `src/pages/ivr/CreateIvrCampaignDialog.tsx` | Multi-step: name → audio → contacts (CSV) → WhatsApp action → schedule |
| `src/pages/ivr/components/index.tsx` | Shared components (status badges, formatters) |
| `src/hooks/useIvrCampaigns.ts` | Query hook for campaigns list |
| `src/hooks/useIvrCampaignDetail.ts` | Query hook for single campaign + calls |
| `src/hooks/useIvrCampaignRealtime.ts` | Realtime subscription (same pattern as existing `useVoiceCampaignRealtime`) |
| `src/types/ivr-campaign.ts` | TypeScript interfaces |

### Route Registration (`App.tsx`)
```
/ivr/dashboard     → IvrDashboard
/ivr/campaigns     → IvrCampaigns
/ivr/campaigns/:id → IvrCampaignDetail
/ivr/audio-library → IvrAudioLibrary
```

### Sidebar (`AppLayout.tsx`)
Add "IVR Campaigns" group under existing "Calling" section:
```
Calling
├── Dashboard (existing Bolna)
├── Campaigns (existing Bolna)
├── IVR Dashboard (new)
├── IVR Campaigns (new)
└── Audio Library (new)
```

---

## Phase 5: VoBiz Credentials

Store in `organization_integrations` table (same pattern as Bolna/AiSensy):
```json
{
  "integration_type": "vobiz",
  "config": {
    "auth_id": "MA_YOCMGHO8",
    "auth_token": "xxx",
    "from_number": "+917971543257",
    "cps_limit": 11,
    "concurrent_limit": 13
  }
}
```

The VoBiz auth token will need to be provided as a secret initially. I'll prompt you for the `VOBIZ_AUTH_TOKEN` when we reach the edge function implementation step — or we store it fully in `organization_integrations.config` (matching Bolna pattern, no env secret needed).

---

## Build Order

1. **Database migration** — all 3 tables + 3 RPCs + storage bucket + realtime
2. **TypeScript types** — `src/types/ivr-campaign.ts`
3. **Edge functions** — ivr-call-answer, ivr-call-response, ivr-call-hangup (webhook handlers first, testable independently)
4. **Edge functions** — start-ivr-campaign, stop-ivr-campaign, process-ivr-queue
5. **Cron job** — pg_cron schedule for process-ivr-queue
6. **Frontend hooks** — useIvrCampaigns, useIvrCampaignDetail, useIvrCampaignRealtime
7. **Frontend pages** — IvrCampaigns (list + create dialog), IvrCampaignDetail, IvrDashboard, IvrAudioLibrary
8. **Routes + Sidebar** — App.tsx routes, AppLayout.tsx navigation
9. **config.toml** — verify_jwt = false for webhook functions

This will be implemented across multiple messages due to the volume of code. I'll start with the database migration and types, then move through edge functions, and finish with the frontend.

