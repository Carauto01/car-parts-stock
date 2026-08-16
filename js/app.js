// 🛠️ Utility Functions

// ==========================================================================
// โหมดมืด / สว่าง
// ==========================================================================

const THEME_KEY = 'cps_theme';
const CHART_COLOR = '#ef4444';
const CHART_COLOR_SOFT = 'rgba(239, 68, 68, 0.16)';

function getTheme() {
  return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);

  document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
    btn.textContent = theme === 'light' ? '🌙' : '☀️';
    btn.title = theme === 'light' ? 'สลับเป็นโหมดมืด' : 'สลับเป็นโหมดสว่าง';
    btn.setAttribute('aria-label', btn.title);
  });
}

function toggleTheme() {
  applyTheme(getTheme() === 'light' ? 'dark' : 'light');
  // ให้หน้าที่มีกราฟวาดใหม่ด้วยสีของโหมดใหม่
  if (typeof onThemeChange === 'function') onThemeChange();
}

// ตั้งธีมทันทีที่โหลด กันจอกะพริบ
applyTheme(getTheme());
document.addEventListener('DOMContentLoaded', () => applyTheme(getTheme()));

// ==========================================================================
// กราฟ
// ==========================================================================

// อ่านสีจากตัวแปร CSS เพื่อให้กราฟเปลี่ยนตามโหมดมืด/สว่างได้
function cssVar(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

if (typeof Chart !== 'undefined') {
  Chart.defaults.font.family = "'Inter', 'Noto Sans Thai', sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 8;
  Chart.defaults.plugins.tooltip.displayColors = false;
}

// แกนแบบเรียบ ๆ ไม่แย่งสายตาไปจากเส้นข้อมูล
function chartScales({ integer = false } = {}) {
  const grid = cssVar('--border-soft', '#2a2b30');
  const ink = cssVar('--text-muted', '#a1a1aa');

  if (typeof Chart !== 'undefined') {
    Chart.defaults.color = ink;
    Chart.defaults.plugins.tooltip.backgroundColor =
      getTheme() === 'light' ? '#1f2937' : '#33343a';
  }

  return {
    y: {
      beginAtZero: true,
      grid: { color: grid, drawBorder: false, drawTicks: false },
      ticks: { color: ink, padding: 8, precision: integer ? 0 : undefined }
    },
    x: {
      grid: { display: false, drawBorder: false },
      ticks: { color: ink, padding: 6 }
    }
  };
}

// สีพื้นของจุดบนกราฟเส้น (ต้องกลืนกับพื้นการ์ด)
function chartSurface() {
  return cssVar('--surface', '#161719');
}

// ดึง localStorage user ก่อน (ในขณะ setup)
let localUser = getLocalUser();
if (localUser) {
  currentUser = localUser;
  userRole = localUser.role;
}

// ฟังก์ชันแสดง notification (หน้าตาอยู่ใน css/style.css → .notification)
function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// ฟังก์ชัน Format ตัวเลข (บาท)
function formatCurrency(number) {
  if (!number) return '฿0.00';
  return '฿' + parseFloat(number).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ฟังก์ชัน Format วันที่ (ภาษาไทย)
function formatDate(date) {
  const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  return new Date(date).toLocaleDateString('th-TH', options);
}

// ฟังก์ชัน Generate QR Code URL
function generateQRCode(data) {
  const encodedData = encodeURIComponent(JSON.stringify(data));
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodedData}`;
}

// ฟังก์ชันเก็บ Session
function setSession(key, value) {
  sessionStorage.setItem(key, JSON.stringify(value));
}

function getSession(key) {
  const data = sessionStorage.getItem(key);
  return data ? JSON.parse(data) : null;
}

function clearSession(key) {
  sessionStorage.removeItem(key);
}

// ฟังก์ชันตรวจสอบ Permission
function canAccess(requiredRole) {
  const roleHierarchy = {
    'admin': 3,
    'manager': 2,
    'staff': 1
  };
  
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

// ฟังก์ชันส่วนหัวสำหรับ Fetch Supabase
function getSupabaseHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'apikey': SUPABASE_KEY
  };
}

// ฟังก์ชัน Export to CSV
function exportToCSV(data, filename = 'export.csv') {
  if (!data || data.length === 0) {
    showNotification('ไม่มีข้อมูลให้ export', 'warning');
    return;
  }
  
  const headers = Object.keys(data[0]);
  let csv = headers.join(',') + '\n';
  
  data.forEach(row => {
    const values = headers.map(header => {
      const value = row[header];
      // Escape comma และ quote
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    csv += values.join(',') + '\n';
  });
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showNotification('Export สำเร็จ', 'success');
}

// ฟังก์ชัน Print — เมนู/ปุ่มถูกซ่อนด้วย @media print ใน style.css
function printPage() {
  window.print();
}

// ฟังก์ชัน Debug Log (เปิด/ปิดด้วย localStorage.setItem('debug', '1'))
function debugLog(message, data = null) {
  if (localStorage.getItem('debug') === '1') {
    console.log(`[DEBUG] ${message}`, data || '');
  }
}

// ฟังก์ชันออกจากระบบ (ใช้ร่วมกันทุกหน้า)
async function logout() {
  if (!confirm('ต้องการออกจากระบบหรือไม่?')) return;

  if (typeof logoutSession === 'function') await logoutSession();
  clearLocalUser();
  window.location.href = 'index.html';
}

