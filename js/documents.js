// 🧾 ตัวสร้างเอกสาร — ใบเสร็จรับเงิน และ ใบสั่งซื้อ
//
// เอกสารเป็น "กระดาษขาวตัวดำ" เสมอ ไม่ว่าเว็บจะอยู่โหมดมืดหรือสว่าง
// เพราะต้องพิมพ์ลงกระดาษจริง และช่องที่ติด class="doc-edit" แก้ไขได้ก่อนพิมพ์

const DOC_TYPES = {
  receipt: { title: 'ใบเสร็จรับเงิน', titleEn: 'RECEIPT', prefix: 'RC' },
  po: { title: 'ใบสั่งซื้อ', titleEn: 'PURCHASE ORDER', prefix: 'PO' }
};

// เลขที่เอกสาร: RC-690816-0007
function docNumber(type, saleId) {
  const d = new Date();
  const yy = String((d.getFullYear() + 543) % 100).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const seq = String(saleId || 0).padStart(4, '0');
  return `${DOC_TYPES[type].prefix}-${yy}${mm}${dd}-${seq}`;
}

function thaiDateTime(iso) {
  return new Date(iso).toLocaleString('th-TH', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

const PAYMENT_LABEL = {
  cash: 'เงินสด',
  card: 'บัตรเครดิต',
  qr: 'QR Code',
  transfer: 'โอนเงิน'
};

// แปลงจำนวนเงินเป็นตัวหนังสือไทย (ใช้บนใบเสร็จตามธรรมเนียมเอกสารไทย)
function bahtText(amount) {
  const digits = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  const places = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];

  function readInt(n) {
    if (n === 0) return '';
    if (n >= 1000000) return readInt(Math.floor(n / 1000000)) + 'ล้าน' + readInt(n % 1000000);

    let text = '';
    const s = String(n);

    for (let i = 0; i < s.length; i++) {
      const digit = Number(s[i]);
      const place = s.length - i - 1;
      if (digit === 0) continue;

      if (place === 1 && digit === 1) text += 'สิบ';
      else if (place === 1 && digit === 2) text += 'ยี่สิบ';
      else if (place === 0 && digit === 1 && s.length > 1) text += 'เอ็ด';
      else text += digits[digit] + places[place];
    }
    return text;
  }

  const rounded = Math.round(Math.abs(amount) * 100) / 100;
  const baht = Math.floor(rounded);
  const satang = Math.round((rounded - baht) * 100);

  if (baht === 0 && satang === 0) return 'ศูนย์บาทถ้วน';

  let text = baht > 0 ? readInt(baht) + 'บาท' : '';
  text += satang > 0 ? readInt(satang) + 'สตางค์' : 'ถ้วน';
  return text;
}

function escapeHtml(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// สร้าง HTML ของเอกสาร
//   type = 'receipt' | 'po'
//   sale = { id, items[], subtotal, discount, total, payment, customer, date }
//   settings = ค่าจาก getSettings()
function buildDocument(type, sale, settings) {
  const meta = DOC_TYPES[type];
  const s = settings || {};
  const items = sale.items || [];
  const subtotal = Number(sale.subtotal) || items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const discount = Number(sale.discount) || 0;
  const total = Number(sale.total) || Math.max(subtotal - discount, 0);

  const rows = items.map((item, i) => `
    <tr>
      <td class="doc-num">${i + 1}</td>
      <td>${escapeHtml(item.name)}</td>
      <td class="doc-num">${item.quantity}</td>
      <td class="doc-num">${formatCurrency(item.price)}</td>
      <td class="doc-num">${formatCurrency(item.price * item.quantity)}</td>
    </tr>
  `).join('');

  // ---------- ส่วน QR ----------
  // ใบสั่งซื้อไม่ใช่เอกสารรับเงิน จึงไม่แปะ QR ชำระเงิน
  let qrHtml = '';
  if (type !== 'receipt') {
    qrHtml = '';
  } else if (s.qrMode === 'image' && s.qrImage) {
    qrHtml = `<img src="${s.qrImage}" alt="QR" class="doc-qr-img">`;
  } else if (s.qrMode !== 'none' && s.qrMode !== 'image') {
    const payload = {
      doc: docNumber(type, sale.id),
      total: total,
      date: sale.date
    };
    qrHtml = `<img src="${generateQRCode(payload)}" alt="QR" class="doc-qr-img">`;
  }

  const qrBlock = qrHtml
    ? `<div class="doc-qr">
         ${qrHtml}
         <div class="doc-qr-caption doc-edit" contenteditable="true">${escapeHtml(s.qrCaption || '')}</div>
       </div>`
    : '';

  const note = type === 'receipt' ? (s.receiptNote || '') : (s.poNote || '');

  // ---------- ประกอบเอกสาร ----------
  return `
    <div class="doc">
      <div class="doc-head">
        <div class="doc-shop">
          ${s.logo ? `<img src="${s.logo}" alt="โลโก้" class="doc-logo">` : ''}
          <div>
            <div class="doc-shop-name doc-edit" contenteditable="true">${escapeHtml(s.shopName || 'ศูนย์แต่งรถ')}</div>
            ${s.shopNameEn ? `<div class="doc-shop-en doc-edit" contenteditable="true">${escapeHtml(s.shopNameEn)}</div>` : ''}
            ${s.address ? `<div class="doc-shop-info doc-edit" contenteditable="true">${escapeHtml(s.address)}</div>` : ''}
            ${s.phone ? `<div class="doc-shop-info">โทร. <span class="doc-edit" contenteditable="true">${escapeHtml(s.phone)}</span></div>` : ''}
            ${s.taxId ? `<div class="doc-shop-info">เลขประจำตัวผู้เสียภาษี <span class="doc-edit" contenteditable="true">${escapeHtml(s.taxId)}</span></div>` : ''}
          </div>
        </div>

        <div class="doc-title">
          <div class="doc-title-th">${meta.title}</div>
          <div class="doc-title-en">${meta.titleEn}</div>
          <table class="doc-meta">
            <tr><td>เลขที่</td><td class="doc-edit" contenteditable="true">${docNumber(type, sale.id)}</td></tr>
            <tr><td>วันที่</td><td class="doc-edit" contenteditable="true">${thaiDateTime(sale.date || new Date().toISOString())}</td></tr>
          </table>
        </div>
      </div>

      <div class="doc-party">
        <span class="doc-party-label">${type === 'receipt' ? 'ลูกค้า' : 'ผู้ขาย/ผู้จัดจำหน่าย'}</span>
        <span class="doc-edit" contenteditable="true">${escapeHtml(sale.customer || 'ลูกค้าทั่วไป')}</span>
      </div>

      <table class="doc-table">
        <thead>
          <tr>
            <th style="width: 8%;">ลำดับ</th>
            <th>รายการ</th>
            <th style="width: 12%;">จำนวน</th>
            <th style="width: 18%;">ราคา/หน่วย</th>
            <th style="width: 20%;">จำนวนเงิน</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="doc-bottom">
        ${qrBlock}

        <table class="doc-total">
          <tr><td>รวมเป็นเงิน</td><td class="doc-num">${formatCurrency(subtotal)}</td></tr>
          ${discount > 0 ? `<tr><td>ส่วนลด</td><td class="doc-num">- ${formatCurrency(discount)}</td></tr>` : ''}
          <tr class="doc-grand"><td>${type === 'receipt' ? 'จำนวนเงินรวมทั้งสิ้น' : 'ยอดสั่งซื้อรวม'}</td><td class="doc-num">${formatCurrency(total)}</td></tr>
          ${type === 'receipt' ? `<tr><td>ชำระโดย</td><td class="doc-num">${PAYMENT_LABEL[sale.payment] || '-'}</td></tr>` : ''}
        </table>
      </div>

      <div class="doc-baht">( ${bahtText(total)} )</div>

      ${note ? `<div class="doc-note doc-edit" contenteditable="true">${escapeHtml(note)}</div>` : ''}

      <div class="doc-sign">
        <div class="doc-sign-box">
          <div class="doc-sign-line"></div>
          ${type === 'receipt' ? 'ผู้รับเงิน' : 'ผู้สั่งซื้อ'}
        </div>
        <div class="doc-sign-box">
          <div class="doc-sign-line"></div>
          ${type === 'receipt' ? 'ผู้จ่ายเงิน' : 'ผู้อนุมัติ'}
        </div>
      </div>
    </div>
  `;
}

// เปิดหน้าต่างพิมพ์เฉพาะตัวเอกสาร (ไม่ต้องพิมพ์เมนูเว็บไปด้วย)
function printDocument(containerId) {
  const node = document.getElementById(containerId);
  if (!node) return;

  const css = document.querySelector('link[rel="stylesheet"]').getAttribute('href');
  const win = window.open('', '', 'width=900,height=1000');

  win.document.write(`<!DOCTYPE html><html lang="th"><head><meta charset="utf-8">
    <title>พิมพ์เอกสาร</title>
    <link rel="stylesheet" href="${css}">
    <style>body{background:#fff;margin:0;padding:16px}</style>
    </head><body>${node.innerHTML}</body></html>`);
  win.document.close();

  // รอให้ฟอนต์กับรูป (โลโก้/QR) โหลดเสร็จก่อน ไม่งั้นพิมพ์ออกมาหน้าว่าง
  const go = () => { win.focus(); win.print(); };
  if (win.document.readyState === 'complete') setTimeout(go, 600);
  else win.onload = () => setTimeout(go, 600);
}
