-- Add converted_from_workshop_id column to track which workshop should receive revenue credit
ALTER TABLE lead_assignments 
ADD COLUMN converted_from_workshop_id UUID REFERENCES workshops(id);

COMMENT ON COLUMN lead_assignments.converted_from_workshop_id IS 
  'The workshop that should receive revenue credit for this product sale (used for rejoin attribution)';