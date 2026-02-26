

# Dynamic Bolna Agent Dropdown

## Problem
The "Bolna Agent" dropdown in the Create Broadcast dialog is hardcoded with a single static option ("Workshop Reminder Agent"). It should fetch real agents from the Bolna API using the organization's configured credentials.

## Solution

### 1. New Edge Function: `list-bolna-agents`

Create `supabase/functions/list-bolna-agents/index.ts` that:
- Authenticates the user via the Authorization header
- Determines the user's organization
- Fetches Bolna credentials from `organization_integrations` (same pattern as `start-voice-campaign`)
- Calls `GET https://api.bolna.ai/v2/agent/all` with the org's API key
- Returns the list of agents (id + name)
- If no Bolna integration is configured, returns a clear error message

### 2. Update `CreateBroadcastDialog.tsx` (Step 2)

Replace the hardcoded `<Select>` with a dynamic dropdown:
- On mount (step 2), call the `list-bolna-agents` edge function via `supabase.functions.invoke`
- Show a loading spinner while fetching
- If no Bolna integration is configured, show an alert with a link to Settings > Integrations
- If agents are returned, populate the dropdown with real agent names and IDs
- Store the selected `bolna_agent_id` in component state and pass it through to `useCreateBroadcast`

### 3. Wire `bolna_agent_id` Through

The `CreateBroadcastDialog` currently doesn't pass `bolna_agent_id` to the mutation. Add state for the selected agent ID and include it in the `handleSubmit` call so it's saved on the `voice_campaigns` record.

## Technical Details

**Edge function request flow:**
```text
Frontend (auth token) --> list-bolna-agents --> organization_integrations (resolve API key) --> Bolna API --> return agents
```

**Bolna API response format** (expected):
```json
[
  { "id": "agent-uuid", "agent_name": "Swati - Workshop Reminder", ... },
  { "id": "agent-uuid-2", "agent_name": "Follow-up Agent", ... }
]
```

**Files to create:**
- `supabase/functions/list-bolna-agents/index.ts`

**Files to modify:**
- `src/pages/calling/CreateBroadcastDialog.tsx` — replace hardcoded agent select with dynamic fetch
- `supabase/config.toml` — add `[functions.list-bolna-agents]` entry

