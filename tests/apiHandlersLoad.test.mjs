

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
