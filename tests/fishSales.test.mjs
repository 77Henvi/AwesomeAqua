// tests/fishSales.test.mjs
// รันด้วย: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SALES_CONFIG,
  formatSoldCount,
  classifyFish,
  markupPercent,
  referencePrice,
  sortFish,
} from '../scripts/shared/fishSales.js';

const NOW = new Date('2026-09-29T12:00:00Z').getTime();
const daysAgo = n => new Date(NOW - n * 86_400_000).toISOString().slice(0, 10);

const fish = (over = {}) => ({
  id: 'f1', stock: 5, salesKnown: true,
  soldTotal: 0, sold30d: 0,
  lastSoldAt: null, lastRestockAt: null, createdAt: daysAgo(3),
  ...over,
});

// ── formatSoldCount ────────────────────────────
test('formatSoldCount: 0/ค่าแปลก → ว่าง (ไม่แสดง)', () => {
  assert.equal(formatSoldCount(0), '');
  assert.equal(formatSoldCount(null), '');
  assert.equal(formatSoldCount(undefined), '');
  assert.equal(formatSoldCount(-3), '');
  assert.equal(formatSoldCount('abc'), '');
});

test('formatSoldCount: ต่ำกว่า 10 แสดงเลขจริง', () => {
  assert.equal(formatSoldCount(1), '1');
  assert.equal(formatSoldCount(9), '9');
});

test('formatSoldCount: ขั้นบันได X+', () => {
  assert.equal(formatSoldCount(10), '10+');
  assert.equal(formatSoldCount(49), '10+');
  assert.equal(formatSoldCount(50), '50+');
  assert.equal(formatSoldCount(99), '50+');
  assert.equal(formatSoldCount(100), '100+');
  assert.equal(formatSoldCount(499), '100+');
  assert.equal(formatSoldCount(500), '500+');
  assert.equal(formatSoldCount(999), '500+');
  assert.equal(formatSoldCount(1000), '1k+');
  assert.equal(formatSoldCount(2500), '2k+');
});

// ── classifyFish ───────────────────────────────
test('Case A: ขายดีมาก (sold30d ถึงเกณฑ์) → hot', () => {
  const r = classifyFish(fish({ soldTotal: 20, sold30d: SALES_CONFIG.hotMinSold30d }), NOW);
  assert.equal(r.kind, 'hot');
});

test('Case A: หมดสต็อกแต่ขายดี ยังติด HOT', () => {
  const r = classifyFish(fish({ stock: 0, soldTotal: 20, sold30d: 9 }), NOW);
  assert.equal(r.kind, 'hot');
});

test('Case B1: เคยขาย ยังขายอยู่เรื่อยๆ (ไม่ถึง HOT ไม่นิ่งนาน) → none', () => {
  const r = classifyFish(fish({
    soldTotal: 6, sold30d: 2, lastSoldAt: daysAgo(10), createdAt: daysAgo(120),
  }), NOW);
  assert.equal(r.kind, 'none');
});

test('Case B2: เคยขาย แต่ไม่มีใครซื้อเกิน 30 วัน → discount', () => {
  const r = classifyFish(fish({
    soldTotal: 6, sold30d: 0, lastSoldAt: daysAgo(45), createdAt: daysAgo(200),
  }), NOW);
  assert.equal(r.kind, 'discount');
  assert.equal(r.idleDays, 45);
});

test('Case B2: ขอบเขต — เท่ากับ 30 วันพอดียังไม่ลด, 31 วันลด', () => {
  const base = { soldTotal: 3, createdAt: daysAgo(300) };
  assert.equal(classifyFish(fish({ ...base, lastSoldAt: daysAgo(30) }), NOW).kind, 'none');
  assert.equal(classifyFish(fish({ ...base, lastSoldAt: daysAgo(31) }), NOW).kind, 'discount');
});

test('B2: รีสต็อกล็อตใหม่เมื่อวาน ไม่ควรติดลดหนัก แม้ขายล่าสุดนานแล้ว', () => {
  const r = classifyFish(fish({
    soldTotal: 6, lastSoldAt: daysAgo(90), lastRestockAt: daysAgo(1), createdAt: daysAgo(200),
  }), NOW);
  assert.equal(r.kind, 'none');
});

test('Case C1: ปลาใหม่ ยังไม่เคยขาย แต่เพิ่งลงขาย → none', () => {
  const r = classifyFish(fish({ soldTotal: 0, createdAt: daysAgo(5) }), NOW);
  assert.equal(r.kind, 'none');
});

test('Case C2: ปลาใหม่ ไม่เคยขายเลย ค้างเกิน 21 วัน → discount', () => {
  const r = classifyFish(fish({ soldTotal: 0, createdAt: daysAgo(40) }), NOW);
  assert.equal(r.kind, 'discount');
});

test('Case C2: นับจากวันรีสต็อกล่าสุด ไม่ใช่วันที่สร้างปลา', () => {
  const r = classifyFish(fish({ soldTotal: 0, createdAt: daysAgo(400), lastRestockAt: daysAgo(4) }), NOW);
  assert.equal(r.kind, 'none');
});

test('หมดสต็อกแล้วไม่ติดป้ายลดราคา (ไม่มีของให้ลด)', () => {
  const r = classifyFish(fish({ stock: 0, soldTotal: 0, createdAt: daysAgo(90) }), NOW);
  assert.equal(r.kind, 'none');
});

test('ไม่มีข้อมูลยอดขายจาก DB (salesKnown=false) → ไม่ติดป้ายใดๆ', () => {
  const r = classifyFish(fish({ salesKnown: false, createdAt: daysAgo(999) }), NOW);
  assert.equal(r.kind, 'none');
});

test('วันที่เสีย/ไม่มีเลย → none ไม่ throw', () => {
  const r = classifyFish(fish({ createdAt: null, lastRestockAt: 'oops' }), NOW);
  assert.equal(r.kind, 'none');
});

// ── referencePrice ─────────────────────────────
test('referencePrice: คงที่ต่อ id เดิม', () => {
  assert.equal(referencePrice(250, 'abc'), referencePrice(250, 'abc'));
  assert.equal(markupPercent('abc'), markupPercent('abc'));
});

test('referencePrice: อยู่ในช่วง +10%..+20% เสมอ (ทดสอบหลายราคา/หลาย id)', () => {
  const prices = [20, 45, 99, 100, 105, 120, 250, 333, 900, 1100, 2400, 15999];
  for (const p of prices) {
    for (let i = 0; i < 50; i++) {
      const ref = referencePrice(p, `fish-${i}`);
      assert.ok(ref > p, `ref (${ref}) ต้องมากกว่าราคาจริง (${p})`);
      assert.ok(ref >= p * 1.1 - 0.5, `ref ${ref} ต่ำกว่า +10% ของ ${p}`);
      assert.ok(ref <= p * 1.2 + 0.5, `ref ${ref} เกิน +20% ของ ${p}`);
    }
  }
});

test('referencePrice: ราคา 0/ไม่ใช่ตัวเลข → null', () => {
  assert.equal(referencePrice(0, 'a'), null);
  assert.equal(referencePrice(null, 'a'), null);
  assert.equal(referencePrice('x', 'a'), null);
});

// ── sortFish ───────────────────────────────────
const list = [
  { id: 'a', priceMin: 250, level: 'ปานกลาง' },
  { id: 'b', priceMin: 100, level: 'ผู้เชี่ยวชาญ' },
  { id: 'c', priceMin: 900, level: 'มือใหม่' },
  { id: 'd', priceMin: null, level: null },
];
const ids = arr => arr.map(x => x.id).join('');

test('sortFish: default คงลำดับเดิม และไม่แก้ array ต้นฉบับ', () => {
  const out = sortFish(list, 'default');
  assert.equal(ids(out), 'abcd');
  assert.notEqual(out, list);
});

test('sortFish: ราคาสูง→ต่ำ / ต่ำ→สูง (ไม่มีราคาอยู่ท้ายเสมอ)', () => {
  assert.equal(ids(sortFish(list, 'price-desc')), 'cabd');
  assert.equal(ids(sortFish(list, 'price-asc')),  'bacd');
});

test('sortFish: เลี้ยงง่ายสุด→ยากสุด / ยากสุด→ง่ายสุด (ไม่ระบุระดับอยู่ท้ายเสมอ)', () => {
  assert.equal(ids(sortFish(list, 'level-asc')),  'cabd');
  assert.equal(ids(sortFish(list, 'level-desc')), 'bacd');
});

// ── describeSales ──────────────────────────────
import { describeSales } from '../scripts/shared/fishSales.js';

test('describeSales: HOT มีป้าย 2 ภาษา + ยอดขาย ไม่มีราคาขีดฆ่า', () => {
  const f = fish({ soldTotal: 34, sold30d: 8, priceMin: 250 });
  const th = describeSales(f, false, NOW), en = describeSales(f, true, NOW);
  assert.equal(th.kind, 'hot');
  assert.equal(th.label, 'ยอดนิยม');
  assert.equal(en.label, 'HOT');
  assert.equal(th.soldText, 'ขายแล้ว 10+ ตัว');
  assert.equal(en.soldText, '10+ sold');
  assert.equal(th.refMin, null);
});

test('describeSales: ลดหนัก มีราคาขีดฆ่าสูงกว่าราคาจริง (ทั้ง min และ max)', () => {
  const f = fish({ soldTotal: 0, createdAt: daysAgo(60), priceMin: 250, priceMax: 400 });
  const d = describeSales(f, false, NOW);
  assert.equal(d.kind, 'discount');
  assert.equal(d.label, 'ลดหนัก');
  assert.ok(d.refMin > 250);
  assert.ok(d.refMax > 400);
  assert.equal(describeSales(f, true, NOW).label, 'Super Discount');
});

test('describeSales: showReferencePrice=false → ยังมีป้าย แต่ไม่มีราคาขีดฆ่า', () => {
  const f = fish({ soldTotal: 0, createdAt: daysAgo(60), priceMin: 250 });
  const d = describeSales(f, false, NOW, { ...SALES_CONFIG, showReferencePrice: false });
  assert.equal(d.kind, 'discount');
  assert.equal(d.refMin, null);
});

test('describeSales: ปลาปกติ ไม่มีป้าย/ไม่มีขีดฆ่า และยังไม่เคยขาย → ไม่มีข้อความยอดขาย', () => {
  const d = describeSales(fish({ createdAt: daysAgo(2), priceMin: 250 }), false, NOW);
  assert.deepEqual(d, { kind: 'none', label: '', soldText: '', refMin: null, refMax: null });
});
