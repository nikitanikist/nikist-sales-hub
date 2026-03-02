

## Plan: Build "Calling Agent" Module Under Operations

A completely separate module from the existing Calling module, accessible under the Operations sidebar group. This module will have its own database tables, pages, and edge function webhook.

---

### 1. Database: New Tables

**Table: `calling_agent_campaigns`**
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| organization_id | uuid | FK to organizations |
| created_by | uuid | FK to profiles |
| name | text | Campaign name |
| bolna_agent_id | text | Selected Bolna agent |
| bolna_agent_name | text | Agent display name |
| bolna_batch_id | text | Returned from Bolna |
| status | text | draft, running, scheduled, completed, failed |
| scheduled_at | timestamptz | Optional schedule time |
| total_contacts | integer | |
| calls_completed | integer | |
| total_cost | numeric | |
| started_at | timestamptz | |
| completed_at | timestamptz | |
| created_at / updated_at | timestamptz | |

**Table: `calling_agent_calls`**
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| campaign_id | uuid | FK to calling_agent_campaigns |
| organization_id | uuid | |
| contact_name | text | |
| contact_phone | text | |
| status | text | pending, queued, ringing, in-progress, completed, etc. |
| outcome | text | Agent-specific outcome (nullable) |
| bolna_call_id | text | |
| call_duration_seconds | integer | |
| total_cost | numeric | |
| transcript | text | Full conversation |
| summary | text | AI-generated call summary from Bolna |
| recording_url | text | |
| extracted_data | jsonb | Agent-specific structured output |
| context_details | jsonb | Input context sent to agent |
| call_started_at / call_ended_at | timestamptz | |
| created_at / updated_at | timestamptz | |

RLS policies: org-scoped read/write for authenticated users via `user_belongs_to_org`.
Enable realtime on both tables.

---

### 2. Frontend Pages (4 new pages)

**A. Calling Agent Dashboard** (`/operations/calling-agent`)
- Summary cards: Total Agents (fetched from Bolna API), Total Campaigns, Active Campaigns, Completed, Total Calls, Total Cost
- Recent campaigns table (click to view detail)
- "Start Calling Agent" button opens the creation dialog

**B. Calling Agent Campaigns List** (`/operations/calling-agent/campaigns`)
- Filterable table of all campaigns (All / Running / Completed / Failed tabs)
- Actions: View, Retry, Stop

**C. Calling Agent Campaign Detail** (`/operations/calling-agent/campaigns/:id`)
- Analytics cards: Total Contacts, Calls Completed, Total Cost, Avg Duration
- Progress bar
- Calls table with columns: Name, Phone, Status, Outcome, Duration, Cost, Summary (eye icon), Transcript (eye icon), Extracted Data (eye icon)
- Realtime updates

**D. Call Detail Dialog (inline)**
- When clicking a call row or summary icon, shows:
  - AI Summary of the call
  - Extracted Data (parsed and displayed as key-value cards)
  - Full Transcript (chat-style bubble view)
  - Recording URL (play button)

---

### 3. Create Campaign Dialog (multi-step)

- **Step 1**: Select AI Agent (dropdown fetched from Bolna via `list-bolna-agents`)
- **Step 2**: Upload CSV with contact data. Preview parsed contacts with validation.
- **Step 3**: Campaign name, review contacts count, choose "Run Now" or "Schedule"

---

### 4. Edge Function: `calling-agent-webhook`

A new webhook endpoint that receives post-call data from Bolna for this module. Key differences from the existing `bolna-webhook`:
- Writes to `calling_agent_calls` table (not `voice_campaign_calls`)
- Stores `summary` field from Bolna response
- Stores full `extracted_data` (agent-specific outputs)
- Stores `context_details` from `body.context_details`
- Uses the same atomic `transition_call_to_terminal`-style logic but on the new table

You will need to add this webhook URL as a tool endpoint in your Bolna agent configuration.

---

### 5. Edge Function: `start-calling-agent-campaign`

Similar to `start-voice-campaign` but operates on the new `calling_agent_campaigns` / `calling_agent_calls` tables.

---

### 6. Sidebar and Routing

- Add "Calling Agent" as a child under the **Operations** sidebar group
- Permission key: `operations`
- Routes:
  - `/operations/calling-agent` -- Dashboard
  - `/operations/calling-agent/campaigns` -- Campaigns list
  - `/operations/calling-agent/campaigns/:id` -- Campaign detail

---

### 7. Files to Create/Modify

| Action | File |
|---|---|
| Create | `src/pages/calling-agent/CallingAgentDashboard.tsx` |
| Create | `src/pages/calling-agent/CallingAgentCampaigns.tsx` |
| Create | `src/pages/calling-agent/CallingAgentDetail.tsx` |
| Create | `src/pages/calling-agent/CreateAgentCampaignDialog.tsx` |
| Create | `src/pages/calling-agent/components/CallDetailDialog.tsx` |
| Create | `src/pages/calling-agent/components/AgentCallsTable.tsx` |
| Create | `src/pages/calling-agent/components/index.tsx` |
| Create | `src/hooks/useCallingAgentCampaigns.ts` |
| Create | `src/hooks/useCallingAgentDetail.ts` |
| Create | `supabase/functions/calling-agent-webhook/index.ts` |
| Create | `supabase/functions/start-calling-agent-campaign/index.ts` |
| Modify | `src/App.tsx` -- add 3 new routes |
| Modify | `src/components/AppLayout.tsx` -- add "Calling Agent" to Operations children |
| Migration | Create 2 tables + RLS + realtime |

---

### 8. Webhook URL for Bolna

After deployment, the webhook URL will be:
```
https://<project-id>.supabase.co/functions/v1/calling-agent-webhook
```
You will add this URL in your Bolna agent's tool/webhook configuration so it sends post-call data back to the system.

