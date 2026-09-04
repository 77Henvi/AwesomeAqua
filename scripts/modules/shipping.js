// scripts/modules/shipping.js
// หน้า "จัดส่ง" — เช็คลิสต์ออเดอร์ที่ต้องแพ็ค/ส่ง มาจากการกรอกข้อมูลจัดส่งตอนบันทึกการขาย
// ดู docs/SHIPPING_CHECKLIST_SETUP.md
import { supabase }  from '../../supabase.js';
import { showToast, adminEmpty } from '../shared/utils.js';
import {
  SHIPPING_METHOD_LABEL, SHIPPING_STATUS_LABEL,
  filterShipmentsByStatus, sortShipmentsByDate, isOverdue, formatShipDate,
} from '../shared/shipments.js';

let _shipments = [];
let _statusFilter = 'pending'; // เปิดมาให้เห็น "รอจัดส่ง" ก่อนเป็นค่าเริ่มต้น เพราะเป็นสิ่งที่ต้องรีบทำ

export async function loadShipments() {
  const { data, error } = await supabase
    .from('shipments')
    .select('*')
    .order('shipping_date', { ascending: true });

  if (error) {
    showToast('<i class="ph-fill ph-x-circle" style="color:#ef4444;"></i> โหลดรายการจัดส่งไม่สำเร็จ');
    return;
  }

  _shipments = data || [];
  renderShipments();
}

export function setShipmentStatusFilter(status, el) {
  _statusFilter = status;
  document.querySelectorAll('.shipment-filter-chip').forEach(c => c.classList.remove('active'));
  el?.classList.add('active');
  renderShipments();
}

export function renderShipments() {
  const el = document.getElementById('shipments-list');
  if (!el) return;

  const list = sortShipmentsByDate(filterShipmentsByStatus(_shipments, _statusFilter));

  if (!list.length) {
    el.innerHTML = adminEmpty('<i class="ph ph-truck"></i>', _statusFilter === 'all' ? 'ยังไม่มีรายการจัดส่งเลยครับ' : `ไม่มีรายการสถานะ "${SHIPPING_STATUS_LABEL[_statusFilter] || _statusFilter}"`);
    return;
  }

  el.innerHTML = `
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
        <thead>
          <tr style="text-align:left;color:var(--gray);border-bottom:1px solid var(--border);">
            <th style="padding:8px 6px;">วันที่จัดส่ง</th>
            <th style="padding:8px 6px;">ลูกค้า</th>
            <th style="padding:8px 6px;">ปลา</th>
            <th style="padding:8px 6px;">วิธีจัดส่ง</th>
            <th style="padding:8px 6px;">ค่าส่ง</th>
            <th style="padding:8px 6px;">สถานะ</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(s => _row(s)).join('')}
        </tbody>
      </table>
    </div>`;
}

function _row(s) {
  const overdue = isOverdue(s);
  const dateColor = overdue ? '#dc2626' : (s.status === 'shipped' ? 'var(--gray)' : 'inherit');
  const methodIcon = s.shipping_method === 'ems' ? 'ph-truck' : 'ph-moped';
  const checked = s.status === 'shipped' ? 'checked' : '';
  const rowMuted = s.status === 'shipped' ? 'color:var(--gray);' : '';

  return `
    <tr style="border-bottom:1px solid var(--border);${rowMuted}">
      <td style="padding:10px 6px;font-weight:600;color:${dateColor};">
        ${formatShipDate(s.shipping_date)}${overdue ? ' <i class="ph-fill ph-warning-circle" title="เลยกำหนดจัดส่งแล้ว"></i>' : ''}
      </td>
      <td style="padding:10px 6px;">${s.customer_name || '—'}</td>
      <td style="padding:10px 6px;">${s.fish_name || '—'}</td>
      <td style="padding:10px 6px;"><i class="ph ${methodIcon}"></i> ${SHIPPING_METHOD_LABEL[s.shipping_method] || s.shipping_method}</td>
      <td style="padding:10px 6px;">฿${(s.shipping_cost || 0).toLocaleString('th-TH')}</td>
      <td style="padding:10px 6px;">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
          <input type="checkbox" ${checked} onchange="window.toggleShipmentStatus('${s.id}', this.checked)">
          ${SHIPPING_STATUS_LABEL[s.status] || s.status}
        </label>
      </td>
    </tr>`;
}

export async function toggleShipmentStatus(id, shipped) {
  const { error } = await supabase.from('shipments').update({ status: shipped ? 'shipped' : 'pending' }).eq('id', id);
  if (error) {
    showToast('<i class="ph-fill ph-x-circle" style="color:#ef4444;"></i> อัปเดตสถานะไม่สำเร็จ');
    return;
  }
  showToast(shipped
    ? '<i class="ph-fill ph-check-circle" style="color:#10b981;"></i> มาร์คว่าจัดส่งแล้ว'
    : '<i class="ph-fill ph-arrow-counter-clockwise" style="color:#d97706;"></i> ย้ายกลับเป็นรอจัดส่ง');
  loadShipments();
}