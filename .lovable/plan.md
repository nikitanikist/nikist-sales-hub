

# Add "Scheduled" Tab and Scheduled Time Column to IVR Campaigns Table

## Changes

### `src/pages/ivr/IvrCampaigns.tsx`

1. **Add "Scheduled" tab** — Insert a new `TabsTrigger` with `value="scheduled"` between "Running" and "Completed" tabs.

2. **Add "Scheduled For" column** — Add a new `TableHead` column after "Created". For each campaign, display the `scheduled_at` value formatted in IST (e.g., "11 Mar 2026, 2:30 PM") if it exists, otherwise show "—". Use `date-fns-tz` `formatInTimeZone` with `Asia/Kolkata`.

3. **Import** `formatInTimeZone` from `date-fns-tz`. Update `colSpan` on empty/loading rows from 8 to 9.

