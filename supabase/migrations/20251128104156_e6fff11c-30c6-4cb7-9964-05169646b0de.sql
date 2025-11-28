-- Add amount field to workshops for price tracking
ALTER TABLE workshops ADD COLUMN IF NOT EXISTS amount numeric DEFAULT 0;

-- Add workshop_id to products for bi-directional linking
ALTER TABLE products ADD COLUMN IF NOT EXISTS workshop_id uuid REFERENCES workshops(id) ON DELETE SET NULL;

-- Add workshop_id and product_id to funnels for bi-directional linking
ALTER TABLE funnels ADD COLUMN IF NOT EXISTS workshop_id uuid REFERENCES workshops(id) ON DELETE SET NULL;
ALTER TABLE funnels ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES products(id) ON DELETE SET NULL;