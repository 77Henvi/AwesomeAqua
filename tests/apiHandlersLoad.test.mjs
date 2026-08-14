// tests/apiHandlersLoad.test.mjs
// รันด้วย: node --test tests/
//
// ⚠️ เทสนี้เกิดขึ้นเพราะมีบั๊กจริงหลุดขึ้น production มาแล้วครั้งหนึ่ง: api/errorNotify.js
// ถูกวางผิดที่ (นอก _shared/) ทำให้ require('./_shared/errorNotify.js') จาก
// messenger-webhook.js, notify-restock.js, data-deletion.js หาไฟล์ไม่เจอ และทั้ง 3 endpoint
// crash ทันทีที่ถูกเรียก — แต่ชุดเทสเดิมทั้งหมดทดสอบแค่ pure-logic module แยกไฟล์ ไม่เคย
// require() ตัว API handler จริงเลยสักครั้ง เลยไม่มีเทสไหนจับบั๊กนี้ได้ก่อนขึ้น production
//
// เทสนี้แก้ช่องโหว่นั้น: require() ทุกไฟล์ใน api/*.js ตรงๆ เหมือนที่ Vercel จะทำตอน
// serverless function เริ่มทำงาน ถ้ามีไฟล์ที่ require() ไม่เจอ (วางผิดที่, ลบไปเฉยๆ,
// พิมพ์ path ผิด) เทสนี้จะ fail ทันทีตั้งแต่ตอน build/CI ก่อนขึ้น production

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const apiDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'api');

// เอาเฉพาะไฟล์ .js ที่อยู่ตรง api/ ชั้นบนสุด (ไม่รวม _shared/ ซึ่งมีเทสของตัวเองแยกอยู่แล้ว)
// เพราะไฟล์ใน api/ ชั้นบนสุดเท่านั้นที่ Vercel จะ deploy เป็น serverless function endpoint จริง
const handlerFiles = readdirSync(apiDir).filter((f) => f.endsWith('.js'));

test('api/: ต้องมีไฟล์ handler อย่างน้อย 1 ไฟล์ (กันเทสนี้เงียบผ่านเฉยๆ เพราะหาโฟลเดอร์ไม่เจอ)', () => {
  assert.ok(handlerFiles.length > 0, 'ไม่พบไฟล์ .js ใดๆ ใน api/ เลย — เช็ค path ของเทสนี้');
});

for (const file of handlerFiles) {
  test(`api/${file}: require() ต้องสำเร็จ ไม่มี module ไหนหาไม่เจอ`, () => {
    assert.doesNotThrow(() => {
      require(path.join(apiDir, file));
    }, `api/${file} require() ไม่สำเร็จ — เช็คว่าไฟล์ที่มัน require() ต่อ (เช่นใน _shared/) วางถูกที่ครบทุกไฟล์หรือยัง`);
  });

  test(`api/${file}: ต้อง export เป็นฟังก์ชัน (Vercel handler) จริง ไม่ใช่ object ว่างเปล่า`, () => {
    const mod = require(path.join(apiDir, file));
    assert.equal(typeof mod, 'function', `api/${file} ควร export เป็นฟังก์ชัน async (req, res) => {...} — ได้ ${typeof mod} แทน`);
  });
}
