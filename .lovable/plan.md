

# Auto-Add Community Admins When Creating WhatsApp Communities

## What You're Asking For

When a WhatsApp community is automatically created for a new workshop, you want to:
1. **Add specific phone numbers** as participants to the community
2. **Promote those participants** to admin status

Currently, you do this manually - joining the groups and promoting each person by hand. This feature will automate it by letting you configure the admin numbers once in Settings.

---

## What's Needed

This feature requires changes on **both sides**:

### Your VPS Side (Action Required From You)

You need to add two new endpoints to your WhatsApp VPS (the Baileys service at 72.61.251.65:3000):

| Endpoint | Method | Purpose | Request Body |
|----------|--------|---------|--------------|
| `/groups/:sessionId/:groupJid/participants/add` | POST | Add phone numbers to group | `{ "participants": ["+919876543210", "+911234567890"] }` |
| `/groups/:sessionId/:groupJid/participants/promote` | POST | Promote participants to admin | `{ "participants": ["+919876543210", "+911234567890"] }` |

**Baileys functions to use:**
```javascript
// Add participants
await sock.groupParticipantsUpdate(groupJid, [jid1, jid2], 'add')

// Promote to admin  
await sock.groupParticipantsUpdate(groupJid, [jid1, jid2], 'promote')
```

---

### CRM Side (What I Will Implement)

#### 1. Database: Store Admin Numbers

Add a new column to the `organizations` table:

```sql
ALTER TABLE organizations 
ADD COLUMN community_admin_numbers text[] DEFAULT '{}';
```

This stores an array of phone numbers like `["+919876543210", "+911234567890"]`.

---

#### 2. Settings UI: Input for Admin Numbers

Add a new section in **Settings → WhatsApp Connection** under the existing "Community Creation Settings" card:

```text
┌────────────────────────────────────────────────────────┐
│  Community Admin Numbers                               │
│  ──────────────────────────────────────────────────────│
│  These numbers will be automatically added as admins   │
│  when new communities are created.                     │
│                                                        │
│  ┌─────────────────────────────────┐ ┌─────────────┐  │
│  │ +919876543210                   │ │   Add       │  │
│  └─────────────────────────────────┘ └─────────────┘  │
│                                                        │
│  [+919876543210]  ✕    [+911234567890]  ✕             │
│                                                        │
└────────────────────────────────────────────────────────┘
```

**Features:**
- Input field to enter phone number (with country code)
- Add button to add to the list
- Display existing numbers as badges with remove option
- Auto-save when changed

---

#### 3. VPS Proxy: New Actions

Update `supabase/functions/vps-whatsapp-proxy/index.ts` to support:

```typescript
case 'add-participants': {
  // POST /groups/:sessionId/:groupJid/participants/add
  vpsEndpoint = `/groups/${vpsSessionId}/${groupJid}/participants/add`;
  vpsBody = { participants: phoneNumbers };
  break;
}

case 'promote-participants': {
  // POST /groups/:sessionId/:groupJid/participants/promote  
  vpsEndpoint = `/groups/${vpsSessionId}/${groupJid}/participants/promote`;
  vpsBody = { participants: phoneNumbers };
  break;
}
```

---

#### 4. Automation: Auto-Add Admins After Community Creation

Update `supabase/functions/create-whatsapp-community/index.ts` to:

1. After successfully creating the community, fetch admin numbers from organization settings
2. Call VPS to add those numbers as participants
3. Call VPS to promote those participants to admin
4. Log results (but don't fail the workshop creation if this step fails)

```typescript
// After community creation succeeds...

// Step 7: Add and promote community admins
const { data: orgSettings } = await supabase
  .from('organizations')
  .select('community_admin_numbers')
  .eq('id', orgId)
  .single();

const adminNumbers = orgSettings?.community_admin_numbers || [];

if (adminNumbers.length > 0 && vpsResult.groupId) {
  console.log(`Adding ${adminNumbers.length} admin(s) to community`);
  
  // Add participants
  await fetch(`${vpsUrl}/groups/${vpsSessionId}/${vpsResult.groupId}/participants/add`, {
    method: 'POST',
    headers: { 'X-API-Key': VPS_API_KEY },
    body: JSON.stringify({ participants: adminNumbers })
  });
  
  // Promote to admin
  await fetch(`${vpsUrl}/groups/${vpsSessionId}/${vpsResult.groupId}/participants/promote`, {
    method: 'POST', 
    headers: { 'X-API-Key': VPS_API_KEY },
    body: JSON.stringify({ participants: adminNumbers })
  });
}
```

---

## Files to Modify

| File | Change |
|------|--------|
| Database Migration | Add `community_admin_numbers` column to `organizations` |
| `src/pages/settings/WhatsAppConnection.tsx` | Add UI for managing admin phone numbers |
| `src/hooks/useCommunitySession.ts` | Add functions to fetch/update admin numbers |
| `supabase/functions/vps-whatsapp-proxy/index.ts` | Add `add-participants` and `promote-participants` actions |
| `supabase/functions/create-whatsapp-community/index.ts` | Call add/promote after community creation |

---

## User Flow After Implementation

1. Go to **Settings → WhatsApp**
2. Scroll to **Community Creation Settings**
3. Enter phone numbers (with country code, e.g., +919876543210)
4. Click "Add" for each number
5. Create a new workshop with auto-community enabled
6. The community is created AND those numbers are automatically added as admins

---

## Important Notes

1. **Phone Number Format**: Numbers must include country code (e.g., +91 for India)
2. **Delay Between Operations**: The VPS should handle adding before promoting (I'll add a small delay)
3. **Best-Effort**: If admin addition fails, the community still gets created (won't block workshop creation)
4. **Existing Communities**: This only applies to newly created communities, not existing ones

---

## VPS Implementation Reference

Here's sample code for your VPS (Node.js/Baileys):

```javascript
// In your routes file
app.post('/groups/:sessionId/:groupJid/participants/add', async (req, res) => {
  const { sessionId, groupJid } = req.params;
  const { participants } = req.body; // Array of phone numbers
  
  const sock = getSock(sessionId);
  const jids = participants.map(p => p.replace('+', '') + '@s.whatsapp.net');
  
  await sock.groupParticipantsUpdate(groupJid, jids, 'add');
  res.json({ success: true });
});

app.post('/groups/:sessionId/:groupJid/participants/promote', async (req, res) => {
  const { sessionId, groupJid } = req.params;
  const { participants } = req.body;
  
  const sock = getSock(sessionId);
  const jids = participants.map(p => p.replace('+', '') + '@s.whatsapp.net');
  
  await sock.groupParticipantsUpdate(groupJid, jids, 'promote');
  res.json({ success: true });
});
```

---

## Summary

| Your Action | My Action |
|-------------|-----------|
| Add `/participants/add` endpoint to VPS | Add database column for admin numbers |
| Add `/participants/promote` endpoint to VPS | Add Settings UI for managing numbers |
| Test endpoints work with your Baileys setup | Update edge functions to call VPS after community creation |

Once you confirm your VPS has these endpoints, I can implement the CRM side.

