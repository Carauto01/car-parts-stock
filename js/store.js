// 💾 Data Store — ศูนย์กลางข้อมูลของทุกหน้า (Demo Mode ใช้ localStorage)
// ทุกหน้าอ่าน/เขียนผ่านไฟล์นี้ เพื่อให้ข้อมูลตรงกันและไม่หายเมื่อรีโหลด

const STORE_KEYS = {
  products: 'cps_products',
  sales: 'cps_sales',
  users: 'cps_users'
};

// ---------- ข้อมูลตัวอย่างเริ่มต้น ----------
const SEED_PRODUCTS = [
  { id: 1, name: 'สเปอร์ยาง BBS', category: 'สเปอร์', cost: 1500, price: 2500, quantity: 15, image: '' },
  { id: 2, name: 'แบมเปอร์หน้า Honda', category: 'แบมเปอร์', cost: 2000, price: 3500, quantity: 8, image: '' },
  { id: 3, name: 'ไฟหรี่ LED ขาว', category: 'ไฟ', cost: 500, price: 1200, quantity: 3, image: '' },
  { id: 4, name: 'ท่อไอเสีย', category: 'ท่อ', cost: 3000, price: 5500, quantity: 5, image: '' },
  { id: 5, name: 'สเตียร์หนัง', category: 'ภายใน', cost: 800, price: 1800, quantity: 20, image: '' }
];

const SEED_USERS = [
  { id: 1, username: 'admin', password: 'admin123', name: 'ผู้ดูแลระบบ', role: 'admin', phone: '08-xxxx-xxxx', status: 'active', permissions: ['dashboard', 'stock', 'sales', 'reports', 'users'] },
  { id: 2, username: 'manager', password: 'manager123', name: 'ผู้จัดการ', role: 'manager', phone: '08-xxxx-xxxx', status: 'active', permissions: ['dashboard', 'stock', 'sales', 'reports'] },
  { id: 3, username: 'staff', password: 'staff123', name: 'พนักงาน', role: 'staff', phone: '08-xxxx-xxxx', status: 'active', permissions: ['dashboard', 'sales'] }
];

// รูปแบบรายการขายมาตรฐาน:
// { id, items: [{id, name, cost, price, quantity}], subtotal, discount, total, payment, customer, date }
function seedSales() {
  const day = 86400000;
  return [
    {
      id: 1,
      items: [{ id: 1, name: 'สเปอร์ยาง BBS', cost: 1500, price: 2500, quantity: 2 }],
      subtotal: 5000, discount: 0, total: 5000,
      payment: 'cash', customer: 'ลูกค้าทั่วไป',
      date: new Date().toISOString()
    },
    {
      id: 2,
      items: [{ id: 3, name: 'ไฟหรี่ LED ขาว', cost: 500, price: 1200, quantity: 1 }],
      subtotal: 1200, discount: 0, total: 1200,
      payment: 'transfer', customer: 'ลูกค้าทั่วไป',
      date: new Date(Date.now() - day).toISOString()
    },
    {
      id: 3,
      items: [{ id: 5, name: 'สเตียร์หนัง', cost: 800, price: 1800, quantity: 1 }],
      subtotal: 1800, discount: 0, total: 1800,
      payment: 'cash', customer: 'ลูกค้าทั่วไป',
      date: new Date(Date.now() - 2 * day).toISOString()
    }
  ];
}

// ---------- ฟังก์ชันพื้นฐาน ----------
function readStore(key, seed) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn(`[store] ข้อมูล "${key}" เสียหาย จะสร้างใหม่:`, err.message);
  }

  const initial = typeof seed === 'function' ? seed() : JSON.parse(JSON.stringify(seed));
  writeStore(key, initial);
  return initial;
}

function writeStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    // มักเกิดจาก quota เต็ม (เช่น อัพโหลดรูป Base64 หลายรูป)
    console.error(`[store] บันทึก "${key}" ไม่สำเร็จ:`, err.message);
    if (typeof showNotification === 'function') {
      showNotification('⚠️ พื้นที่เก็บข้อมูลเต็ม บันทึกไม่สำเร็จ (ลองลดขนาดรูป)', 'error');
    }
  }
}

function nextId(list) {
  return list.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1;
}

// ---------- สินค้า ----------
function getProducts() {
  return readStore(STORE_KEYS.products, SEED_PRODUCTS);
}

function saveProducts(list) {
  writeStore(STORE_KEYS.products, list);
}

// ตัดสต็อกตามรายการที่ขาย (คืน true เมื่อสำเร็จ)
function deductStock(items) {
  const products = getProducts();

  for (const item of items) {
    const product = products.find(p => p.id === item.id);
    if (!product || product.quantity < item.quantity) return false;
  }

  items.forEach(item => {
    const product = products.find(p => p.id === item.id);
    product.quantity -= item.quantity;
  });

  saveProducts(products);
  return true;
}

// ---------- การขาย ----------
function getSales() {
  return readStore(STORE_KEYS.sales, seedSales);
}

function saveSales(list) {
  writeStore(STORE_KEYS.sales, list);
}

function addSale(sale) {
  const sales = getSales();
  const record = { id: nextId(sales), ...sale };
  sales.push(record);
  saveSales(sales);
  return record;
}

// กำไรของรายการขาย 1 บิล (หักส่วนลดด้วย)
function saleProfit(sale) {
  const gross = (sale.items || []).reduce(
    (sum, item) => sum + (item.price - item.cost) * item.quantity, 0
  );
  return gross - (sale.discount || 0);
}

// ต้นทุนรวมของรายการขาย 1 บิล
function saleCost(sale) {
  return (sale.items || []).reduce((sum, item) => sum + item.cost * item.quantity, 0);
}

// ---------- ผู้ใช้งาน ----------
function getUsers() {
  return readStore(STORE_KEYS.users, SEED_USERS);
}

function saveUsers(list) {
  writeStore(STORE_KEYS.users, list);
}

function findUserByLogin(username, password) {
  return getUsers().find(
    u => u.username === username && u.password === password && u.status === 'active'
  ) || null;
}

// ---------- รีเซ็ตข้อมูลกลับเป็นค่าเริ่มต้น ----------
function resetDemoData() {
  Object.values(STORE_KEYS).forEach(key => localStorage.removeItem(key));
  if (typeof showNotification === 'function') {
    showNotification('♻️ รีเซ็ตข้อมูลตัวอย่างเรียบร้อย', 'success');
  }
}
