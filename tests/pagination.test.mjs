// tests/pagination.test.mjs
// รันด้วย: node --test tests/
// ทดสอบ paginate() ที่ใช้ร่วมกันระหว่างตารางปลา (admin.js) และรายการการเงิน (finance.js)

import test from 'node:test';
import assert from 'node:assert/strict';
import { paginate } from '../scripts/shared/utils.js';

const items = Array.from({ length: 45 }, (_, i) => i + 1); // [1..45]

test('paginate: หน้าแรกได้จำนวนตาม pageSize และ totalPages ถูกต้อง', () => {
  const result = paginate(items, 1, 20);
  assert.deepEqual(result.items, items.slice(0, 20));
  assert.equal(result.page, 1);
  assert.equal(result.totalPages, 3); // ceil(45/20) = 3
  assert.equal(result.total, 45);
});

test('paginate: หน้าสุดท้ายได้เฉพาะรายการที่เหลือ (ไม่เต็มหน้า)', () => {
  const result = paginate(items, 3, 20);
  assert.deepEqual(result.items, items.slice(40, 45)); // เหลือ 5 ตัว
  assert.equal(result.page, 3);
});

test('paginate: ขอหน้าที่เกินขอบเขต ต้อง clamp กลับมาที่หน้าสุดท้าย', () => {
  const result = paginate(items, 99, 20);
  assert.equal(result.page, 3);
  assert.deepEqual(result.items, items.slice(40, 45));
});

test('paginate: ขอหน้าที่ต่ำกว่า 1 ต้อง clamp กลับมาที่หน้า 1', () => {
  const result = paginate(items, 0, 20);
  assert.equal(result.page, 1);
  assert.deepEqual(result.items, items.slice(0, 20));

  const result2 = paginate(items, -5, 20);
  assert.equal(result2.page, 1);
});

test('paginate: array ว่าง ต้องคืน totalPages เป็น 1 และ items ว่าง (ไม่ crash)', () => {
  const result = paginate([], 1, 20);
  assert.deepEqual(result.items, []);
  assert.equal(result.totalPages, 1);
  assert.equal(result.total, 0);
});

test('paginate: รายการพอดีกับ pageSize เป๊ะ (เช่น 40 รายการ, pageSize 20) ต้องได้ 2 หน้า', () => {
  const exact = Array.from({ length: 40 }, (_, i) => i);
  const result = paginate(exact, 2, 20);
  assert.equal(result.totalPages, 2);
  assert.equal(result.items.length, 20);
});
