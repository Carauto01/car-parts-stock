# 🛠️ คู่มือการตั้งค่าระบบ

ตัวอย่างการตั้งค่าระบบสต็อก ศูนย์แต่งรถ จากศูนย์ถึง Ready to Use

---

## 📌 ขั้นตอนที่ 1: โหลด Project

### ตัวเลือก A: Clone จาก GitHub
```bash
git clone https://github.com/your-username/car-parts-stock.git
cd car-parts-stock
```

### ตัวเลือก B: ดาวน์โหลด ZIP
1. ไปที่ GitHub Release
2. คลิก "Download ZIP"
3. แตกไฟล์
4. ไปที่โฟลเดอร์ `car-parts-stock`

---

## 📌 ขั้นตอนที่ 2: ใช้งานในโหมด Demo (เร็วที่สุด)

### 1. เปิดไฟล์ `index.html`
```
ดูเบล-คลิก index.html
```

### 2. ใส่ข้อมูลเข้าสู่ระบบ
```
Username: admin
Password: admin123
```

### 3. ใช้งาน 🎉
- ดูแดชบอร์ด
- เพิ่มสินค้า
- ทำการขาย
- ดูรายงาน

**⚠️ หมายเหตุ:** ข้อมูลจะหายเมื่อปิดเบราว์เซอร์ (เก็บใน localStorage)

---

## 📌 ขั้นตอนที่ 3: ตั้ง Supabase (เพื่อเก็บข้อมูลถาวร)

### A. สร้าง Supabase Account
```
1. ไปที่ https://supabase.com
2. คลิก "Sign Up"
3. ใช้ Email หรือ GitHub
4. ยืนยัน Email
```

### B. สร้าง Project ใหม่
```
1. Dashboard → "New Project"
2. ตั้งชื่อ: "car-parts-stock"
3. Database Password: สร้างรหัสแรงๆ
4. Region: Southeast Asia (Singapore/Thailand)
5. คลิก "Create new project"
6. รอ 2-3 นาที
```

### C. รันเพื่อสร้าง Database Tables
```
1. เปิด SQL Editor
2. คลิด "+ New Query"
3. Copy ไฟล์ `schema.sql` ทั้งหมด
4. Paste เข้า SQL Editor
5. คลิด "Run"
```

### D. เอา API Keys
```
1. Project Settings (⚙️) → API
2. Copy:
   - URL → ใส่ไป SUPABASE_URL
   - anon/public key → ใส่ไป SUPABASE_KEY
```

### E. อัพเดท config.js
```javascript
// js/config.js
const SUPABASE_URL = 'https://xxxxx.supabase.co';  // ใส่ URL ที่เอามา
const SUPABASE_KEY = 'eyJhbGc...';                  // ใส่ KEY ที่เอามา
```

### F. รีเฟรชเบราว์เซอร์
```
Press: Ctrl+Shift+Delete (ล้าง Cache)
แล้ว Refresh F5
```

**✅ เสร็จ!** ตอนนี้ข้อมูลจะเก็บใน Supabase Database

---

## 📌 ขั้นตอนที่ 4: ตั้ง Login Users (Supabase Auth - Advanced)

### Option A: ใช้ Demo Users (ง่าย)
- ยังไม่เปลี่ยนอะไร ใช้ได้เลย
- Login ไป admin/manager/staff

### Option B: ใช้ Supabase Auth (ปลอดภัย)

#### 1. เปิด Auth ใน Supabase
```
1. Project → Authentication
2. Enable Auth
3. Providers: Select Email
```

#### 2. เขียน Auth Code (ใน index.html)
```javascript
const { data, error } = await supabaseClient.auth.signInWithPassword({
  email: username,
  password: password
});
```

#### 3. สร้าง Users Profile
```sql
-- SQL Query ใน Supabase
INSERT INTO users (username, name, role, permissions)
VALUES ('john', 'John Doe', 'staff', ARRAY['dashboard', 'sales']);
```

---

## 📌 ขั้นตอนที่ 5: Push ขึ้น GitHub

### 1. ตั้ง Git (ครั้งแรก)
```bash
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"
```

### 2. เตรียม Project
```bash
cd car-parts-stock
git init
```

### 3. Add Files
```bash
git add .
```

### 4. Commit
```bash
git commit -m "Initial car-parts-stock system v1.0"
```

### 5. เชื่อมต่อ Remote
```bash
git remote add origin https://github.com/YOUR-USERNAME/car-parts-stock.git
git branch -M main
```

### 6. Push
```bash
git push -u origin main
```

**✅ เสร็จ!** โค้ดอยู่บน GitHub แล้ว

---

## 📌 ขั้นตอนที่ 6: Deploy ขึ้น Hosting (Optional)

### Option A: Vercel (ฟรี + เร็ว)
```bash
# 1. ติดตั้ง Vercel CLI
npm install -g vercel

# 2. Deploy
vercel

# 3. เลือก project
# 4. แล้วเสร็จ!
```

### Option B: Netlify (ฟรี + ง่าย)
```
1. ไปที่ https://netlify.com
2. Drag & drop โฟลเดอร์ car-parts-stock
3. เสร็จ! ได้ URL แล้ว
```

### Option C: GitHub Pages (ฟรีที่สุด)
```bash
# ใน settings GitHub repo
1. Settings → Pages
2. Source: main branch
3. Save
4. รอ 2 นาที
```

---

## 📌 ขั้นตอนที่ 7: Customize สำหรับร้านคุณ

### เปลี่ยนชื่อร้าน
```
ค้นหา "ศูนย์แต่งรถ" แล้วเปลี่ยนใน:
- หลาย *.html files
- js/config.js
```

### เปลี่ยนสีธีม
```css
/* css/style.css */
:root {
  --primary-color: #1a1a1a;      /* สีเข้มเศษ*/
  --secondary-color: #ff6b6b;    /* สีแดง */
  --success-color: #51cf66;      /* สีเขียว */
}
```

### เพิ่มหมวดหมู่สินค้า
```javascript
// stock.html หรือ sales.html
<option value="รถยนต์พิเศษ">รถยนต์พิเศษ</option>
```

### เพิ่มรูปสินค้า
```javascript
// ใน modal เพิ่มสินค้า
เลือกรูป JPG/PNG แล้วเก็บจะเป็น Base64
```

---

## 📌 ขั้นตอนที่ 8: ตรวจสอบ Security (สำคัญ!)

### ✅ Before Deploy ต้องทำ:

- [ ] เปลี่ยนรหัสผ่าน default users
- [ ] ไม่ commit API keys ขึ้น GitHub (ใช้ .env)
- [ ] Enable Row Level Security (RLS) ใน Supabase
- [ ] ตั้ง CORS ถูกต้อง
- [ ] Test login ทุก role (admin/manager/staff)
- [ ] Backup database เป็นประจำ

### 🔒 Supabase Security:

```sql
-- Set RLS Policies
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Example: Staff can only view sales
CREATE POLICY "staff_view_sales" ON sales
  FOR SELECT
  USING (auth.uid() = created_by OR auth.jwt() ->> 'role' = 'admin');
```

---

## 📌 ขั้นตอนที่ 9: Backup & Maintenance

### Backup Database เป็นประจำ
```
1. Supabase Dashboard
2. Database → Backups
3. คลิด "Create Backup"
```

### Export Data เป็น CSV
```
ใช้ปุ่มในแต่ละหน้า:
- Stock → Export Excel
- Reports → Export
```

### ติดตามการเปลี่ยนแปลง
```bash
git log --oneline  # ดูประวัติ commits
git diff           # ดูการเปลี่ยนแปลง
```

---

## 📌 ขั้นตอนที่ 10: ใช้งานประจำวัน

### Daily Workflow

**หัวหน้า (Admin):**
1. ตรวจแดชบอร์ด (ยอดขาย/สต็อก)
2. จัดการสต็อกหากต้อง
3. ดูรายงาน
4. จัดการ User

**ผู้จัดการ (Manager):**
1. ตรวจแดชบอร์ด
2. อัพเดท stock สินค้าขายดี
3. ดูรายงาน profit/sales

**พนักงาน (Staff):**
1. เปิดแดชบอร์ด
2. ทำการขาย
3. ออกใบเสร็จ/QR Code

### Troubleshooting

| ปัญหา | วิธีแก้ |
|-------|--------|
| ล็อกอินไม่ได้ | Clear Cache → Ctrl+Shift+Del |
| ข้อมูลหายไป | ตรวจสอบ localStorage หรือ Supabase |
| QR Code ไม่ขึ้น | ตรวจสอบ Internet Connection |
| Performance ช้า | Export ข้อมูลเก่า/ลบ (Archive) |

---

## ✅ Checklist - พร้อมใช้งานแล้ว?

- [ ] Project ดาวน์โหลด/Clone แล้ว
- [ ] ใช้ได้ในโหมด Demo
- [ ] Supabase Account สร้างแล้ว (Optional)
- [ ] Database Tables สร้างแล้ว (Optional)
- [ ] API Keys ใส่ config.js แล้ว (Optional)
- [ ] ตั้งค่ากรุณ์ (users/roles)
- [ ] ทดลองขายทั้งรอบ 1 ครั้ง
- [ ] สีธีมเปลี่ยนตามใจ
- [ ] Deploy ขึ้น Hosting
- [ ] ทดลองเข้าจากมือถือ
- [ ] แนะนำพนักงาน

---

## 🎉 ยินดีด้วย!

ระบบสต็อกศูนย์แต่งรถของคุณพร้อมใช้งาน 🚗

**สำหรับคำถาม:** Discord/GitHub Issues/Email

**Happy Selling! 💰**
