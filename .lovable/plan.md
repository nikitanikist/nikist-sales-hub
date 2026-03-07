

# Fix: Add VoBiz Test Connection Handler

**Problem**: The `TestConnectionButton.tsx` switch statement lacks a `case "vobiz"` — it hits the `default` case and throws "Unknown integration type."

**Fix**: Add a `case "vobiz"` block (between `bolna` and `default`) that validates the required fields (`auth_id`, `auth_token`, `from_number`) are present. Since VoBiz API calls from the browser would hit CORS issues, we do a credential-presence check (same approach as Zoom).

**File**: `src/components/settings/TestConnectionButton.tsx`

Add before `default:`:
```typescript
case "vobiz": {
  if (!config.auth_id) throw new Error("Missing VoBiz Auth ID");
  if (!config.auth_token) throw new Error("Missing VoBiz Auth Token");
  if (!config.from_number) throw new Error("Missing VoBiz From Number");
  isValid = true;
  message = "VoBiz credentials saved. Connection will be validated when a campaign is started.";
  break;
}
```

Single-line change, no other files affected.

