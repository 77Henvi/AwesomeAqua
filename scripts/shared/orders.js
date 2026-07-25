// scripts/shared/orders.js
// ฟังก์ชัน "ล้วน" (pure) ที่ใช้ในแท็บ Orders — แยกออกมาจาก modules/orders.js
// เพื่อให้ทดสอบอัตโนมัติได้โดยไม่ต้องพึ่ง DOM หรือ Supabase client
// (modules/orders.js import มาจากไฟล์นี้ ไม่ได้เขียนซ้ำ)

export const STATUS_LABEL = { pending: 'รอชำระ', paid: 'ชำระแล้ว', cancelled: 'ยกเลิก' };
export const STATUS_COLOR = { pending: '#d97706', paid: '#059669', cancelled: '#dc2626' };

const MONTH_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

// ── กรองออเดอร์ตามสถานะที่เลือกในแท็บ ('all' = ไม่กรอง) ──
export function filterOrdersByStatus(orders, status) {
  if (!Array.isArray(orders)) return [];
  return status === 'all' ? orders : orders.filter(o => o.status === status);
}

// ── จัดกลุ่มรายการสินค้า (จาก finance ที่มี order_id) ตามออเดอร์ ──
export function groupItemsByOrder(financeRows) {
  const byOrder = {};
  (financeRows || []).forEach(row => {
    if (!row.order_id) return;
    if (!byOrder[row.order_id]) byOrder[row.order_id] = [];
    byOrder[row.order_id].push(row);
  });
  return byOrder;
}

// ── แปลง ISO date เป็นรูปแบบไทยสั้นๆ ที่ใช้แสดงในการ์ดออเดอร์ ──
export function formatOrderDate(iso) {
  const d = new Date(iso);
  const y = d.getFullYear() + 543;
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${String(y).slice(-2)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ── สถานะถัดไปที่แอดมินกดได้จากสถานะปัจจุบัน (ใช้ตัดสินใจว่าจะโชว์ปุ่มไหน) ──
export function nextActionsForStatus(status) {
  if (status === 'pending')   return ['paid', 'cancelled'];
  if (status === 'paid')      return [];
  if (status === 'cancelled') return ['pending'];
  return [];
}

// ── สรุปยอดรวมของออเดอร์ทั้งหมดที่กรองแล้ว (ใช้เช็คความถูกต้องของหน้า/เทส) ──
export function sumOrderTotals(orders) {
  return (orders || []).reduce((sum, o) => sum + (o.total_amount || 0), 0);
}
