-- ==========================================================================
-- แพตช์แก้ข้อบกพร่องฝั่งฐานข้อมูล
--
-- วิธีใช้: Supabase Dashboard → SQL Editor → New query → วางทั้งไฟล์ → Run
-- รันซ้ำได้ ไม่พัง และไม่แตะข้อมูลที่มีอยู่
--
-- แก้ 3 เรื่อง:
--   1. บิลขายเชื่อราคาที่เบราว์เซอร์ส่งมา  → เปลี่ยนไปอ่านราคาจริงจากตารางสินค้า
--   2. ใส่ส่วนลดติดลบแล้วยอดบิลบวกเพิ่ม    → บังคับให้อยู่ในช่วง 0 ถึงยอดรวม
--   3. ลบพนักงานที่เคยออกบิลไม่ได้         → คลาย foreign key + เพิ่มวิธีปิดบัญชีแทนการลบ
-- ==========================================================================

SET search_path = public, extensions;

-- ==========================================================================
-- 1 + 2. บันทึกการขาย — ราคามาจากฐานข้อมูล ไม่ใช่จากเบราว์เซอร์
--
-- ของเดิมรับ cost/price ที่หน้าเว็บส่งมาใช้ตรง ๆ ใครแก้ค่าก่อนกดบันทึกก็บันทึกได้
-- ยอดขายกับกำไรในรายงานจึงเชื่อถือไม่ได้ ตอนนี้อ่านจากตาราง products เสมอ
-- ส่วน name ยังเก็บสำเนาไว้ในบิลเหมือนเดิม เผื่อสินค้าถูกลบหรือเปลี่ยนชื่อทีหลัง
-- ==========================================================================

CREATE OR REPLACE FUNCTION app_create_sale(
  p_token UUID, p_items JSONB, p_discount NUMERIC,
  p_payment TEXT, p_customer TEXT
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid      BIGINT := app_uid(p_token);
  v_item     JSONB;
  v_subtotal NUMERIC := 0;
  v_discount NUMERIC;
  v_sale_id  BIGINT;
  v_pid      BIGINT;
  v_qty      INT;
  v_product  products%ROWTYPE;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'ไม่มีรายการสินค้าในบิล';
  END IF;

  -- รอบแรก: ล็อกแถวสินค้า ตรวจสต็อก และคิดยอดรวมจากราคาจริงในฐานข้อมูล
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_pid := (v_item->>'id')::BIGINT;
    v_qty := (v_item->>'quantity')::INT;

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'จำนวนสินค้าต้องมากกว่า 0';
    END IF;

    SELECT * INTO v_product FROM products WHERE id = v_pid FOR UPDATE;

    IF v_product.id IS NULL THEN
      RAISE EXCEPTION 'ไม่พบสินค้ารหัส %', v_pid;
    END IF;

    IF v_product.quantity < v_qty THEN
      RAISE EXCEPTION 'สต็อกไม่พอ: % เหลือ % ชิ้น', v_product.name, v_product.quantity;
    END IF;

    v_subtotal := v_subtotal + v_product.sell_price * v_qty;
  END LOOP;

  -- ส่วนลดต้องไม่ติดลบ และต้องไม่เกินยอดรวม
  v_discount := LEAST(GREATEST(COALESCE(p_discount, 0), 0), v_subtotal);

  INSERT INTO sales (subtotal, discount, total, payment_method, customer_name, created_by)
  VALUES (
    v_subtotal,
    v_discount,
    v_subtotal - v_discount,
    p_payment,
    NULLIF(TRIM(COALESCE(p_customer, '')), ''),
    v_uid
  )
  RETURNING id INTO v_sale_id;

  -- รอบสอง: บันทึกรายการ ตัดสต็อก และลงประวัติ
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_pid := (v_item->>'id')::BIGINT;
    v_qty := (v_item->>'quantity')::INT;

    SELECT * INTO v_product FROM products WHERE id = v_pid;

    INSERT INTO sale_items (sale_id, product_id, name, cost_price, unit_price, quantity)
    VALUES (v_sale_id, v_pid, v_product.name, v_product.cost_price, v_product.sell_price, v_qty);

    UPDATE products
    SET quantity = quantity - v_qty, updated_at = NOW()
    WHERE id = v_pid;

    INSERT INTO stock_history (product_id, quantity_change, operation, notes, created_by)
    VALUES (v_pid, -v_qty, 'sale', 'บิลเลขที่ ' || v_sale_id, v_uid);
  END LOOP;

  RETURN v_sale_id;
END;
$$;

GRANT EXECUTE ON FUNCTION app_create_sale(UUID, JSONB, NUMERIC, TEXT, TEXT) TO anon;

-- ==========================================================================
-- 3. พนักงานที่ลาออก
--
-- ปัญหาเดิม: sales.created_by ผูก users(id) แบบไม่ระบุ ON DELETE
-- พอจะลบคนที่เคยออกบิล ฐานข้อมูลจะปฏิเสธทันที และระบบก็ไม่มีทางปิดบัญชีด้วย
-- ผลคือคนลาออกไปแล้วยังล็อกอินเข้าระบบร้านได้ตลอดไป
--
-- แก้เป็น ON DELETE SET NULL — บิลเก่ายังอยู่ครบ แค่ไม่รู้ว่าใครออกให้เท่านั้น
-- ==========================================================================

ALTER TABLE sales         DROP CONSTRAINT IF EXISTS sales_created_by_fkey;
ALTER TABLE sales         ADD  CONSTRAINT sales_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE stock_history DROP CONSTRAINT IF EXISTS stock_history_created_by_fkey;
ALTER TABLE stock_history ADD  CONSTRAINT stock_history_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- ปิด/เปิดบัญชีโดยไม่ต้องลบ — วิธีที่ควรใช้กับคนลาออก เพราะประวัติยังผูกชื่อไว้ครบ
CREATE OR REPLACE FUNCTION app_set_user_status(p_token UUID, p_id BIGINT, p_status TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_admins INT;
BEGIN
  PERFORM app_require_role(p_token, ARRAY['admin']);

  IF p_status NOT IN ('active', 'inactive') THEN
    RAISE EXCEPTION 'สถานะไม่ถูกต้อง';
  END IF;

  -- กันปิดบัญชีผู้ดูแลคนสุดท้ายจนไม่มีใครเข้าระบบได้
  IF p_status = 'inactive' THEN
    SELECT COUNT(*) INTO v_admins FROM users WHERE role = 'admin' AND status = 'active';

    IF v_admins <= 1 AND EXISTS (SELECT 1 FROM users WHERE id = p_id AND role = 'admin' AND status = 'active') THEN
      RAISE EXCEPTION 'ปิดไม่ได้ ต้องเหลือผู้ดูแลระบบที่ใช้งานได้อย่างน้อย 1 คน';
    END IF;
  END IF;

  UPDATE users SET status = p_status, updated_at = NOW() WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ไม่พบผู้ใช้ที่ต้องการแก้ไข';
  END IF;

  -- ปิดบัญชีแล้วต้องเตะเซสชันที่ค้างอยู่ออกด้วย ไม่งั้นยังใช้งานต่อได้จนกว่าจะหมดอายุ
  IF p_status = 'inactive' THEN
    DELETE FROM sessions WHERE user_id = p_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION app_set_user_status(UUID, BIGINT, TEXT) TO anon;

-- ==========================================================================
-- เสร็จแล้ว — ตรวจผลได้ด้วย 2 คำสั่งนี้
--
--   ส่วนลดติดลบต้องกลายเป็น 0 ไม่ใช่บวกเพิ่ม:
--     SELECT app_create_sale('<token>', '[{"id":1,"quantity":1}]'::jsonb, -500, 'cash', 'ทดสอบ');
--
--   ต้องเห็น ON DELETE SET NULL ทั้ง 2 แถว:
--     SELECT conname, confdeltype FROM pg_constraint
--     WHERE conname IN ('sales_created_by_fkey', 'stock_history_created_by_fkey');
--     -- confdeltype = 'n' คือ SET NULL
-- ==========================================================================
