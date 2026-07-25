// tests/orders.test.mjs
// รันด้วย: node --test tests/
// ทดสอบ logic ล้วนของแท็บ Orders (scripts/shared/orders.js) —
// ไม่แตะ DOM หรือ Supabase client จริง เพื่อให้รันบน CI ได้โดยไม่ต้องมี network/credential

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STATUS_LABEL,
  filterOrdersByStatus,
  groupItemsByOrder,
  formatOrderDate,
  nextActionsForStatus,
  sumOrderTotals,
} from '../scripts/shared/orders.js';

const sampleOrders = [
  { id: 'order-1', status: 'pending',   total_amount: 500,  created_at: '2026-07-20T10:15:00Z' },
  { id: 'order-2', status: 'paid',      total_amount: 1200, created_at: '2026-07-21T03:05:00Z' },
  { id: 'order-3', status: 'cancelled', total_amount: 300,  created_at: '2026-07-22T09:00:00Z' },
  { id: 'order-4', status: 'pending',   total_amount: 800,  created_at: '2026-07-23T14:30:00Z' },
];

// ── filterOrdersByStatus ────────────────────────
test('filterOrdersByStatus: "all" คืนออเดอร์ทุกสถานะโดยไม่กรอง', () => {
  const result = filterOrdersByStatus(sampleOrders, 'all');
  assert.equal(result.length, 4);
});

test('filterOrdersByStatus: กรองเฉพาะ pending ได้ถูกต้อง', () => {
  const result = filterOrdersByStatus(sampleOrders, 'pending');
  assert.equal(result.length, 2);
  assert.ok(result.every(o => o.status === 'pending'));
});

test('filterOrdersByStatus: กรองสถานะที่ไม่มีออเดอร์เลย ต้องได้ array ว่าง', () => {
  const result = filterOrdersByStatus(sampleOrders, 'refunded');
  assert.deepEqual(result, []);
});

test('filterOrdersByStatus: input ไม่ใช่ array ต้องไม่ throw และคืน array ว่าง', () => {
  assert.deepEqual(filterOrdersByStatus(null, 'all'), []);
  assert.deepEqual(filterOrdersByStatus(undefined, 'pending'), []);
});

// ── groupItemsByOrder ────────────────────────────
test('groupItemsByOrder: จัดกลุ่มรายการสินค้าตาม order_id ถูกต้อง', () => {
  const financeRows = [
    { name: 'ปลาทอง x2 ตัว', amount: 200, fish_id: 'f1', order_id: 'order-1' },
    { name: 'ปลาหางนกยูง x1 ตัว', amount: 50, fish_id: 'f2', order_id: 'order-1' },
    { name: 'ปลาคาร์ฟ x1 ตัว', amount: 1200, fish_id: 'f3', order_id: 'order-2' },
  ];
  const grouped = groupItemsByOrder(financeRows);
  assert.equal(grouped['order-1'].length, 2);
  assert.equal(grouped['order-2'].length, 1);
  assert.equal(grouped['order-3'], undefined);
});

test('groupItemsByOrder: แถวที่ไม่มี order_id (รายรับ-จ่ายทั่วไป) ต้องถูกข้าม', () => {
  const financeRows = [
    { name: 'ค่าอาหารปลา', amount: 300, order_id: null },
    { name: 'ปลาทอง x1 ตัว', amount: 100, order_id: 'order-1' },
  ];
  const grouped = groupItemsByOrder(financeRows);
  assert.equal(Object.keys(grouped).length, 1);
  assert.equal(grouped['order-1'].length, 1);
});

test('groupItemsByOrder: input ว่าง/undefined ต้องคืน object ว่างไม่ throw', () => {
  assert.deepEqual(groupItemsByOrder(undefined), {});
  assert.deepEqual(groupItemsByOrder([]), {});
});

// ── formatOrderDate ──────────────────────────────
test('formatOrderDate: แปลงเป็นปี พ.ศ. และมีเวลากำกับ', () => {
  const result = formatOrderDate('2026-07-20T10:15:00Z');
  assert.match(result, /69 \d{2}:\d{2}$/); // ปี 2026 + 543 = 2569 -> ตัดมา 2 หลักท้าย "69" ตามด้วยเวลา HH:mm
});

// ── nextActionsForStatus ─────────────────────────
test('nextActionsForStatus: pending ทำต่อได้ทั้งจ่ายแล้ว/ยกเลิก', () => {
  assert.deepEqual(nextActionsForStatus('pending'), ['paid', 'cancelled']);
});

test('nextActionsForStatus: paid ถือว่าจบ flow แล้ว ไม่มีปุ่มต่อ', () => {
  assert.deepEqual(nextActionsForStatus('paid'), []);
});

test('nextActionsForStatus: cancelled ยังกลับไปเป็น pending ได้ (กันกดผิด)', () => {
  assert.deepEqual(nextActionsForStatus('cancelled'), ['pending']);
});

// ── sumOrderTotals ───────────────────────────────
test('sumOrderTotals: รวมยอดออเดอร์ทั้งหมดถูกต้อง', () => {
  assert.equal(sumOrderTotals(sampleOrders), 500 + 1200 + 300 + 800);
});

test('sumOrderTotals: ออเดอร์ที่ไม่มี total_amount ให้นับเป็น 0', () => {
  assert.equal(sumOrderTotals([{ status: 'pending' }]), 0);
});

test('sumOrderTotals: input ว่าง/undefined ต้องคืน 0 ไม่ throw', () => {
  assert.equal(sumOrderTotals(undefined), 0);
  assert.equal(sumOrderTotals([]), 0);
});

// ── STATUS_LABEL sanity check ────────────────────
test('STATUS_LABEL: ครอบคลุมทุกสถานะที่ใช้จริงในระบบ', () => {
  assert.equal(STATUS_LABEL.pending, 'รอชำระ');
  assert.equal(STATUS_LABEL.paid, 'ชำระแล้ว');
  assert.equal(STATUS_LABEL.cancelled, 'ยกเลิก');
});
