

# WhatsApp Baileys VPS Integration - Implementation Plan

Your WhatsApp service is now running on the VPS (`72.61.251.65:3000`). This plan covers integrating it with your CRM to enable:
- WhatsApp device connection from Settings
- Syncing WhatsApp groups with workshops
- Sending scheduled messages to workshop groups

---

## Architecture Overview

```text
+------------------+       +-------------------+       +------------------+
|   CRM Frontend   |  -->  |  Edge Function    |  -->  |  VPS Baileys     |
|   (React)        |       |  (vps-whatsapp-   |       |  (72.61.251.65)  |
|                  |       |   proxy)          |       |                  |
+------------------+       +-------------------+       +------------------+
        |                          |                           |
        |    Uses supabase         |    HTTP with API Key      |
        v                          v                           v
+------------------------------------------------------------------+
|                     Supabase Database                            |
|  - whatsapp_sessions (connection state, QR codes)                |
|  - whatsapp_groups (synced groups per workshop)                  |
|  - scheduled_whatsapp_messages (message queue)                   |
|  - workshop_automation_config (org-level settings)               |
+------------------------------------------------------------------+
```

---

## Phase 1: Backend Secrets Configuration

**What**: Store VPS connection details as Supabase secrets for secure access from edge functions.

**Secrets to add**:
- `WHATSAPP_VPS_URL` = `http://72.61.251.65:3000`
- `WHATSAPP_VPS_API_KEY` = The API key you set on the VPS (`nikist-whatsapp-2025` or custom)

---

## Phase 2: Edge Function - VPS Proxy

**What**: Create a Supabase Edge Function that securely proxies requests from the CRM to the VPS.

**File**: `supabase/functions/vps-whatsapp-proxy/index.ts`

**Endpoints**:
| CRM Action | Edge Function Route | VPS Endpoint |
|------------|---------------------|--------------|
| Connect device | POST `/connect` | POST `/connect` |
| Check status | GET `/status/:sessionId` | GET `/status/:sessionId` |
| Get QR code | GET `/qr/:sessionId` | GET `/qr/:sessionId` |
| Disconnect | POST `/disconnect/:sessionId` | POST `/disconnect/:sessionId` |
| Sync groups | POST `/groups/sync` | POST `/groups/sync/:sessionId` |
| Send message | POST `/send` | POST `/send` |

**Security**:
- Requires authenticated user (Supabase JWT)
- Validates organization access
- Proxies request with VPS API key from secrets

---

## Phase 3: WhatsApp Connection Page

**What**: Add a new settings page for connecting WhatsApp devices.

**File**: `src/pages/settings/WhatsAppConnection.tsx`

**Features**:
1. **Session List**: Show all connected WhatsApp sessions for the organization
2. **Connect New Device**:
   - Generate QR code via VPS
   - Display QR for scanning
   - Poll for connection status
   - Save session to `whatsapp_sessions` table
3. **Session Status**: Show connected/disconnected state with last active time
4. **Disconnect**: Allow removing a session
5. **Sync Groups**: Trigger group sync from connected device

---

## Phase 4: Workshop WhatsApp Tab

**What**: Add a "WhatsApp" tab to each workshop row for messaging workshop participants.

**File**: Modify `src/pages/Workshops.tsx`

**UI Components**:
1. **Expand workshop row** --> Shows new "WhatsApp" tab alongside existing tabs
2. **Tab content**:
   - **Linked Group**: Select/create WhatsApp group for this workshop
   - **Scheduled Messages**: List of upcoming messages with status
   - **Quick Send**: Send immediate message to group
   - **Message Templates**: Select from org templates or custom message

---

## Phase 5: Message Scheduling System

**What**: Implement automated message scheduling based on workshop dates.

**Database**: Uses existing tables:
- `scheduled_whatsapp_messages` - Message queue
- `workshop_automation_config` - Schedule settings per org

**Edge Function**: `supabase/functions/process-whatsapp-queue/index.ts`
- Runs on cron (every minute) via Supabase scheduled functions
- Fetches pending messages where `scheduled_for <= now()`
- Calls VPS `/send` endpoint for each message
- Updates status to `sent` or `failed`

**Automation Logic**:
- When workshop created/updated, auto-generate scheduled messages based on `workshop_automation_config.message_schedule`
- Default schedule: morning reminder, 6hr before, 1hr before, 30min before, "we are live"

---

## Files to Create/Modify

### New Files:
1. `supabase/functions/vps-whatsapp-proxy/index.ts` - Edge function proxy
2. `supabase/functions/process-whatsapp-queue/index.ts` - Message queue processor
3. `src/pages/settings/WhatsAppConnection.tsx` - Connection management page
4. `src/components/workshops/WorkshopWhatsAppTab.tsx` - Workshop messaging UI
5. `src/hooks/useWhatsAppSession.ts` - Session management hook
6. `src/hooks/useWhatsAppGroups.ts` - Group sync hook

### Modified Files:
1. `src/pages/Workshops.tsx` - Add WhatsApp tab to expanded rows
2. `src/pages/settings/index.ts` - Export new settings page
3. `src/App.tsx` - Add route for WhatsApp settings

---

## Implementation Order

1. **Add VPS secrets** (2 min) - Store VPS URL and API key
2. **Create proxy edge function** (15 min) - Secure VPS communication
3. **Build connection page** (30 min) - QR code scanning, session management
4. **Add workshop WhatsApp tab** (25 min) - Group linking, message scheduling
5. **Create queue processor** (15 min) - Automated message sending

---

## Technical Notes

- **Polling**: QR code and status use 3-second polling intervals
- **Timeouts**: VPS requests timeout after 30 seconds
- **Error handling**: Failed messages retry up to 3 times
- **Multi-org**: All data isolated by `organization_id`
- **Realtime**: Connection status updates via Supabase realtime subscriptions

