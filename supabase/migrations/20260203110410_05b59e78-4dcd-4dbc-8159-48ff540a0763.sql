-- Sync missing converted students from call_appointments to cohort_students
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