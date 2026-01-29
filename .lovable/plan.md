

# Restore Original Dashboard Greeting Design

## What We're Doing
Replace the current `PageIntro` component on the Dashboard with the original greeting design that had:
- "Good morning!" / "Good afternoon!" / "Good evening!" as a small gray text
- Large "**Welcome** back" heading with "Welcome" in violet/purple color
- "Here's what's happening with your sales today." as the subtitle

---

## Design Comparison

| Current (Not Good) | Previous (What You Want) |
|--------------------|--------------------------|
| Rounded box with icon | Clean text, no box |
| "Welcome back!" single line | "Good morning!" + "Welcome back" two-tone |
| Generic subtitle | "Here's what's happening with your sales today." |

---

## Technical Changes

**File:** `src/pages/Dashboard.tsx`

### Change: Replace PageIntro with Original Greeting

Remove:
```tsx
<PageIntro
  icon={Sparkles}
  tagline="Welcome back!"
  description="Here's an overview of your business performance today."
  variant="violet"
/>
```

Replace with:
```tsx
<div className="flex flex-col sm:flex-row justify-between items-start gap-4">
  <div className="space-y-1">
    <p className="text-sm text-muted-foreground">
      {getGreeting()}
    </p>
    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
      <span className="text-violet-600">Welcome</span> back
    </h1>
    <p className="text-muted-foreground">
      Here's what's happening with your sales today.
    </p>
  </div>
  <AutomationStatusWidget />
</div>
```

Also add a `getGreeting()` function:
```tsx
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning!";
  if (hour < 18) return "Good afternoon!";
  return "Good evening!";
};
```

This will also move the `AutomationStatusWidget` back to the same row as the greeting (as shown in the previous screenshot).

---

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/Dashboard.tsx` | Replace `PageIntro` with original greeting design, add time-based greeting, move AutomationStatusWidget to same row |

---

## Expected Result

- "Good morning!" / "Good afternoon!" / "Good evening!" based on time of day
- Large "**Welcome** back" with "Welcome" in violet color
- "Here's what's happening with your sales today." subtitle
- AutomationStatusWidget on the right side (same row)
- No box/border - clean, impactful typography
- Matches the previous design exactly

