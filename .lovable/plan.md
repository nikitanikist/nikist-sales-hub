

# Fix WhatsApp Device Connection in Settings

## Problem Identified

The WhatsApp tab in Settings is showing the **AiSensy API integration form** instead of the **device connection feature** with QR code scanning. This happened because:

1. The `WhatsAppConnection` component was created at `src/pages/settings/WhatsAppConnection.tsx`
2. It was exported in `src/pages/settings/index.ts`
3. But it was **never integrated into the OrganizationSettings page** - the settings page still uses `IntegrationSection` for WhatsApp

## Solution

Replace the WhatsApp `IntegrationSection` with the new `WhatsAppConnection` component in the Integrations tab.

---

## Technical Changes

### File: `src/pages/OrganizationSettings.tsx`

**Change 1**: Import `WhatsAppConnection`
- Add import for `WhatsAppConnection` from `./pages/settings/WhatsAppConnection`

**Change 2**: Replace WhatsApp IntegrationSection
- Line 278-286: Replace the current WhatsApp `TabsContent` that uses `IntegrationSection`
- Replace with the `WhatsAppConnection` component

Before:
```tsx
<TabsContent value="whatsapp">
  <IntegrationSection
    type="whatsapp"
    integrations={groupedIntegrations.whatsapp}
    onSave={handleSave}
    onDelete={handleDelete}
    isSaving={saveMutation.isPending}
  />
</TabsContent>
```

After:
```tsx
<TabsContent value="whatsapp">
  <WhatsAppConnection />
</TabsContent>
```

---

## Result

After this change:
- Clicking Settings → Integrations → WhatsApp will show:
  - Connection status (connected/not connected)
  - "Connect Device" button that opens QR code dialog
  - Synced WhatsApp groups list
  - Session history

The AiSensy integration can be moved to a separate section if still needed.

