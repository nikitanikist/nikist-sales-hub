

# Proxy Integration for WhatsApp VPS

## Overview
Add optional SOCKS5 proxy support per WhatsApp session. Existing sessions (Nikist, One Percent Club) are untouched — proxy is purely additive for new clients.

## Changes

### 1. Database Migration
Add `proxy_config` JSONB column to `whatsapp_sessions`:
```sql
ALTER TABLE public.whatsapp_sessions 
ADD COLUMN IF NOT EXISTS proxy_config JSONB DEFAULT NULL;
```

### 2. Edge Function — `vps-whatsapp-proxy/index.ts`
- Update `VPSProxyRequest` interface to accept optional `proxyConfig`
- In the `connect` case (~line 199-207): read `proxy_config` from request body, include it as `proxy` in the VPS payload if present
- In the session insert (~line 782-790): save `proxy_config` to the new column
- In the `status` case: when a disconnected session reconnects, re-read `proxy_config` from DB and pass it to `/connect` (auto-reconnect path)

### 3. UI — `src/pages/settings/WhatsAppConnection.tsx`
- Add state for proxy toggle + 4 fields (host, port, username, password)
- Show "Use Residential Proxy" toggle before the "Connect WhatsApp" button
- When toggled ON, show the 4 proxy fields
- Pass `proxyConfig` in the connect mutation payload
- On each connected session card, show a small badge: "Direct" (green) or "Proxied" (blue) based on whether `proxy_config` is set

### 4. Hook — `src/hooks/useWhatsAppSession.ts`
- Update `WhatsAppSession` interface to include `proxy_config`
- Update `connect()` mutation to accept and forward optional proxy config
- Fetch `proxy_config` in the sessions query select

### 5. Session List Indicator
On each connected session card, display:
- 🟢 **Direct** — when `proxy_config` is null
- 🔵 **Proxied (host)** — when `proxy_config` is set, showing the proxy host

## What's NOT Changed
- All existing sessions continue to work with no proxy (null = direct connection)
- `/send`, `/groups`, webhooks — completely untouched
- No changes to any other edge functions or pages

