-- Add funnel_id and product_id columns to workshops table
ALTER TABLE workshops 
ADD COLUMN funnel_id uuid REFERENCES funnels(id) ON DELETE SET NULL,
ADD COLUMN product_id uuid REFERENCES products(id) ON DELETE SET NULL;

-- Create indexes for better query performance
CREATE INDEX idx_workshops_funnel_id ON workshops(funnel_id);
CREATE INDEX idx_workshops_product_id ON workshops(product_id);