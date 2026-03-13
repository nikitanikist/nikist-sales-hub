
## VoBiz IVR Voice Campaign System — IMPLEMENTED

### What was built

**Database (Migration):**
- `ivr_campaigns` table — campaign config, audio URLs, speech detection, VoBiz settings, counters, retry config
- `ivr_campaign_calls` table — individual call records with speech transcript, WhatsApp tracking, retry tracking
- `ivr_audio_library` table — reusable pre-recorded audio clips
- 3 atomic RPC functions: `increment_ivr_campaign_counter`, `add_ivr_campaign_cost`, `transition_ivr_call`
- RLS policies using `get_user_organization_ids()` on all tables
- Realtime enabled on `ivr_campaigns` and `ivr_campaign_calls`
- `ivr-audio` storage bucket (public)

**Edge Functions (6 new):**
- `ivr-call-answer` — VoBiz Answer URL, returns XML with Play + Gather (speech recognition)
- `ivr-call-response` — VoBiz Action URL, keyword matching, AiSensy WhatsApp trigger
- `ivr-call-hangup` — VoBiz Hangup URL, duration/cost tracking, retry logic
- `start-ivr-campaign` — JWT auth, starts campaign, queues calls
- `stop-ivr-campaign` — JWT auth, cancels campaign and pending calls
- `process-ivr-queue` — Cron processor, fires VoBiz Make Call API, respects CPS limits

**Cron Job:**
- `process-ivr-queue-every-30s` — pg_cron firing every minute (pg_cron minimum interval)

**Frontend:**
- `src/types/ivr-campaign.ts` — TypeScript interfaces
- `src/hooks/useIvrCampaigns.ts` — Query hook for campaigns list
- `src/hooks/useIvrCampaignDetail.ts` — Query hook for single campaign + calls
- `src/hooks/useIvrCampaignRealtime.ts` — Realtime subscription
- `src/pages/ivr/IvrDashboard.tsx` — Overview stats
- `src/pages/ivr/IvrCampaigns.tsx` — Campaign list + create button
- `src/pages/ivr/IvrCampaignDetail.tsx` — Stats cards, progress bar, calls table, realtime
- `src/pages/ivr/IvrAudioLibrary.tsx` — Upload/manage audio clips
- `src/pages/ivr/CreateIvrCampaignDialog.tsx` — Multi-step creation dialog

**Routes (App.tsx):**
- `/ivr/dashboard`, `/ivr/campaigns`, `/ivr/campaigns/:campaignId`, `/ivr/audio-library`

**Sidebar (AppLayout.tsx):**
- Added under "Calling" group: IVR Dashboard, IVR Campaigns, Audio Library

### Remaining setup
- Add VoBiz integration to `organization_integrations` table with `integration_type: 'vobiz'` and config containing `auth_id`, `auth_token`, `from_number`
- Upload pre-recorded audio clips to Audio Library

---

## Fix: Batch Start Date + Notes — IMPLEMENTED

### Problem
- Batch create/edit dialogs only saved `event_dates` (free text) — `start_date` column was never populated
- Pabbly webhook sent empty `batch_start_date` for converted calls → AISensy confirmation message failed
- No "Notes" field on batches for storing extra info

### What was done

**Database:**
- Added `notes` text column to `cohort_batches`
- Backfilled 3 Insider Crypto Club batches with correct `start_date` values (Batch 4→2026-02-16, Batch 5→2026-03-11, Batch 6→2026-03-24)

**CohortPage.tsx:**
- Added Start Date picker (Shadcn Calendar/Popover) to Create & Edit batch dialogs
- Added Notes textarea to Create & Edit batch dialogs
- Updated `createBatchMutation` and `updateBatchMutation` to persist `start_date` and `notes`
- Added useEffect to pre-populate edit form fields
- Notes displayed on batch cards (amber text) and batch detail header

**CloserAssignedCalls.tsx:**
- Updated batch join to fetch `event_dates` as fallback
- Webhook payload: `batch_start_date: batch?.start_date || batch?.event_dates || ''`
