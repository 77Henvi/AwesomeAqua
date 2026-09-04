// scripts/shared/shipments.js
// ฟังก์ชัน "ล้วน" (pure) ที่ใช้ในแท็บ "จัดส่ง" ฝั่ง admin — ดู docs/SHIPPING_CHECKLIST_SETUP.md

export const SHIPPING_METHOD_LABEL = { ems: 'EMS (ต่างจังหวัด)', lalamove: 'Lalamove (ในกรุง)' };
export const SHIPPING_STATUS_LABEL = { pending: 'รอจัดส่ง', shipped: 'จัดส่งแล้ว' };
export const EMS_COST_OPTIONS = [250, 350]; // ตัวเลือกค่าส่ง EMS ต่างจังหวัด (บาท)

const MONTH_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

// ── กรองรายการจัดส่งตามสถานะที่เลือกในแท็บ ('all' = ไม่กรอง) ──
export function filterShipmentsByStatus(shipments, status) {
  if (!Array.isArray(shipments)) return [];
  return status === 'all' ? shipments : shipments.filter(s => s.status === status);
}

// ── เรียงตามวันที่จัดส่งใกล้สุดก่อน (เก่าสุด/ใกล้ถึงกำหนดสุดอยู่บนสุด) ──
export function sortShipmentsByDate(shipments) {
  return [...(shipments || [])].sort((a, b) => (a.shipping_date || '').localeCompare(b.shipping_date || ''));
}

// ── ถือว่า "เลยกำหนด" เมื่อยังไม่ได้จัดส่ง (pending) และวันที่จัดส่งผ่านไปแล้ว (ก่อนวันนี้) ──
export function isOverdue(shipment, today = new Date().toLocaleDateString('en-CA')) {
  if (!shipment || shipment.status !== 'pending') return false;
  return (shipment.shipping_date || '') < today;
}

// ── นับจำนวนรายการที่ "รอจัดส่ง" (ใช้โชว์ badge ตัวเลขบน filter chip) ──
export function countPendingShipments(shipments) {
  return (shipments || []).filter(s => s.status === 'pending').length;
}

// ── แปลง ISO date (YYYY-MM-DD) เป็นรูปแบบไทยสั้นๆ ที่ใช้แสดงในตารางเช็คลิสต์ ──
export function formatShipDate(isoDate) {
  if (!isoDate) return '—';
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  const yearBE = y + 543;
  return `${d} ${MONTH_SHORT[m - 1]} ${String(yearBE).slice(-2)}`;
}

/**
 * สรุปค่าส่งจากฟอร์มบันทึกการขาย
 * @param {'ems'|'lalamove'} method
 * @param {number} value ถ้าเป็น ems คือค่าที่เลือกจาก EMS_COST_OPTIONS, ถ้าเป็น lalamove คือค่าที่กรอกเอง
 * @returns {number} ค่าส่งที่จะบันทึก (ปัดให้ไม่ติดลบ, ems บังคับให้อยู่ใน EMS_COST_OPTIONS เท่านั้น)
 */
export function resolveShippingCost(method, value) {
  const n = Number(value) || 0;
  if (method === 'ems') return EMS_COST_OPTIONS.includes(n) ? n : EMS_COST_OPTIONS[0];
  return Math.max(0, n);
}