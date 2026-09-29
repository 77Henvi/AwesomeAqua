// scripts/shared/fishSales.js
// ตรรกะล้วน (ไม่พึ่ง DOM/Supabase) ของหน้าร้าน: ป้าย HOT / ลดหนัก, ยอดขาย "X+", ราคาขีดฆ่า, การเรียงลำดับ
// มี unit test ที่ tests/fishSales.test.mjs

// ════════════════════════════════════════════
//   ค่าที่ปรับได้ ("ระบบกำหนด") — แก้ตัวเลขตรงนี้ที่เดียว
// ════════════════════════════════════════════
export const SALES_CONFIG = {
  // ── Case A: ขายดีมาก → ป้าย HOT ──
  // ขายได้ (รวมทุกไซส์) อย่างน้อยกี่ตัวใน 30 วันล่าสุด
  // (ช่วง 30 วันถูกกำหนดใน view fish_sales_stats → คอลัมน์ sold_30d)
  hotMinSold30d: 5,

  // ── Case B2: เคยขายได้ แต่นิ่งไปนาน → ลดหนัก ──
  // จำนวนวันที่ "ไม่มีการขายเลย" นับจากวันขายล่าสุด หรือวันรีสต็อกล่าสุด (แล้วแต่อันไหนใหม่กว่า)
  slowDaysAfterSale: 30,

  // ── Case C2: ปลาใหม่ที่ยังไม่เคยขายได้เลย แต่ค้างสต็อกนาน → ลดหนัก ──
  // จำนวนวันนับจากวันที่ลงขาย/รีสต็อกล่าสุด
  slowDaysNeverSold: 21,

  // ── ราคาก่อนลด (จำลอง) = ราคาขายจริง + 10–20% ──
  markupMinPct: 10,
  markupMaxPct: 20,
  showReferencePrice: true, // ตั้งเป็น false เพื่อปิดราคาขีดฆ่า (ยังโชว์ป้ายลดหนักอยู่)
};

const DAY_MS = 86_400_000;

// ════════════════════════════════════════════
//   ยอดขาย  "X+"  (สไตล์ Shopee)
// ════════════════════════════════════════════
/**
 * 0 → '' (ไม่แสดง) | 1–9 → ตัวเลขจริง | 10–49 → '10+' | 50–99 → '50+' | 100–499 → '100+' | 500–999 → '500+' | 1000+ → '1k+', '2k+' ...
 */
export function formatSoldCount(n) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v) || v <= 0) return '';
  if (v < 10)   return String(v);
  if (v < 50)   return '10+';
  if (v < 100)  return '50+';
  if (v < 500)  return '100+';
  if (v < 1000) return '500+';
  return `${Math.floor(v / 1000)}k+`;
}

// ════════════════════════════════════════════
//   จัดประเภทปลา → ป้ายที่ต้องแสดง
// ════════════════════════════════════════════
function toTime(v) {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * @param {object} f  ปลา 1 ตัว (จาก fishData) — ใช้ field: stock, soldTotal, sold30d, lastSoldAt, lastRestockAt, createdAt, salesKnown
 * @param {number} [now]
 * @returns {{kind:'hot'|'discount'|'none', idleDays?:number}}
 *
 *  A  : ขายดีมาก                         → hot
 *  B1 : ขายกลางๆ                         → none
 *  B2 : เคยขายได้ แต่นิ่งเกินกำหนด          → discount
 *  C1 : ปลาใหม่ ยังไม่ค้างนาน              → none
 *  C2 : ปลาใหม่ที่ยังไม่เคยขาย ค้างเกินกำหนด → discount
 *
 * หมายเหตุ: ปลาที่หมดสต็อกแล้วจะไม่ติดป้ายลดราคา (ไม่มีของให้ลด) แต่ยังติด HOT ได้
 *           ถ้าไม่มีข้อมูลยอดขายจาก DB (salesKnown = false) จะไม่ติดป้ายใดๆ กัน "ลดหนัก" ผิดพลาดทั้งร้าน
 */
export function classifyFish(f, now = Date.now(), cfg = SALES_CONFIG) {
  if (!f || !f.salesKnown) return { kind: 'none' };

  const sold   = Number(f.soldTotal) || 0;
  const sold30 = Number(f.sold30d)   || 0;

  if (sold30 >= cfg.hotMinSold30d) return { kind: 'hot' };

  if ((Number(f.stock) || 0) <= 0) return { kind: 'none' };

  const anchors = [f.lastRestockAt, f.createdAt];
  if (sold > 0) anchors.push(f.lastSoldAt);
  const times = anchors.map(toTime).filter(t => t !== null);
  if (!times.length) return { kind: 'none' };

  const idleDays = Math.floor((now - Math.max(...times)) / DAY_MS);
  const limit = sold > 0 ? cfg.slowDaysAfterSale : cfg.slowDaysNeverSold;

  return idleDays > limit ? { kind: 'discount', idleDays } : { kind: 'none', idleDays };
}

// ════════════════════════════════════════════
//   ราคาก่อนลด (จำลอง) — คงที่ต่อปลาแต่ละตัว ไม่สุ่มใหม่ทุกครั้งที่ render
// ════════════════════════════════════════════
function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h;
}

/** เปอร์เซ็นต์ที่บวกเพิ่ม (จำนวนเต็ม min..max) ที่ผูกกับ id ของปลา */
export function markupPercent(id, cfg = SALES_CONFIG) {
  const span = cfg.markupMaxPct - cfg.markupMinPct + 1;
  return cfg.markupMinPct + (hashStr(String(id)) % span);
}

/** ราคาก่อนลด = ราคาจริง + 10–20% ปัดเป็นเลขกลมๆ (ลงท้าย 5/10) โดยไม่ให้หลุดช่วง 10–20% */
export function referencePrice(price, id, cfg = SALES_CONFIG) {
  const p = Number(price);
  if (!Number.isFinite(p) || p <= 0) return null;

  const raw  = p * (1 + markupPercent(id, cfg) / 100);
  const lo   = p * (1 + cfg.markupMinPct / 100);
  const hi   = p * (1 + cfg.markupMaxPct / 100);
  const step = p >= 100 ? 10 : 5;

  const up = Math.ceil(raw / step) * step;
  if (up <= hi) return up;
  const down = Math.floor(raw / step) * step;
  if (down >= lo) return down;
  return Math.round(raw);
}

// ════════════════════════════════════════════
//   เรียงลำดับ
// ════════════════════════════════════════════
export const SORT_MODES = ['default', 'price-desc', 'price-asc', 'level-asc', 'level-desc'];

export const LEVEL_RANK = { 'มือใหม่': 1, 'ปานกลาง': 2, 'ผู้เชี่ยวชาญ': 3 };

/** คืน array ใหม่ (ไม่แก้ตัวเดิม) — ค่าที่ไม่มีข้อมูล (ไม่มีราคา/ไม่ระบุระดับ) จะอยู่ท้ายสุดเสมอ */
export function sortFish(list, mode) {
  const arr = [...list];
  const cmp = (getVal, dir) => (a, b) => {
    const va = getVal(a), vb = getVal(b);
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    return (va - vb) * dir;
  };
  const price = f => (Number.isFinite(Number(f.priceMin)) && f.priceMin !== null ? Number(f.priceMin) : null);
  const level = f => LEVEL_RANK[f.level] ?? null;

  switch (mode) {
    case 'price-desc': return arr.sort(cmp(price, -1));
    case 'price-asc':  return arr.sort(cmp(price,  1));
    case 'level-asc':  return arr.sort(cmp(level,  1));
    case 'level-desc': return arr.sort(cmp(level, -1));
    default:           return arr; // ลำดับเดิมจาก DB (ใหม่สุดก่อน)
  }
}

// ════════════════════════════════════════════
//   สรุปทุกอย่างที่ UI ต้องใช้ในก้อนเดียว (ใช้ร่วมกันทั้งการ์ดและ modal)
// ════════════════════════════════════════════
export const SALES_TEXT = {
  th: { hot: 'ยอดนิยม', discount: 'ลดหนัก', sold: c => `ขายแล้ว ${c} ตัว` },
  en: { hot: 'HOT',     discount: 'Super Discount', sold: c => `${c} sold` },
};

/**
 * @returns {{kind:'hot'|'discount'|'none', label:string, soldText:string, refMin:number|null, refMax:number|null}}
 *   label    : ข้อความบนป้าย ('' ถ้าไม่มีป้าย)
 *   soldText : เช่น 'ขายแล้ว 10+ ตัว' ('' ถ้ายังไม่เคยขาย)
 *   refMin/refMax : ราคาก่อนลด (จำลอง) สำหรับขีดฆ่า — มีเฉพาะปลาที่ติดป้ายลดหนัก
 */
export function describeSales(f, isEn = false, now = Date.now(), cfg = SALES_CONFIG) {
  const t = SALES_TEXT[isEn ? 'en' : 'th'];
  const { kind } = classifyFish(f, now, cfg);
  const count = formatSoldCount(f?.soldTotal);

  const wantRef = kind === 'discount' && cfg.showReferencePrice;
  const refMin = wantRef ? referencePrice(f.priceMin, f.id, cfg) : null;
  const refMax = refMin && Number(f.priceMax) > Number(f.priceMin) ? referencePrice(f.priceMax, f.id, cfg) : null;

  return {
    kind,
    label: kind === 'hot' ? t.hot : kind === 'discount' ? t.discount : '',
    soldText: count ? t.sold(count) : '',
    refMin,
    refMax,
  };
}
