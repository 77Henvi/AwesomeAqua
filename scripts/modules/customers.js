// scripts/modules/customers.js
// หน้า "ลูกค้า" — CRM แบบเบาๆ ตาม spec (ไม่ใช่ enterprise CRM)
// ดึงจาก view `customer_stats` (คำนวณสดจาก orders/finance/fish ทุกครั้ง ไม่เก็บ state ซ้ำซ้อน)
// ดู docs/PHASE2_CRM_LOST_SALE_SETUP.md
import { supabase } from '../../supabase.js';
import { showToast, adminEmpty } from '../shared/utils.js';

let _customers = [];
let _segmentFilter = 'all';

// ── เกณฑ์แบ่ง segment (ปรับได้ตรงนี้ที่เดียว) ──
// เหตุผลที่ไม่เก็บเป็นคอลัมน์ใน DB: ถ้าเก็บแล้วไม่มี cron มา recompute ให้ ข้อมูลจะเพี้ยนตามเวลา
function computeSegment(c) {
  if (c.order_count === 0) return 'new';
  const daysSinceLastPurchase = c.last_purchase_at
    ? Math.floor((Date.now() - new Date(c.last_purchase_at).getTime()) / 86400000)
    : null;
  if (daysSinceLastPurchase !== null && daysSinceLastPurchase > 90) return 'dormant';
  if (c.order_count >= 5 || c.total_spend >= 15000) return 'vip';
  if (c.order_count >= 3 && c.favorite_species) return 'specialist';
  if (c.order_count <= 1) return 'new';
  return 'regular';
}

const SEGMENT_META = {
  new:        { label: 'ลูกค้าใหม่',    color: '#3b82f6' },
  regular:    { label: 'ขาประจำ',       color: '#059669' },
  vip:        { label: 'VIP',           color: '#d97706' },
  specialist: { label: 'สายเฉพาะทาง',   color: '#7c3aed' },
  dormant:    { label: 'หายไปนาน',      color: '#6b7280' },
};

export async function loadCustomers() {
  const { data, error } = await supabase
    .from('customer_stats')
    .select('*')
    .order('total_spend', { ascending: false });

  if (error) {
    // relation ไม่มีอยู่ = ยังไม่ได้รัน SQL Phase 2 — บอกตรงๆ ไม่ใช่ error ทั่วไป
    const el = document.getElementById('customers-list');
    if (el) el.innerHTML = adminEmpty('<i class="ph ph-database"></i>',
      'ยังไม่พบตาราง customer_stats — ต้องรัน SQL ใน docs/PHASE2_CRM_LOST_SALE_SETUP.md ก่อน');
    return;
  }

  _customers = (data || []).map(c => ({ ...c, segment: computeSegment(c) }));
  renderCustomers();
}

export function setCustomerSegmentFilter(seg, el) {
  _segmentFilter = seg;
  document.querySelectorAll('.customer-filter-chip').forEach(c => c.classList.remove('active'));
  el?.classList.add('active');
  renderCustomers();
}

export function renderCustomers() {
  const el = document.getElementById('customers-list');
  if (!el) return;

  const list = _segmentFilter === 'all' ? _customers : _customers.filter(c => c.segment === _segmentFilter);

  if (!list.length) {
    el.innerHTML = adminEmpty('<i class="ph ph-users"></i>', 'ยังไม่มีลูกค้าในหมวดนี้');
    return;
  }

  el.innerHTML = list.map(c => {
    const meta = SEGMENT_META[c.segment];
    const name = c.name || (c.psid ? `ลูกค้า Messenger (${c.psid.slice(0, 8)}...)` : 'ไม่ทราบชื่อ');
    return `
      <div class="customer-row" onclick="openCustomerModal('${c.customer_id}')">
        <div class="customer-row-main">
          <div class="customer-row-name">${name}</div>
          <div class="customer-row-sub">
            ${c.order_count} ออเดอร์ · ฿${Number(c.total_spend).toLocaleString('th-TH')}
            ${c.favorite_species ? ` · ชอบ${c.favorite_species}` : ''}
          </div>
        </div>
        <span class="customer-segment-badge" style="background:${meta.color}1a;color:${meta.color};">${meta.label}</span>
      </div>`;
  }).join('');
}

// ── modal ดู/แก้ไขข้อมูลลูกค้า (ชื่อ/ประเภท/งบประมาณ/โน้ต แก้ได้ ที่เหลือคำนวณอัตโนมัติ) ──
export function openCustomerModal(customerId) {
  const c = _customers.find(x => x.customer_id === customerId);
  if (!c) return;

  document.getElementById('custModalId').value            = c.customer_id;
  document.getElementById('custModalName').value           = c.name || '';
  document.getElementById('custModalType').value            = c.customer_type || '';
  document.getElementById('custModalBudget').value          = c.approx_budget || '';
  document.getElementById('custModalContact').value         = c.contact_note || '';
  document.getElementById('custModalNotes').value           = c.notes || '';
  document.getElementById('custModalStatsLine').textContent =
    `${c.order_count} ออเดอร์ · ยอดรวม ฿${Number(c.total_spend).toLocaleString('th-TH')}` +
    (c.last_purchase_at ? ` · ซื้อล่าสุด ${new Date(c.last_purchase_at).toLocaleDateString('th-TH')}` : '') +
    (c.favorite_species ? ` · ชอบพันธุ์ ${c.favorite_species}` : '');

  document.getElementById('customerModal').classList.add('open');
}

export function closeCustomerModal() {
  document.getElementById('customerModal').classList.remove('open');
}

export async function saveCustomer() {
  const id = document.getElementById('custModalId').value;
  const payload = {
    name:          document.getElementById('custModalName').value.trim() || null,
    customer_type: document.getElementById('custModalType').value.trim() || null,
    approx_budget: parseFloat(document.getElementById('custModalBudget').value) || null,
    contact_note:  document.getElementById('custModalContact').value.trim() || null,
    notes:         document.getElementById('custModalNotes').value.trim() || null,
  };

  const { error } = await supabase.from('customers').update(payload).eq('id', id);
  if (error) {
    showToast('<i class="ph-fill ph-x-circle" style="color:#ef4444;"></i> บันทึกไม่สำเร็จ');
    return;
  }
  showToast('<i class="ph-fill ph-check-circle" style="color:#10b981;"></i> บันทึกแล้ว');
  closeCustomerModal();
  loadCustomers();
}