

# Fix: Proxy Config Save & Auto-Apply on Connect

## Problem
The proxy fields are ephemeral state — there's no "Save" button, and when you click "Connect Another WhatsApp," the proxy config isn't being applied because the `connect()` function may not be wiring it through correctly. The user wants:
1. A **Save** button so proxy details persist at the org level
2. Saved proxy auto-applied to every new connection

## Approach
Store the proxy config at the **organization level** (not per-session), so once saved, every new WhatsApp connection for that org automatically routes through the proxy.

### Database
- Add `default_proxy_config JSONB DEFAULT NULL` column to `organizations` table (or `organization_settings` if that exists — needs verification, but organizations is the safe bet)

### Hook (`useWhatsAppSession.ts`)
- Add a `saveProxyConfig` mutation that updates the org's `default_proxy_config`
- Add a query/field to load the org's saved proxy config
- In `connect()`, auto-read the org's proxy config if no explicit proxy is passed

### UI (`WhatsAppConnection.tsx`)
- Load saved proxy config on mount and populate the fields
- Add a **"Save Proxy Settings"** button below the proxy fields
- Show success toast on save
- Remove proxy fields from being tied to the connect action — they're now org-level settings
- When connecting, automatically use the saved proxy config (no need to re-enter)

### Edge Function (`vps-whatsapp-proxy/index.ts`)
- In the `connect` handler: if no `proxyConfig` in request body, look up the org's `default_proxy_config` as fallback
- This ensures even auto-reconnect uses the proxy

### Session Badge
- Keep the existing Direct/Proxied badge — it reads from `whatsapp_sessions.proxy_config` which gets set during connect

## Files Changed
| File | Change |
|------|--------|
| Migration SQL | Add `default_proxy_config` to `organizations` |
| `useWhatsAppSession.ts` | Add save/load proxy mutations, auto-apply on connect |
| `WhatsAppConnection.tsx` | Load saved proxy, add Save button, auto-populate fields |
| `vps-whatsapp-proxy/index.ts` | Fallback to org proxy config if not in request |

