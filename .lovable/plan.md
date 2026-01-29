

# Typography Upgrade: Switching to Inter

## Overview

This plan upgrades the project's typography from **Plus Jakarta Sans** to **Inter**, the industry-standard font for modern SaaS dashboards. Inter was specifically designed for screen interfaces and is used by leading products like Figma, Linear, Notion, and Discord.

## Why Inter?

| Feature | Plus Jakarta Sans (Current) | Inter (Proposed) |
|---------|---------------------------|------------------|
| **X-height** | 69% | 73% (more legible) |
| **Screen optimization** | General purpose | UI-first design |
| **Number rendering** | Standard | Tabular numerals available |
| **Weights** | 8 weights | 9 weights |
| **Used by** | Various startups | Figma, Linear, Notion, Discord |
| **Cost** | Free | Free |

## Implementation

### Phase 1: Update Font Import

**File: `src/index.css`**

Replace the Google Fonts import at line 1:

```css
/* From */
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

/* To */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
```

### Phase 2: Update Body Font Stack

**File: `src/index.css`** (line 139)

Update the body font-family declaration:

```css
/* From */
font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* To */
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

### Phase 3: Add Typographic Enhancements (Optional)

Add CSS features to enable Inter's special OpenType features for better number rendering in dashboards:

**File: `src/index.css`** (add to base layer)

```css
/* Enable tabular numbers for data tables */
.tabular-nums {
  font-variant-numeric: tabular-nums;
}

/* Enable slashed zero for better data clarity */
.slashed-zero {
  font-variant-numeric: slashed-zero;
}

/* Combine for financial data */
.data-text {
  font-variant-numeric: tabular-nums slashed-zero;
}
```

### Phase 4: Update Memory/Style Documentation

Update the project memory to reflect the new font choice for consistency in future development.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/index.css` | Replace font import and font-family declaration |

---

## Visual Impact

After this change:
- **Tables with numbers** will be more readable with properly aligned digits
- **Data-heavy pages** (Dashboard, Batches, Money Flow) will feel more professional
- **Overall polish** will match industry-leading SaaS products like Linear and Notion
- **Character distinction** - numbers like 0 vs O, 1 vs l vs I will be clearer

---

## Alternative Options

If you'd prefer a different aesthetic, here are runner-up options:

1. **Geist Sans** (Vercel) - More modern/geometric, slightly more technical feel
2. **DM Sans** - Softer, friendlier, excellent for smaller text
3. **Satoshi** - Trendy geometric look popular with modern startups

Inter remains my top recommendation for a sales CRM dashboard due to its proven track record in data-intensive applications.

