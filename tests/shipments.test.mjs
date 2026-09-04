import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SHIPPING_METHOD_LABEL, SHIPPING_STATUS_LABEL, EMS_COST_OPTIONS,
  filterShipmentsByStatus, sortShipmentsByDate, isOverdue,
  countPendingShipments, formatShipDate, resolveShippingCost,
} from '../scripts/shared/shipments.js';

// ── filterShipmentsByStatus ─────────────────────
test('filterShipmentsByStatus: "all" คืนทุกแถวโดยไม่กรอง', () => {
  const rows = [{ status: 'pending' }, { status: 'shipped' }];
  assert.deepEqual(filterShipmentsByStatus(rows, 'all'), rows);
});

test('filterShipmentsByStatus: กรองเฉพาะสถานะที่ระบุ', () => {
  const rows = [{ id: 1, status: 'pending' }, { id: 2, status: 'shipped' }, { id: 3, status: 'pending' }];
  assert.deepEqual(filterShipmentsByStatus(rows, 'pending'), [{ id: 1, status: 'pending' }, { id: 3, status: 'pending' }]);
});

test('filterShipmentsByStatus: input ไม่ใช่ array → คืน array ว่าง ไม่ throw', () => {
  assert.deepEqual(filterShipmentsByStatus(null, 'all'), []);
  assert.deepEqual(filterShipmentsByStatus(undefined, 'pending'), []);
});

// ── sortShipmentsByDate ──────────────────────────
test('sortShipmentsByDate: เรียงวันที่จัดส่งจากใกล้สุด (น้อยไปมาก)', () => {
  const rows = [
    { id: 'c', shipping_date: '2026-09-10' },
    { id: 'a', shipping_date: '2026-09-01' },
    { id: 'b', shipping_date: '2026-09-05' },
  ];
  assert.deepEqual(sortShipmentsByDate(rows).map(r => r.id), ['a', 'b', 'c']);
});

test('sortShipmentsByDate: ไม่ mutate array เดิม', () => {
  const rows = [{ id: 'b', shipping_date: '2026-09-05' }, { id: 'a', shipping_date: '2026-09-01' }];
  const original = [...rows];
  sortShipmentsByDate(rows);
  assert.deepEqual(rows, original);
});

// ── isOverdue ─────────────────────────────────────
test('isOverdue: pending + วันที่จัดส่งผ่านไปแล้ว → true', () => {
  assert.equal(isOverdue({ status: 'pending', shipping_date: '2026-09-01' }, '2026-09-04'), true);
});

test('isOverdue: pending แต่ยังไม่ถึงกำหนด → false', () => {
  assert.equal(isOverdue({ status: 'pending', shipping_date: '2026-09-10' }, '2026-09-04'), false);
});

test('isOverdue: จัดส่งแล้ว (shipped) ไม่ถือว่าเลยกำหนดแม้วันที่ผ่านมาแล้ว', () => {
  assert.equal(isOverdue({ status: 'shipped', shipping_date: '2026-09-01' }, '2026-09-04'), false);
});

test('isOverdue: ไม่มีข้อมูล shipment → false ไม่ throw', () => {
  assert.equal(isOverdue(null), false);
  assert.equal(isOverdue(undefined), false);
});

// ── countPendingShipments ─────────────────────────
test('countPendingShipments: นับเฉพาะ pending', () => {
  const rows = [{ status: 'pending' }, { status: 'shipped' }, { status: 'pending' }];
  assert.equal(countPendingShipments(rows), 2);
});

test('countPendingShipments: array ว่างหรือไม่มีค่า → 0', () => {
  assert.equal(countPendingShipments([]), 0);
  assert.equal(countPendingShipments(undefined), 0);
});

// ── formatShipDate ────────────────────────────────
test('formatShipDate: แปลง ISO date เป็นรูปแบบไทยสั้นๆ ถูกต้อง', () => {
  assert.equal(formatShipDate('2026-09-04'), '4 ก.ย. 69');
  assert.equal(formatShipDate('2026-01-01'), '1 ม.ค. 69');
});

test('formatShipDate: ไม่มีค่า → คืน em dash', () => {
  assert.equal(formatShipDate(null), '—');
  assert.equal(formatShipDate(''), '—');
});

// ── resolveShippingCost ───────────────────────────
test('resolveShippingCost: ems รับเฉพาะค่าใน EMS_COST_OPTIONS', () => {
  assert.equal(resolveShippingCost('ems', 250), 250);
  assert.equal(resolveShippingCost('ems', 350), 350);
});

test('resolveShippingCost: ems ค่าที่ไม่ตรงตัวเลือก → fallback เป็นค่าแรกใน EMS_COST_OPTIONS', () => {
  assert.equal(resolveShippingCost('ems', 999), EMS_COST_OPTIONS[0]);
  assert.equal(resolveShippingCost('ems', 0), EMS_COST_OPTIONS[0]);
});

test('resolveShippingCost: lalamove รับค่าที่กรอกเองได้อิสระ (ไม่ติดลบ)', () => {
  assert.equal(resolveShippingCost('lalamove', 120), 120);
  assert.equal(resolveShippingCost('lalamove', 0), 0);
  assert.equal(resolveShippingCost('lalamove', -50), 0);
});

test('resolveShippingCost: ค่าว่าง/ไม่ใช่ตัวเลข → 0 (lalamove) หรือ default แรก (ems)', () => {
  assert.equal(resolveShippingCost('lalamove', ''), 0);
  assert.equal(resolveShippingCost('lalamove', undefined), 0);
  assert.equal(resolveShippingCost('ems', ''), EMS_COST_OPTIONS[0]);
});

// ── label maps ────────────────────────────────────
test('label maps: ครบทุก key ที่ใช้จริงในระบบ', () => {
  assert.deepEqual(Object.keys(SHIPPING_METHOD_LABEL).sort(), ['ems', 'lalamove']);
  assert.deepEqual(Object.keys(SHIPPING_STATUS_LABEL).sort(), ['pending', 'shipped']);
});
