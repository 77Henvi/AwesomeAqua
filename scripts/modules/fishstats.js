// scripts/modules/fishStats.js
// Modal "สถิติปลารายตัว" — ดูกราฟกำไร/ต้นทุนย้อนหลังเป็นรายเดือนของปลาแต่ละตัว
// เปิดจากตารางปลาใน admin.js (ปุ่ม "สถิติ") ใช้ finance records ที่ผูกกับ fish_id
import { niceMax, smoothPath, monthlyFishBreakdown } from '../shared/calc.js';

const MONTH_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const MONTH_FULL  = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

// ── module state (เก็บไว้เพื่อให้ปุ่มเปลี่ยนปีเรียก re-render ได้โดยไม่ต้องส่ง data ใหม่ทุกครั้ง) ──
let _fish        = null;
let _records      = []; // finance records เฉพาะของปลาตัวนี้ (ทุกปี)
let _selectedYear = null;

// ════════════════════════════════════════════
//   ENTRY POINT
// ════════════════════════════════════════════
/**
 * เปิด modal สถิติของปลาตัวหนึ่ง
 * @param {string} id           fish id
 * @param {Array}  fishData     array ปลาปัจจุบัน (หา fish จาก id)
 * @param {Array}  financeData  array รายการการเงินทั้งหมด (จะกรองเฉพาะ fish_id นี้เอง)
 */
export function openFishStatsModal(id, fishData, financeData) {
  const f = fishData.find(x => x.id === id);
  if (!f) return;

  _fish    = f;
  _records = (financeData || []).filter(r => r.fish_id === id);

  _injectFishStatsStyle();
  _ensureModal();

  _selectedYear = _defaultYear(_records);

  _renderModalHeader();
  _renderYearNav();
  _renderChart();
  _renderKpis();

  document.getElementById('fishStatsModal').classList.add('open');
}

export function closeFishStatsModal() {
  document.getElementById('fishStatsModal')?.classList.remove('open');
}

// ════════════════════════════════════════════
//   YEAR HELPERS
// ════════════════════════════════════════════
function _availableYears(records) {
  const nowYear = new Date().getFullYear();
  const years = new Set([nowYear]);
  records.forEach(r => {
    const y = parseInt((r.date || '').slice(0, 4), 10);
    if (y) years.add(y);
  });
  return [...years].sort((a, b) => b - a);
}

function _defaultYear(records) {
  const nowYear = new Date().getFullYear();
  const hasCurrent = records.some(r => (r.date || '').startsWith(String(nowYear)));
  if (hasCurrent || !records.length) return nowYear;
  // ไม่มีข้อมูลปีนี้ → ใช้ปีล่าสุดที่มีข้อมูลจริง
  return _availableYears(records).find(y => records.some(r => (r.date || '').startsWith(String(y)))) || nowYear;
}

// (การคำนวณล้วนถูกย้ายไปไว้ที่ scripts/shared/calc.js → monthlyFishBreakdown / extractSaleQty
//  เพื่อให้มี unit test ครอบคลุม โดยไม่ต้องพึ่ง DOM/Supabase — ดู tests/fishStats.test.mjs)

// ════════════════════════════════════════════
//   MODAL DOM (สร้างครั้งเดียว ต่อท้าย body)
// ════════════════════════════════════════════
function _ensureModal() {
  if (document.getElementById('fishStatsModal')) return;

  const wrap = document.createElement('div');
  wrap.id = 'fishStatsModal';
  wrap.className = 'fs-modal-overlay';
  wrap.innerHTML = `
    <div class="fs-modal-box">
      <div class="fs-modal-head">
        <div id="fsModalFishInfo" class="fs-modal-fish-info"></div>
        <button type="button" class="fs-modal-close" onclick="window.closeFishStatsModal()"><i class="ph ph-x"></i></button>
      </div>

      <div id="fsKpiGrid" class="fs-kpi-grid"></div>

      <div class="fs-chart-card-head">
        <div class="fs-chart-title"><i class="ph ph-chart-line-up"></i> กำไร &amp; ต้นทุน รายเดือน</div>
        <div id="fsYearNav" class="fs-year-nav"></div>
      </div>
      <div id="fsChartLegend" class="fs-chart-legend"></div>
      <div id="fsChart" class="fs-chart-wrap"></div>
    </div>`;
  document.body.appendChild(wrap);
  wrap.addEventListener('click', e => { if (e.target === wrap) closeFishStatsModal(); });

  window.closeFishStatsModal = closeFishStatsModal;
  window.__fishStatsChangeYear = (delta) => {
    const years = _availableYears(_records);
    const idx = years.indexOf(_selectedYear);
    const next = years[idx - delta] ?? years[idx]; // ปีเรียงมากไปน้อย ปุ่ม "ถัดไป" (delta=-1) = ปีที่ใหม่กว่า
    if (next === undefined) return;
    _selectedYear = next;
    _renderYearNav();
    _renderChart();
    _renderKpis();
  };
}

// ════════════════════════════════════════════
//   HEADER (รูป + ชื่อปลา)
// ════════════════════════════════════════════
function _renderModalHeader() {
  const f = _fish;
  const name = f.name_th || f.name || '—';
  const img = f.image
    ? `<img src="${f.image}" alt="${name}">`
    : `<div class="fs-fish-emoji">${f.emoji || '🐟'}</div>`;

  document.getElementById('fsModalFishInfo').innerHTML = `
    <div class="fs-fish-thumb">${img}</div>
    <div>
      <div class="fs-fish-name">${name}</div>
      <div class="fs-fish-species">${f.species || '—'}</div>
    </div>`;
}

// ════════════════════════════════════════════
//   YEAR NAV
// ════════════════════════════════════════════
function _renderYearNav() {
  const el = document.getElementById('fsYearNav');
  if (!el) return;
  const years = _availableYears(_records);
  const idx = years.indexOf(_selectedYear);
  const hasPrev = idx < years.length - 1; // ปีเก่ากว่า
  const hasNext = idx > 0;                // ปีใหม่กว่า

  el.innerHTML = `
    <button type="button" class="fs-year-arrow" ${hasPrev ? '' : 'disabled'} onclick="window.__fishStatsChangeYear(1)"><i class="ph ph-caret-left"></i></button>
    <span class="fs-year-label">${_selectedYear}</span>
    <button type="button" class="fs-year-arrow" ${hasNext ? '' : 'disabled'} onclick="window.__fishStatsChangeYear(-1)"><i class="ph ph-caret-right"></i></button>`;
}

// ════════════════════════════════════════════
//   KPI CARDS (สรุปของปีที่เลือก)
// ════════════════════════════════════════════
function _renderKpis() {
  const el = document.getElementById('fsKpiGrid');
  if (!el) return;

  const months  = monthlyFishBreakdown(_records, _selectedYear);
  const revenue = months.reduce((s, m) => s + m.income, 0);
  const cost    = months.reduce((s, m) => s + m.cost, 0);
  const profit  = revenue - cost;
  const qty     = months.reduce((s, m) => s + m.qty, 0);

  const fmt = n => '฿' + Math.round(n).toLocaleString('th-TH');

  const cards = [
    { label: 'ขายได้ (ตัว)', val: qty.toLocaleString('th-TH'), accent: true },
    { label: 'รายรับรวม',    val: fmt(revenue) },
    { label: 'ต้นทุนรวม',    val: fmt(cost) },
    { label: 'กำไรสุทธิ',    val: (profit >= 0 ? '+' : '') + fmt(profit), color: profit >= 0 ? '#059669' : '#dc2626' },
  ];

  el.innerHTML = cards.map(k => `
    <div class="fs-kpi-card ${k.accent ? 'fs-kpi-card--accent' : ''}">
      <div class="fs-kpi-label">${k.label}</div>
      <div class="fs-kpi-val" ${k.color ? `style="color:${k.color}"` : ''}>${k.val}</div>
    </div>`).join('');
}

// ════════════════════════════════════════════
//   CHART: X = เดือน, Y = เงิน, เส้น 1 = กำไร, เส้น 2 = ต้นทุน
// ════════════════════════════════════════════
function _renderChart() {
  const el = document.getElementById('fsChart');
  const legEl = document.getElementById('fsChartLegend');
  if (!el) return;

  const months = monthlyFishBreakdown(_records, _selectedYear).map(m => ({
    ...m,
    profit: m.income - m.cost,
  }));

  const hasAny = months.some(m => m.income > 0 || m.cost > 0);
  if (!hasAny) {
    el.innerHTML = `<div class="fs-empty"><i class="ph ph-chart-line-down"></i><div>ยังไม่มีข้อมูลการเงินของปลาตัวนี้ในปี ${_selectedYear}</div></div>`;
    if (legEl) legEl.innerHTML = '';
    return;
  }

  if (legEl) {
    legEl.innerHTML = `
      <span class="fs-legend-item"><span class="fs-legend-swatch solid"></span> กำไร</span>
      <span class="fs-legend-item"><span class="fs-legend-swatch dash"></span> ต้นทุน</span>`;
  }

  const W = 640, H = 240;
  const padL = 46, padR = 10, padT = 16, padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // แกน Y ต้องรองรับได้ทั้งค่าบวก(กำไร)และค่าลบ(ขาดทุนบางเดือน) จึงหา max ของค่า absolute ทั้งหมด
  const maxRaw = Math.max(...months.map(m => Math.max(Math.abs(m.profit), m.cost)), 1);
  const maxVal = niceMax(maxRaw);
  const minVal = months.some(m => m.profit < 0) ? -maxVal : 0;
  const range  = maxVal - minVal;

  const xFor = i => padL + (plotW / 11) * i;
  const yFor = v => padT + plotH - ((v - minVal) / range) * plotH;

  // ── grid lines + y labels ──
  const steps = minVal < 0 ? 4 : 3;
  let gridSvg = '';
  for (let s = 0; s <= steps; s++) {
    const val = minVal + (range / steps) * s;
    const y   = yFor(val);
    const label = val === 0 ? '0' : (Math.abs(val) >= 1000 ? (val < 0 ? '-' : '') + '฿' + Math.round(Math.abs(val) / 1000) + 'k' : '฿' + Math.round(val));
    gridSvg += `
      <line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#eef1f8" stroke-width="1"/>
      <text x="${padL - 8}" y="${y + 4}" font-size="11" fill="#94a3b8" text-anchor="end">${label}</text>`;
  }
  // เส้นศูนย์เข้มขึ้นหน่อยถ้ามีค่าติดลบ (ให้แยกโซนกำไร/ขาดทุนชัดเจน)
  if (minVal < 0) {
    const y0 = yFor(0);
    gridSvg += `<line x1="${padL}" y1="${y0}" x2="${W - padR}" y2="${y0}" stroke="#cbd5e1" stroke-width="1.25"/>`;
  }

  // ── x labels ──
  let xLabelsSvg = '';
  MONTH_SHORT.forEach((m, i) => {
    xLabelsSvg += `<text x="${xFor(i)}" y="${H - 6}" font-size="11" fill="#94a3b8" text-anchor="middle">${m}</text>`;
  });

  const profitPts = months.map((m, i) => ({ x: xFor(i), y: yFor(m.profit) }));
  const costPts   = months.map((m, i) => ({ x: xFor(i), y: yFor(m.cost) }));

  const profitLine = smoothPath(profitPts);
  const costLine   = smoothPath(costPts);

  // ── clickable/hoverable points เฉพาะเดือนที่มีข้อมูลจริง ──
  let pointsSvg = '';
  months.forEach((m, i) => {
    if (m.income === 0 && m.cost === 0) return;
    const monthLabel = `${MONTH_FULL[i]} ${_selectedYear}`;
    pointsSvg += `<circle cx="${profitPts[i].x}" cy="${profitPts[i].y}" r="5" fill="${m.profit >= 0 ? '#059669' : '#dc2626'}" stroke="#fff" stroke-width="2" class="fs-chart-dot"><title>${monthLabel}\nกำไร ${(m.profit >= 0 ? '+' : '')}฿${m.profit.toLocaleString('th-TH')}</title></circle>`;
    if (m.cost > 0) {
      pointsSvg += `<circle cx="${costPts[i].x}" cy="${costPts[i].y}" r="4" fill="#94a3b8" stroke="#fff" stroke-width="2" class="fs-chart-dot"><title>${monthLabel}\nต้นทุน ฿${m.cost.toLocaleString('th-TH')}</title></circle>`;
    }
  });

  el.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" class="fs-chart-svg" preserveAspectRatio="none">
      ${gridSvg}
      <path d="${profitLine}" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round"></path>
      <path d="${costLine}"   fill="none" stroke="#94a3b8" stroke-width="1.75" stroke-dasharray="5,4" stroke-linecap="round"></path>
      ${pointsSvg}
      ${xLabelsSvg}
    </svg>`;
}

// ════════════════════════════════════════════
//   STYLE (inject ครั้งเดียว)
// ════════════════════════════════════════════
function _injectFishStatsStyle() {
  if (document.getElementById('fishStatsExtraStyle')) return;
  const style = document.createElement('style');
  style.id = 'fishStatsExtraStyle';
  style.textContent = `
    .fs-modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.45);
      display: none; align-items: center; justify-content: center; z-index: 9999; padding: 1rem;
    }
    .fs-modal-overlay.open { display: flex; }
    .fs-modal-box {
      background: #fff; border-radius: 16px; padding: 1.5rem;
      width: 100%; max-width: 620px; max-height: 90vh; overflow-y: auto;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    }
    .fs-modal-head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1.1rem; }
    .fs-modal-fish-info { display: flex; align-items: center; gap: 0.7rem; }
    .fs-fish-thumb { width: 46px; height: 46px; border-radius: 10px; overflow: hidden; flex-shrink: 0; background:#f1f5f9; display:flex; align-items:center; justify-content:center; }
    .fs-fish-thumb img { width: 100%; height: 100%; object-fit: cover; }
    .fs-fish-emoji { font-size: 1.5rem; }
    .fs-fish-name { font-family: var(--font-display); font-size: 1.05rem; font-weight: 700; color: var(--black); }
    .fs-fish-species { font-size: 0.78rem; color: var(--gray); }
    .fs-modal-close {
      width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--border);
      background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .fs-modal-close:hover { background: #f1f5f9; }

    .fs-kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.6rem; margin-bottom: 1.3rem; }
    .fs-kpi-card { background: #f8faff; border: 1px solid var(--border); border-radius: 12px; padding: 0.8rem 0.6rem; text-align: center; }
    .fs-kpi-card--accent { background: #eef2ff; border-color: #c7d2fe; }
    .fs-kpi-label { font-size: 0.68rem; color: var(--gray); margin-bottom: 3px; }
    .fs-kpi-val { font-family: var(--font-number, 'Jost', sans-serif); font-weight: 700; font-size: 0.95rem; color: var(--black); }

    .fs-chart-card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.4rem; flex-wrap: wrap; gap: 0.5rem; }
    .fs-chart-title { font-family: var(--font-display); font-size: 0.92rem; font-weight: 700; color: var(--black); display: flex; align-items: center; gap: 0.4rem; }
    .fs-year-nav { display: flex; align-items: center; gap: 0.5rem; }
    .fs-year-label { font-family: var(--font-number, 'Jost', sans-serif); font-weight: 700; font-size: 0.9rem; min-width: 2.6rem; text-align: center; }
    .fs-year-arrow {
      width: 26px; height: 26px; border-radius: 50%; border: 1px solid var(--border);
      background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.75rem;
    }
    .fs-year-arrow:hover:not(:disabled) { background: #f1f5f9; }
    .fs-year-arrow:disabled { opacity: 0.35; cursor: not-allowed; }

    .fs-chart-legend { display: flex; gap: 0.9rem; font-size: 0.75rem; color: var(--gray, #64748b); margin-bottom: 0.5rem; }
    .fs-legend-item { display: flex; align-items: center; gap: 5px; }
    .fs-legend-swatch { width: 14px; height: 0; border-top: 2.5px solid #059669; display: inline-block; }
    .fs-legend-swatch.dash { border-top: 1.75px dashed #94a3b8; }
    .fs-chart-wrap { min-height: 60px; }
    .fs-chart-svg { width: 100%; height: auto; display: block; }
    .fs-chart-dot { cursor: pointer; }
    .fs-chart-dot:hover { r: 7; }

    .fs-empty { text-align: center; padding: 2.2rem 1rem; color: var(--gray); }
    .fs-empty i { font-size: 2rem; display: block; margin-bottom: 0.5rem; opacity: 0.6; }
    .fs-empty div { font-size: 0.85rem; }

    @media (max-width: 640px) {
      .fs-kpi-grid { grid-template-columns: repeat(2, 1fr); }
      .fs-modal-box { padding: 1.1rem; }
    }
  `;
  document.head.appendChild(style);
}