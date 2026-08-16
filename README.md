# 🚗 ระบบจัดการสต็อก - ศูนย์แต่งรถ

ระบบจัดการสต็อก การขาย และรายงานสำหรับศูนย์แต่งรถ พัฒนาด้วย HTML/CSS/JavaScript + Supabase

---

## 📋 คุณสมบัติหลัก

### ✅ ปัจจุบันรองรับ
- 📊 **แดชบอร์ด** - สรุปยอดขาย, สต็อก, กำไร
- 📦 **จัดการสต็อก** - เพิ่ม/แก้ไข/ลบรายการ พร้อมรูป
- 🛒 **การขาย** - เลือกสินค้า, ออกใบเสร็จ, QR Code
- 📋 **รายงาน** - ยอดขาย, สต็อก, กำไร, ตามหมวดหมู่
- 👤 **ผู้ใช้งาน** - จัดการ username/password (Admin only)
- 🔐 **ระบบ Login** - Role-based (Admin, Manager, Staff)
- 📱 **Responsive** - ใช้ได้ทั้ง Desktop, Tablet, Mobile

---

## 🚀 วิธีการใช้งาน

### 1️⃣ **Clone หรือ Download Project**
```bash
git clone https://github.com/your-username/car-parts-stock.git
cd car-parts-stock
```

### 2️⃣ **เปิดในเบราว์เซอร์**
```
ดูเบล-คลิก index.html
หรือ คลิกขวา → Open with → Google Chrome/Firefox
```

### 3️⃣ **ล็อกอิน**
```
Username: admin
Password: admin123

หรือ
Username: manager
Password: manager123

หรือ
Username: staff
Password: staff123
```

---

## 📁 โครงสร้าง Project

```
car-parts-stock/
├── index.html           # หน้า Login
├── dashboard.html       # แดชบอร์ด
├── stock.html          # จัดการสต็อก
├── sales.html          # การขาย
├── reports.html        # รายงาน
├── users.html          # ผู้ใช้งาน (Admin only)
├── css/
│   └── style.css       # Styling ทั้งหมด
├── js/
│   ├── config.js       # ตั้งค่า Supabase (ว่าง = Demo Mode)
│   ├── store.js        # ศูนย์กลางข้อมูล สินค้า/ขาย/ผู้ใช้ (localStorage)
│   └── app.js          # Utility functions
├── images/             # โฟลเดอร์รูปสินค้า
└── README.md           # ไฟล์นี้
```

---

## 🔧 ตั้งค่า Supabase (ถ้าต้องการ)

### 1. สร้าง Supabase Project
- ไปที่ https://supabase.com
- สร้าง Account ใหม่
- Create a new project

### 2. สร้าง Database Tables

**Table: products**
```sql
CREATE TABLE products (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  cost_price DECIMAL(10,2),
  sell_price DECIMAL(10,2),
  quantity INT DEFAULT 0,
  image_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Table: sales**
```sql
CREATE TABLE sales (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT REFERENCES products(id),
  quantity INT,
  total DECIMAL(10,2),
  payment_method VARCHAR(50),
  customer_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Table: users**
```sql
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50),
  phone VARCHAR(20),
  permissions TEXT[],
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 3. อัพเดท config.js
```javascript
const SUPABASE_URL = 'YOUR_SUPABASE_URL'; // เช่น https://xxxxx.supabase.co
const SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY'; // anon/public key
```

ได้จาก: Project Settings → API → URL & Keys

---

## 👥 ระดับสิทธิการใช้งาน

| ฟีเจอร์ | Admin | Manager | Staff |
|--------|-------|---------|-------|
| 📊 ดูแดชบอร์ด | ✅ | ✅ | ✅ |
| 📦 จัดการสต็อก | ✅ | ✅ | ❌ |
| 🛒 ทำการขาย | ✅ | ✅ | ✅ |
| 📋 ดูรายงาน | ✅ | ✅ | ❌ |
| 👤 จัดการผู้ใช้ | ✅ | ❌ | ❌ |

---

## 💾 Storage Data

### ปัจจุบัน (Demo Mode)
- ข้อมูลทั้งหมด (สินค้า / การขาย / ผู้ใช้) เก็บใน **localStorage** ผ่าน `js/store.js`
- ทุกหน้าใช้ข้อมูลชุดเดียวกัน — เพิ่มสินค้าในหน้าสต็อก แล้วหน้าขาย/รายงาน/แดชบอร์ดเห็นทันที
- ขายแล้ว **ตัดสต็อกอัตโนมัติ** และบันทึกบิลเข้ารายงาน
- ข้อมูลอยู่ถาวรจนกว่าจะลบ cache เบราว์เซอร์
- รีเซ็ตกลับเป็นข้อมูลตัวอย่าง: เปิด Console (F12) แล้วพิมพ์ `resetDemoData()` จากนั้นรีโหลด

### หลังจากตั้ง Supabase (Production)
- ข้อมูลเก็บใน **Supabase Database**
- ข้อมูลเก็บถาวร ดึงได้ทุกเวลา

---

## 🎨 Customize

### เปลี่ยนสีธีม
แก้ไข `css/style.css` บรรทัด:
```css
:root {
  --primary-color: #2c3e50;      /* สีหลัก */
  --secondary-color: #e74c3c;    /* สีเน้น */
  --success-color: #28a745;      /* สีสำเร็จ */
  --danger-color: #dc3545;       /* สีเตือน */
}
```

### เปลี่ยนชื่อร้าน
ค้นหา "ศูนย์แต่งรถ" แล้วเปลี่ยนในไฟล์ HTML ทั้งหมด

### เพิ่มหมวดหมู่สินค้า
แก้ไข `stock.html` บรรทัด:
```html
<option value="หมวดใหม่">หมวดใหม่</option>
```

---

## 🐛 Troubleshooting

### ❌ ข้อมูลหายหลังรีโหลด
**คำตอบ:** เก็บใน localStorage ชั่วคราว ต้องตั้ง Supabase ให้เก็บถาวร

### ❌ ไม่สามารถอัพโหลดรูป
**คำตอบ:** 
1. ใช้ Data URL (Base64) ชั่วคราว
2. ตั้ง Supabase Storage สำหรับรูป

### ❌ QR Code ไม่ขึ้น
**คำตอบ:** ใช้บริการ qrserver.com ฟรี (ต้อง Internet)

---

## 📦 Push ขึ้น GitHub

```bash
# 1. Init git
git init

# 2. Add files
git add .

# 3. Commit
git commit -m "Initial car-parts-stock system"

# 4. Add remote
git remote add origin https://github.com/your-username/car-parts-stock.git

# 5. Push
git branch -M main
git push -u origin main
```

---

## 🔒 ความปลอดภัย (ก่อน Deploy)

- ❌ **ไม่ควร** เก็บ Supabase API Key ใน source code
- ✅ **ควร** ใช้ Environment Variables หรือ .env file
- ✅ **ควร** Enable Row Level Security (RLS) ใน Supabase
- ✅ **ควร** ทำ Backup ข้อมูลเป็นประจำ

---

## 📝 Notes

### Demo Mode
- ข้อมูลตัวอย่าง 5 สินค้า
- Login 3 user (admin, manager, staff)
- ยังไม่เชื่อม Supabase (ใช้ localStorage)

### Next Steps
1. ตั้ง Supabase Database
2. เชื่อม config.js
3. Migrate demo data
4. Test ทั้งระบบ
5. Deploy ขึ้น Hosting (Vercel, Netlify, etc.)

---

## 📞 Support

### การติดต่อ
- GitHub Issues: [หนี่หลัง link]
- Email: [email]

### Resources
- [Supabase Docs](https://supabase.com/docs)
- [Chart.js Docs](https://www.chartjs.org)
- [MDN Web Docs](https://developer.mozilla.org)

---

## 📄 License

MIT License - ใช้งานได้อย่างอิสระสำหรับตัวเอง

---

**สร้างด้วย ❤️ สำหรับศูนย์แต่งรถไทย**

วันที่อัพเดท: 2025-08-14
