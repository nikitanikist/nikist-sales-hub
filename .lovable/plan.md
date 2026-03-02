

## Fix: Campaign "Run Now" Fails with 404 + UI Polish

### Root Cause: Edge Functions Not Deployed
The "Run Now" button fails because the `start-calling-agent-campaign` edge function has not been deployed yet. The network request returns a `404 NOT_FOUND` error. Both new edge functions need to be deployed:
- `start-calling-agent-campaign`
- `calling-agent-webhook`

### Plan

**1. Deploy Edge Functions**
Deploy both `start-calling-agent-campaign` and `calling-agent-webhook` so they are live and accessible.

**2. UI Polish on Step 3 Preview**
Minor improvements to the review table:
- Capitalize column headers more cleanly (e.g., "Contact Number" instead of "contact number")
- Ensure the table scrolls horizontally on smaller dialogs so all columns remain visible

### Technical Details

- The edge functions already exist in `supabase/functions/` but were never deployed. This is the sole reason campaigns fail -- the function invocation returns 404.
- No code changes are needed for the deployment fix. The `calling-agent-webhook` also needs deployment so that post-call data from Bolna can be received.
- For the UI, the `csvHeaders` state already uses `.toLowerCase()` on import. The `capitalize` CSS class on `TableHead` handles display, but we can improve by using proper title-case formatting (e.g., "Contact Number" not "contact number") via a small formatting utility in the table header rendering.

