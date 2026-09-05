import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHTML } from '../scripts/shared/utils.js';

// escapeHTML มีอยู่ในโค้ดมาตั้งแต่แรกแต่ไม่เคยถูกเรียกใช้จริงที่ไหนเลย (เพิ่งเริ่มเอามาใช้ตอน
// แก้ช่องโหว่ stored-XSS ใน orders.js/shipping.js/sale.js) เลยไม่เคยมีเทสมาก่อน เพิ่มให้ครบตรงนี้

test('escapeHTML: แปลงอักขระพิเศษ HTML ครบตามสเปก', () => {
  assert.equal(escapeHTML('&'), '&amp;');
  assert.equal(escapeHTML('<'), '&lt;');
  assert.equal(escapeHTML('>'), '&gt;');
  assert.equal(escapeHTML('"'), '&quot;');
  assert.equal(escapeHTML("'"), '&#39;');
});

test('escapeHTML: ป้องกัน stored-XSS แบบ script tag ธรรมดา', () => {
  assert.equal(escapeHTML('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
});

test('escapeHTML: ป้องกัน attribute-breakout ผ่าน onload/onclick แบบมี quote', () => {
  const payload = `"><img src=x onerror="alert(1)">`;
  const escaped = escapeHTML(payload);
  assert.equal(escaped.includes('<'), false);
  assert.equal(escaped.includes('>'), false);
  assert.equal(escaped.includes('"'), false);
});

test('escapeHTML: ข้อความปกติที่ไม่มีอักขระพิเศษ ต้องได้ค่าเดิมกลับมา', () => {
  assert.equal(escapeHTML('คุณจตุพร ซื้อฟาฮาก้า x1 ตัว'), 'คุณจตุพร ซื้อฟาฮาก้า x1 ตัว');
});

test('escapeHTML: string ว่าง → คืน string ว่าง', () => {
  assert.equal(escapeHTML(''), '');
});
