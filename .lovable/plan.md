

# Update Join Rate Calculation

## Current vs New Logic

| Metric | Current | New |
|--------|---------|-----|
| Formula | In Group / Registered | Total in Group / Registered |
| Example | 231 / 497 = 46% | 285 / 497 = 57% |
| What it measures | Matched phone numbers only | All people who joined |

## Why This is Better

The "unregistered" 54 people are most likely:
- Registered attendees using WhatsApp Business instead of regular WhatsApp
- People who entered their phone number differently in the form
- Same person, different number

So they should count as "joined" when calculating the rate.

## Implementation

### File: `src/hooks/useWorkshopParticipants.ts`

**Line 260-263** - Change join rate calculation:

```typescript
// Before:
const joinRate = registeredLeads.length > 0 
  ? (inGroup.length / registeredLeads.length) * 100 
  : 0;

// After:
const joinRate = registeredLeads.length > 0 
  ? (totalInGroupRaw / registeredLeads.length) * 100 
  : 0;
```

Note: `totalInGroupRaw` is already calculated on line 266, so we just need to use it instead of `inGroup.length`.

## Result

After the change:
- **Join Rate: 57%** (285 total in group / 497 registered)
- More accurately reflects true attendance
- Accounts for phone number mismatches

## Files Modified

| File | Change |
|------|--------|
| `src/hooks/useWorkshopParticipants.ts` | Line 262: Replace `inGroup.length` with `totalInGroupRaw` |

