import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SHIPPING_METHOD_LABEL, SHIPPING_STATUS_LABEL, EMS_COST_OPTIONS,
  filterShipmentsByStatus, sortShipmentsByDate, isOverdue,
  countPendingShipments, formatShipDate, resolveShippingCost,
  groupShipments, searchPendingShipmentGroups, countShipmentsByDate, buildCalendarMonth,
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

// ── groupShipments ────────────────────────────────
test('groupShipments: แถวที่ shipment_group_id ตรงกัน ถูกรวมเป็นพัสดุเดียว', () => {
  const rows = [
    { id: '1', shipment_group_id: 'g1', customer_name: 'คุณ A', shipping_method: 'ems', shipping_cost: 250, shipping_date: '2026-09-07', status: 'pending', fish_name: 'หมูอินโด x1 ตัว' },
    { id: '2', shipment_group_id: 'g1', customer_name: 'คุณ A', shipping_method: 'ems', shipping_cost: 250, shipping_date: '2026-09-07', status: 'pending', fish_name: 'หมูอินโด x7 ตัว' },
  ];
  const groups = groupShipments(rows);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].ids, ['1', '2']);
  assert.deepEqual(groups[0].items, ['หมูอินโด x1 ตัว', 'หมูอินโด x7 ตัว']);
  assert.equal(groups[0].shipping_cost, 250); // ไม่บวกซ้ำ ใช้ค่าเดียวของพัสดุ
  assert.equal(groups[0].status, 'pending');
});

test('groupShipments: ไม่มี shipment_group_id (ข้อมูลเก่า) → แต่ละแถวเป็นพัสดุของตัวเอง', () => {
  const rows = [
    { id: '1', shipment_group_id: null, customer_name: 'คุณ A', shipping_method: 'ems', shipping_cost: 250, shipping_date: '2026-09-07', status: 'pending', fish_name: 'ปลา A' },
    { id: '2', shipment_group_id: null, customer_name: 'คุณ B', shipping_method: 'ems', shipping_cost: 250, shipping_date: '2026-09-07', status: 'pending', fish_name: 'ปลา B' },
  ];
  const groups = groupShipments(rows);
  assert.equal(groups.length, 2);
});

test('groupShipments: สถานะรวมเป็น "shipped" ก็ต่อเมื่อทุกแถวในกลุ่มจัดส่งแล้ว', () => {
  const rows = [
    { id: '1', shipment_group_id: 'g1', customer_name: 'คุณ A', shipping_method: 'ems', shipping_cost: 250, shipping_date: '2026-09-07', status: 'shipped', fish_name: 'ปลา A' },
    { id: '2', shipment_group_id: 'g1', customer_name: 'คุณ A', shipping_method: 'ems', shipping_cost: 250, shipping_date: '2026-09-07', status: 'pending', fish_name: 'ปลา B' },
  ];
  assert.equal(groupShipments(rows)[0].status, 'pending');

  rows[1].status = 'shipped';
  assert.equal(groupShipments(rows)[0].status, 'shipped');
});

test('groupShipments: array ว่าง → คืน array ว่าง', () => {
  assert.deepEqual(groupShipments([]), []);
  assert.deepEqual(groupShipments(undefined), []);
});

// ── searchPendingShipmentGroups ───────────────────
test('searchPendingShipmentGroups: หาชื่อลูกค้าแบบ partial match ไม่สนตัวพิมพ์เล็ก/ใหญ่', () => {
  const groups = [
    { group_id: 'g1', customer_name: 'คุณจตุพร', status: 'pending' },
    { group_id: 'g2', customer_name: 'คุณณัทกิจ', status: 'pending' },
  ];
  assert.deepEqual(searchPendingShipmentGroups(groups, 'จตุ').map(g => g.group_id), ['g1']);
});

test('searchPendingShipmentGroups: ไม่รวมพัสดุที่จัดส่งแล้ว (shipped)', () => {
  const groups = [{ group_id: 'g1', customer_name: 'คุณจตุพร', status: 'shipped' }];
  assert.deepEqual(searchPendingShipmentGroups(groups, 'จตุ'), []);
});

test('searchPendingShipmentGroups: query ว่าง → ไม่โชว์ผลอะไรเลย (กันเปิดมาแล้วเห็น dropdown ยาวทั้งหมด)', () => {
  const groups = [{ group_id: 'g1', customer_name: 'คุณจตุพร', status: 'pending' }];
  assert.deepEqual(searchPendingShipmentGroups(groups, ''), []);
  assert.deepEqual(searchPendingShipmentGroups(groups, '   '), []);
});

// ── countShipmentsByDate ───────────────────────────
test('countShipmentsByDate: นับจำนวนพัสดุต่อวัน', () => {
  const groups = [
    { shipping_date: '2026-09-07' }, { shipping_date: '2026-09-07' }, { shipping_date: '2026-09-04' },
  ];
  assert.deepEqual(countShipmentsByDate(groups), { '2026-09-07': 2, '2026-09-04': 1 });
});

test('countShipmentsByDate: array ว่าง → object ว่าง', () => {
  assert.deepEqual(countShipmentsByDate([]), {});
});

// ── buildCalendarMonth ─────────────────────────────
test('buildCalendarMonth: กันยายน 2026 (30 วัน ขึ้นต้นวันอังคาร) มีช่องครบและหารด้วย 7 ลงตัว', () => {
  const cells = buildCalendarMonth(2026, 8); // month index 8 = กันยายน
  assert.equal(cells.length % 7, 0);
  assert.equal(cells[0], null); // 1 ก.ย. 2026 เป็นวันอังคาร (ไม่ใช่อาทิตย์) ช่องแรกต้องว่าง
  assert.equal(cells.includes('2026-09-01'), true);
  assert.equal(cells.includes('2026-09-30'), true);
  assert.equal(cells.includes('2026-10-01'), false);
});

test('buildCalendarMonth: วันในเดือนเรียงต่อเนื่องไม่ขาดหาย', () => {
  const cells = buildCalendarMonth(2026, 0).filter(Boolean); // มกราคม 2026 มี 31 วัน
  assert.equal(cells.length, 31);
  assert.equal(cells[0], '2026-01-01');
  assert.equal(cells[30], '2026-01-31');
});
