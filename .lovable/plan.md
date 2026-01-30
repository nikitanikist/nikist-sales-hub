

# Add "Send Message Now" Feature to Workshop Notification

## Overview

This plan adds a second messaging option in the Workshop detail sheet. Currently, users can only "Run the Sequence" which schedules all messages. The new feature will allow users to:

1. **Run the Sequence** - Schedule all messages based on the template sequence (existing functionality)
2. **Send Message Now** - Immediately send a single message by selecting a template

---

## User Flow

### Before (Current)
```
[Run the Messaging] button → Schedules all sequence messages
```

### After (New)
```
┌─────────────────────────────────────────────────┐
│  Messaging Actions                               │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │  📅 Run the Sequence                      │  │
│  │  Schedules all messages for their times   │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │  📤 Send Message Now                      │  │
│  │  Sends a message immediately              │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
└─────────────────────────────────────────────────┘
```

When user clicks "Send Message Now":
1. A dialog opens with a template dropdown
2. User selects a template from the list
3. User sees a preview of the message content
4. User clicks "Send Now" button
5. Message is sent immediately to the linked WhatsApp group
6. Success/error toast notification appears

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/operations/SendMessageNowDialog.tsx` | Dialog component for template selection and sending |
| `src/components/operations/MessagingActions.tsx` | New component with both action buttons |

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/operations/WorkshopDetailSheet.tsx` | Replace `RunMessagingButton` with new `MessagingActions` |
| `src/components/operations/index.ts` | Export new components |
| `src/hooks/useWorkshopNotification.ts` | Add `sendMessageNow` mutation |

---

## Technical Details

### 1. SendMessageNowDialog.tsx (New Component)

```tsx
interface SendMessageNowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workshopId: string;
  workshopTitle: string;
  workshopDate: Date;
  groupId: string;
  sessionId: string;
  onSend: (params: SendNowParams) => void;
  isSending: boolean;
}
```

**Features:**
- Template dropdown to select from available templates
- Message preview area showing the processed content (with variables replaced)
- Cancel and Send Now buttons
- Loading state while sending
- Error handling

**UI Layout:**
```
┌─────────────────────────────────────────────┐
│ Send Message Now                        [X] │
├─────────────────────────────────────────────┤
│                                             │
│  Select Template                            │
│  ┌─────────────────────────────────────┐   │
│  │ [Choose a template...]          ▼   │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Message Preview                            │
│  ┌─────────────────────────────────────┐   │
│  │ Welcome to {workshop_name}!         │   │
│  │ Join us on {date} at {time}.        │   │
│  │                                     │   │
│  │ → Processed preview appears here    │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ─────────────────────────────────────────  │
│                                             │
│                 [Cancel]  [📤 Send Now]    │
│                                             │
└─────────────────────────────────────────────┘
```

### 2. MessagingActions.tsx (New Component)

Replaces `RunMessagingButton` with two action options:

```tsx
interface MessagingActionsProps {
  workshop: WorkshopWithDetails;
  onRunSequence: () => void;
  onSendNow: () => void;
  isRunningSequence: boolean;
  isSendingNow: boolean;
  hasGroup: boolean;
  hasSequence: boolean;
}
```

**UI Layout:**
```tsx
<div className="space-y-4">
  <h3 className="text-sm font-medium">Messaging Actions</h3>
  
  {/* Run Sequence Button */}
  <Button onClick={onRunSequence} disabled={!canRunSequence}>
    <CalendarClock className="h-4 w-4 mr-2" />
    Run the Sequence
  </Button>
  <p className="text-xs text-muted-foreground">
    Schedules all messages for their designated times
  </p>
  
  <Separator />
  
  {/* Send Now Button */}
  <Button onClick={onSendNow} disabled={!hasGroup} variant="outline">
    <Send className="h-4 w-4 mr-2" />
    Send Message Now
  </Button>
  <p className="text-xs text-muted-foreground">
    Send a single message immediately
  </p>
</div>
```

### 3. Hook Changes (useWorkshopNotification.ts)

Add a new mutation for sending immediate messages:

```typescript
// Send a message immediately
const sendMessageNowMutation = useMutation({
  mutationFn: async ({
    workshopId,
    groupId,
    sessionId,
    templateId,
    content,
    mediaUrl,
  }: {
    workshopId: string;
    groupId: string;
    sessionId: string;
    templateId: string;
    content: string;
    mediaUrl?: string | null;
  }) => {
    // Get the group JID from the database
    const { data: group } = await supabase
      .from('whatsapp_groups')
      .select('group_jid')
      .eq('id', groupId)
      .single();
    
    if (!group?.group_jid) throw new Error('Group not found');
    
    // Call VPS proxy to send immediately
    const { data, error } = await supabase.functions.invoke('vps-whatsapp-proxy', {
      body: {
        action: 'send',
        sessionId,
        groupId: group.group_jid,
        message: content,
        ...(mediaUrl && { mediaUrl }),
      },
    });
    
    if (error) throw error;
    return data;
  },
  onSuccess: () => {
    toast.success('Message sent successfully');
  },
  onError: (error: Error) => {
    toast.error('Failed to send message', { description: error.message });
  },
});
```

### 4. WorkshopDetailSheet.tsx Changes

Replace the current `RunMessagingButton` with `MessagingActions` and add state for the dialog:

```tsx
// Add state
const [sendNowDialogOpen, setSendNowDialogOpen] = useState(false);

// Replace RunMessagingButton with MessagingActions
<MessagingActions
  workshop={workshop}
  onRunSequence={() => runMessaging({ workshopId: workshop.id, workshop })}
  onSendNow={() => setSendNowDialogOpen(true)}
  isRunningSequence={isRunningMessaging}
  isSendingNow={isSendingNow}
  hasGroup={!!workshop.whatsapp_group_id}
  hasSequence={hasSequence}
/>

// Add dialog
<SendMessageNowDialog
  open={sendNowDialogOpen}
  onOpenChange={setSendNowDialogOpen}
  workshopId={workshop.id}
  workshopTitle={workshop.title}
  workshopDate={workshopDate}
  groupId={workshop.whatsapp_group_id!}
  sessionId={workshop.whatsapp_session_id!}
  onSend={sendMessageNow}
  isSending={isSendingNow}
/>
```

---

## Dependencies

The feature uses existing components and hooks:
- `useMessageTemplates` - To fetch available templates
- `useWorkshopNotification` - Extended with `sendMessageNow` mutation
- VPS Proxy Edge Function - Already supports `send` action

---

## Validation Requirements

**Send Message Now is enabled when:**
- WhatsApp account is selected (session_id exists)
- WhatsApp group is linked (group_id exists)

**Send Now button in dialog is enabled when:**
- A template is selected
- Not currently sending

---

## Error Handling

1. **No group linked** → Button disabled with tooltip "Link a WhatsApp group first"
2. **No account selected** → Button disabled with tooltip "Select a WhatsApp account first"
3. **VPS error** → Toast notification with error details
4. **Network error** → Toast notification with retry suggestion

---

## Testing Checklist

After implementation, verify:
- "Send Message Now" button appears alongside "Run the Sequence"
- Dialog opens when clicking "Send Message Now"
- Templates load in the dropdown
- Message preview updates when template is selected
- Variables are replaced in preview ({workshop_name}, {date}, {time})
- Send button works and message is delivered
- Success toast appears after sending
- Error handling works for edge cases
- Buttons are properly disabled when prerequisites are missing

