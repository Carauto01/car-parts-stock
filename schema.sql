-- ==========================================
-- Car Parts Stock Management System
-- Supabase SQL Schema
-- ==========================================

-- ==========================================
-- 1. Products Table
-- ==========================================
CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  cost_price DECIMAL(10, 2) NOT NULL,
  sell_price DECIMAL(10, 2) NOT NULL,
  quantity INT DEFAULT 0 NOT NULL,
  description TEXT,
  image_url TEXT,
  sku VARCHAR(50) UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for searching
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_sku ON products(sku);

-- ==========================================
-- 2. Sales Table
-- ==========================================
CREATE TABLE IF NOT EXISTS sales (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INT NOT NULL CHECK(quantity > 0),
  unit_price DECIMAL(10, 2) NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  cost_total DECIMAL(10, 2),
  profit DECIMAL(10, 2),
  payment_method VARCHAR(50),
  customer_name VARCHAR(255),
  notes TEXT,
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for sales
CREATE INDEX idx_sales_product ON sales(product_id);
CREATE INDEX idx_sales_date ON sales(created_at);
CREATE INDEX idx_sales_customer ON sales(customer_name);

-- ==========================================
-- 3. Users Table
-- ==========================================
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK(role IN ('admin', 'manager', 'staff')),
  phone VARCHAR(20),
  email VARCHAR(255) UNIQUE,
  permissions TEXT[],
  status VARCHAR(20) DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'suspended')),
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for users
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);

-- ==========================================
-- 4. Stock History Table
-- ==========================================
CREATE TABLE IF NOT EXISTS stock_history (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity_change INT NOT NULL,
  operation VARCHAR(50) NOT NULL,
  notes TEXT,
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create index
CREATE INDEX idx_stock_history_product ON stock_history(product_id);
CREATE INDEX idx_stock_history_date ON stock_history(created_at);

-- ==========================================
-- 5. Categories Table (Optional)
-- ==========================================
CREATE TABLE IF NOT EXISTS categories (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ==========================================
-- 6. Daily Summary Table
-- ==========================================
CREATE TABLE IF NOT EXISTS daily_summary (
  id BIGSERIAL PRIMARY KEY,
  summary_date DATE UNIQUE NOT NULL,
  total_sales DECIMAL(12, 2) DEFAULT 0,
  total_cost DECIMAL(12, 2) DEFAULT 0,
  total_profit DECIMAL(12, 2) DEFAULT 0,
  transaction_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_daily_summary_date ON daily_summary(summary_date);

-- ==========================================
-- 7. Insert Default Admin User
-- ==========================================
INSERT INTO users (username, name, role, phone, permissions, status)
VALUES 
  ('admin', 'ผู้ดูแลระบบ', 'admin', '08-0000-0000', 
   ARRAY['dashboard', 'stock', 'sales', 'reports', 'users'], 'active'),
  ('manager', 'ผู้จัดการ', 'manager', '08-1111-1111', 
   ARRAY['dashboard', 'stock', 'sales', 'reports'], 'active'),
  ('staff', 'พนักงาน', 'staff', '08-2222-2222', 
   ARRAY['dashboard', 'sales'], 'active')
ON CONFLICT (username) DO NOTHING;

-- ==========================================
-- 8. Insert Sample Categories
-- ==========================================
INSERT INTO categories (name, description) VALUES
  ('สเปอร์', 'สเปอร์และล้อแม็ก'),
  ('แบมเปอร์', 'แบมเปอร์หน้า-หลัง'),
  ('ไฟ', 'ไฟหรี่ และไฟสัญญาณ'),
  ('ท่อ', 'ท่อไอเสีย และท่อแต่ง'),
  ('ภายใน', 'อุปกรณ์ภายในรถ'),
  ('สติกเกอร์', 'สติกเกอร์และลาย')
ON CONFLICT (name) DO NOTHING;

-- ==========================================
-- 9. Insert Sample Products
-- ==========================================
INSERT INTO products (name, category, cost_price, sell_price, quantity, sku, description) VALUES
  ('สเปอร์ยาง BBS', 'สเปอร์', 1500.00, 2500.00, 15, 'BBS-01', 'ยาง BBS แท้ 17 นิ้ว'),
  ('แบมเปอร์หน้า Honda', 'แบมเปอร์', 2000.00, 3500.00, 8, 'BUMPER-HONDA-01', 'แบมเปอร์หน้า Honda City'),
  ('ไฟหรี่ LED ขาว', 'ไฟ', 500.00, 1200.00, 25, 'LED-WHITE-01', 'ไฟหรี่ LED ขาว 6000K'),
  ('ท่อไอเสีย', 'ท่อ', 3000.00, 5500.00, 5, 'EXHAUST-01', 'ท่อไอเสีย สแตนเลส'),
  ('สเตียร์หนัง', 'ภายใน', 800.00, 1800.00, 20, 'STEERING-01', 'พวงมาลัยหนัง')
ON CONFLICT (sku) DO NOTHING;

-- ==========================================
-- 10. Enable Row Level Security (RLS)
-- ==========================================
-- เปิดใช้ RLS (ทำให้ปลอดภัยขึ้น)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_history ENABLE ROW LEVEL SECURITY;

-- สร้าง Basic Policies
-- ปล. คุณอาจต้องกำหนด policies เพิ่มเติมตามต้องการ

-- ==========================================
-- 11. Stored Procedures (Optional)
-- ==========================================

-- Function: Calculate Daily Summary
CREATE OR REPLACE FUNCTION calculate_daily_summary(p_date DATE)
RETURNS TABLE (
  total_sales DECIMAL,
  total_cost DECIMAL,
  total_profit DECIMAL,
  transaction_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(s.total), 0) as total_sales,
    COALESCE(SUM(s.cost_total), 0) as total_cost,
    COALESCE(SUM(s.profit), 0) as total_profit,
    COUNT(*) as transaction_count
  FROM sales s
  WHERE DATE(s.created_at) = p_date;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- Notes for Setup in Supabase:
-- ==========================================
-- 1. Copy all SQL above
-- 2. Go to Supabase Dashboard → SQL Editor
-- 3. Create New Query
-- 4. Paste SQL and Execute
-- 5. Configure:
--    - Authentication (if needed)
--    - Row Level Security (RLS) policies
--    - API settings in config.js

-- ==========================================
-- Useful Queries for Reporting
-- ==========================================

-- Sales by Date
-- SELECT DATE(created_at), SUM(total), COUNT(*) 
-- FROM sales 
-- GROUP BY DATE(created_at) 
-- ORDER BY DATE(created_at) DESC;

-- Top Selling Products
-- SELECT p.name, SUM(s.quantity) as total_sold, SUM(s.total) as revenue
-- FROM sales s
-- JOIN products p ON s.product_id = p.id
-- GROUP BY p.id, p.name
-- ORDER BY total_sold DESC
-- LIMIT 10;

-- Low Stock Alert
-- SELECT name, quantity, category
-- FROM products
-- WHERE quantity < 5
-- ORDER BY quantity ASC;

-- Profit Report
-- SELECT p.name, SUM(s.profit) as total_profit, SUM(s.quantity) as items_sold
-- FROM sales s
-- JOIN products p ON s.product_id = p.id
-- GROUP BY p.id, p.name
-- ORDER BY total_profit DESC;
