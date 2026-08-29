// scripts/shared/calc.js
// รวมฟังก์ชันคำนวณ "ล้วน" (pure function — input เดิม output เดิมเสมอ ไม่แตะ DOM/network)
// แยกออกมาจาก sale.js และ stats.js เพื่อให้ทดสอบอัตโนมัติได้โดยไม่ต้องพึ่ง browser/Supabase
// ดู tests/calc.test.mjs สำหรับเทสของไฟล์นี้

// ── ราคา/ไซส์ปลา (ใช้ใน sale.js) ──────────────────────────────

/** คืนค่า true ถ้าปลาตัวนี้มี 2 ไซส์ที่ต้องให้เลือก (ราคาคนละราคากัน) */
export function hasSizeOptions(fish) {
  return fish.sizeMin != null && fish.sizeMax != null && fish.sizeMin !== fish.sizeMax;
}

/** คืนราคาตามไซส์ที่เลือก ('min' | 'max') หรือ fallback ตามเดิมถ้าไม่มีตัวเลือกไซส์ */
export function priceForSize(fish, sizeChoice) {
  if (fish.sale_price && fish.sale_price > 0) return fish.sale_price;
  if (hasSizeOptions(fish)) {
    return sizeChoice === 'max' ? (fish.priceMax || fish.priceMin || 0) : (fish.priceMin || 0);
  }
  return fish.priceMax && !fish.priceMin ? fish.priceMax : (fish.priceMin || fish.priceMax || 0);
}

// ── กราฟการเงิน (ใช้ใน stats.js) ──────────────────────────────

/** ปัดค่า max ของแกน Y ให้เป็นตัวเลขกลมๆ (1/2/5/10 คูณ 10^n) สำหรับวาดกราฟ */
export function niceMax(value) {
  if (value <= 0) return 100;
  const pow = Math.pow(10, Math.floor(Math.log10(value)));
  const n = value / pow;
  let nice;
  if (n <= 1) nice = 1;
  else if (n <= 2) nice = 2;
  else if (n <= 5) nice = 5;
  else nice = 10;
  return nice * pow;
}

/** สร้าง SVG path แบบเส้นโค้ง (cubic bezier ผ่านจุดกึ่งกลาง) จากลิสต์จุด {x,y} */
export function smoothPath(points) {
  if (!points.length) return '';
  if (points.length === 1) return `M${points[0].x},${points[0].y}`;
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i], p1 = points[i + 1];
    const midX = (p0.x + p1.x) / 2;
    d += ` C${midX},${p0.y} ${midX},${p1.y} ${p1.x},${p1.y}`;
  }
  return d;
}

// ── ระบบเลิกขาย (archive) ─────────────────────────────────────

/** ควรถามว่าจะเลิกขายไหม หลังขายแล้วสต็อกเหลือเท่าไหร่ */
export function shouldPromptArchive(newStock) {
  return newStock === 0;
}

// ── สต็อกใกล้หมด (แจ้งเตือน Messenger + การ์ด dashboard) ───────

/** เกณฑ์ "สต็อกใกล้หมด" ใช้ร่วมกันทั้งการ์ด dashboard และ auto-alert Messenger */
export const LOW_STOCK_THRESHOLD = 3;

/** เหลือน้อยกว่าหรือเท่ากับเกณฑ์ไหม (รวมกรณีหมดสต็อกพอดีด้วย) */
export function isLowStock(stock) {
  return stock <= LOW_STOCK_THRESHOLD;
}

// ── สถิติกำไร/ต้นทุนรายตัว (ใช้ใน modules/fishStats.js) ────────

/**
 * ดึงจำนวนตัวที่ขายจากข้อความชื่อรายการ finance เช่น "ขายปลา: ... x3 ตัว" (รูปแบบที่ sale.js สร้างตอนบันทึกการขาย)
 * ถ้า parse ไม่ได้ (รายการเก่า/แก้ไขเองในระบบการเงิน) นับเป็น 1 รายการแทน กันตกหล่น
 */
export function extractSaleQty(name) {
  const m = /x(\d+)\s*ตัว/.exec(name || '');
  return m ? parseInt(m[1], 10) : 1;
}

/**
 * สรุปรายรับ/ต้นทุน/จำนวนขาย รายเดือน (12 เดือน) ของปีที่ระบุ จาก finance records ของปลาตัวเดียว
 * @param {Array} records finance records ที่กรองเฉพาะ fish_id ของปลาตัวนั้นแล้ว
 * @param {number} year
 * @returns {Array<{income:number, cost:number, qty:number}>} ยาว 12 ช่อง (index 0 = มกราคม)
 */
export function monthlyFishBreakdown(records, year) {
  const months = Array.from({ length: 12 }, () => ({ income: 0, cost: 0, qty: 0 }));
  (records || []).forEach(r => {
    const d = r.date || '';
    if (!d.startsWith(String(year))) return;
    const mo = parseInt(d.slice(5, 7), 10) - 1;
    if (mo < 0 || mo > 11) return;
    if (r.type === 'income') {
      months[mo].income += r.amount || 0;
      months[mo].qty += extractSaleQty(r.name);
    } else {
      months[mo].cost += r.amount || 0;
    }
  });
  return months;
}

/**
 * ดึงไซส์ (นิ้ว) จากข้อความชื่อรายการขาย เช่น "ขายปลา: ... (ไซส์ 4 นิ้ว) x3 ตัว" (รูปแบบที่ sale.js สร้างตอนบันทึกการขาย)
 * ถ้าปลาตัวนั้นไม่มีตัวเลือกไซส์ (ไม่มีข้อความ "ไซส์ ... นิ้ว" แทรกอยู่) → คืนค่า null
 */
export function extractSaleSize(name) {
  const m = /ไซส์\s*([\d.]+)\s*นิ้ว/.exec(name || '');
  return m ? m[1] : null;
}

/**
 * สรุปรายละเอียดการขายรายเดือน แยกตามไซส์ (สำหรับ popover ตอนคลิกจุดกำไรบนกราฟสถิติรายตัว)
 * กำไรต่อตัวของแต่ละไซส์ = ราคาขายเฉลี่ยต่อตัวของไซส์นั้น - ต้นทุนเฉลี่ยต่อตัวของทั้งเดือน
 * (ประมาณจากต้นทุนรวมของเดือน / จำนวนขายรวมของเดือน เพราะรายการต้นทุนไม่ได้ผูกกับการขายแต่ละครั้งแบบ 1:1)
 * @param {Array} records finance records ที่กรองเฉพาะ fish_id ของปลาตัวนั้นแล้ว
 * @param {number} year
 * @returns {Array<Array<{size:string|null, qty:number, revenue:number, profitPerUnit:number, totalProfit:number}>>}
 *          ยาว 12 ช่อง (index 0 = มกราคม) แต่ละช่องคือลิสต์ของกลุ่มไซส์ที่ขายได้ในเดือนนั้น
 */
export function monthlyFishSizeBreakdown(records, year) {
  const totals = monthlyFishBreakdown(records, year);
  const months = totals.map(t => ({
    costPerUnit: t.qty > 0 ? t.cost / t.qty : 0,
    groups: [],
  }));

  (records || []).forEach(r => {
    if (r.type !== 'income') return;
    const d = r.date || '';
    if (!d.startsWith(String(year))) return;
    const mo = parseInt(d.slice(5, 7), 10) - 1;
    if (mo < 0 || mo > 11) return;

    const size   = extractSaleSize(r.name);
    const qty    = extractSaleQty(r.name);
    const amount = r.amount || 0;

    const groups = months[mo].groups;
    let group = groups.find(g => g.size === size);
    if (!group) {
      group = { size, qty: 0, revenue: 0 };
      groups.push(group);
    }
    group.qty     += qty;
    group.revenue += amount;
  });

  return months.map(m => m.groups.map(g => {
    const sellPricePerUnit = g.qty > 0 ? g.revenue / g.qty : 0;
    const profitPerUnit = Math.round(sellPricePerUnit - m.costPerUnit);
    return { ...g, profitPerUnit, totalProfit: profitPerUnit * g.qty };
  }));
}