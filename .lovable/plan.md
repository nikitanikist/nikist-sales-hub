

# Proxy Setup UX Improvement

## Problem
1. "Clear Proxy Settings" button is dangerous — accidental click could break proxied sessions
2. Proxy config is awkwardly placed inside the WhatsApp Connections card
3. VPS Connection Test card takes up space that could be better used

## Solution
Replace the "VPS Connection Test" card with a dedicated **"Proxy Configuration"** card. Move all proxy UI there. Remove the dangerous "Clear Proxy Settings" button — instead, turning the toggle OFF and saving will clear it (intentional action).

### Changes to `WhatsAppConnection.tsx`

1. **Replace the VPS Connection Test card** (lines 134-213) with a new "Proxy Configuration" card containing:
   - Shield icon + "Proxy Configuration" title
   - "Use Residential Proxy" toggle
   - When ON: 4 fields (host, port, username, password) + "Save Proxy Settings" button
   - When OFF: simple message "Direct connection (no proxy)" + if previously saved, a "Save" button to persist the OFF state
   - Show current status: "Active: 82.41.x.x:45131" or "Not configured"
   - Add a confirmation dialog if turning OFF when proxy was previously saved (prevents accidental clearing)

2. **Remove proxy section from WhatsApp Connections card** (lines 466-542) — it moves to the dedicated card above

3. **Keep VPS test** as a small "Test Connection" button inside the new proxy card or inside the Connections card header (less prominent but still accessible)

### No backend changes needed — same `saveProxyConfig` mutation, same org-level storage.

