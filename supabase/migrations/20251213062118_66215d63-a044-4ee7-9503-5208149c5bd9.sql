-- Step 1: Drop the constraint
ALTER TABLE lead_assignments DROP CONSTRAINT IF EXISTS at_least_one_assignment;

-- Step 2: Update lead_assignments to use product_id instead of workshop_id for the 5 product items

-- Sunday Classe Recordings: workshop 2381054f -> product 28f57164-5fcf-4b29-a806-fba60e193101
UPDATE lead_assignments SET 
  product_id = '28f57164-5fcf-4b29-a806-fba60e193101',
  workshop_id = NULL
WHERE workshop_id = '2381054f-1bc2-4e13-b290-507e69168db8';

-- Friday Crypto Community Class: workshop 65b09939 -> product 370e2065-796a-48d3-a2ff-f638020201dd
UPDATE lead_assignments SET 
  product_id = '370e2065-796a-48d3-a2ff-f638020201dd',
  workshop_id = NULL
WHERE workshop_id = '65b09939-96cc-4559-bd3d-ef0ee86c33fd';

-- Insider crypto club Partial Access: workshop 0c6e9d33 -> product a004e167-7c82-4022-af80-fd666cd679a1
UPDATE lead_assignments SET 
  product_id = 'a004e167-7c82-4022-af80-fd666cd679a1',
  workshop_id = NULL
WHERE workshop_id = '0c6e9d33-c8bb-4cc7-87c3-0aa8afa5ad41';

-- One To One Strategy Call with Crypto Expert: workshop b27dbc21 -> product 6d04c71f-458f-47e3-b5ee-5f251598734a
UPDATE lead_assignments SET 
  product_id = '6d04c71f-458f-47e3-b5ee-5f251598734a',
  workshop_id = NULL
WHERE workshop_id = 'b27dbc21-5aea-409b-8d40-86413843ae00';

-- LinkedIn High-Ticket challenge - EMI: workshop b05842bc -> product 76ab72a7-4857-400a-a63c-38e8fa8ed3cd
UPDATE lead_assignments SET 
  product_id = '76ab72a7-4857-400a-a63c-38e8fa8ed3cd',
  workshop_id = NULL
WHERE workshop_id = 'b05842bc-e847-4a7f-a073-b48e71674b2d';

-- Step 3: Delete the fake workshop entries
DELETE FROM workshops WHERE id IN (
  '2381054f-1bc2-4e13-b290-507e69168db8',
  '65b09939-96cc-4559-bd3d-ef0ee86c33fd',
  '0c6e9d33-c8bb-4cc7-87c3-0aa8afa5ad41',
  'b27dbc21-5aea-409b-8d40-86413843ae00',
  'b05842bc-e847-4a7f-a073-b48e71674b2d'
);

-- Step 4: Add the constraint back that allows product_id OR workshop_id OR funnel_id
ALTER TABLE lead_assignments ADD CONSTRAINT at_least_one_assignment 
  CHECK (workshop_id IS NOT NULL OR funnel_id IS NOT NULL OR product_id IS NOT NULL);