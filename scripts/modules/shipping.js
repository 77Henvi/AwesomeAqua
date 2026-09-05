// scripts/modules/shipping.js
// หน้า "จัดส่ง" — เช็คลิสต์ออเดอร์ที่ต้องแพ็ค/ส่ง มาจากการกรอกข้อมูลจัดส่งตอนบันทึกการขาย
// แถวที่ shipment_group_id ตรงกัน (ลูกค้าคนเดิม นัดส่งพัสดุเดียวกัน) จะถูกรวมแสดงเป็นแถวเดียว
// ดู docs/SHIPPING_CHECKLIST_SETUP.md
import { supabase }  from '../../supabase.js';
import { showToast, adminEmpty, escapeHTML } from '../shared/utils.js';
import {
  SHIPPING_METHOD_LABEL, SHIPPING_STATUS_LABEL,
  filterShipmentsByStatus, sortShipmentsByDate, isOverdue, formatShipDate,
  groupShipments, countShipmentsByDate, buildCalendarMonth,
} from '../shared/shipments.js';

let _shipments    = [];   // แถวดิบจาก DB (ยังไม่รวมกลุ่ม)
let _statusFilter = 'pending'; // เปิดมาให้เห็น "รอจัดส่ง" ก่อนเป็นค่าเริ่มต้น เพราะเป็นสิ่งที่ต้องรีบทำ
let _view         = 'list';    // 'list' | 'calendar'
let _selectedDate = null;      // ISO date ที่กดเลือกจากปฏิทิน (null = ไม่ได้กรองตามวัน)
let _calMonth     = new Date(); // เดือนที่กำลังโชว์ในปฏิทิน (ใช้แค่ getFullYear()/getMonth())

const MONTH_FULL = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const WEEKDAY_TH  = ['อา','จ','อ','พ','พฤ','ศ','ส'];

export async function loadShipments() {
  const { data, error } = await supabase
    .from('shipments')
    .select('*')
    .order('shipping_date', { ascending: true })
    .order('created_at', { ascending: true }); // เรียงลำดับรองด้วย created_at กันแถววันเดียวกันสลับที่ไปมาไม่คงที่ทุกครั้งที่โหลด (Postgres ไม่การันตีลำดับถ้ามีแค่ key เดียวที่ค่าเท่ากันหลายแถว)

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

export function setShipmentView(view) {
  _view = view;
  renderShipments();
}

export function clearShipmentDateFilter() {
  _selectedDate = null;
  renderShipments();
}

function _pickDate(iso) {
  _selectedDate = iso;
  _view = 'list';
  renderShipments();
}

function _changeCalMonth(delta) {
  _calMonth = new Date(_calMonth.getFullYear(), _calMonth.getMonth() + delta, 1);
  renderShipments();
}

export function renderShipments() {
  const el = document.getElementById('shipments-list');
  if (!el) return;

  const groups = groupShipments(_shipments);

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:1rem;">
      <div style="display:flex;gap:6px;">
        <button class="action-btn" onclick="window.setShipmentView('list')" style="${_view === 'list' ? 'background:#2563eb;color:#fff;border-color:#2563eb;' : ''}"><i class="ph ph-list-bullets"></i> รายการ</button>
        <button class="action-btn" onclick="window.setShipmentView('calendar')" style="${_view === 'calendar' ? 'background:#2563eb;color:#fff;border-color:#2563eb;' : ''}"><i class="ph ph-calendar"></i> ปฏิทิน</button>
      </div>
      ${_selectedDate ? `
        <span style="font-size:0.82rem;background:#eff6ff;color:#2563eb;padding:4px 10px;border-radius:999px;">
          เฉพาะวันที่ ${formatShipDate(_selectedDate)}
          <i class="ph ph-x" style="cursor:pointer;margin-left:4px;" onclick="window.clearShipmentDateFilter()"></i>
        </span>` : ''}
    </div>
    <div id="shipments-body"></div>
  `;

  if (_view === 'calendar') {
    _renderCalendar(groups);
  } else {
    _renderList(groups);
  }
}

function _renderList(groups) {
  const body = document.getElementById('shipments-body');
  if (!body) return;

  let list = _selectedDate
    ? groups.filter(g => g.shipping_date === _selectedDate)
    : filterShipmentsByStatus(groups, _statusFilter);
  list = sortShipmentsByDate(list);

  if (!list.length) {
    body.innerHTML = adminEmpty('<i class="ph ph-truck"></i>', _selectedDate
      ? `ไม่มีพัสดุที่จัดส่งวันที่ ${formatShipDate(_selectedDate)}`
      : (_statusFilter === 'all' ? 'ยังไม่มีรายการจัดส่งเลยครับ' : `ไม่มีรายการสถานะ "${SHIPPING_STATUS_LABEL[_statusFilter] || _statusFilter}"`));
    return;
  }

  body.innerHTML = `
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
          ${list.map(g => _row(g)).join('')}
        </tbody>
      </table>
    </div>`;
}

function _row(g) {
  const overdue    = isOverdue(g);
  const dateColor  = overdue ? '#dc2626' : (g.status === 'shipped' ? 'var(--gray)' : 'inherit');
  const methodIcon = g.shipping_method === 'ems' ? 'ph-truck' : 'ph-moped';
  const checked    = g.status === 'shipped' ? 'checked' : '';
  const rowMuted   = g.status === 'shipped' ? 'color:var(--gray);' : '';
  const idsCsv     = g.ids.join(',');

  return `
    <tr style="border-bottom:1px solid var(--border);${rowMuted}">
      <td style="padding:10px 6px;font-weight:600;color:${dateColor};">
        ${formatShipDate(g.shipping_date)}${overdue ? ' <i class="ph-fill ph-warning-circle" title="เลยกำหนดจัดส่งแล้ว"></i>' : ''}
      </td>
      <td style="padding:10px 6px;">${escapeHTML(g.customer_name || '—')}</td>
      <td style="padding:10px 6px;">${escapeHTML(g.items.join(', '))}</td>
      <td style="padding:10px 6px;"><i class="ph ${methodIcon}"></i> ${SHIPPING_METHOD_LABEL[g.shipping_method] || g.shipping_method}</td>
      <td style="padding:10px 6px;">฿${(g.shipping_cost || 0).toLocaleString('th-TH')}</td>
      <td style="padding:10px 6px;">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
          <input type="checkbox" ${checked} onchange="window.toggleShipmentGroup('${idsCsv}', this.checked)">
          ${SHIPPING_STATUS_LABEL[g.status] || g.status}
        </label>
      </td>
    </tr>`;
}

function _renderCalendar(groups) {
  const body = document.getElementById('shipments-body');
  if (!body) return;

  const year  = _calMonth.getFullYear();
  const month = _calMonth.getMonth();
  const cells = buildCalendarMonth(year, month);
  const counts = countShipmentsByDate(groups);
  const today  = new Date().toLocaleDateString('en-CA');

  body.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
      <button class="action-btn" onclick="window.__shipCalMonth(-1)"><i class="ph ph-caret-left"></i></button>
      <div style="font-weight:700;">${MONTH_FULL[month]} ${year + 543}</div>
      <button class="action-btn" onclick="window.__shipCalMonth(1)"><i class="ph ph-caret-right"></i></button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;font-size:0.78rem;text-align:center;color:var(--gray);margin-bottom:4px;">
      ${WEEKDAY_TH.map(w => `<div>${w}</div>`).join('')}
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;">
      ${cells.map(iso => {
        if (!iso) return '<div></div>';
        const count   = counts[iso] || 0;
        const isToday = iso === today;
        const day     = parseInt(iso.slice(-2), 10);
        return `
          <div onclick="${count ? `window.__shipCalPick('${iso}')` : ''}" style="
            aspect-ratio:1; border-radius:8px; padding:4px; font-size:0.8rem;
            border:1px solid ${isToday ? '#2563eb' : 'var(--border)'};
            cursor:${count ? 'pointer' : 'default'};
            background:${count ? '#eff6ff' : 'transparent'};
          ">
            <div style="font-weight:${isToday ? 700 : 400};">${day}</div>
            ${count ? `<div style="font-size:0.72rem;color:#2563eb;font-weight:700;">${count} พัสดุ</div>` : ''}
          </div>`;
      }).join('')}
    </div>`;
}

export async function toggleShipmentGroup(idsCsv, shipped) {
  const ids = idsCsv.split(',').filter(Boolean);
  if (!ids.length) return;

  const { error } = await supabase.from('shipments').update({ status: shipped ? 'shipped' : 'pending' }).in('id', ids);
  if (error) {
    showToast('<i class="ph-fill ph-x-circle" style="color:#ef4444;"></i> อัปเดตสถานะไม่สำเร็จ');
    return;
  }
  showToast(shipped
    ? '<i class="ph-fill ph-check-circle" style="color:#10b981;"></i> มาร์คว่าจัดส่งแล้ว'
    : '<i class="ph-fill ph-arrow-counter-clockwise" style="color:#d97706;"></i> ย้ายกลับเป็นรอจัดส่ง');
  loadShipments();
}

// expose ให้ inline onclick ในตัวปฏิทิน/ปุ่มเปลี่ยนเดือนเรียกได้ (ผูกครั้งเดียวพอ ไม่ต้องมี init แยก)
window.__shipCalMonth = _changeCalMonth;
window.__shipCalPick  = _pickDate;