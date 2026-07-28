// tests/csvExport.test.mjs
// รันด้วย: node --test tests/
// ทดสอบ toCSV() ที่ใช้สร้างไฟล์ CSV สำหรับปุ่ม "Export" ในหน้า Finance ของ admin

import test from 'node:test';
import assert from 'node:assert/strict';
import { toCSV } from '../scripts/shared/utils.js';

const columns = [
  { key: 'date', label: 'วันที่' },
  { key: 'name', label: 'รายการ' },
  { key: 'amount', label: 'จำนวนเงิน' },
];

test('toCSV: แปลง rows ธรรมดาเป็น CSV ที่มี header ถูกต้อง', () => {
  const rows = [{ date: '2026-07-20', name: 'ขายปลาทอง', amount: 500 }];
  const csv = toCSV(rows, columns);
  const lines = csv.replace('\uFEFF', '').split('\r\n');

  assert.equal(lines[0], 'วันที่,รายการ,จำนวนเงิน');
  assert.equal(lines[1], '2026-07-20,ขายปลาทอง,500');
});

test('toCSV: ค่าที่มี comma ต้องถูกครอบด้วย quote', () => {
  const rows = [{ date: '2026-07-20', name: 'ขายปลา, ทอง', amount: 500 }];
  const csv = toCSV(rows, columns);
  assert.ok(csv.includes('"ขายปลา, ทอง"'));
});

test('toCSV: ค่าที่มี quote (") ต้อง escape เป็น "" ตามสเปก CSV', () => {
  const rows = [{ date: '2026-07-20', name: 'ปลา "พิเศษ"', amount: 500 }];
  const csv = toCSV(rows, columns);
  assert.ok(csv.includes('"ปลา ""พิเศษ"""'));
});

test('toCSV: ค่าที่มี newline ต้องถูกครอบด้วย quote', () => {
  const rows = [{ date: '2026-07-20', name: 'บรรทัดที่1\nบรรทัดที่2', amount: 500 }];
  const csv = toCSV(rows, columns);
  assert.ok(csv.includes('"บรรทัดที่1\nบรรทัดที่2"'));
});

test('toCSV: ค่า null/undefined ต้องกลายเป็นช่องว่าง ไม่ใช่ข้อความ "null"/"undefined"', () => {
  const rows = [{ date: '2026-07-20', name: null, amount: undefined }];
  const csv = toCSV(rows, columns);
  const lines = csv.replace('\uFEFF', '').split('\r\n');
  assert.equal(lines[1], '2026-07-20,,');
});

test('toCSV: rows ว่าง ต้องได้แค่ header ไม่ throw', () => {
  const csv = toCSV([], columns);
  const lines = csv.replace('\uFEFF', '').split('\r\n');
  assert.equal(lines.length, 1);
  assert.equal(lines[0], 'วันที่,รายการ,จำนวนเงิน');
});

test('toCSV: มี BOM (\\uFEFF) นำหน้าเสมอ กัน Excel เปิดภาษาไทยเพี้ยน', () => {
  const csv = toCSV([{ date: '1', name: '2', amount: '3' }], columns);
  assert.equal(csv.charCodeAt(0), 0xFEFF);
});

test('toCSV: หลายแถวคั่นด้วย \\r\\n ตามสเปก CSV มาตรฐาน', () => {
  const rows = [
    { date: '2026-07-20', name: 'A', amount: 100 },
    { date: '2026-07-21', name: 'B', amount: 200 },
  ];
  const csv = toCSV(rows, columns);
  const lines = csv.replace('\uFEFF', '').split('\r\n');
  assert.equal(lines.length, 3); // header + 2 rows
  assert.equal(lines[2], '2026-07-21,B,200');
});
