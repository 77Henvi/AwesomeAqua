// api/_shared/orderHelpers.js
// ฟังก์ชัน "ล้วน" (pure) เกี่ยวกับออเดอร์ — ใช้ฝั่ง server เท่านั้น
// (api/messenger-webhook.js, api/notify-restock.js — ทั้งคู่เป็น CJS)
//
// ⚠️ ไฟล์นี้จงใจมีเนื้อหาซ้ำกับ scripts/shared/orders.js (ฝั่ง admin browser) — ไม่ได้ import
// ต่อกัน เพราะ api/ บน Vercel เป็นพื้นที่ serverless functions เท่านั้น เบราว์เซอร์ดึงไฟล์จาก
// /api/*.js ผ่าน GET ไม่ได้ (404) ส่วน scripts/ ที่มี package.json "type":"module" ก็ require()
// จากฝั่ง CJS ไม่ได้เหมือนกัน (ได้ exports ว่างเปล่าแบบเงียบๆ ไม่ throw error เลย — เจอบั๊กนี้
// มาแล้วจริงกับทั้ง cart.js และไฟล์นี้เอง ตอนที่เคยรวมไว้ที่เดียว)
//
// ถ้าจะแก้ logic การจัดการออเดอร์ ต้องแก้ทั้ง 2 ไฟล์นี้ให้ตรงกัน:
//   - api/_shared/orderHelpers.js     (ไฟล์นี้ — ฝั่ง server)
//   - scripts/shared/orders.js        (ฝั่ง admin browser)

const STATUS_LABEL = { pending: 'รอชำระ', paid: 'ชำระแล้ว', cancelled: 'ยกเลิก' };
const STATUS_COLOR = { pending: '#d97706', paid: '#059669', cancelled: '#dc2626' };
const STATUS_EMOJI = { pending: '⏳', paid: '✅', cancelled: '❌' };

const MONTH_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

// ── กรองออเดอร์ตามสถานะที่เลือกในแท็บ ('all' = ไม่กรอง) ──
function filterOrdersByStatus(orders, status) {
  if (!Array.isArray(orders)) return [];
  return status === 'all' ? orders : orders.filter(o => o.status === status);
}

// ── จัดกลุ่มรายการสินค้า (จาก finance ที่มี order_id) ตามออเดอร์ ──
function groupItemsByOrder(financeRows) {
  const byOrder = {};
  (financeRows || []).forEach(row => {
    if (!row.order_id) return;
    if (!byOrder[row.order_id]) byOrder[row.order_id] = [];
    byOrder[row.order_id].push(row);
  });
  return byOrder;
}

// ── แปลง ISO date เป็นรูปแบบไทยสั้นๆ ที่ใช้แสดงในการ์ดออเดอร์ ──
function formatOrderDate(iso) {
  const d = new Date(iso);
  const y = d.getFullYear() + 543;
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${String(y).slice(-2)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ── สถานะถัดไปที่แอดมินกดได้จากสถานะปัจจุบัน (ใช้ตัดสินใจว่าจะโชว์ปุ่มไหน) ──
function nextActionsForStatus(status) {
  if (status === 'pending')   return ['paid', 'cancelled'];
  if (status === 'paid')      return [];
  if (status === 'cancelled') return ['pending'];
  return [];
}

// ── สรุปยอดรวมของออเดอร์ทั้งหมดที่กรองแล้ว (ใช้เช็คความถูกต้องของหน้า/เทส) ──
function sumOrderTotals(orders) {
  return (orders || []).reduce((sum, o) => sum + (o.total_amount || 0), 0);
}

module.exports = {
  STATUS_LABEL,
  STATUS_COLOR,
  STATUS_EMOJI,
  filterOrdersByStatus,
  groupItemsByOrder,
  formatOrderDate,
  nextActionsForStatus,
  sumOrderTotals,
};
