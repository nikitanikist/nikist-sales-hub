

# Add "Unregistered Members" Tracking

## Problem

Currently the system shows:
| Stat | Description |
|------|-------------|
| **Registered** | 500 leads who signed up for the workshop |
| **In Group** | 204 registered leads who are also in WhatsApp |
| **Missing** | 296 registered leads NOT in WhatsApp |
| **Left Group** | People who joined and then left |

But we're missing visibility into the **46 people** who are in the WhatsApp group but **never registered** for the workshop. These could be:
- Team members/staff
- Friends who got invite links
- People who joined via direct links

## Solution

Add a new stat card and tab for **"Unregistered Members"** - people in WhatsApp group who are NOT in the leads database.

---

## Updated Stats Cards (6 cards)

```text
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│     250      │ │     500      │ │     204      │ │     296      │ │      46      │ │     40%      │
│ Total in     │ │  Registered  │ │   In Group   │ │   Missing    │ │ Unregistered │ │  Join Rate   │
│   Group      │ │              │ │              │ │              │ │ (Non-Admin)  │ │              │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
      ▲                                                                    ▲
      │                                                                    │
   NEW CARD                                                             NEW CARD
   (from VPS)                                                     (VPS minus Leads,
                                                                    minus Admins)
```

---

## New Tab: "Unregistered"

Shows people in the WhatsApp group who are NOT in the database, with:
- Phone number
- Admin status badge (if any slipped through)
- Download CSV button

---

## Technical Changes

### 1. Update `useWorkshopParticipants.ts` Hook

Add new fields to track unregistered members:

| New Field | Description |
|-----------|-------------|
| `totalInGroupRaw` | Total participants from VPS (including admins) |
| `unregistered` | Array of VPS participants NOT in leads (excluding admins) |
| `totalUnregistered` | Count of unregistered non-admin members |

The calculation:
1. Get all VPS participants
2. Filter out admins (`isAdmin === true`)
3. Filter out those whose phone matches a registered lead
4. Remaining = unregistered members

### 2. Update `WorkshopDetail.tsx` Page

- Add "Total in Group" stat card showing raw VPS count
- Add "Unregistered" stat card showing non-admin, non-lead members
- Add "Unregistered" tab with phone list and CSV download
- Update grid layout to accommodate 6 cards

---

## Data Flow After Change

```text
VPS Returns 250 participants
        │
        ├── 6 are admins → Excluded from "Unregistered"
        │
        └── 244 regular members
                │
                ├── 204 match registered leads → "In Group"
                │
                └── 40 don't match any lead → "Unregistered"
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useWorkshopParticipants.ts` | Add `totalInGroupRaw`, `unregistered`, `totalUnregistered` fields; calculate unregistered members by comparing VPS list against leads |
| `src/pages/WorkshopDetail.tsx` | Add "Total in Group" card, "Unregistered" card, "Unregistered" tab with table and CSV download |

---

## Implementation Details

### Hook Changes (`useWorkshopParticipants.ts`)

```typescript
// New interface field
interface UnregisteredMember {
  id: string;
  phone: string;
  fullPhone: string;
  isAdmin: boolean;
}

// New calculation logic
const registeredPhoneSet = new Set(
  registeredLeads.map(l => normalizePhone(l.phone))
);

// Filter: in VPS, NOT in leads, NOT admin
const unregistered = vpsData.participants
  .filter(p => !p.isAdmin && !registeredPhoneSet.has(normalizePhone(p.phone)))
  .map(p => ({
    id: p.id,
    phone: normalizePhone(p.phone),
    fullPhone: p.phone,
    isAdmin: p.isAdmin,
  }));
```

### UI Changes (`WorkshopDetail.tsx`)

1. **New stat cards:**
   - "Total in Group" (all VPS participants)
   - "Unregistered" (VPS minus leads minus admins)

2. **New tab:**
   - Table showing phone numbers of unregistered members
   - Download CSV button

3. **Grid layout:**
   - Update from 5 columns to 6 columns on desktop
   - Keep 2 columns on mobile

---

## Summary

| Component | Change |
|-----------|--------|
| **New Stat Card** | "Total in Group" showing raw VPS count |
| **New Stat Card** | "Unregistered" showing non-admin, non-lead members |
| **New Tab** | "Unregistered" with phone list and CSV export |
| **Hook Update** | Calculate unregistered members from VPS data |

This will give you complete visibility into everyone in the WhatsApp group - whether they registered or not.

