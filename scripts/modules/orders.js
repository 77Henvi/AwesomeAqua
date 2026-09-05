// scripts/modules/orders.js
// หน้า "ออเดอร์" — ดูรายการสั่งซื้อที่มาจากตะกร้า Messenger + อัปเดตสถานะ
import { supabase }  from '../../supabase.js';
import { showToast, adminEmpty, escapeHTML } from '../shared/utils.js';
import { STATUS_LABEL, STATUS_COLOR, filterOrdersByStatus, groupItemsByOrder, formatOrderDate }
  from '../shared/orders.js';

let _orders = [];
let _itemsByOrder = {}; // { order_id: [ {name, amount, fish_id}, ... ] }
let _statusFilter = 'all';
let _cancelTargetId = null; // order id ที่กำลังจะยกเลิก รอเลือกเหตุผลอยู่

const _fmtDate = formatOrderDate;

// เหตุผลออเดอร์ไม่สำเร็จ (Lost Sale Reason) — ดู docs/PHASE2_CRM_LOST_SALE_SETUP.md
export const LOST_REASON_LABEL = {
  price_too_high:     'ราคาสูงเกินไป',
  no_stock:           'สต็อกไม่พอ/หมด',
  fish_not_ready:     'ปลายังไม่พร้อมส่ง',
  changed_mind:       'ลูกค้าเปลี่ยนใจ',
  shipping_cost:      'ค่าส่งแพงเกินไป',
  chose_another_fish: 'เลือกซื้อปลาตัวอื่นแทน',
  budget:             'งบไม่พอ',
  other:              'อื่นๆ',
};

export async function loadOrders() {
  const [ordersRes, itemsRes] = await Promise.all([
    supabase.from('orders').select('*').order('created_at', { ascending: false }),
    supabase.from('finance').select('name,amount,fish_id,order_id').not('order_id', 'is', null),
  ]);

  if (ordersRes.error) {
    showToast('<i class="ph-fill ph-x-circle" style="color:#ef4444;"></i> โหลดออเดอร์ไม่สำเร็จ');
    return;
  }

  _orders = ordersRes.data || [];
  _itemsByOrder = groupItemsByOrder(itemsRes.data);

  renderOrders();
}

export function setOrderStatusFilter(status, el) {
  _statusFilter = status;
  document.querySelectorAll('.order-filter-chip').forEach(c => c.classList.remove('active'));
  el?.classList.add('active');
  renderOrders();
}

export function renderOrders() {
  const el = document.getElementById('orders-list');
  if (!el) return;

  const list = filterOrdersByStatus(_orders, _statusFilter);

  if (!list.length) {
    el.innerHTML = adminEmpty('<i class="ph ph-receipt"></i>', _statusFilter === 'all' ? 'ยังไม่มีออเดอร์เข้ามาเลยครับ' : `ไม่มีออเดอร์สถานะ "${STATUS_LABEL[_statusFilter] || _statusFilter}"`);
    return;
  }

  el.innerHTML = list.map(o => {
    const items = _itemsByOrder[o.id] || [];
    const itemLines = items.map(i => `<div style="font-size:0.82rem;color:var(--gray);">• ${escapeHTML(i.name)}</div>`).join('');
    const shortId = o.id.slice(0, 8);
    const color = STATUS_COLOR[o.status] || '#6b7280';

    return `
      <div style="background:white;border:1px solid var(--border);border-radius:12px;padding:1rem;margin-bottom:0.75rem;">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:0.5rem;">
          <div>
            <div style="font-weight:700;">ออเดอร์ #${shortId}</div>
            <div style="font-size:0.75rem;color:var(--gray);">${_fmtDate(o.created_at)}</div>
          </div>
          <span style="background:${color}22;color:${color};padding:4px 10px;border-radius:999px;font-size:0.75rem;font-weight:600;white-space:nowrap;">
            ${STATUS_LABEL[o.status] || o.status}
          </span>
        </div>

        <div style="margin:0.6rem 0;">${itemLines || '<div style="font-size:0.8rem;color:var(--gray);">ไม่พบรายการสินค้า</div>'}</div>

        ${o.status === 'cancelled' && o.lost_reason ? `
          <div style="font-size:0.78rem;color:#dc2626;background:#fef2f2;border-radius:8px;padding:5px 10px;margin-bottom:0.5rem;display:inline-block;">
            <i class="ph ph-x-circle"></i> เหตุผล: ${LOST_REASON_LABEL[o.lost_reason] || o.lost_reason}
          </div>` : ''}

        <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid #f0f4ff;padding-top:0.6rem;">
          <div style="font-weight:700;font-family:var(--font-number, 'Jost', sans-serif);">฿${(o.total_amount || 0).toLocaleString('th-TH')}</div>
          <div style="display:flex;gap:6px;">
            ${o.status === 'pending' ? `
              <button class="action-btn" style="background:#059669;color:#fff;border:none;" onclick="updateOrderStatus('${o.id}','paid')">✅ ชำระแล้ว</button>
              <button class="action-btn action-delete" onclick="askCancelReason('${o.id}')">✕ ยกเลิก</button>
            ` : o.status === 'paid' ? `
              <span style="font-size:0.78rem;color:var(--gray);">เรียบร้อยแล้ว</span>
            ` : `
              <button class="action-btn" onclick="updateOrderStatus('${o.id}','pending')">↺ กลับเป็นรอชำระ</button>
            `}
          </div>
        </div>
      </div>`;
  }).join('');
}

// ── เปิด modal ให้เลือกเหตุผลก่อนยกเลิกออเดอร์ (Lost Sale Reason) ──
export function askCancelReason(orderId) {
  _cancelTargetId = orderId;
  document.getElementById('lostReasonSelect').value = 'no_stock';
  document.getElementById('lostReasonModal').classList.add('open');
}

export function closeLostReasonModal() {
  _cancelTargetId = null;
  document.getElementById('lostReasonModal').classList.remove('open');
}

export async function confirmCancelWithReason() {
  const reason = document.getElementById('lostReasonSelect').value;
  if (!_cancelTargetId) return;
  await updateOrderStatus(_cancelTargetId, 'cancelled', reason);
  closeLostReasonModal();
}

export async function updateOrderStatus(orderId, newStatus, lostReason = null) {
  const { error } = await supabase.from('orders')
    .update({ status: newStatus, lost_reason: newStatus === 'cancelled' ? lostReason : null })
    .eq('id', orderId);

  if (error) {
    showToast('<i class="ph-fill ph-x-circle" style="color:#ef4444;"></i> อัปเดตสถานะไม่สำเร็จ');
    return;
  }

  showToast(`<i class="ph-fill ph-check-circle" style="color:#10b981;"></i> อัปเดตเป็น "${STATUS_LABEL[newStatus]}" แล้ว`);
  loadOrders();
}