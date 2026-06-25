import { state } from './adminState.js';
import { profitCell } from './modules/profit.js';
import { openSaleModal } from './modules/sale.js';

export function renderAll() {
  renderAdminStats();
  renderFishTable();
  renderFinancePage();
  renderDashboardCards();
}

export function switchTab(tab) {
  document.querySelectorAll('.admin-page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.admin-nav-tab, .bnav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + tab)?.classList.add('active');
  document.getElementById('nav-'  + tab)?.classList.add('active');
  document.getElementById('bnav-' + tab)?.classList.add('active');
  if (tab === 'finance') renderFinancePage();
  if (tab === 'stats')   window.initAds(); // Call stats/ads if needed
  if (tab === 'ads')     window.initAds();
}

export function toggleAddPanel(forceOpen) {
  const body   = document.getElementById('addPanelBody');
  const toggle = document.getElementById('addPanelToggle');
  const open   = forceOpen !== undefined ? forceOpen : !body.classList.contains('open');
  body.classList.toggle('open', open);
  toggle.classList.toggle('open', open);
}

export function setStockFilter(f, el) {
  state.stockFilter = f;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderFishTable();
}

export function setDateHeaders() {
  const str = new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const hd = document.getElementById('headerDate');
  const tl = document.getElementById('todayLabel');
  if (hd) hd.textContent = str;
  if (tl) tl.textContent = str;
}

export function _empty(icon, text) {
  return `<div class="admin-empty-state"><div class="admin-empty-icon">${icon}</div><div class="admin-empty-text">${text}</div></div>`;
}

export function handleComingSoon(prefix) {
  const isCS  = document.getElementById(prefix + 'IsComingSoon').checked;
  const pMin  = document.getElementById(prefix + 'PriceMin');
  const pMax  = document.getElementById(prefix + 'PriceMax');
  const stock = document.getElementById(prefix + 'Stock');

  if (isCS) {
    pMin.value = 0; pMin.disabled = true;
    pMax.value = ''; pMax.disabled = true;
    stock.value = 0; stock.disabled = true;
  } else {
    pMin.disabled = false; pMax.disabled = false; stock.disabled = false;
  }
  if (prefix === 'new') window.calcPricePreview();
  if (prefix === 'new') updateAddFishTotal(); 
}

export function updateAddFishTotal() {
  const c = parseFloat(document.getElementById('newCost')?.value) || 0;
  const s = parseInt(document.getElementById('newStock')?.value) || 0;
  const display = document.getElementById('totalFinanceDisplay');
  if (display) display.value = (c * s).toLocaleString('th-TH') + ' บาท';
}

export function openRestockModal(id) {
  const f = state.fishData.find(x => x.id === id);
  if (!f) return;
  document.getElementById('rsFishId').value = f.id;
  document.getElementById('rsFishName').value = f.name_th || f.name;
  document.getElementById('rsQty').value = '';
  document.getElementById('rsCost').value = f.cost || 0;
  document.getElementById('rsDate').value = new Date().toLocaleDateString('en-CA');
  calcRestockTotal();
  document.getElementById('restockModal').classList.add('open');
}

export function closeRestockModal() {
  document.getElementById('restockModal').classList.remove('open');
}

export function calcRestockTotal() {
  const q = parseInt(document.getElementById('rsQty').value) || 0;
  const c = parseFloat(document.getElementById('rsCost').value) || 0;
  document.getElementById('rsTotal').value = (q * c).toLocaleString('th-TH');
}

export function openSale(id) {
  const f = state.fishData.find(x => x.id === id);
  if (!f) return;
  openSaleModal(f, () => {
    window.loadFishFromDB();
    window.loadFinanceFromDB();
  });
}

export function openEditModal(id) {
  const f = state.fishData.find(x => x.id === id);
  if (!f) return;

  document.getElementById('editFishId').value   = f.id;
  document.getElementById('editName_th').value  = f.name_th || '';
  document.getElementById('editName_en').value  = f.name_en || '';
  document.getElementById('editSpecies').value  = f.species || '';
  document.getElementById('editPriceMin').value = f.priceMin;
  document.getElementById('editPriceMax').value = f.priceMax || '';
  document.getElementById('editStock').value    = f.stock;
  document.getElementById('editLevel').value    = f.level;
  document.getElementById('editDesc_th').value  = f.desc_th || '';
  document.getElementById('editDesc_en').value  = f.desc_en || '';
  document.getElementById('editSizeMin').value  = f.sizeMin || '';
  document.getElementById('editSizeMax').value  = f.sizeMax || '';
  if (document.getElementById('editCost')) document.getElementById('editCost').value = f.cost || '';
  if (document.getElementById('editSalePrice')) document.getElementById('editSalePrice').value = f.sale_price || '';

  const preview = document.getElementById('editImagePreview');
  if (preview) { preview.src = f.image || ''; preview.style.display = f.image ? 'block' : 'none'; }
  document.getElementById('editImageFile').value = '';

  window.setSelectedTags('editTags_th', f.tags_th || []);
  window.setSelectedTags('editTags_en', f.tags_en || []);
  
  document.getElementById('editModal').classList.add('open');
  document.getElementById('editIsComingSoon').checked = (f.priceMin === 0 && f.stock === 0);
  handleComingSoon('edit');
}

export function closeEditModal() {
  document.getElementById('editModal').classList.remove('open');
}

export function clearForm() {
  ['newName_th', 'newName_en', 'newSpecies', 'newPriceMin', 'newPriceMax', 'newStock', 'newSizeMin', 'newSizeMax', 'newDesc_th', 'newDesc_en', 'newCost', 'receiveDate', 'newSalePrice']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('newImageFile').value = '';
  const display = document.getElementById('totalFinanceDisplay');
  if (display) display.value = '';
  const preview = document.getElementById('newImagePreview');
  if (preview) { preview.src = ''; preview.style.display = 'none'; }
  document.querySelectorAll('#newTags_th .tag-option, #newTags_en .tag-option').forEach(el => el.classList.remove('active', 'selected'));
  const pp = document.getElementById('pricePreview');
  if (pp) { pp.textContent = '—'; pp.className = 'price-preview'; }
  document.getElementById('newIsComingSoon').checked = false;
  handleComingSoon('new');
}

export function toggleSyncTag(element, mode) {
  const isSelecting = !element.classList.contains('selected');
  const idx = element.getAttribute('data-idx');
  const thTag = document.getElementById(mode + 'Tags_th')?.querySelector(`[data-idx="${idx}"]`);
  const enTag = document.getElementById(mode + 'Tags_en')?.querySelector(`[data-idx="${idx}"]`);
  
  if (isSelecting) {
    if (thTag) thTag.classList.add('selected');
    if (enTag) enTag.classList.add('selected');
  } else {
    if (thTag) thTag.classList.remove('selected');
    if (enTag) enTag.classList.remove('selected');
  }
}

// Stats & Cards
export function renderAdminStats() {
  const total    = state.fishData.length;
  const inStock  = state.fishData.filter(f => f.stock > 0).length;
  const lowStock = state.fishData.filter(f => f.stock > 0 && f.stock <= 5).length;
  const outStock = state.fishData.filter(f => f.stock === 0).length;

  document.getElementById('adminStats').innerHTML = `
    <div class="admin-stat-card stat-card-total"><div class="admin-stat-icon"><i class="ph ph-fish-simple"></i></div><div><div class="admin-stat-num">${total}</div><div class="admin-stat-label">ชนิดปลาทั้งหมด</div></div></div>
    <div class="admin-stat-card stat-card-ok"><div class="admin-stat-icon"><i class="ph ph-check-circle"></i></div><div><div class="admin-stat-num">${inStock}</div><div class="admin-stat-label">มีในสต็อก</div></div></div>
    <div class="admin-stat-card stat-card-low"><div class="admin-stat-icon"><i class="ph ph-warning-circle"></i></div><div><div class="admin-stat-num">${lowStock}</div><div class="admin-stat-label">สต็อกเหลือน้อย</div></div></div>
    <div class="admin-stat-card stat-card-out"><div class="admin-stat-icon"><i class="ph ph-x-circle"></i></div><div><div class="admin-stat-num">${outStock}</div><div class="admin-stat-label">หมดสต็อก</div></div></div>`;
}

export function renderDashboardCards() {
  const lowEl = document.getElementById('dash-lowstock');
  const lowItems = state.fishData.filter(f => f.stock <= 3 && f.priceMin > 0);
  lowEl.innerHTML = !lowItems.length ? _empty('<i class="ph ph-confetti"></i>', 'สต็อกครบทุกรายการ') : 
    lowItems.slice(0, 5).map(f => `
      <div class="dash-mini-row" style="align-items:center;">
        <div style="flex:1;"><div class="dash-mini-name"><i class="ph ph-fish-simple" style="color:var(--royal-blue);margin-right:4px;"></i>${f.name}</div><div class="dash-mini-sub">${f.species || '—'}</div></div>
        <div style="display:flex; align-items:center; gap:8px;"><span class="admin-stock-badge ${f.stock === 0 ? 'out' : 'low'}">${f.stock === 0 ? 'หมด' : f.stock + ' ตัว'}</span><button class="btn-restock-tiny" onclick="openRestockModal('${f.id}')">+ เติม</button></div>
      </div>`).join('');

  const recEl = document.getElementById('dash-recent');
  recEl.innerHTML = !state.fishData.length ? _empty('<i class="ph ph-fish-simple"></i>', 'ยังไม่มีปลา') : 
    [...state.fishData].slice(0, 5).map(f => `
      <div class="dash-mini-row">
        <div><div class="dash-mini-name"><i class="ph ph-fish-simple" style="color:var(--royal-blue);margin-right:4px;"></i>${f.name}</div><div class="dash-mini-sub">${f.species || '—'}</div></div>
        <span style="font-size:0.82rem;font-weight:600;color:var(--royal-blue);font-family:var(--font-number);">฿${(f.priceMin || 0).toLocaleString('th-TH')}</span>
      </div>`).join('');
}

export function renderFishTable() {
  _ensureAccProfitHeader();
  const q = (document.getElementById('fishSearch')?.value || '').toLowerCase();
  const list = state.fishData.filter(f => {
    const match = (f.name + ' ' + (f.species || '')).toLowerCase().includes(q);
    if (state.stockFilter === 'ok')  return match && f.stock > 5;
    if (state.stockFilter === 'low') return match && f.stock > 0 && f.stock <= 5;
    if (state.stockFilter === 'out') return match && f.stock === 0;
    return match;
  });

  const countEl = document.getElementById('fishCount');
  if (countEl) countEl.textContent = list.length + ' รายการ';

  const tbody = document.getElementById('fishTableBody');
  if (!list.length) { tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--gray);padding:2rem">ไม่มีข้อมูล</td></tr>`; return; }

  tbody.innerHTML = list.map(f => {
    const sc = f.stock === 0 ? 'out' : f.stock <= 5 ? 'low' : 'ok';
    const st = f.stock === 0 ? '<i class="ph ph-x-circle"></i> หมด' : f.stock <= 5 ? `<i class="ph ph-warning-circle"></i> ${f.stock} ตัว` : `<i class="ph ph-check-circle"></i> ${f.stock} ตัว`;
    const lvCls = { 'มือใหม่': 'easy', 'ปานกลาง': 'medium', 'ผู้เชี่ยวชาญ': 'hard' }[f.level] || '';
    const imgCell = f.image ? `<img src="${f.image}" style="width:44px;height:44px;object-fit:cover;border-radius:8px;">` : `<div style="width:44px;height:44px;background:#f1f5f9;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:1.5rem;"><i class="ph ph-image"></i></div>`;
    
    let accProfHTML = '—';
    if (state.profitMap[f.id] !== undefined) {
      const p = state.profitMap[f.id];
      accProfHTML = `<span style="font-family:var(--font-number);font-weight:700;${p > 0 ? 'color:#10b981' : p < 0 ? 'color:#ef4444' : 'color:#64748b'}">${p > 0 ? '+' : ''}฿${p.toLocaleString('th-TH')}</span>`;
    }

    return `<tr>
      <td>${imgCell}</td>
      <td><strong>${f.name}</strong><br><small style="color:var(--gray)">${f.species || '—'}</small></td>
      <td style="font-family:var(--font-number);font-weight:600;color:var(--royal-blue);">฿${(f.priceMin || 0).toLocaleString('th-TH')}</td>
      <td style="font-family:var(--font-number);font-weight:600;">${profitCell(f)}</td>
      <td>${accProfHTML}</td>
      <td><span class="admin-stock-badge ${sc}">${st}</span></td>
      <td><span class="admin-level-badge ${lvCls}">${f.level}</span></td>
      <td>
        <button class="action-btn" style="background:#059669;color:#fff;border:none;" onclick="openSale('${f.id}')"><i class="ph ph-shopping-cart-simple"></i> ขาย</button>
        <button class="action-btn action-edit" onclick="openEditModal('${f.id}')"><i class="ph ph-pencil-simple"></i> แก้ไข</button>
        <button class="action-btn action-delete" onclick="deleteFish('${f.id}')"><i class="ph ph-trash"></i> ลบ</button>
      </td>
    </tr>`;
  }).join('');
}

export function _ensureAccProfitHeader() {
  const thead = document.querySelector('#fishTableBody')?.closest('table')?.querySelector('thead tr');
  if (!thead || thead.querySelector('.th-acc-profit')) return;
  const profitTh = thead.querySelector('.th-profit');
  if (profitTh) {
    const th = document.createElement('th'); th.className = 'th-acc-profit'; th.textContent = 'กำไรสะสม'; profitTh.after(th);
  }
}

// Finance UI
export function populateFinMonthSelect() {
  const select = document.getElementById('fin-month-select');
  if (!select) return;
  const months = new Set(state.financeData.map(f => (f.date || '').slice(0, 7)).filter(Boolean));
  months.add(new Date().toLocaleDateString('en-CA').slice(0, 7));
  const sorted = [...months].sort((a, b) => b.localeCompare(a));
  const monthNames = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  select.innerHTML = sorted.map(m => {
    const [y, mo] = m.split('-');
    const label = `${monthNames[parseInt(mo) - 1]} ${parseInt(y) + 543}`;
    const isNow = m === new Date().toLocaleDateString('en-CA').slice(0, 7) ? ' (เดือนนี้)' : '';
    return `<option value="${m}" ${m === state.selectedFinMonth ? 'selected' : ''}>${label}${isNow}</option>`;
  }).join('');
}

export function onFinMonthChange() {
  state.selectedFinMonth = document.getElementById('fin-month-select').value;
  renderFinancePage();
}

export function setFinFilter(f, el) {
  state.finFilter = f;
  document.querySelectorAll('.fin-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderFinancePage();
}

export function renderFinancePage() {
  populateFinMonthSelect();
  const isCurrentMonth = state.selectedFinMonth === new Date().toLocaleDateString('en-CA').slice(0, 7);
  const monthFin = state.financeData.filter(f => (f.date || '').startsWith(state.selectedFinMonth));
  const income  = monthFin.filter(f => f.type === 'income').reduce((s,f) => s + f.amount, 0);
  const expense = monthFin.filter(f => f.type === 'expense').reduce((s,f) => s + f.amount, 0);
  const profit  = income - expense;

  const suffix = isCurrentMonth ? 'เดือนนี้' : 'เดือนนั้น';
  if(document.getElementById('fin-label-income')) document.getElementById('fin-label-income').textContent = `รายรับ${suffix}`;
  if(document.getElementById('fin-label-expense')) document.getElementById('fin-label-expense').textContent = `รายจ่าย${suffix}`;
  if(document.getElementById('fin-label-profit')) document.getElementById('fin-label-profit').textContent = `กำไร/ขาดทุน${suffix}`;
  if(document.getElementById('fin-month-income')) document.getElementById('fin-month-income').textContent = '฿' + income.toLocaleString('th-TH');
  if(document.getElementById('fin-month-expense')) document.getElementById('fin-month-expense').textContent = '฿' + expense.toLocaleString('th-TH');

  const elProVal = document.getElementById('fin-profit');
  if(elProVal) {
    elProVal.textContent = (profit >= 0 ? '+' : '') + '฿' + profit.toLocaleString('th-TH');
    elProVal.className   = 'fin-profit-val ' + (profit >= 0 ? 'good' : 'bad');
  }

  const elList = document.getElementById('finance-list');
  if (!elList) return;

  if (state.finFilter === 'calendar') { renderCalendarView(monthFin, elList); return; }

  let list = [...monthFin].sort((a,b) => (b.date||'').localeCompare(a.date||''));
  if (state.finFilter === 'income')  list = list.filter(f => f.type === 'income');
  if (state.finFilter === 'expense') list = list.filter(f => f.type === 'expense');

  if (!list.length) { elList.innerHTML = _empty('<i class="ph ph-receipt"></i>', 'ไม่มีรายการในเดือนนี้'); return; }
  elList.innerHTML = list.map(f => {
    const [y, mo, d] = f.date.split('-');
    const dateStr = `${parseInt(d)} ${['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'][parseInt(mo)-1]} ${(parseInt(y)+543).toString().slice(-2)}`;
    return `
    <div class="fin-item">
      <div class="fin-item-left"><div class="fin-item-name">${f.name}</div><div class="fin-item-sub">${dateStr} · ${f.type === 'income' ? 'รายรับ' : 'รายจ่าย'}</div></div>
      <div class="fin-item-right"><div class="fin-item-amt ${f.type === 'income' ? 'inc' : 'exp'}">${f.type === 'income' ? '+' : '-'}฿${f.amount.toLocaleString('th-TH')}</div><button class="fin-item-del" onclick="deleteFinance('${f.id}')"><i class="ph ph-trash"></i></button></div>
    </div>`;
  }).join('');
}

export function renderCalendarView(monthData, container) {
  const [yyyy, mm] = state.selectedFinMonth.split('-');
  const year = parseInt(yyyy), month = parseInt(mm) - 1;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const dayMap = {};
  monthData.forEach(r => {
    if(!r.date) return;
    const d = new Date(r.date);
    if(isNaN(d)) return;
    dayMap[r.date] = dayMap[r.date] || [];
    dayMap[r.date].push(r);
  });

  const days = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
  let html = `<div class="cal-grid">`;
  days.forEach(d => html += `<div class="cal-head">${d}</div>`);
  for (let i = 0; i < firstDay; i++) html += `<div class="cal-day empty"></div>`;

  for (let i = 1; i <= daysInMonth; i++) {
    const dStr = `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
    const records = dayMap[dStr] || [];
    let hasInc = false, hasExp = false, net = 0;

    records.forEach(r => {
      if (r.type === 'income') { hasInc = true; net += r.amount; }
      if (r.type === 'expense') { hasExp = true; net -= r.amount; }
    });

    html += `
      <div class="cal-day" onclick="showDayBreakdown('${dStr}')">
        <div class="cal-date-num">${i}</div>
        <div class="cal-dots">${hasInc ? '<div class="cal-dot inc"></div>' : ''}${hasExp ? '<div class="cal-dot exp"></div>' : ''}</div>
        ${net !== 0 ? `<div class="cal-net ${net > 0 ? 'pos' : 'neg'}">${net > 0 ? '+' : ''}${Math.abs(net).toLocaleString('en-US')}</div>` : ''}
      </div>`;
  }
  container.innerHTML = html + `</div><div id="cal-breakdown"></div>`;
}

export function showDayBreakdown(dateStr) {
  const box = document.getElementById('cal-breakdown');
  if(!box) return;
  const records = state.financeData.filter(f => f.date === dateStr);
  if(!records.length) { box.innerHTML = `<div class="cal-breakdown-box" style="text-align:center;color:var(--gray);">ไม่มีรายการวันนี้</div>`; return; }

  const [y, m, d] = dateStr.split('-');
  box.innerHTML = `<div class="cal-breakdown-box">
    <div style="font-weight:600;margin-bottom:10px;border-bottom:1px solid #e2e8f0;padding-bottom:8px;">รายการวันที่ ${parseInt(d)}/${parseInt(m)}/${parseInt(y)+543}</div>
    ${records.map(f => `<div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:0.85rem;"><span>${f.name}</span><span style="font-family:var(--font-number);font-weight:600;color:${f.type==='income'?'#10b981':'#ef4444'}">${f.type==='income'?'+':'-'}฿${f.amount.toLocaleString('th-TH')}</span></div>`).join('')}
  </div>`;
}

export function renderTodayFinance() {
  const el = document.getElementById('financeTodayList');
  if (!el) return;
  const today = new Date().toLocaleDateString('en-CA');
  const list = state.financeData.filter(f => f.date === today);

  if (!list.length) { el.innerHTML = _empty('<i class="ph ph-receipt"></i>', 'ยังไม่มีรายการเคลื่อนไหววันนี้'); return; }
  el.innerHTML = list.map(f => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:white;border:1px solid var(--border);border-radius:10px;margin-bottom:8px;">
      <div><div style="font-weight:500;font-size:0.95rem;">${f.name}</div><div style="font-size:0.75rem;color:var(--gray);"><i class="ph-fill ${f.type === 'income' ? 'ph-arrow-circle-up' : 'ph-arrow-circle-down'}" style="color:${f.type === 'income' ? '#059669' : '#dc2626'};"></i> ${f.type === 'income' ? 'รายรับ' : 'รายจ่าย'}</div></div>
      <div style="display:flex;align-items:center;gap:10px;"><span style="font-family:var(--font-number);font-weight:700;color:${f.type === 'income' ? '#059669' : '#dc2626'};">${f.type === 'income' ? '+' : '-'}฿${f.amount.toLocaleString()}</span><button onclick="deleteFinance('${f.id}')" style="background:none;border:none;color:var(--gray);cursor:pointer;"><i class="ph ph-trash"></i></button></div>
    </div>`).join('');
}

export function openFinanceModal() {
  document.getElementById('finModalName').value = '';
  document.getElementById('finModalAmount').value = '';
  document.getElementById('finModalDate').value = new Date().toLocaleDateString('en-CA');
  document.getElementById('financeModal').classList.add('open');
}
export function closeFinanceModal() { document.getElementById('financeModal').classList.remove('open'); }