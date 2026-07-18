import { niceMax as _niceMax, smoothPath as _smoothPath } from '../shared/calc.js';

const MONTH_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const MONTH_FULL  = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

// ── module state ──────────────────────────────
let _fishData    = [];
let _financeData = [];
let _selectedYear = null;

// ── entry point ──────────────────────────────
export function renderStats(fishData, financeData) {
  _fishData    = fishData.filter(f => !f.is_archived); // ไม่นับปลาที่เลิกขายแล้วในสถิติสต็อก/ราคา
  _financeData = financeData;

  _injectStatsStyle();

  if (_selectedYear === null) {
    _selectedYear = _defaultYear(financeData);
  }

  renderYearSelect(financeData);
  renderFinanceKPI(financeData, _selectedYear);
  renderFinanceChart(financeData, _selectedYear);
  renderMonthlyList(financeData, _selectedYear);

  renderStatsStockChart(_fishData);
  renderStatsPriceDist(_fishData);
  renderStatsTopFish(_fishData);
  renderStatsLevelDist(_fishData);
}

// ── ปีที่มีข้อมูล + ปีปัจจุบัน ─────────────────
function _availableYears(financeData) {
  const nowYear = new Date().getFullYear();
  const years = new Set([nowYear]);
  financeData.forEach(f => {
    const y = parseInt((f.date || '').slice(0, 4), 10);
    if (y) years.add(y);
  });
  return [...years].sort((a, b) => b - a);
}

function _defaultYear(financeData) {
  const years = _availableYears(financeData);
  const nowYear = new Date().getFullYear();
  // ถ้าปีปัจจุบันมีข้อมูล ใช้ปีปัจจุบัน ไม่งั้นใช้ปีล่าสุดที่มีข้อมูล
  const hasCurrent = financeData.some(f => (f.date || '').startsWith(String(nowYear)));
  if (hasCurrent || !years.length) return nowYear;
  return years[0];
}

// ── ตัวเลือกปี ─────────────────────────────────
function renderYearSelect(financeData) {
  const sel = document.getElementById('statsYearSelect');
  if (!sel) return;

  const years = _availableYears(financeData);
  sel.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
  sel.value = String(_selectedYear);

  sel.onchange = () => {
    _selectedYear = parseInt(sel.value, 10);
    renderFinanceKPI(_financeData, _selectedYear);
    renderFinanceChart(_financeData, _selectedYear);
    renderMonthlyList(_financeData, _selectedYear);
  };
}

// ── สรุปข้อมูลการเงินรายปี ต่อเดือน ──────────────
function _monthlyBreakdown(financeData, year) {
  const months = Array.from({ length: 12 }, () => ({ income: 0, expense: 0, orders: 0 }));
  financeData.forEach(f => {
    const d = f.date || '';
    if (!d.startsWith(String(year))) return;
    const mo = parseInt(d.slice(5, 7), 10) - 1;
    if (mo < 0 || mo > 11) return;
    if (f.type === 'income') {
      months[mo].income += f.amount;
      months[mo].orders += 1;
    } else {
      months[mo].expense += f.amount;
    }
  });
  return months;
}

// ── Finance KPI cards ──────────────────────────
function renderFinanceKPI(financeData, year) {
  const el = document.getElementById('stats-fin-kpi');
  if (!el) return;

  const months = _monthlyBreakdown(financeData, year);
  const totalIncome  = months.reduce((s, m) => s + m.income, 0);
  const totalExpense = months.reduce((s, m) => s + m.expense, 0);
  const totalOrders  = months.reduce((s, m) => s + m.orders, 0);
  const profit       = totalIncome - totalExpense;

  const activeMonths = months.filter(m => m.income > 0).length || 1;
  const avgPerMonth  = totalIncome / activeMonths;

  let bestIdx = 0;
  months.forEach((m, i) => { if (m.income > months[bestIdx].income) bestIdx = i; });
  const bestMonthLabel = months[bestIdx].income > 0 ? MONTH_FULL[bestIdx] : '—';

  const fmt = n => '฿' + Math.round(n).toLocaleString('th-TH');

  const cards = [
    { icon: 'ph-receipt',                label: 'ออเดอร์ทั้งปี',       val: totalOrders,               color: 'var(--royal-blue)', accent: true },
    { icon: 'ph-trend-up',               label: 'รายรับรวม',          val: fmt(totalIncome),          color: '#059669' },
    { icon: 'ph-trend-down',             label: 'รายจ่ายรวม',         val: fmt(totalExpense),         color: '#dc2626' },
    { icon: 'ph-currency-circle-dollar', label: 'กำไรสุทธิ',          val: (profit >= 0 ? '+' : '') + fmt(profit), color: profit >= 0 ? '#059669' : '#dc2626' },
    { icon: 'ph-calculator',             label: 'เฉลี่ย/เดือน',        val: fmt(avgPerMonth),          color: '#7c3aed' },
    { icon: 'ph-crown-simple',           label: 'เดือนทำได้สูงสุด',    val: bestMonthLabel,            color: '#d97706', small: true },
  ];

  el.innerHTML = cards.map(k => `
    <div class="stats-kpi-card ${k.accent ? 'stats-kpi-card-accent' : ''}">
      <div class="stats-kpi-icon" style="color:${k.color}"><i class="ph ${k.icon}"></i></div>
      <div class="stats-kpi-val ${k.small ? 'stats-kpi-val-small' : ''}">${k.val}</div>
      <div class="stats-kpi-label">${k.label}</div>
    </div>`).join('');
}

// ── กราฟรายรับ vs รายจ่าย (area + line) ─────────
function renderFinanceChart(financeData, year) {
  const el = document.getElementById('stats-fin-chart');
  if (!el) return;

  const months = _monthlyBreakdown(financeData, year);
  const hasAny = months.some(m => m.income > 0 || m.expense > 0);
  if (!hasAny) { el.innerHTML = statsEmpty(`ยังไม่มีข้อมูลการเงินในปี ${year}`); return; }

  const W = 760, H = 300;
  const padL = 46, padR = 12, padT = 16, padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const maxRaw = Math.max(...months.map(m => Math.max(m.income, m.expense)), 1);
  const maxVal = _niceMax(maxRaw);
  const steps  = 4;

  const xFor = i => padL + (plotW / 11) * i;
  const yFor = v => padT + plotH - (v / maxVal) * plotH;

  // ── grid lines + y labels ──
  let gridSvg = '';
  for (let s = 0; s <= steps; s++) {
    const val = (maxVal / steps) * s;
    const y   = yFor(val);
    gridSvg += `
      <line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#eef1f8" stroke-width="1"/>
      <text x="${padL - 8}" y="${y + 4}" font-size="11" fill="#94a3b8" text-anchor="end">${val >= 1000 ? Math.round(val / 1000) + 'k' : Math.round(val)}</text>`;
  }

  // ── x labels ──
  let xLabelsSvg = '';
  MONTH_SHORT.forEach((m, i) => {
    xLabelsSvg += `<text x="${xFor(i)}" y="${H - 6}" font-size="11" fill="#94a3b8" text-anchor="middle">${m}</text>`;
  });

  const incomePts  = months.map((m, i) => ({ x: xFor(i), y: yFor(m.income) }));
  const expensePts = months.map((m, i) => ({ x: xFor(i), y: yFor(m.expense) }));

  const incomeLine = _smoothPath(incomePts);
  const incomeArea = `${incomeLine} L${incomePts[incomePts.length - 1].x},${padT + plotH} L${incomePts[0].x},${padT + plotH} Z`;
  const expenseLine = _smoothPath(expensePts);

  // ── clickable points (เฉพาะเดือนที่มีข้อมูล) ──
  let pointsSvg = '';
  months.forEach((m, i) => {
    if (m.income === 0 && m.expense === 0) return;
    const monthKey = `${year}-${String(i + 1).padStart(2, '0')}`;
    if (m.income > 0) {
      pointsSvg += `<circle cx="${incomePts[i].x}" cy="${incomePts[i].y}" r="5" fill="#059669" stroke="#fff" stroke-width="2" class="stats-chart-dot" onclick="window.__statsOpenMonth('${monthKey}')"></circle>`;
    }
    if (m.expense > 0) {
      pointsSvg += `<circle cx="${expensePts[i].x}" cy="${expensePts[i].y}" r="4" fill="#dc2626" stroke="#fff" stroke-width="2" class="stats-chart-dot" onclick="window.__statsOpenMonth('${monthKey}')"></circle>`;
    }
  });

  el.innerHTML = `
    <div class="stats-chart-legend">
      <span><span class="dot" style="background:#059669;"></span> รายรับ</span>
      <span><span class="dot dash" style="background:#dc2626;"></span> รายจ่าย</span>
    </div>
    <svg viewBox="0 0 ${W} ${H}" class="stats-fin-svg">
      ${gridSvg}
      <path d="${incomeArea}" fill="#059669" fill-opacity="0.12" stroke="none"></path>
      <path d="${incomeLine}" fill="none" stroke="#059669" stroke-width="2.5"></path>
      <path d="${expenseLine}" fill="none" stroke="#dc2626" stroke-width="2" stroke-dasharray="5,4"></path>
      ${pointsSvg}
      ${xLabelsSvg}
    </svg>`;

  window.__statsOpenMonth = openMonthModal;
}

// ── รายละเอียดรายเดือน (list) ────────────────────
function renderMonthlyList(financeData, year) {
  const el = document.getElementById('stats-fin-monthly-list');
  if (!el) return;

  const months = _monthlyBreakdown(financeData, year);
  const rows = months
    .map((m, i) => ({ ...m, idx: i }))
    .filter(m => m.income > 0 || m.expense > 0)
    .sort((a, b) => b.idx - a.idx);

  if (!rows.length) { el.innerHTML = statsEmpty(`ยังไม่มีข้อมูลการเงินในปี ${year}`); return; }

  el.innerHTML = rows.map(m => {
    const profit = m.income - m.expense;
    const monthKey = `${year}-${String(m.idx + 1).padStart(2, '0')}`;
    return `
      <div class="stats-month-row" onclick="window.__statsOpenMonth('${monthKey}')">
        <div class="stats-month-info">
          <div class="stats-month-name">${MONTH_FULL[m.idx]}</div>
          <div class="stats-month-sub">รับ ฿${m.income.toLocaleString('th-TH')} · จ่าย ฿${m.expense.toLocaleString('th-TH')}</div>
        </div>
        <div class="stats-month-nums">
          <div class="stats-month-income">฿${m.income.toLocaleString('th-TH')}</div>
          <div class="stats-month-profit ${profit >= 0 ? 'pos' : 'neg'}">${profit >= 0 ? '+' : ''}฿${profit.toLocaleString('th-TH')}</div>
        </div>
      </div>`;
  }).join('');
}

// ── Modal รายการธุรกรรมรายเดือน ───────────────────
function _initMonthModal() {
  if (document.getElementById('statsMonthModal')) return;

  const wrap = document.createElement('div');
  wrap.id = 'statsMonthModal';
  wrap.className = 'stats-modal-overlay';
  wrap.innerHTML = `
    <div class="stats-modal-box">
      <div class="stats-modal-head">
        <div id="statsModalTitle" class="stats-modal-title"></div>
        <button type="button" class="stats-modal-close" onclick="window.__statsCloseMonth()"><i class="ph ph-x"></i></button>
      </div>
      <div id="statsModalSummary" class="stats-modal-summary"></div>
      <div id="statsModalList" class="stats-modal-list"></div>
    </div>`;
  document.body.appendChild(wrap);
  wrap.addEventListener('click', e => { if (e.target === wrap) closeMonthModal(); });

  window.__statsCloseMonth = closeMonthModal;
}

function _fmtTxDate(dateStr) {
  const [y, m, d] = (dateStr || '').split('-').map(Number);
  if (!y || !m || !d) return dateStr || '';
  return `${d} ${MONTH_SHORT[m - 1]} ${String(y).slice(-2)}`;
}

function openMonthModal(monthKey) {
  _initMonthModal();
  const [year, mo] = monthKey.split('-').map(Number);

  const records = _financeData
    .filter(f => (f.date || '').startsWith(monthKey))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const income  = records.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
  const expense = records.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
  const profit  = income - expense;

  document.getElementById('statsModalTitle').textContent = MONTH_FULL[mo - 1];
  document.getElementById('statsModalSummary').innerHTML = `
    <div class="stats-modal-summary-item">
      <div class="stats-modal-summary-label">รายรับ</div>
      <div class="stats-modal-summary-val inc">฿${income.toLocaleString('th-TH')}</div>
    </div>
    <div class="stats-modal-summary-item">
      <div class="stats-modal-summary-label">รายจ่าย</div>
      <div class="stats-modal-summary-val exp">฿${expense.toLocaleString('th-TH')}</div>
    </div>
    <div class="stats-modal-summary-item">
      <div class="stats-modal-summary-label">กำไร</div>
      <div class="stats-modal-summary-val ${profit >= 0 ? 'inc' : 'exp'}">${profit >= 0 ? '+' : ''}฿${profit.toLocaleString('th-TH')}</div>
    </div>`;

  if (!records.length) {
    document.getElementById('statsModalList').innerHTML = statsEmpty('ไม่มีรายการในเดือนนี้');
  } else {
    document.getElementById('statsModalList').innerHTML = records.map(r => {
      const isIncome = r.type === 'income';
      const tag = r.fish_id ? 'ขายปลา' : (isIncome ? 'รายรับอื่นๆ' : 'รายจ่าย');
      return `
        <div class="stats-modal-tx-row">
          <div class="stats-modal-tx-info">
            <div class="stats-modal-tx-name">${r.name || '—'}</div>
            <div class="stats-modal-tx-sub">${tag} · ${_fmtTxDate(r.date)}</div>
          </div>
          <div class="stats-modal-tx-amt ${isIncome ? 'inc' : 'exp'}">${isIncome ? '+' : '-'}฿${(r.amount || 0).toLocaleString('th-TH')}</div>
        </div>`;
    }).join('');
  }

  document.getElementById('statsMonthModal').classList.add('open');
}

function closeMonthModal() {
  document.getElementById('statsMonthModal')?.classList.remove('open');
}

// ── สต็อก bar chart (ย่อ Top 5) ───────────────────
function renderStatsStockChart(fishData) {
  const el = document.getElementById('stats-stock-chart');
  if (!el) return;

  const items = [...fishData]
    .filter(f => !isCS(f))
    .sort((a, b) => (b.stock || 0) - (a.stock || 0))
    .slice(0, 5);

  if (!items.length) { el.innerHTML = statsEmpty('ไม่มีข้อมูลปลา'); return; }

  const max = Math.max(...items.map(f => f.stock || 0), 1);
  const COLOR = { ok: '#059669', low: '#d97706', out: '#dc2626' };

  el.innerHTML = items.map(f => {
    const pct   = Math.round(((f.stock || 0) / max) * 100);
    const cls   = f.stock === 0 ? 'out' : f.stock <= 5 ? 'low' : 'ok';
    const color = COLOR[cls];
    return `
      <div class="stats-bar-row">
        <div class="stats-bar-name" title="${f.name}">${f.emoji || '🐟'} ${f.name}</div>
        <div class="stats-bar-track">
          <div class="stats-bar-fill" style="width:${Math.max(pct, 2)}%;background:${color};"></div>
        </div>
        <div class="stats-bar-num" style="color:${color}">${f.stock}</div>
      </div>`;
  }).join('');
}

// ── กระจายราคา ───────────────────────────────
function renderStatsPriceDist(fishData) {
  const el = document.getElementById('stats-price-dist');
  if (!el) return;

  const buckets = [
    { label: '< ฿100',        min: 0,    max: 100      },
    { label: '฿100–300',       min: 100,  max: 300      },
    { label: '฿300–500',       min: 300,  max: 500      },
    { label: '฿500–1,000',     min: 500,  max: 1000     },
    { label: '฿1,000–3,000',   min: 1000, max: 3000     },
    { label: '> ฿3,000',       min: 3000, max: Infinity },
  ];

  const counts = buckets.map(b => ({
    ...b,
    count: fishData.filter(f => f.priceMin >= b.min && f.priceMin < b.max).length
  }));

  const max = Math.max(...counts.map(b => b.count), 1);

  el.innerHTML = counts.map(b => `
    <div class="stats-bar-row">
      <div class="stats-bar-name">${b.label}</div>
      <div class="stats-bar-track">
        <div class="stats-bar-fill" style="width:${Math.round((b.count / max) * 100)}%;background:var(--royal-blue);opacity:${(0.4 + (b.count / max) * 0.6).toFixed(2)};"></div>
      </div>
      <div class="stats-bar-num">${b.count} ชนิด</div>
    </div>`).join('');
}

// ── Top ราคาแพง / ถูก (ย่อ Top 3) ─────────────────
function renderStatsTopFish(fishData) {
  const el = document.getElementById('stats-top-fish');
  if (!el) return;

  const saleable = fishData.filter(f => f.priceMin > 0);
  if (!saleable.length) { el.innerHTML = statsEmpty('ไม่มีข้อมูลราคา'); return; }

  const topExpensive = [...saleable].sort((a, b) => (b.priceMax || b.priceMin) - (a.priceMax || a.priceMin)).slice(0, 3);
  const topCheap     = [...saleable].sort((a, b) => a.priceMin - b.priceMin).slice(0, 3);

  const row = (f, rank) => `
    <div class="stats-top-row">
      <div class="stats-top-rank">${rank}</div>
      <div class="stats-top-info">
        <div class="stats-top-name">${f.emoji || '🐟'} ${f.name}</div>
        <div class="stats-top-species">${f.species || '—'}</div>
      </div>
      <div class="stats-top-price">฿${(f.priceMin || 0).toLocaleString('th-TH')}${f.priceMax ? '–฿' + f.priceMax.toLocaleString('th-TH') : ''}</div>
    </div>`;

  el.innerHTML = `
    <div class="stats-top-col">
      <div class="stats-top-title">💎 ราคาสูงสุด</div>
      ${topExpensive.map((f, i) => row(f, i + 1)).join('')}
    </div>
    <div class="stats-top-col">
      <div class="stats-top-title">🌱 ราคาเริ่มต้น</div>
      ${topCheap.map((f, i) => row(f, i + 1)).join('')}
    </div>`;
}

// ── ระดับความยาก ──────────────────────────────
function renderStatsLevelDist(fishData) {
  const el = document.getElementById('stats-level-dist');
  if (!el) return;

  const levels = [
    { key: 'มือใหม่',      color: '#059669', cls: 'easy'   },
    { key: 'ปานกลาง',      color: '#d97706', cls: 'medium' },
    { key: 'ผู้เชี่ยวชาญ', color: '#dc2626', cls: 'hard'   },
  ];

  const total = fishData.length || 1;

  el.innerHTML = levels.map(l => {
    const count = fishData.filter(f => f.level === l.key).length;
    const pct   = Math.round((count / total) * 100);
    return `
      <div class="stats-level-row">
        <span class="admin-level-badge ${l.cls}">${l.key}</span>
        <div class="stats-bar-track" style="flex:1">
          <div class="stats-bar-fill" style="width:${pct}%;background:${l.color};"></div>
        </div>
        <div class="stats-bar-num">${count} <span style="opacity:0.5;font-size:0.72rem;">(${pct}%)</span></div>
      </div>`;
  }).join('');
}

// ── private helpers ───────────────────────────
function isCS(f)         { return f.priceMin === 0 && f.stock === 0; }
function statsEmpty(msg) { return `<div class="admin-empty-state"><div class="admin-empty-icon">📊</div><div class="admin-empty-text">${msg}</div></div>`; }

// ── style ที่เพิ่มใหม่สำหรับ finance overview / mini grid / modal ──
function _injectStatsStyle() {
  if (document.getElementById('statsExtraStyle')) return;
  const style = document.createElement('style');
  style.id = 'statsExtraStyle';
  style.textContent = `
    .stats-fin-toolbar {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 1rem;
    }
    .stats-fin-toolbar-title {
      font-family: var(--font-display); font-size: 1.1rem; font-weight: 700;
      color: var(--black); display: flex; align-items: center; gap: 0.4rem;
    }
    .stats-year-select {
      padding: 0.5rem 0.9rem; border-radius: 10px; border: 1px solid var(--border);
      font-family: var(--font-number, 'Jost', sans-serif); font-size: 0.9rem;
      font-weight: 600; color: var(--black); background: #fff; cursor: pointer;
    }
    .stats-kpi-card-accent { border-color: var(--royal-blue); }
    .stats-kpi-val-small { font-size: 1.05rem; }

    .stats-hint { font-size: 0.72rem; font-weight: 500; color: var(--gray); margin-left: 0.4rem; }

    .stats-chart-legend { display: flex; gap: 1rem; font-size: 0.75rem; margin-bottom: 0.75rem; color: var(--gray); }
    .stats-chart-legend .dot { width: 10px; height: 10px; border-radius: 2px; display: inline-block; margin-right: 4px; }
    .stats-fin-svg { width: 100%; height: auto; display: block; }
    .stats-chart-dot { cursor: pointer; }
    .stats-chart-dot:hover { r: 7; }

    .stats-month-list { display: flex; flex-direction: column; gap: 0.6rem; }
    .stats-month-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.75rem 0.9rem; border: 1px solid var(--border); border-radius: 12px;
      cursor: pointer; transition: 0.15s;
    }
    .stats-month-row:hover { border-color: var(--royal-blue); background: #f8faff; }
    .stats-month-name { font-size: 0.9rem; font-weight: 700; color: var(--black); }
    .stats-month-sub { font-size: 0.75rem; color: var(--gray); margin-top: 2px; }
    .stats-month-nums { text-align: right; }
    .stats-month-income {
      font-family: var(--font-number, 'Jost', sans-serif); font-weight: 700; font-size: 0.95rem; color: var(--black);
    }
    .stats-month-profit { font-size: 0.72rem; font-weight: 600; margin-top: 2px; }
    .stats-month-profit.pos { color: #059669; }
    .stats-month-profit.neg { color: #dc2626; }

    .stats-mini-title-row {
      font-family: var(--font-display); font-size: 0.95rem; font-weight: 700;
      color: var(--black); margin: 1.75rem 0 0.75rem; display: flex; align-items: center; gap: 0.4rem;
    }
    .stats-mini-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
    .stats-mini-card {
      background: white; border: 1px solid var(--border);
      border-radius: 14px; padding: 1.1rem;
    }
    .stats-section-title.small { font-size: 0.85rem; margin-bottom: 0.9rem; }

    .stats-modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.45);
      display: none; align-items: center; justify-content: center; z-index: 9999; padding: 1rem;
    }
    .stats-modal-overlay.open { display: flex; }
    .stats-modal-box {
      background: #fff; border-radius: 16px; padding: 1.5rem;
      width: 100%; max-width: 420px; max-height: 85vh; overflow-y: auto;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    }
    .stats-modal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
    .stats-modal-title { font-family: var(--font-display); font-size: 1.15rem; font-weight: 700; color: var(--black); }
    .stats-modal-close {
      width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--border);
      background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center;
    }
    .stats-modal-close:hover { background: #f1f5f9; }
    .stats-modal-summary {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem;
      background: #f8faff; border-radius: 12px; padding: 0.9rem; margin-bottom: 1rem;
    }
    .stats-modal-summary-item { text-align: center; }
    .stats-modal-summary-label { font-size: 0.7rem; color: var(--gray); margin-bottom: 2px; }
    .stats-modal-summary-val { font-family: var(--font-number, 'Jost', sans-serif); font-weight: 700; font-size: 0.95rem; }
    .stats-modal-summary-val.inc { color: #059669; }
    .stats-modal-summary-val.exp { color: #dc2626; }
    .stats-modal-list { display: flex; flex-direction: column; }
    .stats-modal-tx-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.7rem 0; border-bottom: 1px solid #f0f4ff;
    }
    .stats-modal-tx-row:last-child { border-bottom: none; }
    .stats-modal-tx-name { font-size: 0.85rem; font-weight: 600; color: var(--black); }
    .stats-modal-tx-sub { font-size: 0.7rem; color: var(--gray); margin-top: 2px; }
    .stats-modal-tx-amt { font-family: var(--font-number, 'Jost', sans-serif); font-weight: 700; font-size: 0.85rem; flex-shrink: 0; }
    .stats-modal-tx-amt.inc { color: #059669; }
    .stats-modal-tx-amt.exp { color: #dc2626; }

    @media (max-width: 640px) {
      .stats-mini-grid { grid-template-columns: 1fr; }
      .stats-fin-toolbar { flex-wrap: wrap; gap: 0.6rem; }
    }
  `;
  document.head.appendChild(style);
}