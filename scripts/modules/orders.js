// scripts/modules/orders.js
// หน้า "ออเดอร์" — ดูรายการสั่งซื้อที่มาจากตะกร้า Messenger + อัปเดตสถานะ
import { supabase }  from '../../supabase.js';
import { showToast, adminEmpty } from '../shared/utils.js';

let _orders = [];
let _itemsByOrder = {}; // { order_id: [ {name, amount, fish_id}, ... ] }
let _statusFilter = 'all';

const STATUS_LABEL = { pending: 'รอชำระ', paid: 'ชำระแล้ว', cancelled: 'ยกเลิก' };
const STATUS_COLOR = { pending: '#d97706', paid: '#059669', cancelled: '#dc2626' };

const MONTH_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

function _fmtDate(iso) {
  const d = new Date(iso);
  const y = d.getFullYear() + 543;
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${String(y).slice(-2)} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

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
  _itemsByOrder = {};
  (itemsRes.data || []).forEach(row => {
    if (!_itemsByOrder[row.order_id]) _itemsByOrder[row.order_id] = [];
    _itemsByOrder[row.order_id].push(row);
  });

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

  const list = _statusFilter === 'all' ? _orders : _orders.filter(o => o.status === _statusFilter);

  if (!list.length) {
    el.innerHTML = adminEmpty('<i class="ph ph-receipt"></i>', _statusFilter === 'all' ? 'ยังไม่มีออเดอร์เข้ามาเลยครับ' : `ไม่มีออเดอร์สถานะ "${STATUS_LABEL[_statusFilter] || _statusFilter}"`);
    return;
  }

  el.innerHTML = list.map(o => {
    const items = _itemsByOrder[o.id] || [];
    const itemLines = items.map(i => `<div style="font-size:0.82rem;color:var(--gray);">• ${i.name}</div>`).join('');
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

        <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid #f0f4ff;padding-top:0.6rem;">
          <div style="font-weight:700;font-family:var(--font-number, 'Jost', sans-serif);">฿${(o.total_amount || 0).toLocaleString('th-TH')}</div>
          <div style="display:flex;gap:6px;">
            ${o.status === 'pending' ? `
              <button class="action-btn" style="background:#059669;color:#fff;border:none;" onclick="updateOrderStatus('${o.id}','paid')">✅ ชำระแล้ว</button>
              <button class="action-btn action-delete" onclick="updateOrderStatus('${o.id}','cancelled')">✕ ยกเลิก</button>
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

export async function updateOrderStatus(orderId, newStatus) {
  const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);

  if (error) {
    showToast('<i class="ph-fill ph-x-circle" style="color:#ef4444;"></i> อัปเดตสถานะไม่สำเร็จ');
    return;
  }

  showToast(`<i class="ph-fill ph-check-circle" style="color:#10b981;"></i> อัปเดตเป็น "${STATUS_LABEL[newStatus]}" แล้ว`);
  loadOrders();
}