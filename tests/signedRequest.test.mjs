// tests/signedRequest.test.mjs
// รันด้วย: node --test tests/
// ทดสอบ parseSignedRequest ที่ใช้ใน api/data-deletion.js (Meta Data Deletion Callback)
// เทสสร้าง signed_request ปลอมขึ้นมาเอง (ใช้ APP_SECRET ทดสอบ) ไม่เรียก Meta จริง

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHmac } from 'node:crypto';

const require = createRequire(import.meta.url);
const { parseSignedRequest, base64UrlDecode } = require('../api/_shared/signedRequest.js');

const APP_SECRET = 'test_app_secret_1234';

// ── helper: สร้าง signed_request ให้เหมือน Meta ส่งมาจริง (ไว้ใช้แค่ในเทส) ──
function makeSignedRequest(payloadObj, secret = APP_SECRET) {
  const encodedPayload = Buffer.from(JSON.stringify(payloadObj))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const sig = createHmac('sha256', secret).update(encodedPayload).digest();
  const encodedSig = sig.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${encodedSig}.${encodedPayload}`;
}

test('parseSignedRequest: signed_request ที่เซ็นถูกต้อง ต้องถอด payload ได้', () => {
  const signed = makeSignedRequest({ user_id: 'psid_12345', algorithm: 'HMAC-SHA256' });
  const result = parseSignedRequest(signed, APP_SECRET);
  assert.equal(result.user_id, 'psid_12345');
});

test('parseSignedRequest: signature ผิด (secret ไม่ตรง) ต้องคืน null', () => {
  const signed = makeSignedRequest({ user_id: 'psid_12345' }, 'wrong_secret');
  const result = parseSignedRequest(signed, APP_SECRET);
  assert.equal(result, null);
});

test('parseSignedRequest: payload ถูกแก้ไขหลังเซ็น (tamper) ต้องคืน null', () => {
  const signed = makeSignedRequest({ user_id: 'psid_12345' });
  const [sig] = signed.split('.');
  const tamperedPayload = Buffer.from(JSON.stringify({ user_id: 'psid_ATTACKER' }))
    .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const tampered = `${sig}.${tamperedPayload}`;
  assert.equal(parseSignedRequest(tampered, APP_SECRET), null);
});

test('parseSignedRequest: รูปแบบผิด (ไม่มีจุดคั่น หรือมีมากกว่า 1 จุด) ต้องคืน null', () => {
  assert.equal(parseSignedRequest('not-a-valid-format', APP_SECRET), null);
  assert.equal(parseSignedRequest('a.b.c', APP_SECRET), null);
});

test('parseSignedRequest: ไม่มี appSecret หรือ signedRequest เป็นค่าว่าง ต้องคืน null ไม่ throw', () => {
  assert.equal(parseSignedRequest('', APP_SECRET), null);
  assert.equal(parseSignedRequest(null, APP_SECRET), null);
  const signed = makeSignedRequest({ user_id: 'psid_1' });
  assert.equal(parseSignedRequest(signed, ''), null);
  assert.equal(parseSignedRequest(signed, undefined), null);
});

test('parseSignedRequest: payload ที่ไม่ใช่ JSON ที่ถูกต้อง ต้องคืน null ไม่ throw', () => {
  const encodedPayload = Buffer.from('{not valid json').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const sig = createHmac('sha256', APP_SECRET).update(encodedPayload).digest()
    .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  assert.equal(parseSignedRequest(`${sig}.${encodedPayload}`, APP_SECRET), null);
});

// ── base64UrlDecode sanity check ──
test('base64UrlDecode: ถอดรหัส base64url กลับเป็นข้อความต้นฉบับได้ถูกต้อง', () => {
  const original = 'สวัสดีครับ {"a":1}';
  const encoded = Buffer.from(original).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  assert.equal(base64UrlDecode(encoded).toString('utf8'), original);
});
