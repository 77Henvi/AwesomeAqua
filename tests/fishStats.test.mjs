// tests/fishStats.test.mjs
// รันด้วย: node --test tests/
// ทดสอบฟังก์ชันคำนวณล้วนที่ใช้ในกราฟ "สถิติรายตัว" (modules/fishStats.js)

import test from 'node:test';
import assert from 'node:assert/strict';
import { extractSaleQty, monthlyFishBreakdown, extractSaleSize, monthlyFishSizeBreakdown } from '../scripts/shared/calc.js';

// ── extractSaleQty ─────────────────────────────
test('extractSaleQty: ดึงจำนวนตัวจากชื่อรายการขายปกติ', () => {
  assert.equal(extractSaleQty('ขายปลา: เรนโบว์ 2 สี สั้น x3 ตัว'), 3);
});

test('extractSaleQty: ดึงจำนวนตัวได้แม้มีข้อความไซส์แทรกอยู่', () => {
  assert.equal(extractSaleQty('ขายปลา: ฟรอนโตซ่า บุรุนดี (ไซส์ 5 นิ้ว) x12 ตัว'), 12);
});

test('extractSaleQty: parse ไม่ได้ (รูปแบบเก่า/แก้ไขเอง) → fallback เป็น 1', () => {
  assert.equal(extractSaleQty('รายรับพิเศษ'), 1);
  assert.equal(extractSaleQty(''), 1);
  assert.equal(extractSaleQty(undefined), 1);
});

// ── monthlyFishBreakdown ────────────────────────
test('monthlyFishBreakdown: คืน array ยาว 12 เดือนเสมอ', () => {
  const months = monthlyFishBreakdown([], 2026);
  assert.equal(months.length, 12);
  months.forEach(m => assert.deepEqual(m, { income: 0, cost: 0, qty: 0 }));
});

test('monthlyFishBreakdown: รวมรายรับ/ต้นทุน/จำนวนขายแยกตามเดือนถูกต้อง', () => {
  const records = [
    { type: 'income', amount: 900,  date: '2026-01-15', name: 'ขายปลา: A x3 ตัว' },
    { type: 'income', amount: 300,  date: '2026-01-20', name: 'ขายปลา: A x1 ตัว' },
    { type: 'expense', amount: 400, date: '2026-01-05', name: 'เติมสต็อก: A x4 ตัว' },
    { type: 'income', amount: 600,  date: '2026-03-02', name: 'ขายปลา: A x2 ตัว' },
  ];
  const months = monthlyFishBreakdown(records, 2026);

  assert.deepEqual(months[0], { income: 1200, cost: 400, qty: 4 }); // มกราคม
  assert.deepEqual(months[1], { income: 0, cost: 0, qty: 0 });      // กุมภาพันธ์ ไม่มีรายการ
  assert.deepEqual(months[2], { income: 600, cost: 0, qty: 2 });    // มีนาคม
});

test('monthlyFishBreakdown: กรองเฉพาะปีที่ระบุ ไม่ปนปีอื่น', () => {
  const records = [
    { type: 'income', amount: 500, date: '2025-06-01', name: 'ขายปลา: A x1 ตัว' },
    { type: 'income', amount: 700, date: '2026-06-01', name: 'ขายปลา: A x1 ตัว' },
  ];
  const months2026 = monthlyFishBreakdown(records, 2026);
  assert.equal(months2026[5].income, 700); // มิถุนายน 2026 เท่านั้น

  const months2025 = monthlyFishBreakdown(records, 2025);
  assert.equal(months2025[5].income, 500);
});

test('monthlyFishBreakdown: record ที่ไม่มี date หรือ date ผิดรูปแบบถูกข้ามไปเงียบๆ ไม่ throw', () => {
  const records = [
    { type: 'income', amount: 100, date: '', name: 'x1 ตัว' },
    { type: 'income', amount: 100, date: undefined, name: 'x1 ตัว' },
  ];
  assert.doesNotThrow(() => monthlyFishBreakdown(records, 2026));
  const months = monthlyFishBreakdown(records, 2026);
  months.forEach(m => assert.deepEqual(m, { income: 0, cost: 0, qty: 0 }));
});

// ── extractSaleSize ─────────────────────────────
test('extractSaleSize: ดึงไซส์จากชื่อรายการขายที่มีไซส์', () => {
  assert.equal(extractSaleSize('ขายปลา: ฟรอนโตซ่า บุรุนดี (ไซส์ 5 นิ้ว) x12 ตัว'), '5');
  assert.equal(extractSaleSize('ขายปลา: A (ไซส์ 4 นิ้ว) x4 ตัว'), '4');
});

test('extractSaleSize: ปลาที่ไม่มีตัวเลือกไซส์ → คืน null', () => {
  assert.equal(extractSaleSize('ขายปลา: A x3 ตัว'), null);
  assert.equal(extractSaleSize(''), null);
  assert.equal(extractSaleSize(undefined), null);
});

// ── monthlyFishSizeBreakdown ────────────────────
test('monthlyFishSizeBreakdown: แยกกลุ่มตามไซส์ถูกต้อง พร้อมคำนวณกำไรต่อตัว/รวม', () => {
  const records = [
    // มกราคม: ไซส์ 4" ขาย 4 ตัว รวม 2400 (ต้นทุนของเดือนคือ 400 สำหรับ 4 ตัว → ต้นทุนเฉลี่ย/ตัว = 100)
    { type: 'income',  amount: 2400, date: '2026-01-10', name: 'ขายปลา: A (ไซส์ 4 นิ้ว) x4 ตัว' },
    { type: 'expense', amount: 400,  date: '2026-01-05', name: 'เติมสต็อก: A x4 ตัว' },
  ];
  const months = monthlyFishSizeBreakdown(records, 2026);
  assert.equal(months.length, 12);

  const jan = months[0];
  assert.equal(jan.length, 1);
  assert.deepEqual(jan[0], {
    size: '4', qty: 4, revenue: 2400,
    profitPerUnit: 500, // (2400/4) - (400/4) = 600 - 100 = 500
    totalProfit: 2000,
  });
});

test('monthlyFishSizeBreakdown: หลายไซส์ในเดือนเดียวกัน แยกกลุ่มไม่ปนกัน', () => {
  const records = [
    { type: 'income', amount: 1200, date: '2026-02-03', name: 'ขายปลา: A (ไซส์ 3 นิ้ว) x2 ตัว' },
    { type: 'income', amount: 2000, date: '2026-02-11', name: 'ขายปลา: A (ไซส์ 5 นิ้ว) x2 ตัว' },
  ];
  const feb = monthlyFishSizeBreakdown(records, 2026)[1];
  assert.equal(feb.length, 2);
  const bySize = Object.fromEntries(feb.map(g => [g.size, g]));
  assert.equal(bySize['3'].qty, 2);
  assert.equal(bySize['5'].qty, 2);
});

test('monthlyFishSizeBreakdown: เดือนไม่มีข้อมูล → คืน array ว่าง', () => {
  const months = monthlyFishSizeBreakdown([], 2026);
  months.forEach(m => assert.deepEqual(m, []));
});
