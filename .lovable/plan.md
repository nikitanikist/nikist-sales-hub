

# Add Confirmation Popup Before "Send Now"

## What
Add an "Are you sure?" confirmation dialog that appears when the user clicks "Send Now" in the SendMessageNowDialog. Only after confirming will the message actually be sent. Zero impact on existing functionality — it's purely an extra gate before the same `onSend` call.

## How

### Single file change: `src/components/operations/SendMessageNowDialog.tsx`

1. **Add state**: `const [showConfirm, setShowConfirm] = useState(false);`
2. **Change `handleSend`**: Instead of calling `onSend(...)` directly, set `showConfirm = true`
3. **Add `handleConfirmedSend`**: The actual `onSend(...)` call + `setShowConfirm(false)`
4. **Add AlertDialog** (already available in `@/components/ui/alert-dialog`):
   - Title: "Are you 100% sure?"
   - Description: "This will immediately send the message to {groupCount} group(s). This action cannot be undone."
   - Cancel button → closes dialog
   - Confirm button → calls `handleConfirmedSend`
5. **Reset** `showConfirm` to `false` when the parent dialog closes

No other files are touched. The `onSend` callback and all upstream logic remain identical.

