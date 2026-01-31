

# Improvement: Show More Time Badges in Sequence Steps Column

## Problem

In the Sequences table, the "Steps" column currently shows only **4 time badges** and then displays a "+N" badge for any additional ones (e.g., "+3"). 

As shown in your screenshot, there's plenty of horizontal space in the table, so truncating at 4 items is unnecessarily restrictive.

## Solution

Increase the number of visible time badges from 4 to **8**, which will utilize the available space much better while still providing an overflow indicator for very long sequences.

## File to Change

| File | Change |
|------|--------|
| `src/pages/settings/WorkshopNotificationSettings.tsx` | Increase visible badges from 4 to 8 |

## Code Changes

**Lines 799 and 805-807:**

```typescript
// Current (shows only 4)
{(s.steps || []).slice(0, 4).map((step: any) => (
  ...
))}
{(s.steps || []).length > 4 && (
  <Badge variant="secondary" className="text-xs">
    +{(s.steps || []).length - 4}
  </Badge>
)}

// Updated (shows up to 8)
{(s.steps || []).slice(0, 8).map((step: any) => (
  ...
))}
{(s.steps || []).length > 8 && (
  <Badge variant="secondary" className="text-xs">
    +{(s.steps || []).length - 8}
  </Badge>
)}
```

## Result

- Sequences with up to 8 steps will show all time badges
- Sequences with 9+ steps will show 8 badges plus a "+N" indicator
- The layout already has `flex-wrap` enabled, so badges will wrap gracefully if needed
- In your example, all 7 times (11:00, 13:00, 16:00, 18:00, and the 3 hidden ones) will be visible

