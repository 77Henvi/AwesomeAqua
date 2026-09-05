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

// ════════════════════════════════════════════
//   รวมพัสดุ (shipment_group_id ตรงกัน = ห่อเดียวกัน ส่งพร้อมกัน)
// ════════════════════════════════════════════
/**
 * รวมแถว shipments (1 แถว = 1 รายการปลาที่ขาย) ให้เป็น "พัสดุ" — แถวที่มี shipment_group_id
 * ตรงกัน (หรือไม่มีกลุ่มเลย ก็ถือเป็นพัสดุเดี่ยวของตัวเอง) จะถูกรวมเป็นก้อนเดียว พร้อมลิสต์
 * รายการปลาทั้งหมดในพัสดุนั้น และสถานะรวม (ถือว่า "จัดส่งแล้ว" ก็ต่อเมื่อทุกแถวในกลุ่มจัดส่งแล้ว)
 * @param {Array} shipments แถวดิบจากตาราง shipments
 * @returns {Array<{group_id, customer_name, shipping_method, shipping_cost, shipping_date, status, ids: string[], items: string[]}>}
 */
export function groupShipments(shipments) {
  const order = [];
  const map = {};

  (shipments || []).forEach(s => {
    const key = s.shipment_group_id || s.id;
    if (!map[key]) {
      map[key] = {
        group_id: key,
        customer_name: s.customer_name,
        shipping_method: s.shipping_method,
        shipping_cost: s.shipping_cost || 0, // ค่าส่งเป็นค่าเดียวของทั้งพัสดุ (ทุกแถวในกลุ่มเก็บค่าเดียวกันไว้ซ้ำ) ไม่ต้องบวกรวม
        shipping_date: s.shipping_date,
        ids: [],
        items: [],
        allShipped: true,
      };
      order.push(key);
    }
    const g = map[key];
    g.ids.push(s.id);
    g.items.push(s.fish_name);
    if (s.status !== 'shipped') g.allShipped = false;
  });

  return order.map(key => {
    const { allShipped, ...g } = map[key];
    return { ...g, status: allShipped ? 'shipped' : 'pending' };
  });
}

// ── ค้นหาพัสดุที่ "รอจัดส่ง" อยู่ ตามชื่อลูกค้า (ใช้ตอนติ๊ก "แนบเข้าพัสดุเดิม" ในฟอร์มขาย) ──
export function searchPendingShipmentGroups(groups, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];
  return (groups || [])
    .filter(g => g.status === 'pending' && (g.customer_name || '').toLowerCase().includes(q));
}

// ── นับจำนวนพัสดุ (ไม่ใช่จำนวนแถว) ต่อวันที่จัดส่ง — ใช้โชว์ตัวเลขบนปฏิทิน ──
export function countShipmentsByDate(groups) {
  const map = {};
  (groups || []).forEach(g => {
    if (!g.shipping_date) return;
    map[g.shipping_date] = (map[g.shipping_date] || 0) + 1;
  });
  return map;
}

/**
 * สร้างกริดปฏิทินของเดือนที่ระบุ เป็น array ของช่อง (7 ช่องต่อแถว, ครบสัปดาห์) — ช่องว่างก่อน/หลัง
 * วันที่ 1 และวันสุดท้ายของเดือนเป็น null ส่วนวันในเดือนเป็น ISO date string ('YYYY-MM-DD')
 * @param {number} year
 * @param {number} month 0-11 (0 = มกราคม)
 * @returns {Array<string|null>}
 */
export function buildCalendarMonth(year, month) {
  const firstWeekday  = new Date(year, month, 1).getDay(); // 0 = อาทิตย์
  const daysInMonth   = new Date(year, month + 1, 0).getDate();
  const mm            = String(month + 1).padStart(2, '0');

  const cells = Array(firstWeekday).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${mm}-${String(d).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}