

# Workshop Automation System + WhatsApp Group Integration

## Executive Summary

This plan details the implementation of a WhatsApp group messaging automation system integrated into your CRM. The system uses a **hybrid architecture** with the CRM handling UI/scheduling and a separate **VPS server running Baileys** for the WhatsApp connection.

---

## Technical Architecture Validation

### Why Baileys Cannot Run in Supabase Edge Functions

| Constraint | Edge Functions | Baileys Requirement |
|------------|----------------|---------------------|
| Runtime | Deno | Node.js |
| Execution time | Max 60 seconds | 24/7 persistent |
| File system | No local storage | Session credentials |
| Connection | Stateless HTTP | WebSocket (persistent) |

**Conclusion**: A separate VPS server is mandatory for Baileys integration.

---

## Confirmed Requirements

| Requirement | Decision |
|-------------|----------|
| Multiple WhatsApp accounts per org | Yes - Support multiple accounts |
| Group creation flow | Manual in WhatsApp app, then link via dropdown in CRM |
| Zoom integration | Skipped for now (future phase) |
| VPS down handling | Queue in database, retry when VPS comes back |
| Message templates | Editable per organization |

---

## Phase 1: Database Schema Changes

### New Tables

**1. `whatsapp_sessions`** - Store encrypted Baileys credentials (multi-account support)

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | Primary key |
| organization_id | uuid | FK to organizations |
| phone_number | text | Connected phone number |
| display_name | text | Friendly name ("Marketing WhatsApp") |
| session_data | jsonb | Encrypted Baileys credentials |
| status | text | connected, disconnected, qr_pending, connecting |
| qr_code | text | Base64 QR code (when pending) |
| qr_expires_at | timestamptz | QR expiration time |
| connected_at | timestamptz | When connection established |
| last_active_at | timestamptz | Last activity timestamp |

**2. `whatsapp_groups`** - Link groups to workshops

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | Primary key |
| organization_id | uuid | FK to organizations |
| session_id | uuid | FK to whatsapp_sessions |
| group_jid | text | WhatsApp group ID (e.g., "123456@g.us") |
| group_name | text | Human-readable name |
| invite_link | text | Group invite URL |
| workshop_id | uuid | FK to workshops (nullable) |
| participant_count | integer | Number of members |
| is_active | boolean | Is messaging enabled |
| synced_at | timestamptz | Last sync from WhatsApp |

**3. `scheduled_whatsapp_messages`** - Message queue

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | Primary key |
| organization_id | uuid | FK to organizations |
| group_id | uuid | FK to whatsapp_groups |
| workshop_id | uuid | FK to workshops |
| message_type | text | morning, 6hr_before, we_are_live, etc. |
| message_content | text | The message text |
| media_url | text | Optional image/video URL |
| scheduled_for | timestamptz | When to send |
| status | text | pending, sending, sent, failed, cancelled |
| sent_at | timestamptz | When message was sent |
| error_message | text | Error details if failed |
| retry_count | integer | Number of retry attempts |

**4. `whatsapp_message_templates`** - Reusable message templates

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | Primary key |
| organization_id | uuid | FK to organizations |
| name | text | Template name |
| content | text | Message with placeholders |
| media_url | text | Optional default media |
| is_default | boolean | Is this a system default |

**5. `workshop_automation_config`** - Org-level automation settings

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | Primary key |
| organization_id | uuid | FK to organizations (unique) |
| auto_schedule_messages | boolean | Auto-schedule when group linked |
| default_workshop_time | time | Default time (7 PM) |
| message_schedule | jsonb | Schedule times for each message type |

### Modifications to Existing `workshops` Table

Add columns:
- `whatsapp_group_id` (uuid, FK to whatsapp_groups)
- `automation_status` (jsonb) - Track automation state

---

## Phase 2: VPS Server Implementation

### Server Specifications

| Spec | Value |
|------|-------|
| Provider | Contabo / DigitalOcean / AWS EC2 |
| RAM | 1GB minimum |
| OS | Ubuntu 22.04 LTS |
| Runtime | Node.js 18+ |
| Process Manager | PM2 |
| Cost | ~$5-10/month |

### API Endpoints

```text
POST /api/auth/connect    - Start connection (returns QR)
GET  /api/auth/qr         - Get current QR code
GET  /api/auth/status     - Check connection status
POST /api/auth/disconnect - Disconnect session
POST /api/auth/logout     - Logout and clear session

GET  /api/groups          - List all WhatsApp groups
POST /api/groups          - Create new group
GET  /api/groups/:jid/invite - Get invite link

POST /api/send            - Send message to group
GET  /api/messages/:id    - Check delivery status

GET  /health              - Health check
```

### Core Baileys Service

The VPS will run a Node.js/Express server with:
- Baileys library for WhatsApp Web protocol
- Supabase client to read/write session data and messages
- PM2 for 24/7 process management
- node-cron for scheduled message processing
- API key authentication for all endpoints

### Security Measures

1. API key authentication on all endpoints
2. Session data encryption (AES-256-GCM)
3. Rate limiting (30 messages/min per group)
4. HTTPS via Let's Encrypt
5. IP whitelisting (optional)

---

## Phase 3: CRM Frontend Changes

### New Settings Page: WhatsApp Groups

Location: Settings > Integrations > WhatsApp Groups (new tab)

Features:
- Connect/disconnect WhatsApp accounts
- QR code display for linking
- Connection status indicator
- List of connected accounts with phone numbers
- Manage multiple accounts per organization

### Workshop Detail - New "WhatsApp" Tab

Features:
1. **Link Group Section**
   - Select WhatsApp account dropdown
   - Select group dropdown (fetched from WhatsApp)
   - Refresh groups button
   - Link/Unlink actions

2. **Linked Group Info**
   - Group name, participant count
   - Invite link with copy button
   - Direct link to open in WhatsApp

3. **Scheduled Messages Section**
   - List of scheduled messages with times and status
   - Status badges: Pending, Sending, Sent, Failed
   - Edit schedule button
   - Add custom message button
   - Cancel all button

### New Components to Create

| Component | Purpose |
|-----------|---------|
| `WhatsAppConnectionSettings.tsx` | QR scanner, connection management |
| `LinkWhatsAppGroupDialog.tsx` | Dropdown to link group to workshop |
| `ScheduledMessagesPanel.tsx` | View/manage scheduled messages |
| `WhatsAppGroupStatus.tsx` | Status badge for connection state |

---

## Phase 4: Integration Points

### 1. Edge Function: `proxy-whatsapp-vps`

New edge function to securely proxy requests to VPS:
- Reads VPS_URL and VPS_API_KEY from secrets
- Forwards requests to VPS with authentication
- Returns VPS responses to frontend

### 2. Edge Function: `process-whatsapp-queue` (Optional)

Cron job alternative if VPS scheduler fails:
- Runs every minute
- Checks for due messages
- Calls VPS /send endpoint

### 3. Modify `ingest-tagmango` (Future)

When workshop is created, optionally trigger:
- Auto-schedule default messages (if config enabled)
- Update automation_status JSONB

---

## Implementation Order

### Week 1: VPS + WhatsApp Service

| Day | Tasks |
|-----|-------|
| 1 | VPS setup, Node.js, PM2, firewall configuration |
| 2 | Baileys service (connect, QR, status endpoints) |
| 3 | Group management endpoints (list, create, invite) |
| 4 | Message sending with retry logic |
| 5 | Testing, error handling, logging |

### Week 2: Database + CRM Integration

| Day | Tasks |
|-----|-------|
| 1 | Database migrations (all new tables) |
| 2 | CRM: WhatsApp connection page (QR scanner) |
| 3 | CRM: Group management UI in workshop detail |
| 4 | CRM: Message scheduler UI |
| 5 | Integration testing with VPS |

### Week 3: Automation + Polish

| Day | Tasks |
|-----|-------|
| 1 | Edge function: proxy-whatsapp-vps |
| 2 | Message template management |
| 3 | Auto-schedule when group is linked |
| 4 | Error handling and notifications |
| 5 | End-to-end testing and documentation |

---

## Files to Create/Modify

### Database Migrations (SQL)

| File | Purpose |
|------|---------|
| Migration 1 | Create whatsapp_sessions table |
| Migration 2 | Create whatsapp_groups table |
| Migration 3 | Create scheduled_whatsapp_messages table |
| Migration 4 | Create whatsapp_message_templates table |
| Migration 5 | Create workshop_automation_config table |
| Migration 6 | Add columns to workshops table |
| Migration 7 | Create indexes and RLS policies |

### Frontend Components

| File | Purpose |
|------|---------|
| `src/components/whatsapp/WhatsAppConnectionSettings.tsx` | QR + connection UI |
| `src/components/whatsapp/LinkWhatsAppGroupDialog.tsx` | Group linking dialog |
| `src/components/whatsapp/ScheduledMessagesPanel.tsx` | Message scheduler |
| `src/components/whatsapp/WhatsAppGroupStatus.tsx` | Status badge |
| `src/hooks/useWhatsAppConnection.ts` | Hook for WA connection state |
| `src/hooks/useWhatsAppGroups.ts` | Hook for group management |

### Pages to Modify

| File | Change |
|------|--------|
| `src/pages/OrganizationSettings.tsx` | Add "WhatsApp Groups" tab |
| `src/pages/Workshops.tsx` | Add WhatsApp tab to workshop details |

### Edge Functions

| File | Purpose |
|------|---------|
| `supabase/functions/proxy-whatsapp-vps/index.ts` | Proxy to VPS |

### VPS Server (Separate Repository)

| File | Purpose |
|------|---------|
| `src/index.ts` | Express server entry |
| `src/services/baileys.ts` | Baileys wrapper |
| `src/services/scheduler.ts` | Cron job for messages |
| `src/routes/auth.ts` | Auth endpoints |
| `src/routes/groups.ts` | Group endpoints |
| `src/routes/messages.ts` | Message endpoints |
| `src/middleware/api-key.ts` | Authentication |
| `ecosystem.config.js` | PM2 configuration |

---

## Secrets Required

### Supabase Secrets (CRM Side)

| Secret Name | Purpose |
|-------------|---------|
| VPS_URL | URL to your VPS (https://your-vps.com) |
| VPS_API_KEY | API key for VPS authentication |

### VPS Environment Variables

| Variable | Purpose |
|----------|---------|
| PORT | Server port (3000) |
| API_KEY | API key for authentication |
| SUPABASE_URL | Supabase project URL |
| SUPABASE_SERVICE_KEY | Service role key for DB access |
| ENCRYPTION_KEY | 32-byte key for session encryption |

---

## RLS Policies

All new tables will have RLS policies following the existing pattern:
- Super admins: Full access
- Org admins: CRUD within their organization
- Regular users: View only within their organization
- Organization ID filtering on all queries

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| WhatsApp account ban | Use dedicated business number, rate limit messages |
| VPS downtime | Messages queued in DB, retry on reconnect |
| Session expiration | Auto-reconnect logic, notify admin if QR needed |
| Message delivery failure | Retry up to 3 times, mark as failed with error |

---

## Estimated Total Effort

| Component | Days |
|-----------|------|
| VPS Setup + Baileys Server | 5 |
| Database Migrations | 1 |
| CRM UI Components | 4 |
| Edge Function (proxy) | 1 |
| Integration Testing | 2 |
| Documentation | 1 |
| **Total** | **14 days** |

---

## Next Steps After Approval

1. Create database migrations for all new tables
2. Provide complete VPS server code (Node.js/Baileys)
3. Build CRM UI components
4. Create edge function for VPS proxy
5. Integration testing
6. Documentation and handoff

