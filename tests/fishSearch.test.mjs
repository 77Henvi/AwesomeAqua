// tests/fishSearch.test.mjs
// รันด้วย: node --test tests/
// ทดสอบ fuzzy search ที่ใช้ในบอท Messenger เวลาลูกค้าพิมพ์ชื่อปลาแบบไม่ตรงเป๊ะ

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { levenshtein, scoreFishMatch, searchFish } = require('../api/_shared/fishSearch.js');

const fishList = [
  { id: '1', name_th: 'ปลาทองคอเมท', name_en: 'Comet Goldfish', species: 'Carassius auratus' },
  { id: '2', name_th: 'ปลาหางนกยูง',   name_en: 'Guppy',          species: 'Poecilia reticulata' },
  { id: '3', name_th: 'ปลาคาร์ฟ',      name_en: 'Koi',            species: 'Cyprinus rubrofuscus' },
  { id: '4', name_th: 'ปลาเทวดา',      name_en: 'Angelfish',      species: 'Pterophyllum scalare' },
];

// ── levenshtein ──────────────────────────────────
test('levenshtein: คำเดียวกันต้องได้ระยะห่าง 0', () => {
  assert.equal(levenshtein('ปลาทอง', 'ปลาทอง'), 0);
});

test('levenshtein: ต่างกัน 1 ตัวอักษร ต้องได้ระยะห่าง 1', () => {
  assert.equal(levenshtein('ปลาทอง', 'ปลาทอว'), 1);
});

test('levenshtein: string ว่างเทียบกับ string อื่น ต้องได้ความยาวของอีกฝั่ง', () => {
  assert.equal(levenshtein('', 'abc'), 3);
  assert.equal(levenshtein('abc', ''), 3);
});

// ── scoreFishMatch ───────────────────────────────
test('scoreFishMatch: ชื่อตรงเป๊ะ ต้องได้คะแนนเต็ม 1', () => {
  assert.equal(scoreFishMatch('ปลาทองคอเมท', fishList[0]), 1);
});

test('scoreFishMatch: query เป็นส่วนหนึ่งของชื่อ (substring) ต้องได้คะแนนสูง', () => {
  const score = scoreFishMatch('ทองคอเมท', fishList[0]);
  assert.ok(score >= 0.9);
});

test('scoreFishMatch: พิมพ์ผิดเล็กน้อย ยังต้องได้คะแนนสูงพอสมควร', () => {
  const score = scoreFishMatch('ปลาทองคอเมด', fishList[0]); // ท -> ด
  assert.ok(score > 0.7, `expected high score, got ${score}`);
});

test('scoreFishMatch: คำที่ไม่เกี่ยวข้องเลย ต้องได้คะแนนต่ำ', () => {
  const score = scoreFishMatch('สวัสดีครับวันนี้อากาศดี', fishList[0]);
  assert.ok(score < 0.45, `expected low score, got ${score}`);
});

test('scoreFishMatch: ค้นด้วยชื่ออังกฤษก็ต้อง match ได้', () => {
  const score = scoreFishMatch('guppy', fishList[1]);
  assert.equal(score, 1);
});

// ── searchFish ───────────────────────────────────
test('searchFish: หา "ปลาทอง" ต้องเจอปลาทองคอเมทอันดับแรก', () => {
  const results = searchFish('ปลาทอง', fishList);
  assert.ok(results.length >= 1);
  assert.equal(results[0].id, '1');
});

test('searchFish: คำที่ไม่เกี่ยวข้องเลย ต้องได้ผลลัพธ์ว่าง', () => {
  const results = searchFish('สวัสดีครับ ขอบคุณครับ', fishList);
  assert.deepEqual(results, []);
});

test('searchFish: จำกัดจำนวนผลลัพธ์ตาม limit', () => {
  const results = searchFish('ปลา', fishList, { limit: 2, threshold: 0 });
  assert.equal(results.length, 2);
});

test('searchFish: query ว่าง หรือ fishList ไม่ใช่ array ต้องคืน array ว่างไม่ throw', () => {
  assert.deepEqual(searchFish('', fishList), []);
  assert.deepEqual(searchFish('ปลาทอง', null), []);
  assert.deepEqual(searchFish('ปลาทอง', undefined), []);
});

test('searchFish: เรียงผลลัพธ์จากคะแนนมากไปน้อย', () => {
  const results = searchFish('คาร์ฟ', fishList, { threshold: 0.3 });
  // ปลาคาร์ฟควรมาก่อนตัวอื่นเพราะ match ตรงที่สุด
  assert.equal(results[0].id, '3');
});
