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