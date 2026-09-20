-- ==========================================================================
-- ส่วนเสริม: ตั้งค่าร้าน (โลโก้ / ที่อยู่ / QR / ข้อความบนเอกสาร)
--
-- วิธีใช้: Supabase Dashboard → SQL Editor → New query → วางทั้งไฟล์ → Run
-- รันซ้ำได้ ไม่พัง — และรันหลัง schema.sql เท่านั้น
-- ==========================================================================

SET search_path = public, extensions;

-- เก็บเป็นแถวเดียว (id = 1) ข้อมูลอยู่ในคอลัมน์ JSON เพิ่มฟิลด์ใหม่ได้โดยไม่ต้องแก้ตาราง
CREATE TABLE IF NOT EXISTS settings (
  id         INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  data       JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by BIGINT REFERENCES users(id)
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- ค่าเริ่มต้น (ใส่ให้ครั้งแรกครั้งเดียว)
INSERT INTO settings (id, data)
VALUES (1, jsonb_build_object(
  'shopName',     'ศูนย์แต่งรถ',
  'shopNameEn',   'Car Parts Stock',
  'address',      '',
  'phone',        '',
  'taxId',        '',
  'logo',         '',
  'qrMode',       'auto',        -- auto = สร้างจากข้อมูลบิล | image = รูปที่อัปโหลด | none = ไม่แสดง
  'qrImage',      '',
  'qrCaption',    'สแกนเพื่อชำระเงิน',
  'receiptNote',  'ขอบคุณที่ใช้บริการ ยินดีต้อนรับกลับมา',
  'poNote',       'กรุณาตรวจสอบรายการก่อนยืนยันการสั่งซื้อ'
))
ON CONFLICT (id) DO NOTHING;

-- ==========================================================================
-- ฟังก์ชัน
-- ==========================================================================

-- อ่านค่าตั้งค่า — ผู้ใช้ที่ล็อกอินแล้วทุกคนอ่านได้ (ต้องใช้ตอนออกใบเสร็จ)
CREATE OR REPLACE FUNCTION app_settings(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_data JSONB;
BEGIN
  PERFORM app_uid(p_token);

  SELECT data INTO v_data FROM settings WHERE id = 1;
  RETURN COALESCE(v_data, '{}'::jsonb);
END;
$$;

-- บันทึกค่าตั้งค่า — เฉพาะ admin กับ manager
-- รวมค่าเดิมกับค่าใหม่ (||) เลยส่งมาเฉพาะฟิลด์ที่แก้ก็ได้
CREATE OR REPLACE FUNCTION app_save_settings(p_token UUID, p_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid  BIGINT := app_require_role(p_token, ARRAY['admin', 'manager']);
  v_data JSONB;
BEGIN
  UPDATE settings
  SET data = data || p_data, updated_at = NOW(), updated_by = v_uid
  WHERE id = 1
  RETURNING data INTO v_data;

  RETURN v_data;
END;
$$;

GRANT EXECUTE ON FUNCTION app_settings(UUID)          TO anon;
GRANT EXECUTE ON FUNCTION app_save_settings(UUID, JSONB) TO anon;

-- ==========================================================================
-- เสร็จแล้ว — ทดสอบ: SELECT app_settings((SELECT app_login('admin','admin123')->>'token')::uuid);
-- ==========================================================================
