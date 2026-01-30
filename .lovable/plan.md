

# Add Organization Timezone Setting

## Overview

Add a timezone setting at the organization level so that all time-related operations (workshop scheduling, notifications, etc.) use the organization's configured timezone instead of the browser's local timezone.

**Example:** You're in Dubai (GMT+4) but want to schedule a workshop notification at 7 PM India Time (GMT+5:30). With this feature, the system will always use the organization's timezone (India), regardless of where you access the dashboard from.

---

## Current Behavior

| Scenario | What Happens Now |
|----------|------------------|
| User in Dubai sets "7 PM" | Stored as 3 PM UTC (Dubai time) |
| User in India sets "7 PM" | Stored as 1:30 PM UTC (India time) |

This is inconsistent because the same "7 PM" results in different actual times.

---

## New Behavior

| Scenario | What Will Happen |
|----------|------------------|
| Org timezone: Asia/Kolkata (India) | |
| User in Dubai sets "7 PM" | Stored as 1:30 PM UTC (India time) |
| User in India sets "7 PM" | Stored as 1:30 PM UTC (India time) |

All times are interpreted as the organization's timezone, ensuring consistency.

---

## Implementation Steps

### Step 1: Add Timezone Column to Organizations Table

Add a new `timezone` column to the `organizations` table with a default of 'Asia/Kolkata'.

```sql
ALTER TABLE organizations 
ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata';
```

---

### Step 2: Update General Settings UI

Add a timezone selector dropdown to the General Settings page.

| Component | Description |
|-----------|-------------|
| `TimezoneSelect` | A reusable dropdown component with common timezones |
| Display current timezone | Show the active timezone in the settings |
| Save timezone | Update organization record when changed |

**Common Timezones to Include:**
- Asia/Kolkata (India - IST)
- Asia/Dubai (UAE - GST)
- America/New_York (Eastern US)
- America/Los_Angeles (Pacific US)
- Europe/London (UK - GMT/BST)
- Asia/Singapore (Singapore)
- Australia/Sydney (Australia)

---

### Step 3: Create Timezone Utility Hook

Create a new hook `useOrganizationTimezone` that provides:

```typescript
// Returns:
{
  timezone: 'Asia/Kolkata',      // Current org timezone
  toOrgTime: (date) => Date,     // Convert UTC to org timezone
  fromOrgTime: (date) => Date,   // Convert org timezone to UTC
  formatInOrgTime: (date, format) => string  // Format date in org timezone
}
```

---

### Step 4: Update Message Scheduling Logic

Modify `useWorkshopNotification.ts` to use the organization's timezone when calculating scheduled times.

**Current Code:**
```typescript
// Line 262-265 - Uses browser timezone implicitly
let scheduledFor = new Date(workshopDate);
scheduledFor = setHours(scheduledFor, hours);
scheduledFor = setMinutes(scheduledFor, minutes);
```

**New Code:**
```typescript
// Convert workshop date to org timezone, set time, convert back to UTC
const orgTimezone = organization.timezone || 'Asia/Kolkata';
const workshopInOrgTz = toZonedTime(workshopDate, orgTimezone);
let scheduledFor = setHours(workshopInOrgTz, hours);
scheduledFor = setMinutes(scheduledFor, minutes);
const scheduledForUTC = fromZonedTime(scheduledFor, orgTimezone);
```

---

### Step 5: Update Organization Context

Extend the `useOrganization` hook to include the timezone in the organization data.

```typescript
interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  is_active: boolean;
  timezone: string;  // NEW
}
```

---

### Step 6: Display Timezone in UI

Add timezone indicator in relevant places:
- Settings page shows current timezone
- Workshop notification shows "Times shown in IST" or similar
- Scheduled messages show times in org timezone

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| Database Migration | Create | Add `timezone` column to `organizations` |
| `src/lib/timezoneUtils.ts` | Create | Timezone conversion utilities |
| `src/hooks/useOrganization.tsx` | Modify | Include timezone in Organization interface |
| `src/pages/settings/GeneralSettings.tsx` | Modify | Add timezone selector dropdown |
| `src/hooks/useWorkshopNotification.ts` | Modify | Use org timezone for scheduling |
| `src/components/operations/MessageCheckpoints.tsx` | Modify | Display times in org timezone |

---

## Technical Details

### Timezone Library

Use `date-fns-tz` for timezone handling:

```bash
# Already compatible with date-fns v3
npm install date-fns-tz
```

Key functions:
- `toZonedTime(date, timezone)` - Convert UTC to timezone
- `fromZonedTime(date, timezone)` - Convert timezone to UTC
- `formatInTimeZone(date, timezone, format)` - Format in specific timezone

---

### Database Schema Change

```sql
-- Migration
ALTER TABLE organizations 
ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata';

-- Update existing organizations to India timezone
COMMENT ON COLUMN organizations.timezone IS 'IANA timezone identifier (e.g., Asia/Kolkata)';
```

---

### Timezone Selector Component

```typescript
const COMMON_TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'India (IST) - UTC+5:30' },
  { value: 'Asia/Dubai', label: 'Dubai (GST) - UTC+4' },
  { value: 'America/New_York', label: 'New York (EST/EDT)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT) - UTC+8' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
];
```

---

## Data Flow After Implementation

```text
User sets workshop time: 7:00 PM
                  |
                  v
System reads org timezone: Asia/Kolkata
                  |
                  v
Interpret as: 7:00 PM IST (UTC+5:30)
                  |
                  v
Convert to UTC: 1:30 PM UTC
                  |
                  v
Store in database: 2025-01-31T13:30:00Z
                  |
                  v
Edge function triggers at: 1:30 PM UTC
                  |
                  v
Message sent at: 7:00 PM India time
```

---

## Testing Checklist

1. Set organization timezone to India
2. Create a workshop with 7 PM start time
3. Run messaging to schedule notifications
4. Verify scheduled times are stored correctly in UTC
5. Verify messages are displayed in India time in the UI
6. Change browser location (VPN/device settings) and verify times remain consistent

