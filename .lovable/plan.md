

# Plan: Enhanced Multi-Integration Settings UI

## Summary

The Settings page needs significant updates to:
1. **Display existing integration values** from the database
2. **Support multiple integrations** per type (multiple Calendly, multiple WhatsApp)
3. **Handle the secret reference pattern** used in the existing data

---

## Current Data Structure (Already in Database)

The Nikist organization already has:

| Integration | Type Key | Description |
|-------------|----------|-------------|
| Zoom (Adesh) | `zoom` | Host: aadeshnikist@gmail.com |
| Calendly (Dipanshu) | `calendly_dipanshu` | Has Calendly URL |
| Calendly (Akansha) | `calendly_akansha` | Token reference |
| WhatsApp | `whatsapp` | Has templates for different closers |

---

## Changes Required

### 1. Update OrganizationSettings.tsx

**Current Problem:** 
- Only loads ONE integration per type
- Doesn't display existing config values properly  
- Uses `type="password"` on inputs so values are hidden

**Solution:**
- Fetch ALL integrations for the organization
- Group integrations by base type (zoom, calendly, whatsapp)
- Show a list of existing integrations with their details
- Add "Add New Integration" button for each type
- Show masked values with "Reveal" toggle for secrets

### 2. New UI Structure

```text
+------------------------------------------+
| Zoom Integrations                        |
+------------------------------------------+
| [+] Add Zoom Account                     |
|                                          |
| Zoom (Adesh) ✓ Active                    |
| Host: aadeshnikist@gmail.com             |
| Account ID: ●●●●●●●● [Reveal]            |
| [Edit] [Test] [Delete]                   |
+------------------------------------------+

+------------------------------------------+
| Calendly Integrations                    |
+------------------------------------------+
| [+] Add Calendly Account                 |
|                                          |
| Calendly (Dipanshu) ✓ Active             |
| URL: calendly.com/nikist/...             |
| [Edit] [Test] [Delete]                   |
|                                          |
| Calendly (Akansha) ✓ Active              |
| [Edit] [Test] [Delete]                   |
+------------------------------------------+

+------------------------------------------+
| WhatsApp Integrations                    |
+------------------------------------------+
| [+] Add WhatsApp Account                 |
|                                          |
| WhatsApp (Free Leads) ✓ Active           |
| Source: 919266395637                     |
| Purpose: Registration confirmations      |
| [Edit] [Test] [Delete]                   |
|                                          |
| WhatsApp (Paid Students) ✓ Active        |
| Source: 91XXXXXXXXXX                     |
| Purpose: Paid customer notifications     |
| [Edit] [Test] [Delete]                   |
+------------------------------------------+
```

### 3. Database Schema Update

Add `integration_name` column for display purposes:

```sql
ALTER TABLE organization_integrations 
ADD COLUMN IF NOT EXISTS integration_name TEXT;

-- Update existing records
UPDATE organization_integrations 
SET integration_name = 'Adesh Zoom' 
WHERE integration_type = 'zoom';

UPDATE organization_integrations 
SET integration_name = 'Dipanshu Calendly' 
WHERE integration_type = 'calendly_dipanshu';

UPDATE organization_integrations 
SET integration_name = 'Akansha Calendly' 
WHERE integration_type = 'calendly_akansha';

UPDATE organization_integrations 
SET integration_name = 'Main WhatsApp' 
WHERE integration_type = 'whatsapp';
```

### 4. New Component Structure

```text
src/components/settings/
├── IntegrationCard.tsx          # Displays single integration details
├── IntegrationList.tsx          # Lists all integrations of a type
├── AddIntegrationDialog.tsx     # Modal to add new integration
├── ZoomIntegrationForm.tsx      # Zoom-specific fields
├── CalendlyIntegrationForm.tsx  # Calendly-specific fields
└── WhatsAppIntegrationForm.tsx  # WhatsApp-specific fields
```

### 5. Handle Secret Reference Pattern

The existing config uses a pattern like:
```json
{
  "uses_env_secrets": true,
  "account_id_secret": "ZOOM_ADESH_ACCOUNT_ID",
  "client_id_secret": "ZOOM_ADESH_CLIENT_ID"
}
```

For new organizations, we'll store direct values:
```json
{
  "uses_env_secrets": false,
  "account_id": "xyz123",
  "client_id": "abc456"
}
```

Edge functions will be updated to check both patterns.

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/pages/OrganizationSettings.tsx` | **Rewrite** | Complete UI overhaul |
| `src/components/settings/IntegrationCard.tsx` | **Create** | Card displaying integration details |
| `src/components/settings/AddIntegrationDialog.tsx` | **Create** | Dialog for adding new integrations |
| `src/components/settings/CloserAssignmentSection.tsx` | **Create** | Link closers to integrations |
| Migration file | **Create** | Add `integration_name` column |

---

## User Workflows Enabled

### Adding a second WhatsApp for paid students:
1. Go to Settings → WhatsApp tab
2. Click "Add WhatsApp Account"
3. Enter name: "Paid Students WhatsApp"
4. Enter AiSensy API Key and Source
5. Save

### Linking a closer to a specific integration:
1. Settings → Team/Closers tab
2. Select closer (e.g., Dipanshu)
3. Assign Calendly integration: "Dipanshu Calendly"
4. Assign WhatsApp integration: "Free Leads WhatsApp"
5. Save

---

## Technical Implementation Details

### Loading Existing Integrations

```typescript
// Group integrations by base type
const groupedIntegrations = useMemo(() => {
  const groups: Record<string, typeof integrations> = {
    zoom: [],
    calendly: [],
    whatsapp: []
  };
  
  integrations?.forEach(integration => {
    if (integration.integration_type.startsWith('calendly')) {
      groups.calendly.push(integration);
    } else if (integration.integration_type.startsWith('zoom')) {
      groups.zoom.push(integration);
    } else if (integration.integration_type.startsWith('whatsapp')) {
      groups.whatsapp.push(integration);
    }
  });
  
  return groups;
}, [integrations]);
```

### Extracting Display Values from Config

```typescript
const getDisplayValue = (config: any, key: string): string => {
  // Check if using env secret reference
  if (config.uses_env_secrets && config[`${key}_secret`]) {
    return `[Using: ${config[`${key}_secret`]}]`;
  }
  // Direct value
  return config[key] || '';
};
```

---

## Summary

This plan transforms the Settings page from a single-integration view to a full **multi-integration management system** that:

1. Shows ALL existing integrations with their details
2. Allows adding multiple accounts of the same type
3. Supports naming integrations (e.g., "Free Leads WhatsApp", "Paid Students WhatsApp")
4. Links closers to specific integrations
5. Maintains backward compatibility with existing env-secret-based configs

