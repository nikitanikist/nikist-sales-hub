

# WhatsApp VPS Integration - Continue Implementation

The VPS secrets still need to be added, and then we'll build the complete integration.

---

## Step 1: Add VPS Secrets

Add two secrets required for edge function communication with your VPS:

| Secret Name | Value |
|-------------|-------|
| `WHATSAPP_VPS_URL` | `http://72.61.251.65:3000` |
| `WHATSAPP_VPS_API_KEY` | `nikist-whatsapp-2025` |

---

## Step 2: Create VPS Proxy Edge Function

**File**: `supabase/functions/vps-whatsapp-proxy/index.ts`

Creates a secure bridge between your CRM and the VPS WhatsApp service:
- Validates user authentication (Supabase JWT)
- Proxies requests with the API key from secrets
- Handles: connect, status, QR code, disconnect, sync groups, send message

---

## Step 3: Build WhatsApp Connection Page

**File**: `src/pages/settings/WhatsAppConnection.tsx`

Settings page for connecting WhatsApp devices:
- Display connected sessions for the organization
- QR code scanning to connect new device
- Status polling (every 3 seconds during connection)
- Disconnect session button
- Sync groups button

**Route**: Add `/settings/whatsapp` route in `App.tsx`

---

## Step 4: Create Supporting Hooks

**Files**:
- `src/hooks/useWhatsAppSession.ts` - Session management (connect, status, disconnect)
- `src/hooks/useWhatsAppGroups.ts` - Group sync and management

---

## Step 5: Add Workshop WhatsApp Tab

**File**: `src/components/workshops/WorkshopWhatsAppTab.tsx`

Add messaging capabilities to workshop management:
- Link WhatsApp group to workshop
- View scheduled messages
- Send immediate message to group
- Use message templates

**Modify**: `src/pages/Workshops.tsx` to include new tab

---

## Step 6: Create Message Queue Processor

**File**: `supabase/functions/process-whatsapp-queue/index.ts`

Automated message sending:
- Process pending messages from `scheduled_whatsapp_messages`
- Send via VPS `/send` endpoint
- Update status (sent/failed)
- Retry logic for failed messages

---

## Technical Details

**New Files (6)**:
1. `supabase/functions/vps-whatsapp-proxy/index.ts`
2. `supabase/functions/process-whatsapp-queue/index.ts`
3. `src/pages/settings/WhatsAppConnection.tsx`
4. `src/components/workshops/WorkshopWhatsAppTab.tsx`
5. `src/hooks/useWhatsAppSession.ts`
6. `src/hooks/useWhatsAppGroups.ts`

**Modified Files (3)**:
1. `src/App.tsx` - Add WhatsApp settings route
2. `src/pages/settings/index.ts` - Export new page
3. `src/pages/Workshops.tsx` - Add WhatsApp tab

