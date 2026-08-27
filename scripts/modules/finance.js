// scripts/modules/finance.js
// ระบบการเงินทั้งหมด (แยกออกจาก admin.js): บันทึกรายรับ-รายจ่าย, สรุปวันนี้/รายเดือน,
// ปฏิทินการเงิน, กำไรสะสมต่อปลา (profitMap ใช้ในตารางปลาที่ admin.js)
import { supabase }               from '../../supabase.js';
import { showToast, adminEmpty, paginate, renderPager, toCSV, downloadTextFile }  from '../shared/utils.js';

// ── state ภายในโมดูล ──────────────────────────
let financeData       = [];
let profitMap          = {};   // { fish_id: กำไรสะสม } — ใช้ในตารางปลาที่ admin.js
let finFilter          = 'all';
let selectedFinMonth   = new Date().toLocaleDateString('en-CA').slice(0, 7);
let finPage            = 1;
const FIN_PAGE_SIZE    = 20;

const MONTH_NAMES = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const MONTH_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

// ── getter ให้ admin.js อ่านค่าที่ต้องใช้ข้ามโมดูล ──
export function getFinanceData() { return financeData; }
export function getProfitMap()   { return profitMap; }

// ════════════════════════════════════════════
//   LOAD + PROFIT CALCULATION
// ════════════════════════════════════════════
/**
 * โหลดข้อมูลการเงินทั้งหมด + คำนวณกำไรสะสมต่อปลา
 * @param {Function} onDone callback หลังโหลดเสร็จ (admin.js ใช้รีเฟรชตารางปลา)
 */
export async function loadFinanceFromDB(onDone) {
  const { data, error } = await supabase
    .from('finance')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    // เดิมโค้ดจุดนี้ไม่มี error handling เลย (มีแต่ if (!error)) พอ query พลาด
    // (เช่น session หมดอายุ → 401) เลยเงียบไปดื้อๆ หน้าจอโชว์ยอด/ประวัติว่างเปล่าทั้งที่ข้อมูลใน DB ยังอยู่ครบ
    console.error('โหลดข้อมูลการเงินไม่ได้:', error);
    if (error.code === '401' || error.status === 401 || /jwt|401/i.test(error.message || '')) {
      showToast('<i class="ph-fill ph-warning-circle" style="color:#f59e0b;"></i> เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
      if (typeof window.adminLogout === 'function') await window.adminLogout(true); // เด้งกลับหน้า login ให้เอง
      return;
    }
    showToast('<i class="ph-fill ph-x-circle" style="color:#ef4444;"></i> โหลดข้อมูลการเงินไม่ได้ ลองรีเฟรชหน้าใหม่');
    return; // สำคัญ: ไม่แตะ financeData/profitMap เดิม กันของเก่าที่เคยโหลดไว้หายไปเงียบๆ ตอน error
  }

  financeData = data;

  // คำนวณกำไรสะสม Group By fish_id แบบยิงครั้งเดียว
  profitMap = {};
  financeData.forEach(r => {
    if (!r.fish_id) return;
    profitMap[r.fish_id] = (profitMap[r.fish_id] || 0) + (r.type === 'income' ? r.amount : -r.amount);
  });

  renderTodayFinance();
  renderFinancePage();
  onDone?.();
}

// ════════════════════════════════════════════
//   เพิ่ม/ลบรายการ (widget หน้า dashboard)
// ════════════════════════════════════════════
export async function addFinance(type) {
  const name   = document.getElementById('finItemName').value.trim();
  const amount = parseFloat(document.getElementById('finItemAmount').value);

  if (!name || !amount) {
    showToast('<i class="ph-fill ph-warning-circle" style="color:#f59e0b; font-size:1.1em; vertical-align:-2px;"></i> กรุณากรอกชื่อรายการและจำนวนเงิน');
    return;
  }

  const today = new Date().toLocaleDateString('en-CA');

  const { error } = await supabase.from('finance').insert({ type, name, amount, date: today });

  if (error) {
    showToast('<i class="ph-fill ph-x-circle" style="color:#ef4444; font-size:1.1em; vertical-align:-2px;"></i> บันทึกไม่ได้: ' + error.message);
    return;
  }

  showToast('<i class="ph-fill ph-check-circle" style="color:#10b981; font-size:1.1em; vertical-align:-2px;"></i> บันทึกยอดเรียบร้อย');
  document.getElementById('finItemName').value = '';
  document.getElementById('finItemAmount').value = '';
  loadFinanceFromDB();
}

export async function deleteFinance(id) {
  if (!confirm('ลบรายการนี้?')) return;
  const { error } = await supabase.from('finance').delete().eq('id', id);

  if (error) {
    showToast('<i class="ph-fill ph-x-circle" style="color:#ef4444; font-size:1.1em; vertical-align:-2px;"></i> ลบไม่ได้');
    return;
  }

  showToast('<i class="ph-fill ph-trash" style="color:#6b7280; font-size:1.1em; vertical-align:-2px;"></i> ลบรายการแล้ว');
  loadFinanceFromDB();
}

// ════════════════════════════════════════════
//   รายการวันนี้ (dashboard widget)
// ════════════════════════════════════════════
export function renderTodayFinance() {
  const el = document.getElementById('financeTodayList');
  if (!el) return;

  const today = new Date().toLocaleDateString('en-CA');
  const list = financeData.filter(f => f.date === today);

  if (!list.length) {
    el.innerHTML = adminEmpty('<i class="ph ph-receipt"></i>', 'ยังไม่มีรายการเคลื่อนไหววันนี้');
    return;
  }

  el.innerHTML = list.map(f => `
    <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: white; border: 1px solid var(--border); border-radius: 10px; margin-bottom: 8px;">
      <div>
        <div style="font-weight: 500; font-size: 0.95rem;">${f.name}</div>
        <div style="font-size: 0.75rem; color: var(--gray); display: flex; align-items: center; gap: 4px;">
          <i class="ph-fill ${f.type === 'income' ? 'ph-arrow-circle-up' : 'ph-arrow-circle-down'}" style="color: ${f.type === 'income' ? '#059669' : '#dc2626'};"></i>
          ${f.type === 'income' ? 'รายรับ' : 'รายจ่าย'}
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-family: var(--font-number); font-weight: 700; color: ${f.type === 'income' ? '#059669' : '#dc2626'};">
          ${f.type === 'income' ? '+' : '-'}฿${f.amount.toLocaleString()}
        </span>
        <button onclick="deleteFinance('${f.id}')" style="background:none; border:none; color:var(--gray); cursor:pointer; padding:4px; font-size:1.1rem; display:flex;"><i class="ph ph-trash"></i></button>
      </div>
    </div>
  `).join('');
}

// ════════════════════════════════════════════
//   หน้า Finance (รายเดือน + ปฏิทิน)
// ════════════════════════════════════════════
function populateFinMonthSelect() {
  const select = document.getElementById('fin-month-select');
  if (!select) return;

  const months = new Set(financeData.map(f => (f.date || '').slice(0, 7)).filter(Boolean));
  months.add(new Date().toLocaleDateString('en-CA').slice(0, 7));

  const sorted = [...months].sort((a, b) => b.localeCompare(a));

  select.innerHTML = sorted.map(m => {
    const [y, mo] = m.split('-');
    const yearTh = parseInt(y) + 543;
    const label = `${MONTH_NAMES[parseInt(mo) - 1]} ${yearTh}`;
    const isNow = m === new Date().toLocaleDateString('en-CA').slice(0, 7) ? ' (เดือนนี้)' : '';
    return `<option value="${m}" ${m === selectedFinMonth ? 'selected' : ''}>${label}${isNow}</option>`;
  }).join('');
}

// ── เปลี่ยนหน้ารายการการเงิน (เรียกจากปุ่มใน table-pager) ──
export function onFinPageChange(page) {
  finPage = page;
  renderFinancePage();
}

// ── Export CSV ของเดือนที่เลือกอยู่ตอนนี้ (เปิดด้วย Excel ได้ตรงๆ) ──
// export ทุกรายการในเดือนนั้น (ไม่ผูกกับ filter รายรับ/รายจ่ายที่กำลังดูอยู่บนจอ
// เพราะแอดมินน่าจะอยากได้ข้อมูลครบเดือนไปทำบัญชีต่อมากกว่า)
export function exportFinanceCSV() {
  const monthFin = financeData.filter(f => (f.date || '').startsWith(selectedFinMonth));

  if (!monthFin.length) {
    showToast('<i class="ph-fill ph-warning-circle" style="color:#d97706;"></i> เดือนนี้ไม่มีรายการให้ export');
    return;
  }

  const sorted = [...monthFin].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const rows = sorted.map(f => ({
    date: f.date,
    type: f.type === 'income' ? 'รายรับ' : 'รายจ่าย',
    name: f.name,
    amount: f.amount,
  }));

  const csv = toCSV(rows, [
    { key: 'date',   label: 'วันที่' },
    { key: 'type',   label: 'ประเภท' },
    { key: 'name',   label: 'รายการ' },
    { key: 'amount', label: 'จำนวนเงิน (บาท)' },
  ]);

  downloadTextFile(`awesomeaqua-finance-${selectedFinMonth}.csv`, csv);
  showToast('<i class="ph-fill ph-check-circle" style="color:#10b981;"></i> ดาวน์โหลดไฟล์ CSV เรียบร้อย');
}

export function onFinMonthChange() {
  finPage = 1;
  selectedFinMonth = document.getElementById('fin-month-select').value;
  renderFinancePage();
}

export function setFinFilter(f, el) {
  finFilter = f;
  finPage = 1;
  document.querySelectorAll('.fin-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderFinancePage();
}

export function renderFinancePage() {
  populateFinMonthSelect();

  const isCurrentMonth = selectedFinMonth === new Date().toLocaleDateString('en-CA').slice(0, 7);
  const monthFin = financeData.filter(f => (f.date || '').startsWith(selectedFinMonth));

  const income  = monthFin.filter(f => f.type === 'income').reduce((s, f) => s + f.amount, 0);
  const expense = monthFin.filter(f => f.type === 'expense').reduce((s, f) => s + f.amount, 0);
  const profit  = income - expense;

  const suffix = isCurrentMonth ? 'เดือนนี้' : 'เดือนนั้น';

  if (document.getElementById('fin-label-income'))  document.getElementById('fin-label-income').textContent  = `รายรับ${suffix}`;
  if (document.getElementById('fin-label-expense')) document.getElementById('fin-label-expense').textContent = `รายจ่าย${suffix}`;
  if (document.getElementById('fin-label-profit'))  document.getElementById('fin-label-profit').textContent  = `กำไร/ขาดทุน${suffix}`;

  if (document.getElementById('fin-month-income'))  document.getElementById('fin-month-income').textContent  = '฿' + income.toLocaleString('th-TH');
  if (document.getElementById('fin-month-expense')) document.getElementById('fin-month-expense').textContent = '฿' + expense.toLocaleString('th-TH');

  const elProVal = document.getElementById('fin-profit');
  if (elProVal) {
    elProVal.textContent = (profit >= 0 ? '+' : '') + '฿' + profit.toLocaleString('th-TH');
    elProVal.className   = 'fin-profit-val ' + (profit >= 0 ? 'good' : 'bad');
  }

  const elList  = document.getElementById('finance-list');
  const pagerEl = document.getElementById('financePager');
  if (!elList) return;

  // ── Render Calendar View ──
  if (finFilter === 'calendar') {
    if (pagerEl) pagerEl.innerHTML = ''; // ปฏิทินไม่ต้องแบ่งหน้า
    renderCalendarView(monthFin, elList);
    return;
  }

  // ── Render List View ──
  let list = [...monthFin].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (finFilter === 'income')  list = list.filter(f => f.type === 'income');
  if (finFilter === 'expense') list = list.filter(f => f.type === 'expense');

  if (!list.length) {
    elList.innerHTML = adminEmpty('<i class="ph ph-receipt"></i>', 'ไม่มีรายการในเดือนนี้').replace('admin-empty-state', 'admin-empty-state admin-empty-state--card');
    if (pagerEl) pagerEl.innerHTML = '';
    return;
  }

  const { items: pageList, page, totalPages, total } = paginate(list, finPage, FIN_PAGE_SIZE);
  finPage = page; // clamp กลับถ้าหน้าเดิมเกินขอบเขต (เช่น ลบรายการจนหน้าสุดท้ายว่าง)
  renderPager(pagerEl, { page, totalPages, total }, 'onFinPageChange', FIN_PAGE_SIZE);

  elList.innerHTML = pageList.map(f => {
    const [y, mo, d] = f.date.split('-');
    const dateStr = `${parseInt(d)} ${MONTH_SHORT[parseInt(mo) - 1]} ${(parseInt(y) + 543).toString().slice(-2)}`;

    return `
    <div class="fin-item">
      <div class="fin-item-left">
        <div class="fin-item-name">${f.name}</div>
        <div class="fin-item-sub">${dateStr} · ${f.type === 'income' ? 'รายรับ' : 'รายจ่าย'}</div>
      </div>
      <div class="fin-item-right">
        <div class="fin-item-amt ${f.type === 'income' ? 'inc' : 'exp'}">${f.type === 'income' ? '+' : '-'}฿${f.amount.toLocaleString('th-TH')}</div>
        <button class="fin-item-del" onclick="deleteFinance('${f.id}')"><i class="ph ph-trash"></i></button>
      </div>
    </div>`;
  }).join('');
}

function renderCalendarView(monthData, container) {
  const [yyyy, mm] = selectedFinMonth.split('-');
  const year = parseInt(yyyy), month = parseInt(mm) - 1;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const dayMap = {};
  monthData.forEach(r => {
    if (!r.date) return;
    const d = new Date(r.date);
    if (isNaN(d)) return;
    const dateStr = r.date;
    dayMap[dateStr] = dayMap[dateStr] || [];
    dayMap[dateStr].push(r);
  });

  const days = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
  let html = `<div class="cal-grid">`;
  days.forEach(d => html += `<div class="cal-head">${d}</div>`);

  for (let i = 0; i < firstDay; i++) {
    html += `<div class="cal-day empty"></div>`;
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const records = dayMap[dStr] || [];
    let hasInc = false, hasExp = false;
    let net = 0;

    records.forEach(r => {
      if (r.type === 'income') { hasInc = true; net += r.amount; }
      if (r.type === 'expense') { hasExp = true; net -= r.amount; }
    });

    html += `
      <div class="cal-day" onclick="showDayBreakdown('${dStr}')">
        <div class="cal-date-num">${i}</div>
        <div class="cal-dots">
          ${hasInc ? '<div class="cal-dot inc"></div>' : ''}
          ${hasExp ? '<div class="cal-dot exp"></div>' : ''}
        </div>
        ${net !== 0 ? `<div class="cal-net ${net > 0 ? 'pos' : 'neg'}">${net > 0 ? '+' : ''}${Math.abs(net).toLocaleString('en-US')}</div>` : ''}
      </div>`;
  }
  html += `</div><div id="cal-breakdown"></div>`;
  container.innerHTML = html;
}

export function showDayBreakdown(dateStr) {
  const box = document.getElementById('cal-breakdown');
  if (!box) return;
  const records = financeData.filter(f => f.date === dateStr);

  if (!records.length) {
    box.innerHTML = `<div class="cal-breakdown-box" style="text-align:center;color:var(--gray);">ไม่มีรายการวันนี้</div>`;
    return;
  }

  const [y, m, d] = dateStr.split('-');
  const displayDate = `${parseInt(d)}/${parseInt(m)}/${parseInt(y) + 543}`;

  box.innerHTML = `<div class="cal-breakdown-box">
    <div style="font-weight:600;margin-bottom:10px;border-bottom:1px solid #e2e8f0;padding-bottom:8px;">รายการวันที่ ${displayDate}</div>
    ${records.map(f => `
      <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:0.85rem;">
        <span>${f.name}</span>
        <span style="font-family:var(--font-number);font-weight:600;color:${f.type === 'income' ? '#10b981' : '#ef4444'}">${f.type === 'income' ? '+' : '-'}฿${f.amount.toLocaleString('th-TH')}</span>
      </div>
    `).join('')}
  </div>`;
}

// ════════════════════════════════════════════
//   Modal เพิ่มรายการ (ระบุวันที่เองได้)
// ════════════════════════════════════════════
export function openFinanceModal() {
  document.getElementById('finModalName').value = '';
  document.getElementById('finModalAmount').value = '';
  document.getElementById('finModalDate').value = new Date().toLocaleDateString('en-CA');
  document.getElementById('finModalType').value = 'income';
  document.getElementById('financeModal').classList.add('open');
}

export function closeFinanceModal() {
  document.getElementById('financeModal').classList.remove('open');
}

export async function saveFinanceModal() {
  const type   = document.getElementById('finModalType').value;
  const name   = document.getElementById('finModalName').value.trim();
  const amount = parseFloat(document.getElementById('finModalAmount').value);
  const date   = document.getElementById('finModalDate').value;

  if (!name || !amount || !date) {
    showToast('<i class="ph-fill ph-warning-circle" style="color:#f59e0b; font-size:1.1em; vertical-align:-2px;"></i> กรุณากรอกข้อมูลให้ครบ');
    return;
  }

  const { error } = await supabase.from('finance').insert({ type, name, amount, date });

  if (error) {
    showToast('<i class="ph-fill ph-x-circle" style="color:#ef4444; font-size:1.1em; vertical-align:-2px;"></i> บันทึกไม่ได้: ' + error.message);
    return;
  }

  showToast('<i class="ph-fill ph-check-circle" style="color:#10b981; font-size:1.1em; vertical-align:-2px;"></i> บันทึกรายการเรียบร้อย');
  closeFinanceModal();
  loadFinanceFromDB();
}

// ── ผูกฟังก์ชันที่ถูกเรียกจาก onclick ใน HTML เข้ากับ window ──
// เรียกครั้งเดียวตอน init จาก admin.js
export function bindFinanceWindowFunctions() {
  window.onFinMonthChange  = onFinMonthChange;
  window.onFinPageChange   = onFinPageChange;
  window.exportFinanceCSV  = exportFinanceCSV;
  window.setFinFilter      = setFinFilter;
  window.openFinanceModal  = openFinanceModal;
  window.closeFinanceModal = closeFinanceModal;
  window.saveFinanceModal  = saveFinanceModal;
  window.showDayBreakdown  = showDayBreakdown;
  window.addFinance        = addFinance;
  window.deleteFinance     = deleteFinance;
}