

# Simplify IVR System — Voice Broadcast (Play Audio Only)

## What You Want
A simple voice broadcast system: upload audio, upload CSV, call everyone, play the audio, hang up. No speech detection, no response gathering, no WhatsApp sending. Just a clean broadcast.

## New Flow
1. Go to Audio Library, upload audio clip
2. Go to IVR Campaigns, click "New Campaign"
3. **Step 1**: Enter campaign name
4. **Step 2**: Select ONE audio clip (from entire library, no type filtering) + Upload CSV
5. **Step 3**: Review contacts + Create/Run campaign
6. Backend: Call each number → Play audio → Hang up. Done.

## Changes

### Frontend

**`src/pages/ivr/CreateIvrCampaignDialog.tsx`** — Rebuild as 3-step flow:
- Step 1: Campaign name (keep as-is)
- Step 2: Single audio select (all clips, no type filter) + CSV upload (merged into one step)
- Step 3: Review contact count + confirm. Single "Create & Run" button
- Remove: thankyou/not_interested audio selects, WhatsApp template config, from number input
- Campaign insert: set `on_yes_action: "none"`, only `audio_opening_url` matters, set others to empty/null

**`src/pages/ivr/IvrCampaignDetail.tsx`** — Simplify stats:
- Remove: Interested, Not Interested, No Response, WhatsApp Sent cards
- Keep: Total Contacts, Answered, No Answer, Failed, Cost
- Table: Remove Speech and WhatsApp columns, keep Name, Phone, Status, Duration

**`src/pages/ivr/IvrCampaigns.tsx`** — Simplify table:
- Replace "Interested" column with "Answered"
- Keep: Name, Status, Contacts, Answered, No Answer, Cost, Created, Actions

**`src/pages/ivr/IvrDashboard.tsx`** — Change "Total Interested" to "Total Answered"

**`src/pages/ivr/IvrAudioLibrary.tsx`** — Remove audio type categorization:
- Remove the Type select dropdown from upload dialog
- Remove type badges from cards
- Default audio_type to "opening" on insert (backward compat)

### Backend

**`supabase/functions/ivr-call-answer/index.ts`** — Simplify to play-and-hangup:
- Remove all Gather elements and speech recognition logic
- Just: update status to answered, increment counter, return `<Response><Play>audio_url</Play><Hangup/></Response>`
- Keep voicemail detection as-is

**`supabase/functions/ivr-call-response/index.ts`** — No longer needed for new campaigns but keep for backward compat. No changes required (it simply won't be called since there's no Gather).

**`process-ivr-queue/index.ts`** — No changes needed, it just initiates calls.

### No DB Changes
The existing `ivr_campaigns` table already has all needed columns. We just stop using the speech/response ones. No migration needed.

## Files Changed
- `src/pages/ivr/CreateIvrCampaignDialog.tsx` — 3-step simplified flow
- `src/pages/ivr/IvrCampaignDetail.tsx` — Remove speech/WhatsApp stats and columns
- `src/pages/ivr/IvrCampaigns.tsx` — Replace "Interested" with "Answered"
- `src/pages/ivr/IvrDashboard.tsx` — "Total Answered" instead of "Total Interested"
- `src/pages/ivr/IvrAudioLibrary.tsx` — Remove audio type categorization
- `supabase/functions/ivr-call-answer/index.ts` — Play audio + hangup only

