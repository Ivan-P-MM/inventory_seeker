-- Migration to add inventory_categories table
CREATE TABLE IF NOT EXISTS inventory_categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  category_name text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_inventory_categories_name
  ON inventory_categories(category_name);

-- Enable Row Level Security
ALTER TABLE inventory_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access" ON inventory_categories
  FOR ALL
  USING (true)
  WITH CHECK (true);
