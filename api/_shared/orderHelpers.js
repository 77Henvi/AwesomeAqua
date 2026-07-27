// api/_shared/orderHelpers.js
// ฟังก์ชัน "ล้วน" (pure) เกี่ยวกับออเดอร์ — ใช้ร่วมกันทั้งฝั่ง admin (scripts/modules/orders.js, ESM)
// และฝั่ง Messenger webhook (api/messenger-webhook.js, CJS)
//
// เดิมไฟล์นี้อยู่ที่ scripts/shared/orders.js (ESM only) ย้ายมาไว้ที่นี่เพราะ scripts/
// มี package.json "type":"module" บังคับให้ทุกไฟล์ในนั้นเป็น ESM — ถ้า api/*.js (CJS) มา
// require() ไฟล์ที่อยู่ใน scope นั้น จะได้ exports ว่างเปล่าแบบเงียบๆ ไม่ throw error เลย
// (เจอบั๊กนี้มาแล้วครั้งหนึ่งกับ cart.js — ย้ายมาไว้ที่นี่กันไว้ก่อนเกิดซ้ำ)

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
