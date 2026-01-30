
# Workshop Notification - Multi-Channel Architecture Implementation Plan

## Executive Summary

Transform the Workshop Notification page from a single-channel WhatsApp Groups system into a professional **multi-channel notification platform** with 4 distinct channels: WhatsApp Group (existing), WhatsApp Personal (AiSensy), SMS (Fast2SMS), and IVR Calls.

---

## Current State Analysis

### Existing Implementation

| Component | Location | Status |
|-----------|----------|--------|
| Workshop Notification Page | `src/pages/operations/WorkshopNotification.tsx` | WhatsApp Groups only |
| Detail Sheet | `src/components/operations/WorkshopDetailSheet.tsx` | Full-featured |
| Settings Page | `src/pages/settings/WorkshopNotificationSettings.tsx` | Templates, Sequences, Tags |
| Hook | `src/hooks/useWorkshopNotification.ts` | VPS Baileys integration |
| Integration Config | `organization_integrations` table | AiSensy already supported |

### Key Findings

1. **AiSensy is already integrated** in edge functions (`rebook-call`, `reassign-call`) for 1:1 call notifications
2. **Lead data** is accessible via `lead_assignments` -> `leads` join (includes `phone`, `email`, `contact_name`)
3. **organization_integrations** table already supports storing API keys with JSONB config
4. **No existing tables** for SMS/IVR broadcasts - need to create

---

## Architecture Design

### Tab Structure

```
WorkshopNotification.tsx
├── PageIntro (existing)
├── TodaysWorkshopCard (existing, shared)
├── Tabs
│   ├── WhatsApp Group (extracted from current page)
│   ├── WhatsApp Personal (new - AiSensy)
│   ├── SMS (new - Fast2SMS)
│   └── IVR Call (new - placeholder)
```

### Component Architecture

```
src/components/operations/notification-channels/
├── index.ts                    (exports)
├── WhatsAppGroupTab.tsx        (extract from current page)
├── WhatsAppPersonalTab.tsx     (new)
├── SmsTab.tsx                  (new)
├── IvrCallTab.tsx              (new)
├── ChannelStatusCard.tsx       (reusable integration status)
├── RecipientSummary.tsx        (reusable recipient count component)
└── BroadcastHistoryTable.tsx   (reusable history table)
```

---

## Phase 1: Page Refactoring (Tab Structure)

### Files to Modify

**1. `src/pages/operations/WorkshopNotification.tsx`**

Wrap existing content in Tabs component:

```tsx
// Add imports
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, MessageCircle, Smartphone, Phone } from 'lucide-react';

// Tab structure
<Tabs defaultValue="whatsapp-group" className="space-y-6">
  <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
    <TabsTrigger value="whatsapp-group" className="gap-2">
      <Users className="h-4 w-4" />
      <span className="hidden sm:inline">WhatsApp Group</span>
      <span className="sm:hidden">Groups</span>
    </TabsTrigger>
    <TabsTrigger value="whatsapp-personal" className="gap-2">
      <MessageCircle className="h-4 w-4" />
      <span className="hidden sm:inline">WhatsApp Personal</span>
      <span className="sm:hidden">Personal</span>
    </TabsTrigger>
    <TabsTrigger value="sms" className="gap-2">
      <Smartphone className="h-4 w-4" />
      <span>SMS</span>
    </TabsTrigger>
    <TabsTrigger value="ivr" className="gap-2">
      <Phone className="h-4 w-4" />
      <span className="hidden sm:inline">IVR Call</span>
      <span className="sm:hidden">IVR</span>
    </TabsTrigger>
  </TabsList>
  
  <TabsContent value="whatsapp-group">
    {/* Existing WhatsApp Group content moves here */}
  </TabsContent>
  
  <TabsContent value="whatsapp-personal">
    <ComingSoonPlaceholder channel="WhatsApp Personal" provider="AiSensy" />
  </TabsContent>
  
  <TabsContent value="sms">
    <ComingSoonPlaceholder channel="SMS" provider="Fast2SMS" />
  </TabsContent>
  
  <TabsContent value="ivr">
    <ComingSoonPlaceholder channel="IVR Call" provider="TBD" />
  </TabsContent>
</Tabs>
```

**2. Create `src/components/operations/notification-channels/ComingSoonPlaceholder.tsx`**

A reusable placeholder for channels not yet implemented:

```tsx
interface Props {
  channel: string;
  provider: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export function ComingSoonPlaceholder({ channel, provider, icon: Icon }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
        {Icon ? <Icon className="h-8 w-8 text-muted-foreground" /> : <Settings2 className="h-8 w-8 text-muted-foreground" />}
      </div>
      <h3 className="text-lg font-semibold">{channel} Notifications</h3>
      <p className="text-sm text-muted-foreground mt-2 max-w-md">
        Send individual {channel.toLowerCase()} notifications to workshop registrants via {provider}.
      </p>
      <Badge variant="secondary" className="mt-4">Coming Soon</Badge>
    </div>
  );
}
```

**3. Update `src/components/operations/index.ts`**

Add new exports for channel components.

---

## Phase 2: WhatsApp Personal (AiSensy Integration)

### Database Schema

Create new tables for tracking personal message broadcasts:

```sql
-- Broadcast tracking table
CREATE TABLE whatsapp_personal_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workshop_id UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,           -- AiSensy template name
  total_recipients INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Individual message tracking
CREATE TABLE whatsapp_personal_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id UUID NOT NULL REFERENCES whatsapp_personal_broadcasts(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  aisensy_response JSONB,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE whatsapp_personal_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_personal_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for broadcasts
CREATE POLICY "Users can view broadcasts in their org" ON whatsapp_personal_broadcasts
  FOR SELECT USING (organization_id = ANY(get_user_organization_ids()) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can manage broadcasts in their org" ON whatsapp_personal_broadcasts
  FOR ALL USING (
    (organization_id = ANY(get_user_organization_ids()) AND 
     (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')))
    OR is_super_admin(auth.uid())
  );

-- RLS policies for messages (view via broadcast)
CREATE POLICY "Users can view messages for broadcasts in their org" ON whatsapp_personal_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM whatsapp_personal_broadcasts b 
      WHERE b.id = broadcast_id 
      AND (b.organization_id = ANY(get_user_organization_ids()) OR is_super_admin(auth.uid()))
    )
  );
```

### New Files

**1. `src/hooks/useWhatsAppPersonal.ts`**

```tsx
// Hook for WhatsApp Personal (AiSensy) integration
// - Fetch integration status from organization_integrations
// - Get workshop recipients with phone numbers
// - Create and manage broadcasts
// - Call edge function to send via AiSensy
```

**2. `src/components/operations/notification-channels/WhatsAppPersonalTab.tsx`**

UI for sending individual WhatsApp messages:
- Integration status card (shows if AiSensy is configured)
- Workshop selector dropdown
- Recipient summary (total, with phone, missing phone)
- Template selector (AiSensy template names)
- Preview area
- Send button with confirmation
- Broadcast history table

**3. `supabase/functions/send-aisensy-broadcast/index.ts`**

Edge function to:
- Accept broadcast request with workshop_id and template_name
- Fetch recipients from lead_assignments + leads
- Create broadcast and message records
- Send to AiSensy API in batches
- Update status as messages are sent

### AiSensy Integration Details

Based on existing code patterns:

```typescript
// AiSensy API call pattern (from existing edge functions)
const payload = {
  apiKey: aisensyApiKey,
  campaignName: templateName,
  destination: phoneNumber,
  userName: leadName,
  source: aisensySource,
  templateParams: [...],
};

await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
```

---

## Phase 3: SMS Notifications (Fast2SMS)

### Database Schema

```sql
-- SMS broadcast tracking
CREATE TABLE sms_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workshop_id UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  message_content TEXT NOT NULL,
  sender_id TEXT,                        -- DLT sender ID
  template_id TEXT,                      -- DLT template ID
  message_type TEXT DEFAULT 'transactional',
  total_recipients INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  cost_per_sms DECIMAL(10,4),
  total_cost DECIMAL(10,2),
  status TEXT NOT NULL DEFAULT 'pending',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Individual SMS tracking
CREATE TABLE sms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id UUID NOT NULL REFERENCES sms_broadcasts(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  provider_message_id TEXT,              -- Fast2SMS message ID
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies similar to whatsapp_personal tables
```

### New Files

**1. `src/hooks/useSmsNotification.ts`**
**2. `src/components/operations/notification-channels/SmsTab.tsx`**
**3. `supabase/functions/send-sms-broadcast/index.ts`**

### Fast2SMS Integration

```typescript
// Fast2SMS API pattern
const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
  method: 'POST',
  headers: {
    'authorization': apiKey,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    route: 'dlt',                        // or 'v3' for promotional
    sender_id: senderId,
    message: messageId,                  // DLT template ID
    variables_values: variableValues,
    flash: 0,
    numbers: phoneNumbers.join(','),
  }),
});
```

---

## Phase 4: IVR Calling (Future)

### Placeholder Implementation

Create `IvrCallTab.tsx` with:
- "Coming Soon" status
- Provider selection research notes
- Basic UI structure for future implementation

### Potential Providers

- Exotel
- Knowlarity
- Ozonetel
- MyOperator

---

## Settings Page Enhancements

### Add Integration Configuration

Update `src/pages/settings/WorkshopNotificationSettings.tsx` to include additional tabs or sections:

1. **WhatsApp Group Settings** (existing - VPS connection)
2. **WhatsApp Personal (AiSensy)** - API key, source, templates
3. **SMS (Fast2SMS)** - API key, sender IDs, DLT templates
4. **IVR** - Future placeholder

### Integration Settings Component

```tsx
// Add to settings tabs
<TabsTrigger value="integrations" className="gap-2">
  <Settings2 className="h-4 w-4" />
  Integrations
</TabsTrigger>

<TabsContent value="integrations">
  <div className="space-y-6">
    {/* AiSensy Config */}
    <IntegrationConfigCard
      title="WhatsApp Personal (AiSensy)"
      description="Send individual WhatsApp messages to registrants"
      integrationType="aisensy_personal"
      fields={[
        { key: 'api_key', label: 'API Key', secret: true },
        { key: 'source', label: 'Source Number' },
      ]}
    />
    
    {/* Fast2SMS Config */}
    <IntegrationConfigCard
      title="SMS (Fast2SMS)"
      description="Send SMS notifications to registrants"
      integrationType="fast2sms"
      fields={[
        { key: 'api_key', label: 'API Key', secret: true },
        { key: 'sender_id', label: 'Sender ID (DLT)' },
      ]}
    />
  </div>
</TabsContent>
```

---

## Reusable Components

### 1. ChannelStatusCard

Displays integration status for any channel:

```tsx
interface ChannelStatusCardProps {
  title: string;
  isConfigured: boolean;
  statusDetails?: string;          // e.g., "Balance: ₹2,450"
  onConfigure: () => void;
}
```

### 2. RecipientSummary

Shows recipient breakdown for any channel:

```tsx
interface RecipientSummaryProps {
  total: number;
  withPhone: number;
  missingPhone: number;
  withEmail?: number;
  missingEmail?: number;
}
```

### 3. BroadcastHistoryTable

Reusable table for broadcast history:

```tsx
interface BroadcastHistoryProps {
  broadcasts: Array<{
    id: string;
    date: string;
    workshopTitle: string;
    templateName: string;
    sentCount: number;
    totalCount: number;
    status: string;
  }>;
  isLoading: boolean;
}
```

---

## File Summary

### New Files to Create

| File | Purpose |
|------|---------|
| `src/components/operations/notification-channels/index.ts` | Barrel exports |
| `src/components/operations/notification-channels/WhatsAppGroupTab.tsx` | Extract existing functionality |
| `src/components/operations/notification-channels/WhatsAppPersonalTab.tsx` | AiSensy UI |
| `src/components/operations/notification-channels/SmsTab.tsx` | Fast2SMS UI |
| `src/components/operations/notification-channels/IvrCallTab.tsx` | Placeholder |
| `src/components/operations/notification-channels/ChannelStatusCard.tsx` | Reusable status |
| `src/components/operations/notification-channels/RecipientSummary.tsx` | Reusable recipients |
| `src/components/operations/notification-channels/BroadcastHistoryTable.tsx` | Reusable history |
| `src/components/operations/notification-channels/ComingSoonPlaceholder.tsx` | Placeholder UI |
| `src/hooks/useWhatsAppPersonal.ts` | AiSensy hook |
| `src/hooks/useSmsNotification.ts` | Fast2SMS hook |
| `src/hooks/useWorkshopRecipients.ts` | Shared recipient fetching |
| `supabase/functions/send-aisensy-broadcast/index.ts` | AiSensy edge function |
| `supabase/functions/send-sms-broadcast/index.ts` | Fast2SMS edge function |

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/operations/WorkshopNotification.tsx` | Add tabs wrapper |
| `src/components/operations/index.ts` | Add new exports |
| `src/pages/settings/WorkshopNotificationSettings.tsx` | Add integrations tab |

---

## Implementation Priority

### Phase 1 (Immediate)
1. Add tab structure to WorkshopNotification.tsx
2. Create placeholder components for other channels
3. Extract existing WhatsApp Group content into tab

### Phase 2 (WhatsApp Personal)
1. Create database tables
2. Build useWhatsAppPersonal hook
3. Create WhatsAppPersonalTab UI
4. Build send-aisensy-broadcast edge function
5. Add AiSensy config to settings

### Phase 3 (SMS)
1. Create database tables
2. Build useSmsNotification hook
3. Create SmsTab UI
4. Build send-sms-broadcast edge function
5. Add Fast2SMS config to settings

### Phase 4 (IVR - Future)
1. Research providers
2. Build placeholder UI
3. Implement when provider selected

---

## Testing Checklist

After Phase 1:
- [ ] Tab navigation works
- [ ] WhatsApp Group functionality unchanged
- [ ] Placeholders display correctly
- [ ] Mobile responsive

After Phase 2:
- [ ] AiSensy config saves correctly
- [ ] Recipients load for selected workshop
- [ ] Broadcast creates and tracks correctly
- [ ] Messages appear in WhatsApp

After Phase 3:
- [ ] Fast2SMS config saves correctly
- [ ] SMS sends successfully
- [ ] Delivery status updates
