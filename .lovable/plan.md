

# WhatsApp Disconnection UX Improvements

## What We're Building

Three changes to improve the experience when a WhatsApp session drops:

### 1. Dashboard Disconnection Banner

When a user lands on the WhatsApp Dashboard and their session(s) are disconnected, show a prominent error banner at the top (before the stats cards) with:
- A warning icon and message: "Your WhatsApp account (916290859215) is disconnected"
- A "Go to Settings" button that navigates to the Settings page where they can reconnect

Currently, the dashboard only checks for `connectedSessions.length === 0` and shows a generic empty state. We need to also detect sessions that exist but are disconnected and show the banner instead of (or alongside) the empty state.

### 2. Replace "Sync Groups" with "Reconnect" for Disconnected Sessions (Settings Page)

On the WhatsApp Connection settings card, when a session shows "Disconnected -- Reconnect needed":
- Hide the "Sync Groups" button (syncing a disconnected session makes no sense)
- Show a "Reconnect" button instead that opens the QR code dialog, pre-targeting that specific session ID

### 3. Silent VPS Error Toasts During Verification

Add a `silent` option to `callVPSProxy` so that automatic session verification on page load does not trigger the "VPS Endpoint Not Found (404)" toast. The verification logic already handles the error gracefully by updating the DB.

## Technical Details

**File: `src/pages/whatsapp/WhatsAppDashboard.tsx`**
- Track ALL sessions (not just connected) and disconnected sessions separately
- After the loading skeleton check (line 56), before the `connectedSessions.length === 0` empty state, add a new condition: if there are disconnected sessions, show an Alert banner with the phone number and a "Go to Settings" button
- Adjust the empty state logic so the dashboard still renders stats/groups if there are connected sessions, even if some are disconnected

**File: `src/pages/settings/WhatsAppConnection.tsx`**
- In the connected sessions list (lines 311-384), when `isVpsDisconnected` is true for a session:
  - Replace the "Sync Groups" button with a "Reconnect" button
  - The Reconnect button calls `connect()` (or a new reconnect function) and opens the QR dialog, targeting the existing session
- Keep the "Disconnect" button visible so users can still fully remove the session

**File: `src/hooks/useWhatsAppSession.ts`**
- Modify `callVPSProxy` (line 305) to accept an optional third parameter `options?: { silent?: boolean }`
- When `silent` is true, skip the `toast.error()` calls at lines 324 and 333, but still throw the error for callers to handle
- Update the verification `useEffect` (line 483) to call `callVPSProxy('status', { sessionId }, { silent: true })`
- Update `refreshSession` (line 531) to also use `{ silent: true }`

