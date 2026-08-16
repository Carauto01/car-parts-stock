// 🛠️ Utility Functions

// ดึง localStorage user ก่อน (ในขณะ setup)
let localUser = getLocalUser();
if (localUser) {
  currentUser = localUser;
  userRole = localUser.role;
}

// ฟังก์ชันแสดง notification
function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  const style = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    border-radius: 5px;
    color: white;
    font-weight: 500;
    z-index: 9999;
    animation: slideIn 0.3s ease;
  `;
  
  if (type === 'success') {
    notification.style.cssText = style + 'background-color: #28a745;';
  } else if (type === 'error') {
    notification.style.cssText = style + 'background-color: #dc3545;';
  } else if (type === 'warning') {
    notification.style.cssText = style + 'background-color: #ffc107; color: black;';
  } else if (type === 'info') {
    notification.style.cssText = style + 'background-color: #17a2b8;';
  }
  
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

// ฟังก์ชัน Print
function printPage(elementId, title) {
  const printContents = document.getElementById(elementId).innerHTML;
  const originalContents = document.body.innerHTML;
  
  document.body.innerHTML = `
    <div style="padding: 20px;">
      <h1>${title}</h1>
      ${printContents}
    </div>
  `;
  
  window.print();
  document.body.innerHTML = originalContents;
  location.reload();
}

// ฟังก์ชัน Debug Log (เปิด/ปิดด้วย localStorage.setItem('debug', '1'))
function debugLog(message, data = null) {
  if (localStorage.getItem('debug') === '1') {
    console.log(`[DEBUG] ${message}`, data || '');
  }
}

// ฟังก์ชันออกจากระบบ (ใช้ร่วมกันทุกหน้า)
function logout() {
  if (confirm('ต้องการออกจากระบบหรือไม่?')) {
    clearLocalUser();
    window.location.href = 'index.html';
  }
}

// Animation CSS
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`;
document.head.appendChild(style);
