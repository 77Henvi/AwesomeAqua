// tests/rateLimiter.test.mjs
// รันด้วย: node --test tests/
// ทดสอบ rate limiter ที่ใช้กันสแปมยิง webhook รัวๆ — inject store/clock เองในเทส
// เพื่อไม่ต้องรอเวลาจริงและไม่แชร์ state ข้ามเทสเคส

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { checkRateLimit, pruneRateLimitStore } = require('../api/_shared/rateLimiter.js');

test('checkRateLimit: อนุญาตให้ผ่านตราบใดที่ยังไม่ถึง limit', () => {
  const store = new Map();
  const opts = { limit: 3, windowMs: 60_000 };
  let now = 1_000_000;

  const r1 = checkRateLimit('psid_1', opts, store, now);
  const r2 = checkRateLimit('psid_1', opts, store, now + 10);
  const r3 = checkRateLimit('psid_1', opts, store, now + 20);

  assert.equal(r1.allowed, true);
  assert.equal(r2.allowed, true);
  assert.equal(r3.allowed, true);
  assert.equal(r3.remaining, 0);
});

test('checkRateLimit: ครั้งที่เกิน limit ต้องถูกบล็อก', () => {
  const store = new Map();
  const opts = { limit: 2, windowMs: 60_000 };
  let now = 1_000_000;

  checkRateLimit('psid_2', opts, store, now);
  checkRateLimit('psid_2', opts, store, now + 10);
  const r3 = checkRateLimit('psid_2', opts, store, now + 20);

  assert.equal(r3.allowed, false);
  assert.equal(r3.remaining, 0);
  assert.ok(r3.retryAfterMs > 0);
});

test('checkRateLimit: หลังพ้น window แล้วต้องอนุญาตใหม่ (sliding window)', () => {
  const store = new Map();
  const opts = { limit: 1, windowMs: 1000 };
  let now = 1_000_000;

  const r1 = checkRateLimit('psid_3', opts, store, now);
  const r2 = checkRateLimit('psid_3', opts, store, now + 500); // ยังอยู่ใน window เดิม -> โดนบล็อก
  const r3 = checkRateLimit('psid_3', opts, store, now + 1500); // พ้น window แล้ว -> ผ่านใหม่

  assert.equal(r1.allowed, true);
  assert.equal(r2.allowed, false);
  assert.equal(r3.allowed, true);
});

test('checkRateLimit: แต่ละ key (PSID) แยก quota กันเอง ไม่ปนกัน', () => {
  const store = new Map();
  const opts = { limit: 1, windowMs: 60_000 };
  const now = 1_000_000;

  const rA = checkRateLimit('psid_A', opts, store, now);
  const rB = checkRateLimit('psid_B', opts, store, now);

  assert.equal(rA.allowed, true);
  assert.equal(rB.allowed, true); // คนละคน ไม่ควรกระทบกัน
});

test('checkRateLimit: key ว่าง/undefined ต้องอนุญาตผ่านเสมอ ไม่ throw', () => {
  const store = new Map();
  const r = checkRateLimit(null, { limit: 1, windowMs: 1000 }, store, Date.now());
  assert.equal(r.allowed, true);
});

test('pruneRateLimitStore: ลบ key ที่ timestamp หมดอายุทั้งหมดออกจาก store', () => {
  const store = new Map();
  const opts = { limit: 5, windowMs: 1000 };
  const now = 1_000_000;

  checkRateLimit('old_psid', opts, store, now);
  assert.ok(store.has('old_psid'));

  pruneRateLimitStore(1000, store, now + 5000); // เวลาผ่านไปเกิน window มาก
  assert.equal(store.has('old_psid'), false);
});

test('pruneRateLimitStore: key ที่ยัง active อยู่ต้องไม่ถูกลบ', () => {
  const store = new Map();
  const opts = { limit: 5, windowMs: 60_000 };
  const now = 1_000_000;

  checkRateLimit('active_psid', opts, store, now);
  pruneRateLimitStore(60_000, store, now + 100);
  assert.ok(store.has('active_psid'));
});
