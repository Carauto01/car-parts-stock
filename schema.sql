-- ==========================================================================
-- ระบบจัดการสต็อก ศูนย์แต่งรถ — Supabase Schema
--
-- วิธีใช้: Supabase Dashboard → SQL Editor → New query → วางทั้งไฟล์ → Run
-- รันซ้ำได้ ไม่พัง (ใช้ IF NOT EXISTS / OR REPLACE ทั้งหมด)
--
-- แนวคิดด้านความปลอดภัย:
--   เว็บนี้เป็นเว็บสาธารณะ ใครก็เห็น anon key ได้ จึง "ปิดตายทุกตาราง" ด้วย RLS
--   โดยไม่สร้าง policy ใด ๆ เลย → anon key อ่าน/เขียนตารางตรง ๆ ไม่ได้แม้แต่แถวเดียว
--   ทุกอย่างต้องผ่านฟังก์ชัน app_* ที่ตรวจ token ก่อนเสมอ
--   รหัสผ่านเก็บเป็น bcrypt hash ไม่มีทางอ่านกลับเป็นตัวอักษรได้
-- ==========================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ==========================================================================
-- 1. ตาราง
-- ==========================================================================

-- ผู้ใช้งาน (ต้องสร้างก่อน เพราะตารางอื่นอ้างถึง)
CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  username      VARCHAR(100) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          VARCHAR(255) NOT NULL,
  role          VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'manager', 'staff')),
  phone         VARCHAR(20),
  permissions   TEXT[] DEFAULT '{}',
  status        VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- เซสชันการล็อกอิน (token ที่เว็บถือไว้)
CREATE TABLE IF NOT EXISTS sessions (
  token      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '12 hours'
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- สินค้า
CREATE TABLE IF NOT EXISTS products (
  id         BIGSERIAL PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  category   VARCHAR(100),
  cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  sell_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  quantity   INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  image_url  TEXT,
  sku        VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- บิลขาย (1 แถว = 1 ใบเสร็จ)
CREATE TABLE IF NOT EXISTS sales (
  id             BIGSERIAL PRIMARY KEY,
  subtotal       NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount       NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total          NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(50),
  customer_name  VARCHAR(255),
  created_by     BIGINT REFERENCES users(id),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(created_at);

-- รายการสินค้าในบิล (1 บิลมีได้หลายรายการ — ของเดิมทำไม่ได้)
CREATE TABLE IF NOT EXISTS sale_items (
  id         BIGSERIAL PRIMARY KEY,
  sale_id    BIGINT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
  name       VARCHAR(255) NOT NULL,   -- เก็บชื่อ ณ วันขาย เผื่อสินค้าถูกลบ/เปลี่ยนชื่อ
  cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  quantity   INT NOT NULL CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);

-- ประวัติการเคลื่อนไหวสต็อก
CREATE TABLE IF NOT EXISTS stock_history (
  id              BIGSERIAL PRIMARY KEY,
  product_id      BIGINT REFERENCES products(id) ON DELETE CASCADE,
  quantity_change INT NOT NULL,
  operation       VARCHAR(50) NOT NULL,
  notes           TEXT,
  created_by      BIGINT REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_history_product ON stock_history(product_id);

-- ==========================================================================
-- 2. ปิดตายทุกตาราง (RLS เปิด แต่ไม่มี policy = anon key แตะไม่ได้เลย)
-- ==========================================================================

ALTER TABLE users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE products      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales         ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_history ENABLE ROW LEVEL SECURITY;

-- ==========================================================================
-- 3. ฟังก์ชันภายใน — ตรวจ token
-- ==========================================================================

-- คืน id ของผู้ใช้จาก token ถ้า token ใช้ไม่ได้จะ error ทันที
CREATE OR REPLACE FUNCTION app_uid(p_token UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid BIGINT;
BEGIN
  DELETE FROM sessions WHERE expires_at < NOW();   -- เก็บกวาดเซสชันหมดอายุ

  SELECT s.user_id INTO v_uid
  FROM sessions s
  JOIN users u ON u.id = s.user_id
  WHERE s.token = p_token
    AND s.expires_at > NOW()
    AND u.status = 'active';

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' USING ERRCODE = '28000';
  END IF;

  -- ต่ออายุเซสชันทุกครั้งที่ใช้งาน
  UPDATE sessions SET expires_at = NOW() + INTERVAL '12 hours' WHERE token = p_token;

  RETURN v_uid;
END;
$$;

-- ตรวจว่าผู้ใช้มีตำแหน่งตามที่กำหนดไหม
CREATE OR REPLACE FUNCTION app_require_role(p_token UUID, p_roles TEXT[])
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  BIGINT := app_uid(p_token);
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM users WHERE id = v_uid;

  IF NOT (v_role = ANY (p_roles)) THEN
    RAISE EXCEPTION 'ไม่มีสิทธิ์ใช้งานส่วนนี้' USING ERRCODE = '42501';
  END IF;

  RETURN v_uid;
END;
$$;

-- ==========================================================================
-- 4. เข้าสู่ระบบ / ออกจากระบบ
-- ==========================================================================

CREATE OR REPLACE FUNCTION app_login(p_username TEXT, p_password TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user  users%ROWTYPE;
  v_token UUID;
BEGIN
  SELECT * INTO v_user
  FROM users
  WHERE username = LOWER(TRIM(p_username)) AND status = 'active';

  -- เทียบรหัสผ่านกับ bcrypt hash (ไม่มีการอ่านรหัสจริงออกมาเลย)
  IF v_user.id IS NULL OR v_user.password_hash <> crypt(p_password, v_user.password_hash) THEN
    RAISE EXCEPTION 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' USING ERRCODE = '28P01';
  END IF;

  INSERT INTO sessions (user_id) VALUES (v_user.id) RETURNING token INTO v_token;
  UPDATE users SET last_login = NOW() WHERE id = v_user.id;

  RETURN json_build_object(
    'token', v_token,
    'user', json_build_object(
      'id', v_user.id,
      'username', v_user.username,
      'name', v_user.name,
      'role', v_user.role,
      'permissions', v_user.permissions
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION app_logout(p_token UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM sessions WHERE token = p_token;
$$;

-- ==========================================================================
-- 5. สินค้า
-- ==========================================================================

CREATE OR REPLACE FUNCTION app_products(p_token UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM app_uid(p_token);

  RETURN COALESCE((
    SELECT json_agg(json_build_object(
      'id', id, 'name', name, 'category', category,
      'cost', cost_price, 'price', sell_price,
      'quantity', quantity, 'image', COALESCE(image_url, '')
    ) ORDER BY id)
    FROM products
  ), '[]'::json);
END;
$$;

-- p_id = NULL คือเพิ่มใหม่, ใส่ id คือแก้ไข
CREATE OR REPLACE FUNCTION app_save_product(
  p_token UUID, p_id BIGINT, p_name TEXT, p_category TEXT,
  p_cost NUMERIC, p_price NUMERIC, p_quantity INT, p_image TEXT
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid BIGINT := app_require_role(p_token, ARRAY['admin', 'manager']);
  v_id  BIGINT;
  v_old INT;
BEGIN
  IF p_id IS NULL THEN
    INSERT INTO products (name, category, cost_price, sell_price, quantity, image_url)
    VALUES (p_name, p_category, p_cost, p_price, p_quantity, NULLIF(p_image, ''))
    RETURNING id INTO v_id;

    INSERT INTO stock_history (product_id, quantity_change, operation, created_by)
    VALUES (v_id, p_quantity, 'create', v_uid);
  ELSE
    SELECT quantity INTO v_old FROM products WHERE id = p_id;

    UPDATE products SET
      name = p_name, category = p_category,
      cost_price = p_cost, sell_price = p_price,
      quantity = p_quantity, image_url = NULLIF(p_image, ''),
      updated_at = NOW()
    WHERE id = p_id
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'ไม่พบสินค้าที่ต้องการแก้ไข';
    END IF;

    IF v_old IS DISTINCT FROM p_quantity THEN
      INSERT INTO stock_history (product_id, quantity_change, operation, created_by)
      VALUES (v_id, p_quantity - v_old, 'adjust', v_uid);
    END IF;
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION app_delete_product(p_token UUID, p_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM app_require_role(p_token, ARRAY['admin', 'manager']);
  DELETE FROM products WHERE id = p_id;
END;
$$;

-- ==========================================================================
-- 6. การขาย
-- ==========================================================================

CREATE OR REPLACE FUNCTION app_sales(p_token UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM app_uid(p_token);

  RETURN COALESCE((
    SELECT json_agg(json_build_object(
      'id', s.id,
      'subtotal', s.subtotal, 'discount', s.discount, 'total', s.total,
      'payment', s.payment_method, 'customer', s.customer_name,
      'date', s.created_at,
      'items', COALESCE((
        SELECT json_agg(json_build_object(
          'id', i.product_id, 'name', i.name,
          'cost', i.cost_price, 'price', i.unit_price, 'quantity', i.quantity
        ))
        FROM sale_items i WHERE i.sale_id = s.id
      ), '[]'::json)
    ) ORDER BY s.created_at)
    FROM sales s
  ), '[]'::json);
END;
$$;

-- ตัดสต็อก + บันทึกบิล ในทรานแซกชันเดียว
-- ถ้าของไม่พอแม้แต่รายการเดียว จะ rollback ทั้งบิล ไม่มีทางตัดครึ่ง ๆ กลาง ๆ
-- p_items = [{"id":1,"name":"...","cost":1500,"price":2500,"quantity":2}, ...]
CREATE OR REPLACE FUNCTION app_create_sale(
  p_token UUID, p_items JSONB, p_discount NUMERIC,
  p_payment TEXT, p_customer TEXT
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      BIGINT := app_uid(p_token);
  v_item     JSONB;
  v_subtotal NUMERIC := 0;
  v_sale_id  BIGINT;
  v_stock    INT;
  v_name     TEXT;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'ไม่มีรายการสินค้าในบิล';
  END IF;

  -- ล็อกแถวสินค้าไว้ก่อน กันสองเครื่องขายชิ้นสุดท้ายพร้อมกัน
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT quantity, name INTO v_stock, v_name
    FROM products WHERE id = (v_item->>'id')::BIGINT FOR UPDATE;

    IF v_stock IS NULL THEN
      RAISE EXCEPTION 'ไม่พบสินค้ารหัส %', v_item->>'id';
    END IF;

    IF v_stock < (v_item->>'quantity')::INT THEN
      RAISE EXCEPTION 'สต็อกไม่พอ: % เหลือ % ชิ้น', v_name, v_stock;
    END IF;

    v_subtotal := v_subtotal + (v_item->>'price')::NUMERIC * (v_item->>'quantity')::INT;
  END LOOP;

  INSERT INTO sales (subtotal, discount, total, payment_method, customer_name, created_by)
  VALUES (
    v_subtotal,
    COALESCE(p_discount, 0),
    GREATEST(v_subtotal - COALESCE(p_discount, 0), 0),
    p_payment,
    NULLIF(TRIM(COALESCE(p_customer, '')), ''),
    v_uid
  )
  RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO sale_items (sale_id, product_id, name, cost_price, unit_price, quantity)
    VALUES (
      v_sale_id,
      (v_item->>'id')::BIGINT,
      v_item->>'name',
      (v_item->>'cost')::NUMERIC,
      (v_item->>'price')::NUMERIC,
      (v_item->>'quantity')::INT
    );

    UPDATE products
    SET quantity = quantity - (v_item->>'quantity')::INT, updated_at = NOW()
    WHERE id = (v_item->>'id')::BIGINT;

    INSERT INTO stock_history (product_id, quantity_change, operation, notes, created_by)
    VALUES (
      (v_item->>'id')::BIGINT,
      -(v_item->>'quantity')::INT,
      'sale',
      'บิลเลขที่ ' || v_sale_id,
      v_uid
    );
  END LOOP;

  RETURN v_sale_id;
END;
$$;

-- ==========================================================================
-- 7. ผู้ใช้งาน (เฉพาะ admin)
-- ==========================================================================

CREATE OR REPLACE FUNCTION app_users(p_token UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM app_require_role(p_token, ARRAY['admin']);

  -- ไม่ส่ง password_hash ออกไปเด็ดขาด
  RETURN COALESCE((
    SELECT json_agg(json_build_object(
      'id', id, 'username', username, 'name', name, 'role', role,
      'phone', COALESCE(phone, ''), 'status', status,
      'permissions', COALESCE(permissions, '{}')
    ) ORDER BY id)
    FROM users
  ), '[]'::json);
END;
$$;

CREATE OR REPLACE FUNCTION app_save_user(
  p_token UUID, p_id BIGINT, p_username TEXT, p_password TEXT,
  p_name TEXT, p_role TEXT, p_phone TEXT, p_permissions TEXT[]
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id       BIGINT;
  v_username TEXT := LOWER(TRIM(p_username));
BEGIN
  PERFORM app_require_role(p_token, ARRAY['admin']);

  IF p_id IS NULL THEN
    IF p_password IS NULL OR LENGTH(p_password) < 6 THEN
      RAISE EXCEPTION 'รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร';
    END IF;

    INSERT INTO users (username, password_hash, name, role, phone, permissions)
    VALUES (v_username, crypt(p_password, gen_salt('bf')), p_name, p_role,
            NULLIF(p_phone, ''), COALESCE(p_permissions, '{}'))
    RETURNING id INTO v_id;
  ELSE
    UPDATE users SET
      username = v_username, name = p_name, role = p_role,
      phone = NULLIF(p_phone, ''), permissions = COALESCE(p_permissions, '{}'),
      password_hash = CASE
        WHEN p_password IS NULL OR p_password = '' THEN password_hash
        ELSE crypt(p_password, gen_salt('bf'))
      END,
      updated_at = NOW()
    WHERE id = p_id
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'ไม่พบผู้ใช้ที่ต้องการแก้ไข';
    END IF;
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION app_set_password(p_token UUID, p_id BIGINT, p_password TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM app_require_role(p_token, ARRAY['admin']);

  IF p_password IS NULL OR LENGTH(p_password) < 6 THEN
    RAISE EXCEPTION 'รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร';
  END IF;

  UPDATE users SET password_hash = crypt(p_password, gen_salt('bf')), updated_at = NOW()
  WHERE id = p_id;

  -- เปลี่ยนรหัสแล้วเตะเซสชันเดิมออกทั้งหมด
  DELETE FROM sessions WHERE user_id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION app_delete_user(p_token UUID, p_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admins INT;
BEGIN
  PERFORM app_require_role(p_token, ARRAY['admin']);

  -- กันลบ admin คนสุดท้ายจนไม่มีใครเข้าระบบได้
  SELECT COUNT(*) INTO v_admins FROM users WHERE role = 'admin' AND status = 'active';

  IF v_admins <= 1 AND EXISTS (SELECT 1 FROM users WHERE id = p_id AND role = 'admin') THEN
    RAISE EXCEPTION 'ลบไม่ได้ ต้องเหลือผู้ดูแลระบบอย่างน้อย 1 คน';
  END IF;

  DELETE FROM users WHERE id = p_id;
END;
$$;

-- ==========================================================================
-- 8. เปิดสิทธิ์เรียกเฉพาะฟังก์ชัน app_* (ตารางยังปิดตายเหมือนเดิม)
-- ==========================================================================

REVOKE ALL ON FUNCTION app_uid(UUID) FROM anon, authenticated;
REVOKE ALL ON FUNCTION app_require_role(UUID, TEXT[]) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION app_login(TEXT, TEXT)            TO anon;
GRANT EXECUTE ON FUNCTION app_logout(UUID)                 TO anon;
GRANT EXECUTE ON FUNCTION app_products(UUID)               TO anon;
GRANT EXECUTE ON FUNCTION app_save_product(UUID, BIGINT, TEXT, TEXT, NUMERIC, NUMERIC, INT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION app_delete_product(UUID, BIGINT) TO anon;
GRANT EXECUTE ON FUNCTION app_sales(UUID)                  TO anon;
GRANT EXECUTE ON FUNCTION app_create_sale(UUID, JSONB, NUMERIC, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION app_users(UUID)                  TO anon;
GRANT EXECUTE ON FUNCTION app_save_user(UUID, BIGINT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[]) TO anon;
GRANT EXECUTE ON FUNCTION app_set_password(UUID, BIGINT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION app_delete_user(UUID, BIGINT)    TO anon;

-- ==========================================================================
-- 9. ข้อมูลเริ่มต้น
-- ==========================================================================

-- ผู้ใช้ 3 คน (รหัสผ่านถูกเข้ารหัส bcrypt ก่อนเก็บ)
-- ⚠️ เข้าระบบครั้งแรกแล้วเปลี่ยนรหัสทันทีที่หน้า "ผู้ใช้"
INSERT INTO users (username, password_hash, name, role, phone, permissions)
VALUES
  ('admin',   crypt('admin123',   gen_salt('bf')), 'ผู้ดูแลระบบ', 'admin',   '08-0000-0000', ARRAY['dashboard','stock','sales','reports','users']),
  ('manager', crypt('manager123', gen_salt('bf')), 'ผู้จัดการ',   'manager', '08-1111-1111', ARRAY['dashboard','stock','sales','reports']),
  ('staff',   crypt('staff123',   gen_salt('bf')), 'พนักงาน',     'staff',   '08-2222-2222', ARRAY['dashboard','sales'])
ON CONFLICT (username) DO NOTHING;

-- สินค้าตัวอย่าง (ใส่ให้เฉพาะตอนตารางยังว่าง)
INSERT INTO products (name, category, cost_price, sell_price, quantity, sku)
SELECT * FROM (VALUES
  ('สเปอร์ยาง BBS',      'สเปอร์',   1500.00, 2500.00, 15, 'BBS-01'),
  ('แบมเปอร์หน้า Honda', 'แบมเปอร์', 2000.00, 3500.00,  8, 'BUMPER-01'),
  ('ไฟหรี่ LED ขาว',     'ไฟ',        500.00, 1200.00, 25, 'LED-01'),
  ('ท่อไอเสีย',          'ท่อ',      3000.00, 5500.00,  5, 'EXHAUST-01'),
  ('สเตียร์หนัง',        'ภายใน',     800.00, 1800.00, 20, 'STEERING-01')
) AS seed(name, category, cost_price, sell_price, quantity, sku)
WHERE NOT EXISTS (SELECT 1 FROM products);

-- ==========================================================================
-- เสร็จแล้ว — ทดสอบได้ด้วยคำสั่งนี้ (ควรได้ token กลับมา):
--   SELECT app_login('admin', 'admin123');
-- และคำสั่งนี้ต้อง error "permission denied" ซึ่งแปลว่า RLS ทำงานถูกต้อง:
--   SET ROLE anon; SELECT * FROM users;
-- ==========================================================================
