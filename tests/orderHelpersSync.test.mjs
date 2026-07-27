// tests/orderHelpersSync.test.mjs
// รันด้วย: node --test tests/
//
// scripts/shared/orders.js (ฝั่ง admin browser, ESM) และ api/_shared/orderHelpers.js
// (ฝั่ง server, CJS) มีเนื้อหาเหมือนกันโดยตั้งใจ (ดูเหตุผลในคอมเมนต์หัวไฟล์ทั้งสอง) —
// เทสนี้เช็คว่าพฤติกรรมยังตรงกันอยู่ กันไม่ให้แก้ไฟล์เดียวแล้วลืมอีกไฟล์จนพฤติกรรมเพี้ยนไปคนละทาง

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

import * as browserSide from '../scripts/shared/orders.js';
const serverSide = require('../api/_shared/orderHelpers.js');

const sampleOrders = [
  { id: 'o1', status: 'pending',   total_amount: 500 },
  { id: 'o2', status: 'paid',      total_amount: 1200 },
  { id: 'o3', status: 'cancelled', total_amount: 300 },
];

test('sync: STATUS_LABEL ต้องเหมือนกันทุกคีย์ระหว่างสองไฟล์', () => {
  assert.deepEqual(browserSide.STATUS_LABEL, serverSide.STATUS_LABEL);
});

test('sync: filterOrdersByStatus ต้องให้ผลลัพธ์เหมือนกัน', () => {
  assert.deepEqual(
    browserSide.filterOrdersByStatus(sampleOrders, 'pending'),
    serverSide.filterOrdersByStatus(sampleOrders, 'pending')
  );
});

test('sync: formatOrderDate ต้องให้ผลลัพธ์เหมือนกันเป๊ะ (รูปแบบวันที่ไทย)', () => {
  const iso = '2026-07-20T10:15:00Z';
  assert.equal(browserSide.formatOrderDate(iso), serverSide.formatOrderDate(iso));
});

test('sync: nextActionsForStatus ต้องให้ผลลัพธ์เหมือนกันทุกสถานะ', () => {
  for (const status of ['pending', 'paid', 'cancelled', 'unknown']) {
    assert.deepEqual(
      browserSide.nextActionsForStatus(status),
      serverSide.nextActionsForStatus(status)
    );
  }
});

test('sync: sumOrderTotals ต้องให้ผลลัพธ์เหมือนกัน', () => {
  assert.equal(
    browserSide.sumOrderTotals(sampleOrders),
    serverSide.sumOrderTotals(sampleOrders)
  );
});
