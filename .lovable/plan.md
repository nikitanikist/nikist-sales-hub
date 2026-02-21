

# Move Dead Letter Queue to WhatsApp Menu

## What Changes

Move the "Dead Letter Queue" sub-menu item from under **Operations** to under **WhatsApp**. This means:

- The WhatsApp menu will now have 4 items: Dashboard, Campaigns, Templates, Dead Letter Queue
- The Operations menu loses one item (Dead Letter Queue stays at the same route `/operations/dead-letter-queue`)
- No database changes needed -- the existing permission system already controls WhatsApp visibility

## Why This Works

The Dead Letter Queue currently uses the `settings` permission key. Moving it under WhatsApp and changing its permission to `whatsapp` means it will automatically be shown/hidden along with the rest of the WhatsApp section. The Operations menu (Workshop Notification, Dynamic Links) can already be hidden via existing permission overrides since those items use `workshops` and `settings` permission keys respectively.

## Technical Changes

### File: `src/components/AppLayout.tsx`

1. Remove "Dead Letter Queue" from the Operations `children` array (line 345)
2. Add "Dead Letter Queue" to the WhatsApp `children` array (after Templates)

### File: `src/lib/permissions.ts`

1. Add route mapping: `'/operations/dead-letter-queue': PERMISSION_KEYS.whatsapp` to `ROUTE_TO_PERMISSION`

That is all -- two small edits, no new files, no database changes.

