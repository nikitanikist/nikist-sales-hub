

## Fix: Dialog Too Narrow for CSV Preview Table

### Problem
The dialog uses `max-w-xl` (max-width: 36rem), which is too narrow when the CSV has 4+ columns. The table overflows the dialog boundaries, causing text to be cut off (visible in the "Event Date" column).

### Solution
**File: `src/pages/calling-agent/CreateAgentCampaignDialog.tsx`**

- Change `DialogContent className="max-w-xl"` to `max-w-2xl` (42rem) to give the table more room
- This provides enough space for 4-5 columns without the dialog feeling oversized

### Technical Detail
Single class change on line 196: `max-w-xl` to `max-w-2xl`.

