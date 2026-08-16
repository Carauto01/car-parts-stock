// 💾 Data Store — ศูนย์กลางข้อมูลของทุกหน้า
//
// ทำงาน 2 โหมดโดยอัตโนมัติ:
//   • Supabase Mode — เมื่อกรอกค่าใน config.js แล้ว ข้อมูลอยู่บนฐานข้อมูลกลาง ทุกเครื่องเห็นชุดเดียวกัน
//   • Demo Mode     — เมื่อยังไม่ได้กรอก ข้อมูลเก็บใน localStorage ของเบราว์เซอร์เครื่องนั้น
//
// หน้าเว็บเรียกใช้ผ่านฟังก์ชันชุดเดียวกันทั้งสองโหมด ไม่ต้องรู้ว่ากำลังใช้โหมดไหน
// กติกา: getXxx() อ่านจากแคชได้ทันที (sync) ส่วนฟังก์ชันที่เขียนข้อมูลเป็น async ต้อง await

const STORE_KEYS = {
  products: 'cps_products',
  sales: 'cps_sales',
  users: 'cps_users',
  settings: 'cps_settings',
  token: 'cps_token'
};

// ค่าตั้งต้นของข้อมูลร้าน (ใช้เมื่อยังไม่เคยตั้งค่า)
const DEFAULT_SETTINGS = {
  shopName: 'ศูนย์แต่งรถ',
  shopNameEn: 'Car Parts Stock',
  address: '',
  phone: '',
  taxId: '',
  logo: '',
  qrMode: 'auto',        // auto = สร้างจากข้อมูลบิล | image = รูปที่อัปโหลด | none = ไม่แสดง
  qrImage: '',
  qrCaption: 'สแกนเพื่อชำระเงิน',
  receiptNote: 'ขอบคุณที่ใช้บริการ ยินดีต้อนรับกลับมา',
  poNote: 'กรุณาตรวจสอบรายการก่อนยืนยันการสั่งซื้อ'
};

// ---------- ข้อมูลตัวอย่างของ Demo Mode ----------
const SEED_PRODUCTS = [
  { id: 1, name: 'สเปอร์ยาง BBS', category: 'สเปอร์', cost: 1500, price: 2500, quantity: 15, image: '' },
  { id: 2, name: 'แบมเปอร์หน้า Honda', category: 'แบมเปอร์', cost: 2000, price: 3500, quantity: 8, image: '' },
  { id: 3, name: 'ไฟหรี่ LED ขาว', category: 'ไฟ', cost: 500, price: 1200, quantity: 3, image: '' },
  { id: 4, name: 'ท่อไอเสีย', category: 'ท่อ', cost: 3000, price: 5500, quantity: 5, image: '' },
  { id: 5, name: 'สเตียร์หนัง', category: 'ภายใน', cost: 800, price: 1800, quantity: 20, image: '' }
];

const SEED_USERS = [
  { id: 1, username: 'admin', password: 'admin123', name: 'ผู้ดูแลระบบ', role: 'admin', phone: '08-0000-0000', status: 'active', permissions: ['dashboard', 'stock', 'sales', 'reports', 'users'] },
  { id: 2, username: 'manager', password: 'manager123', name: 'ผู้จัดการ', role: 'manager', phone: '08-1111-1111', status: 'active', permissions: ['dashboard', 'stock', 'sales', 'reports'] },
  { id: 3, username: 'staff', password: 'staff123', name: 'พนักงาน', role: 'staff', phone: '08-2222-2222', status: 'active', permissions: ['dashboard', 'sales'] }
];

function seedSales() {
  const day = 86400000;
  return [
    { id: 1, items: [{ id: 1, name: 'สเปอร์ยาง BBS', cost: 1500, price: 2500, quantity: 2 }], subtotal: 5000, discount: 0, total: 5000, payment: 'cash', customer: 'ลูกค้าทั่วไป', date: new Date().toISOString() },
    { id: 2, items: [{ id: 3, name: 'ไฟหรี่ LED ขาว', cost: 500, price: 1200, quantity: 1 }], subtotal: 1200, discount: 0, total: 1200, payment: 'transfer', customer: 'ลูกค้าทั่วไป', date: new Date(Date.now() - day).toISOString() },
    { id: 3, items: [{ id: 5, name: 'สเตียร์หนัง', cost: 800, price: 1800, quantity: 1 }], subtotal: 1800, discount: 0, total: 1800, payment: 'cash', customer: 'ลูกค้าทั่วไป', date: new Date(Date.now() - 2 * day).toISOString() }
  ];
}

// ==========================================================================
// localStorage พื้นฐาน (ใช้ใน Demo Mode และเก็บ token ใน Supabase Mode)
// ==========================================================================

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
    console.error(`[store] บันทึก "${key}" ไม่สำเร็จ:`, err.message);
    if (typeof showNotification === 'function') {
      showNotification('⚠️ พื้นที่เก็บข้อมูลเต็ม บันทึกไม่สำเร็จ (ลองลดขนาดรูป)', 'error');
    }
  }
}

function nextId(list) {
  return list.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1;
}

// ==========================================================================
// แคชในหน่วยความจำ — ทุกหน้าอ่านจากตรงนี้
// ==========================================================================

const USE_SUPABASE = typeof supabaseClient !== 'undefined' && supabaseClient !== null;

let cache = { products: [], sales: [], users: [], settings: { ...DEFAULT_SETTINGS } };

function getToken() {
  return localStorage.getItem(STORE_KEYS.token);
}

function setToken(token) {
  if (token) localStorage.setItem(STORE_KEYS.token, token);
  else localStorage.removeItem(STORE_KEYS.token);
}

// เรียกฟังก์ชันบนฐานข้อมูล แล้วแปลง error ให้เป็นข้อความไทยที่อ่านรู้เรื่อง
async function rpc(fn, params = {}) {
  const { data, error } = await supabaseClient.rpc(fn, params);

  if (error) {
    // เซสชันหมดอายุ → เด้งกลับหน้า login
    if (error.message && error.message.includes('เซสชันหมดอายุ')) {
      setToken(null);
      clearLocalUser();
      window.location.href = 'index.html';
    }
    throw new Error(error.message || 'เชื่อมต่อฐานข้อมูลไม่สำเร็จ');
  }

  return data;
}

// โหลดข้อมูลทั้งหมดเข้าแคช — หน้าเว็บต้อง await dataReady ก่อนวาดหน้าจอ
async function loadAll() {
  if (!USE_SUPABASE) {
    cache.products = readStore(STORE_KEYS.products, SEED_PRODUCTS);
    cache.sales = readStore(STORE_KEYS.sales, seedSales);
    cache.users = readStore(STORE_KEYS.users, SEED_USERS);
    cache.settings = { ...DEFAULT_SETTINGS, ...readStore(STORE_KEYS.settings, DEFAULT_SETTINGS) };
    return;
  }

  const token = getToken();
  if (!token) return;   // ยังไม่ล็อกอิน (เช่นอยู่หน้า index.html)

  const [products, sales] = await Promise.all([
    rpc('app_products', { p_token: token }),
    rpc('app_sales', { p_token: token })
  ]);

  cache.products = products || [];
  cache.sales = (sales || []).map(s => ({ ...s, items: s.items || [] }));

  // ตารางตั้งค่ามาจากไฟล์ schema-settings.sql — ถ้ายังไม่ได้รัน ก็ใช้ค่าเริ่มต้นไปก่อน
  try {
    cache.settings = { ...DEFAULT_SETTINGS, ...(await rpc('app_settings', { p_token: token })) };
  } catch (err) {
    console.warn('[store] ยังไม่มีตารางตั้งค่า ใช้ค่าเริ่มต้นแทน:', err.message);
  }

  // ตารางผู้ใช้เปิดให้เฉพาะ admin ถ้าไม่ใช่ก็ข้ามไปเงียบ ๆ
  const localUser = getLocalUser();
  if (localUser && localUser.role === 'admin') {
    try {
      cache.users = (await rpc('app_users', { p_token: token })) || [];
    } catch (err) {
      cache.users = [];
    }
  }
}

// หน้าเว็บใช้: dataReady.then(() => วาดหน้าจอ)
const dataReady = loadAll().catch(err => {
  console.error('[store] โหลดข้อมูลไม่สำเร็จ:', err.message);
  if (typeof showNotification === 'function') {
    showNotification('⚠️ โหลดข้อมูลไม่สำเร็จ: ' + err.message, 'error');
  }
});

// ==========================================================================
// เข้าสู่ระบบ
// ==========================================================================

async function login(username, password) {
  if (!USE_SUPABASE) {
    const user = readStore(STORE_KEYS.users, SEED_USERS).find(
      u => u.username === username && u.password === password && u.status === 'active'
    );
    if (!user) return null;
    return { id: user.id, username: user.username, name: user.name, role: user.role, permissions: user.permissions || [] };
  }

  try {
    const result = await rpc('app_login', { p_username: username, p_password: password });
    setToken(result.token);
    return result.user;
  } catch (err) {
    return null;   // รหัสผิด — ให้หน้า login แสดงข้อความเอง
  }
}

async function logoutSession() {
  if (USE_SUPABASE && getToken()) {
    try {
      await rpc('app_logout', { p_token: getToken() });
    } catch (err) {
      /* ออกจากระบบฝั่งเครื่องให้ได้ไว้ก่อน แม้เซิร์ฟเวอร์จะพลาด */
    }
  }
  setToken(null);
}

// ==========================================================================
// สินค้า
// ==========================================================================

function getProducts() {
  return cache.products;
}

// product ที่ไม่มี id = เพิ่มใหม่, มี id = แก้ไข
async function saveProduct(product) {
  if (!USE_SUPABASE) {
    const list = cache.products;
    if (product.id) {
      const found = list.find(p => p.id === product.id);
      if (found) Object.assign(found, product);
    } else {
      list.push({ ...product, id: nextId(list) });
    }
    writeStore(STORE_KEYS.products, list);
    return;
  }

  await rpc('app_save_product', {
    p_token: getToken(),
    p_id: product.id || null,
    p_name: product.name,
    p_category: product.category,
    p_cost: product.cost,
    p_price: product.price,
    p_quantity: product.quantity,
    p_image: product.image || ''
  });

  cache.products = await rpc('app_products', { p_token: getToken() });
}

async function removeProduct(id) {
  if (!USE_SUPABASE) {
    cache.products = cache.products.filter(p => p.id !== id);
    writeStore(STORE_KEYS.products, cache.products);
    return;
  }

  await rpc('app_delete_product', { p_token: getToken(), p_id: id });
  cache.products = await rpc('app_products', { p_token: getToken() });
}

// ==========================================================================
// การขาย
// ==========================================================================

function getSales() {
  return cache.sales;
}

// ตัดสต็อกและบันทึกบิลพร้อมกัน ถ้าของไม่พอจะไม่บันทึกอะไรเลย
async function createSale({ items, discount = 0, payment = 'cash', customer = '' }) {
  const clean = items.map(({ id, name, cost, price, quantity }) => ({ id, name, cost, price, quantity }));
  const subtotal = clean.reduce((sum, i) => sum + i.price * i.quantity, 0);

  if (!USE_SUPABASE) {
    // ตรวจสต็อกให้ครบก่อน แล้วค่อยตัด (กันตัดครึ่ง ๆ กลาง ๆ)
    for (const item of clean) {
      const product = cache.products.find(p => p.id === item.id);
      if (!product || product.quantity < item.quantity) {
        throw new Error(`สต็อกไม่พอ: ${item.name}`);
      }
    }

    clean.forEach(item => {
      cache.products.find(p => p.id === item.id).quantity -= item.quantity;
    });
    writeStore(STORE_KEYS.products, cache.products);

    const sale = {
      id: nextId(cache.sales),
      items: clean,
      subtotal,
      discount,
      total: Math.max(subtotal - discount, 0),
      payment,
      customer: customer || 'ลูกค้าทั่วไป',
      date: new Date().toISOString()
    };
    cache.sales.push(sale);
    writeStore(STORE_KEYS.sales, cache.sales);
    return sale;
  }

  await rpc('app_create_sale', {
    p_token: getToken(),
    p_items: clean,
    p_discount: discount,
    p_payment: payment,
    p_customer: customer
  });

  const [products, sales] = await Promise.all([
    rpc('app_products', { p_token: getToken() }),
    rpc('app_sales', { p_token: getToken() })
  ]);
  cache.products = products || [];
  cache.sales = (sales || []).map(s => ({ ...s, items: s.items || [] }));

  return cache.sales[cache.sales.length - 1];
}

// กำไรของบิล (หักส่วนลดแล้ว)
function saleProfit(sale) {
  const gross = (sale.items || []).reduce(
    (sum, item) => sum + (item.price - item.cost) * item.quantity, 0
  );
  return gross - (sale.discount || 0);
}

// ต้นทุนรวมของบิล
function saleCost(sale) {
  return (sale.items || []).reduce((sum, item) => sum + item.cost * item.quantity, 0);
}

// ==========================================================================
// ผู้ใช้งาน
// ==========================================================================

function getUsers() {
  return cache.users;
}

async function saveUser(user, password) {
  if (!USE_SUPABASE) {
    const list = cache.users;
    if (user.id) {
      const found = list.find(u => u.id === user.id);
      if (found) {
        Object.assign(found, user);
        if (password) found.password = password;
      }
    } else {
      list.push({ ...user, id: nextId(list), password, status: 'active' });
    }
    writeStore(STORE_KEYS.users, list);
    return;
  }

  await rpc('app_save_user', {
    p_token: getToken(),
    p_id: user.id || null,
    p_username: user.username,
    p_password: password || null,
    p_name: user.name,
    p_role: user.role,
    p_phone: user.phone || '',
    p_permissions: user.permissions || []
  });

  cache.users = await rpc('app_users', { p_token: getToken() });
}

async function setUserPassword(id, password) {
  if (!USE_SUPABASE) {
    const found = cache.users.find(u => u.id === id);
    if (found) found.password = password;
    writeStore(STORE_KEYS.users, cache.users);
    return;
  }

  await rpc('app_set_password', { p_token: getToken(), p_id: id, p_password: password });
}

async function removeUser(id) {
  if (!USE_SUPABASE) {
    cache.users = cache.users.filter(u => u.id !== id);
    writeStore(STORE_KEYS.users, cache.users);
    return;
  }

  await rpc('app_delete_user', { p_token: getToken(), p_id: id });
  cache.users = await rpc('app_users', { p_token: getToken() });
}

// ==========================================================================
// ตั้งค่าร้าน (โลโก้ / ที่อยู่ / QR / ข้อความบนเอกสาร)
// ==========================================================================

function getSettings() {
  return cache.settings;
}

async function saveSettings(patch) {
  if (!USE_SUPABASE) {
    cache.settings = { ...cache.settings, ...patch };
    writeStore(STORE_KEYS.settings, cache.settings);
    return cache.settings;
  }

  const data = await rpc('app_save_settings', { p_token: getToken(), p_data: patch });
  cache.settings = { ...DEFAULT_SETTINGS, ...data };
  return cache.settings;
}

// ==========================================================================
// รีเซ็ตข้อมูลตัวอย่าง (ใช้ได้เฉพาะ Demo Mode)
// ==========================================================================

function resetDemoData() {
  if (USE_SUPABASE) {
    console.warn('[store] ตอนนี้ใช้ Supabase อยู่ ข้อมูลจริงจะไม่ถูกลบ');
    return;
  }
  [STORE_KEYS.products, STORE_KEYS.sales, STORE_KEYS.users].forEach(k => localStorage.removeItem(k));
  if (typeof showNotification === 'function') {
    showNotification('♻️ รีเซ็ตข้อมูลตัวอย่างเรียบร้อย', 'success');
  }
}
