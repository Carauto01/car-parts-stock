// 🔧 ตั้งค่า Supabase ที่นี่
// ถ้ายังไม่กรอกค่าจริง ระบบจะทำงานใน "Demo Mode" (เก็บข้อมูลใน localStorage) โดยอัตโนมัติ
const SUPABASE_URL = 'https://hebnokrvhexmkuuhgqoa.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhlYm5va3J2aGV4bWt1dWhncW9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4OTAwMDMsImV4cCI6MjEwMjQ2NjAwM30.rRRJIt0rf-Ie52eRci_b20QX6xMkHcO1JCZnS4Lg2HI';

// ตรวจว่ากรอกค่าจริงหรือยัง (createClient จะ throw ถ้า URL ไม่ใช่ http/https)
const SUPABASE_READY =
  /^https?:\/\/.+/.test(SUPABASE_URL) &&
  SUPABASE_KEY !== 'YOUR_SUPABASE_ANON_KEY' &&
  SUPABASE_KEY.length > 20;

// Supabase Client (เป็น null เมื่ออยู่ใน Demo Mode)
let supabaseClient = null;

if (SUPABASE_READY && typeof supabase !== 'undefined') {
  try {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  } catch (err) {
    console.warn('[config] เชื่อม Supabase ไม่สำเร็จ ใช้ Demo Mode แทน:', err.message);
  }
} else {
  console.info('[config] Demo Mode — ข้อมูลถูกเก็บใน localStorage ของเบราว์เซอร์');
}

// ตัวแปร global
let currentUser = null;
let userRole = null;

// ตรวจสอบ login state
async function checkAuth() {
  // Demo Mode: ใช้ผู้ใช้ที่เก็บไว้ใน localStorage
  if (!supabaseClient) {
    const local = getLocalUser();
    if (local) {
      currentUser = local;
      userRole = local.role;
      return true;
    }
    return false;
  }

  const { data: { user } } = await supabaseClient.auth.getUser();

  if (user) {
    currentUser = user;
    // ดึง role จาก profiles table
    const { data } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (data) {
      userRole = data.role;
      return true;
    }
  }
  return false;
}

// ออกแบบ localStorage ชั่วคราว (ถ้า Supabase auth ยังไม่สำเร็จ)
function getLocalUser() {
  try {
    const user = localStorage.getItem('currentUser');
    return user ? JSON.parse(user) : null;
  } catch (err) {
    console.warn('[config] อ่านข้อมูลผู้ใช้ไม่สำเร็จ:', err.message);
    return null;
  }
}

function saveLocalUser(user) {
  localStorage.setItem('currentUser', JSON.stringify(user));
}

function clearLocalUser() {
  localStorage.removeItem('currentUser');
}
