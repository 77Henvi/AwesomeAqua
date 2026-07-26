// tests/cart.test.mjs
// รันด้วย: node --test tests/
// ทดสอบ scripts... (จริงๆ อยู่ที่ api/_shared/cart.js) — ฟังก์ชัน parse คำสั่งลบของในตะกร้า Messenger
// เทสนี้สำคัญมาก: เคยมีบั๊กที่ require() คืนค่า exports ว่างเปล่าเงียบๆ (เพราะไฟล์เดิมอยู่ผิด
// scope ESM/CJS) โค้ด runtime ไม่ throw error เลย แต่ parseRemoveCommand เป็น undefined จริง —
// ถ้าไม่มีเทสตรงๆ แบบนี้ จะไม่มีทางรู้เลยจนกว่าลูกค้าจะลองพิมพ์ "ลบ 1" ในแชทจริง

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parseRemoveCommand, findCartRemovalIndex } = require('../api/_shared/cart.js');

// ── sanity: exports ต้องเป็นฟังก์ชันจริง ไม่ใช่ undefined (กันบั๊กแบบที่เคยเกิด) ──
test('cart module: exports ต้องเป็นฟังก์ชันจริง ไม่ใช่ undefined', () => {
  assert.equal(typeof parseRemoveCommand, 'function');
  assert.equal(typeof findCartRemovalIndex, 'function');
});

// ── parseRemoveCommand ───────────────────────────
test('parseRemoveCommand: "ลบ 1" ต้องได้เลข 1', () => {
  assert.equal(parseRemoveCommand('ลบ 1'), 1);
});

test('parseRemoveCommand: "ลบตัวที่ 3" ต้องได้เลข 3', () => {
  assert.equal(parseRemoveCommand('ลบตัวที่ 3'), 3);
});

test('parseRemoveCommand: ข้อความที่ไม่เกี่ยวกับการลบ ต้องได้ null', () => {
  assert.equal(parseRemoveCommand('สวัสดีครับ'), null);
  assert.equal(parseRemoveCommand('ตะกร้า'), null);
});

test('parseRemoveCommand: "ลบ" ไม่มีเลขต่อท้าย ต้องได้ null', () => {
  assert.equal(parseRemoveCommand('ลบ'), null);
  assert.equal(parseRemoveCommand('ล้างตะกร้า'), null); // ไม่ตรงเพราะไม่มีเลข
});

test('parseRemoveCommand: input ว่าง/undefined ต้องไม่ throw และคืน null', () => {
  assert.equal(parseRemoveCommand(''), null);
  assert.equal(parseRemoveCommand(undefined), null);
});

// ── findCartRemovalIndex ─────────────────────────
const cart = [{ fish_id: 'a' }, { fish_id: 'b' }, { fish_id: 'c' }];

test('findCartRemovalIndex: หาตำแหน่งจริงตามลำดับที่แสดงผล (ทุกตัว valid)', () => {
  const isValid = () => true;
  assert.equal(findCartRemovalIndex(cart, 1, isValid), 0);
  assert.equal(findCartRemovalIndex(cart, 2, isValid), 1);
  assert.equal(findCartRemovalIndex(cart, 3, isValid), 2);
});

test('findCartRemovalIndex: ถ้ามีรายการที่ invalid (หาปลาไม่เจอ) ต้องข้ามลำดับนั้นไป', () => {
  // สมมติ fish_id 'b' หาไม่เจอ (ปลาถูกลบจาก DB แล้ว) -> ลำดับที่แสดงผลจะเหลือ a=1, c=2
  const isValid = (item) => item.fish_id !== 'b';
  assert.equal(findCartRemovalIndex(cart, 1, isValid), 0); // a
  assert.equal(findCartRemovalIndex(cart, 2, isValid), 2); // c (ข้าม b ไป)
});

test('findCartRemovalIndex: เลขที่ขอเกินจำนวนรายการจริง ต้องคืน -1', () => {
  assert.equal(findCartRemovalIndex(cart, 99, () => true), -1);
});

test('findCartRemovalIndex: เลข 0 หรือติดลบ ต้องคืน -1 ไม่ throw', () => {
  assert.equal(findCartRemovalIndex(cart, 0, () => true), -1);
  assert.equal(findCartRemovalIndex(cart, -1, () => true), -1);
});

test('findCartRemovalIndex: cart ว่าง/ไม่ใช่ array ต้องคืน -1 ไม่ throw', () => {
  assert.equal(findCartRemovalIndex([], 1, () => true), -1);
  assert.equal(findCartRemovalIndex(null, 1, () => true), -1);
});
