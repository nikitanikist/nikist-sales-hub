-- Add foreign key constraints to high_future_students
ALTER TABLE high_future_students
  ADD CONSTRAINT high_future_students_batch_id_fkey 
    FOREIGN KEY (batch_id) REFERENCES high_future_batches(id) ON DELETE CASCADE,
  ADD CONSTRAINT high_future_students_lead_id_fkey 
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;

-- Add foreign key constraints to high_future_emi_payments
ALTER TABLE high_future_emi_payments
  ADD CONSTRAINT high_future_emi_payments_student_id_fkey 
    FOREIGN KEY (student_id) REFERENCES high_future_students(id) ON DELETE CASCADE;

-- Add foreign key constraints to high_future_offer_amount_history
ALTER TABLE high_future_offer_amount_history
  ADD CONSTRAINT high_future_offer_amount_history_student_id_fkey 
    FOREIGN KEY (student_id) REFERENCES high_future_students(id) ON DELETE CASCADE;