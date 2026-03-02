

## Fix: CSV Upload Not Advancing to Step 3

### Problem
In the last edit, the `setStep(3)` call was accidentally removed from the CSV parsing logic. After uploading a CSV, `contacts` and `csvHeaders` are set, but the dialog stays on step 2 because it never transitions to the review step.

### Solution
Add `setStep(3)` back after `setContacts(parsed)` on line 116 of `CreateAgentCampaignDialog.tsx`.

### Technical Change
**File: `src/pages/calling-agent/CreateAgentCampaignDialog.tsx`** (line ~116)

After:
```ts
setCsvHeaders(headers);
setContacts(parsed);
```

Add:
```ts
setStep(3);
```

This is a one-line fix.

