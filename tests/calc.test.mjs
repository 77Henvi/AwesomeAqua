// tests/calc.test.mjs
// รันด้วย: node --test tests/
// ไม่ต้องติดตั้ง dependency ใดๆ เพิ่ม (ใช้ node:test / node:assert ที่มากับ Node.js อยู่แล้ว ตั้งแต่ v18+)

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasSizeOptions,
  priceForSize,
  niceMax,
  smoothPath,
  shouldPromptArchive,
} from '../scripts/shared/calc.js';

// ── hasSizeOptions ─────────────────────────────
test('hasSizeOptions: คืน true เมื่อมี 2 ไซส์ต่างกัน', () => {
  assert.equal(hasSizeOptions({ sizeMin: 2, sizeMax: 5 }), true);
});

test('hasSizeOptions: คืน false เมื่อไซส์เดียวกัน (min === max)', () => {
  assert.equal(hasSizeOptions({ sizeMin: 3, sizeMax: 3 }), false);
});

test('hasSizeOptions: คืน false เมื่อไม่มีไซส์เลย (null)', () => {
  assert.equal(hasSizeOptions({ sizeMin: null, sizeMax: null }), false);
  assert.equal(hasSizeOptions({ sizeMin: 2, sizeMax: null }), false);
});

// ── priceForSize ───────────────────────────────
test('priceForSize: ใช้ sale_price ก่อนเสมอถ้ามีการตั้งราคาพิเศษ', () => {
  const fish = { sizeMin: 2, sizeMax: 5, priceMin: 100, priceMax: 300, sale_price: 250 };
  assert.equal(priceForSize(fish, 'min'), 250);
  assert.equal(priceForSize(fish, 'max'), 250);
});

test('priceForSize: เลือกไซส์ min ต้องได้ priceMin (เคสบั๊กที่เจอจริงจากผู้ใช้)', () => {
  const fish = { sizeMin: 2, sizeMax: 5, priceMin: 100, priceMax: 300 };
  assert.equal(priceForSize(fish, 'min'), 100);
});

test('priceForSize: เลือกไซส์ max ต้องได้ priceMax ไม่ใช่ priceMin', () => {
  const fish = { sizeMin: 2, sizeMax: 5, priceMin: 100, priceMax: 300 };
  assert.equal(priceForSize(fish, 'max'), 300);
});

test('priceForSize: ปลาไซส์เดียว ไม่มี sizeMax ให้ fallback ใช้ priceMin', () => {
  const fish = { sizeMin: 3, sizeMax: 3, priceMin: 120, priceMax: 120 };
  assert.equal(priceForSize(fish, 'min'), 120);
});

test('priceForSize: มีแค่ priceMax (priceMin เป็น 0/null) ต้อง fallback ไปใช้ priceMax', () => {
  const fish = { sizeMin: 3, sizeMax: 3, priceMin: 0, priceMax: 150 };
  assert.equal(priceForSize(fish, 'min'), 150);
});

// ── niceMax ────────────────────────────────────
test('niceMax: ปัดขึ้นเป็นเลขกลมสำหรับสเกลกราฟ', () => {
  assert.equal(niceMax(0), 100);
  assert.equal(niceMax(-50), 100);
  assert.equal(niceMax(1200), 2000);
  assert.equal(niceMax(4800), 5000);
  assert.equal(niceMax(9999), 10000);
});

// ── smoothPath ─────────────────────────────────
test('smoothPath: array ว่างคืนค่าว่าง', () => {
  assert.equal(smoothPath([]), '');
});

test('smoothPath: จุดเดียวคืนแค่คำสั่ง M', () => {
  assert.equal(smoothPath([{ x: 10, y: 20 }]), 'M10,20');
});

test('smoothPath: หลายจุดต้องขึ้นต้นด้วย M และมีคำสั่ง C ครบตามจำนวนช่วง', () => {
  const path = smoothPath([{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 5 }]);
  assert.match(path, /^M0,0/);
  assert.equal((path.match(/C/g) || []).length, 2); // 3 จุด = 2 ช่วง = 2 คำสั่ง C
});

// ── shouldPromptArchive ────────────────────────
test('shouldPromptArchive: ถามเฉพาะตอนสต็อกเหลือ 0 พอดี', () => {
  assert.equal(shouldPromptArchive(0), true);
  assert.equal(shouldPromptArchive(1), false);
  assert.equal(shouldPromptArchive(-1), false); // กันเคส edge case ที่ไม่ควรเกิดแต่เผื่อไว้
});
