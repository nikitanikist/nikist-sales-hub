
-- Phase 2: Migrate Nikist data to unified cohort tables
-- This migration copies existing data from legacy tables to the new unified structure

-- Step 1: Migrate batches from legacy 'batches' table to cohort_batches (for Insider Crypto Club)
INSERT INTO public.cohort_batches (id, cohort_type_id, organization_id, name, start_date, is_active, created_by, created_at, updated_at, status)
SELECT 
  b.id,
  ct.id as cohort_type_id,
  b.organization_id,
  b.name,
  b.start_date,
  b.is_active,
  b.created_by,
  b.created_at,
  b.updated_at,
  'active'::text as status
FROM public.batches b
JOIN public.cohort_types ct ON ct.organization_id = b.organization_id AND ct.slug = 'insider-crypto-club'
ON CONFLICT (id) DO NOTHING;

-- Step 2: Migrate batches from futures_mentorship_batches to cohort_batches
INSERT INTO public.cohort_batches (id, cohort_type_id, organization_id, name, start_date, event_dates, is_active, created_by, created_at, updated_at, status)
SELECT 
  fmb.id,
  ct.id as cohort_type_id,
  fmb.organization_id,
  fmb.name,
  NULL as start_date,
  fmb.event_dates,
  fmb.is_active,
  fmb.created_by,
  fmb.created_at,
  fmb.updated_at,
  fmb.status
FROM public.futures_mentorship_batches fmb
JOIN public.cohort_types ct ON ct.organization_id = fmb.organization_id AND ct.slug = 'futures-mentorship'
ON CONFLICT (id) DO NOTHING;

-- Step 3: Migrate batches from high_future_batches to cohort_batches
INSERT INTO public.cohort_batches (id, cohort_type_id, organization_id, name, start_date, event_dates, is_active, created_by, created_at, updated_at, status)
SELECT 
  hfb.id,
  ct.id as cohort_type_id,
  hfb.organization_id,
  hfb.name,
  NULL as start_date,
  hfb.event_dates,
  hfb.is_active,
  hfb.created_by,
  hfb.created_at,
  hfb.updated_at,
  hfb.status
FROM public.high_future_batches hfb
JOIN public.cohort_types ct ON ct.organization_id = hfb.organization_id AND ct.slug = 'high-future'
ON CONFLICT (id) DO NOTHING;

-- Step 4: Migrate students from call_appointments (Insider Crypto Club conversions) to cohort_students
-- These are students who were converted through call appointments and assigned to batches
INSERT INTO public.cohort_students (id, cohort_batch_id, organization_id, lead_id, conversion_date, offer_amount, cash_received, due_amount, classes_access, closer_id, next_follow_up_date, no_cost_emi, gst_fees, platform_fees, pay_after_earning, payment_platform, payment_remarks, status, notes, refund_reason, created_by, created_at)
SELECT 
  gen_random_uuid() as id,
  cb.id as cohort_batch_id,
  ca.organization_id,
  ca.lead_id,
  COALESCE(ca.conversion_date, ca.scheduled_date) as conversion_date,
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
  CASE 
    WHEN ca.status = 'refunded' THEN 'refunded'
    ELSE 'active'
  END as status,
  ca.additional_comments as notes,
  ca.refund_reason,
  ca.created_by,
  ca.created_at
FROM public.call_appointments ca
JOIN public.cohort_batches cb ON cb.id = ca.batch_id
WHERE ca.batch_id IS NOT NULL
  AND ca.status IN ('converted', 'converted_beginner', 'converted_intermediate', 'converted_advance', 'booking_amount', 'refunded')
ON CONFLICT DO NOTHING;

-- Step 5: Migrate futures_mentorship_students to cohort_students
INSERT INTO public.cohort_students (id, cohort_batch_id, organization_id, lead_id, conversion_date, offer_amount, cash_received, due_amount, classes_access, closer_id, next_follow_up_date, no_cost_emi, gst_fees, platform_fees, pay_after_earning, payment_platform, payment_remarks, status, notes, refund_reason, created_by, created_at)
SELECT 
  fms.id,
  cb.id as cohort_batch_id,
  fms.organization_id,
  fms.lead_id,
  fms.conversion_date,
  fms.offer_amount,
  fms.cash_received,
  fms.due_amount,
  fms.classes_access,
  fms.closer_id,
  fms.next_follow_up_date,
  fms.no_cost_emi,
  fms.gst_fees,
  fms.platform_fees,
  fms.pay_after_earning,
  fms.payment_platform,
  fms.payment_remarks,
  fms.status,
  fms.notes,
  fms.refund_reason,
  fms.created_by,
  fms.created_at
FROM public.futures_mentorship_students fms
JOIN public.cohort_batches cb ON cb.id = fms.batch_id
ON CONFLICT (id) DO NOTHING;

-- Step 6: Migrate high_future_students to cohort_students
INSERT INTO public.cohort_students (id, cohort_batch_id, organization_id, lead_id, conversion_date, offer_amount, cash_received, due_amount, classes_access, closer_id, next_follow_up_date, no_cost_emi, gst_fees, platform_fees, pay_after_earning, payment_platform, payment_remarks, status, notes, refund_reason, created_by, created_at)
SELECT 
  hfs.id,
  cb.id as cohort_batch_id,
  hfs.organization_id,
  hfs.lead_id,
  hfs.conversion_date,
  hfs.offer_amount,
  hfs.cash_received,
  hfs.due_amount,
  hfs.classes_access,
  hfs.closer_id,
  hfs.next_follow_up_date,
  hfs.no_cost_emi,
  hfs.gst_fees,
  hfs.platform_fees,
  hfs.pay_after_earning,
  hfs.payment_platform,
  hfs.payment_remarks,
  hfs.status,
  hfs.notes,
  hfs.refund_reason,
  hfs.created_by,
  hfs.created_at
FROM public.high_future_students hfs
JOIN public.cohort_batches cb ON cb.id = hfs.batch_id
ON CONFLICT (id) DO NOTHING;

-- Step 7: Migrate futures_emi_payments to cohort_emi_payments
INSERT INTO public.cohort_emi_payments (id, student_id, organization_id, emi_number, amount, payment_date, previous_cash_received, no_cost_emi, gst_fees, platform_fees, payment_platform, remarks, created_by, created_at)
SELECT 
  fep.id,
  fep.student_id,
  fep.organization_id,
  fep.emi_number,
  fep.amount,
  fep.payment_date,
  fep.previous_cash_received,
  fep.no_cost_emi,
  fep.gst_fees,
  fep.platform_fees,
  fep.payment_platform,
  fep.remarks,
  fep.created_by,
  fep.created_at
FROM public.futures_emi_payments fep
WHERE EXISTS (SELECT 1 FROM public.cohort_students cs WHERE cs.id = fep.student_id)
ON CONFLICT (id) DO NOTHING;

-- Step 8: Migrate high_future_emi_payments to cohort_emi_payments
INSERT INTO public.cohort_emi_payments (id, student_id, organization_id, emi_number, amount, payment_date, previous_cash_received, no_cost_emi, gst_fees, platform_fees, payment_platform, remarks, created_by, created_at)
SELECT 
  hfep.id,
  hfep.student_id,
  hfep.organization_id,
  hfep.emi_number,
  hfep.amount,
  hfep.payment_date,
  hfep.previous_cash_received,
  hfep.no_cost_emi,
  hfep.gst_fees,
  hfep.platform_fees,
  hfep.payment_platform,
  hfep.remarks,
  hfep.created_by,
  hfep.created_at
FROM public.high_future_emi_payments hfep
WHERE EXISTS (SELECT 1 FROM public.cohort_students cs WHERE cs.id = hfep.student_id)
ON CONFLICT (id) DO NOTHING;

-- Step 9: Migrate futures_offer_amount_history to cohort_offer_amount_history
INSERT INTO public.cohort_offer_amount_history (id, student_id, organization_id, previous_amount, new_amount, changed_by, changed_at, reason)
SELECT 
  foah.id,
  foah.student_id,
  foah.organization_id,
  foah.previous_amount,
  foah.new_amount,
  foah.changed_by,
  foah.changed_at,
  foah.reason
FROM public.futures_offer_amount_history foah
WHERE EXISTS (SELECT 1 FROM public.cohort_students cs WHERE cs.id = foah.student_id)
ON CONFLICT (id) DO NOTHING;

-- Step 10: Migrate high_future_offer_amount_history to cohort_offer_amount_history
INSERT INTO public.cohort_offer_amount_history (id, student_id, organization_id, previous_amount, new_amount, changed_by, changed_at, reason)
SELECT 
  hfoah.id,
  hfoah.student_id,
  hfoah.organization_id,
  hfoah.previous_amount,
  hfoah.new_amount,
  hfoah.changed_by,
  hfoah.changed_at,
  hfoah.reason
FROM public.high_future_offer_amount_history hfoah
WHERE EXISTS (SELECT 1 FROM public.cohort_students cs WHERE cs.id = hfoah.student_id)
ON CONFLICT (id) DO NOTHING;
