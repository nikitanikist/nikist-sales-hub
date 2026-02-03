

# Fix: Sync Converted Students to Cohort Batches

## What Happened

You are correct - there **was** logic, but it was a **one-time data migration** performed on January 28, 2026. This migration copied all existing converted students from `call_appointments` to the new unified `cohort_students` table. However, **no ongoing sync logic was implemented** to keep them connected after that date.

This means:
- Students converted **before** January 28, 2026 → Appear in both Sales Closers and Cohort Management
- Students converted **after** January 28, 2026 → Only appear in Sales Closers, NOT in Cohort Management

## Who Is Affected (Nikist Organization)

Currently, there are **8 students** converted to Insider Crypto Club Batch 3 who are missing from the cohort view:
1. Amit Kulkarni
2. Vijay Shetty  
3. Naveen S P
4. Aswini Veerapaneni
5. Ramkrishna Sahu
6. Arun B Kalburgi
7. Rahul Jangid
8. Dharun

These students show correctly in the Sales Closers → Update EMI dialog, but do NOT appear in the Insider Crypto Club → Batch 3 cohort page.

---

## Solution: Two-Part Fix

### Part 1: Immediate Data Sync (One-Time Fix)

Run a database migration to copy all missing converted students from `call_appointments` to `cohort_students`:

```sql
INSERT INTO public.cohort_students (
  cohort_batch_id, organization_id, lead_id, conversion_date, 
  offer_amount, cash_received, due_amount, classes_access, 
  closer_id, next_follow_up_date, no_cost_emi, gst_fees, 
  platform_fees, pay_after_earning, payment_platform, 
  payment_remarks, status, notes, refund_reason, created_by, created_at
)
SELECT 
  ca.batch_id,
  ca.organization_id,
  ca.lead_id,
  COALESCE(ca.conversion_date, ca.scheduled_date),
  ca.offer_amount,
  ca.cash_received,
  ca.due_amount,
  ca.classes_access,
  ca.closer_id,
  ca.next_follow_up_date,
  ca.no_cost_emi,
  ca.gst_fees,
  ca.platform_fees,
  ca.pay_after_earning,
  ca.payment_platform,
  ca.payment_remarks,
  CASE WHEN ca.status = 'refunded' THEN 'refunded' ELSE 'active' END,
  ca.additional_comments,
  ca.refund_reason,
  ca.created_by,
  ca.created_at
FROM public.call_appointments ca
JOIN public.cohort_batches cb ON cb.id = ca.batch_id
WHERE ca.batch_id IS NOT NULL
  AND ca.status IN ('converted', 'converted_beginner', 'converted_intermediate', 'converted_advance', 'booking_amount', 'refunded')
  AND NOT EXISTS (
    SELECT 1 FROM public.cohort_students cs 
    WHERE cs.lead_id = ca.lead_id 
      AND cs.cohort_batch_id = ca.batch_id
  );
```

### Part 2: Add Automatic Sync Logic (Permanent Fix)

Update `src/pages/CloserAssignedCalls.tsx` to automatically create/update a `cohort_students` record whenever a closer converts a call.

**Location:** Inside the `updateMutation` function (around line 582, after the successful `call_appointments` update)

**New Logic:**
```typescript
// After updating call_appointments successfully...
// If status is a converted type and has a batch assigned, sync to cohort_students
const convertedStatuses = ['converted', 'converted_beginner', 'converted_intermediate', 'converted_advance', 'booking_amount'];

if (convertedStatuses.includes(data.status) && data.batch_id) {
  // Check if this lead already exists in cohort_students for this batch
  const { data: existingStudent } = await supabase
    .from("cohort_students")
    .select("id")
    .eq("lead_id", freshAppointment.lead.id)
    .eq("cohort_batch_id", data.batch_id)
    .maybeSingle();

  if (existingStudent) {
    // Update existing cohort student
    await supabase
      .from("cohort_students")
      .update({
        offer_amount: data.offer_amount,
        cash_received: data.cash_received,
        due_amount,
        classes_access: data.classes_access,
        closer_id: closerId,
      })
      .eq("id", existingStudent.id);
  } else {
    // Create new cohort student
    await supabase
      .from("cohort_students")
      .insert({
        cohort_batch_id: data.batch_id,
        organization_id: organizationId,
        lead_id: freshAppointment.lead.id,
        conversion_date: freshAppointment.scheduled_date,
        offer_amount: data.offer_amount,
        cash_received: data.cash_received,
        due_amount,
        classes_access: data.classes_access,
        closer_id: closerId,
        status: 'active',
        created_by: user?.id
      });
  }
}
```

---

## Files to Modify

| File | Change |
|------|--------|
| Database Migration | Sync all missing converted students from `call_appointments` to `cohort_students` |
| `src/pages/CloserAssignedCalls.tsx` | Add automatic cohort_students sync when status becomes converted |

---

## Safety & Scope

- **Isolated Change**: Only affects the conversion flow in Sales Closers
- **No Breaking Changes**: The existing `call_appointments` update logic remains unchanged
- **Backward Compatible**: Works with all existing batches and students
- **Organization-Aware**: Uses `organization_id` to ensure multi-tenant isolation
- **Duplicate Prevention**: Checks for existing records before inserting

---

## What Will Change

| Before | After |
|--------|-------|
| Student converted in Sales Closers stays only in call_appointments | Student is automatically added to cohort_students as well |
| Cohort Management view shows stale data | Cohort Management view shows all converted students in real-time |
| Manual intervention needed to see new conversions | Zero manual intervention required |

---

## Testing After Implementation

1. Go to Sales Closers → Any closer (e.g., Dipanshu)
2. Find a scheduled call and convert it with a batch assignment
3. Go to the assigned cohort (e.g., Insider Crypto Club → Batch 3)
4. Verify the newly converted student appears immediately
5. Verify existing students (Amit Kulkarni, Vijay Shetty, etc.) now appear after the data migration

