// ============================================
//   scripts/modules/stats.js
//   Stats page — รับ fishData & financeData
//   จาก admin.js ผ่าน renderStats(fish, fin)
// ============================================

const MONTH_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

// ── entry point ──────────────────────────────
export function renderStats(fishData, financeData) {
  renderStatsKPI(fishData, financeData);
  renderStatsStockChart(fishData);
  renderStatsPriceDist(fishData);
  renderStatsTopFish(fishData);
  renderStatsLevelDist(fishData);
  renderStatsMonthlyFinance(financeData);
}

// ── KPI cards ────────────────────────────────
function renderStatsKPI(fishData, financeData) {
  const el = document.getElementById('stats-kpi');
  if (!el) return;

  const total      = fishData.length;
  const inStock    = fishData.filter(f => !isCS(f) && f.stock > 0).length;
  const outStock   = fishData.filter(f => !isCS(f) && f.stock === 0).length;
  const comingSoon = fishData.filter(f => isCS(f)).length;
  const totalStock = fishData.reduce((s, f) => s + (f.stock || 0), 0);
  const priced     = fishData.filter(f => f.priceMin > 0);
  const avgPrice   = priced.length
    ? priced.reduce((s, f) => s + f.priceMin, 0) / priced.length
    : 0;

  const thisMonth = new Date().toLocaleDateString('en-CA').slice(0, 7);
  const monthFin  = financeData.filter(f => (f.date || '').startsWith(thisMonth));
  const income    = monthFin.filter(f => f.type === 'income').reduce((s, f) => s + f.amount, 0);
  const expense   = monthFin.filter(f => f.type === 'expense').reduce((s, f) => s + f.amount, 0);

  const cards = [
    { icon: 'ph-fish-simple',            color: 'var(--royal-blue)', label: 'ปลาทั้งหมด',     val: total,                                            sub: `Coming Soon: ${comingSoon}` },
    { icon: 'ph-check-circle',           color: '#059669',           label: 'มีในสต็อก',       val: inStock,                                          sub: `หมด: ${outStock} ชนิด` },
    { icon: 'ph-stack',                  color: '#2255cc',           label: 'จำนวนปลารวม',    val: `${totalStock} ตัว`,                              sub: 'ทุก species' },
    { icon: 'ph-currency-circle-dollar', color: '#7c3aed',           label: 'ราคาเฉลี่ย',     val: '฿' + Math.round(avgPrice).toLocaleString('th-TH'), sub: 'ราคาเริ่มต้น' },
    { icon: 'ph-trend-up',               color: '#059669',           label: 'รายรับเดือนนี้',  val: '฿' + income.toLocaleString('th-TH'),             sub: '' },
    { icon: 'ph-trend-down',             color: '#dc2626',           label: 'รายจ่ายเดือนนี้', val: '฿' + expense.toLocaleString('th-TH'),            sub: '' },
  ];

  el.innerHTML = cards.map(k => `
    <div class="stats-kpi-card">
      <div class="stats-kpi-icon" style="color:${k.color}"><i class="ph ${k.icon}"></i></div>
      <div class="stats-kpi-val">${k.val}</div>
      <div class="stats-kpi-label">${k.label}</div>
      ${k.sub ? `<div class="stats-kpi-sub">${k.sub}</div>` : ''}
    </div>`).join('');
}

// ── สต็อก bar chart ───────────────────────────
function renderStatsStockChart(fishData) {
  const el = document.getElementById('stats-stock-chart');
  if (!el) return;

  const items = [...fishData]
    .filter(f => !isCS(f))
    .sort((a, b) => (b.stock || 0) - (a.stock || 0))
    .slice(0, 10);

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

// ── Top ราคาแพง / ถูก ─────────────────────────
function renderStatsTopFish(fishData) {
  const el = document.getElementById('stats-top-fish');
  if (!el) return;

  const saleable = fishData.filter(f => f.priceMin > 0);
  if (!saleable.length) { el.innerHTML = statsEmpty('ไม่มีข้อมูลราคา'); return; }

  const topExpensive = [...saleable].sort((a, b) => (b.priceMax || b.priceMin) - (a.priceMax || a.priceMin)).slice(0, 5);
  const topCheap     = [...saleable].sort((a, b) => a.priceMin - b.priceMin).slice(0, 5);

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

// ── Monthly finance ───────────────────────────
function renderStatsMonthlyFinance(financeData) {
  const el = document.getElementById('stats-monthly-finance');
  if (!el) return;

  if (!financeData.length) { el.innerHTML = statsEmpty('ยังไม่มีข้อมูลการเงิน'); return; }

  const groups = {};
  financeData.forEach(f => {
    const m = (f.date || '').slice(0, 7);
    if (!m) return;
    if (!groups[m]) groups[m] = { income: 0, expense: 0 };
    groups[m][f.type === 'income' ? 'income' : 'expense'] += f.amount;
  });

  const sorted = Object.entries(groups)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 6);

  const maxVal = Math.max(...sorted.map(([, g]) => Math.max(g.income, g.expense)), 1);

  el.innerHTML = sorted.map(([m, g]) => {
    const [y, mo] = m.split('-');
    const label   = `${MONTH_SHORT[parseInt(mo) - 1]} ${(parseInt(y) + 543).toString().slice(-2)}`;
    const profit  = g.income - g.expense;
    const pColor  = profit >= 0 ? '#059669' : '#dc2626';
    const iW      = Math.round((g.income  / maxVal) * 100);
    const eW      = Math.round((g.expense / maxVal) * 100);
    return `
      <div class="stats-fin-row">
        <div class="stats-fin-month">${label}</div>
        <div class="stats-fin-bars">
          <div class="stats-fin-bar-wrap">
            <div class="stats-fin-bar" style="width:${iW}%;background:#059669;"></div>
            <span class="stats-fin-label inc">฿${g.income.toLocaleString('th-TH')}</span>
          </div>
          <div class="stats-fin-bar-wrap">
            <div class="stats-fin-bar" style="width:${eW}%;background:#dc2626;opacity:0.7;"></div>
            <span class="stats-fin-label exp">฿${g.expense.toLocaleString('th-TH')}</span>
          </div>
        </div>
        <div class="stats-fin-profit" style="color:${pColor}">${profit >= 0 ? '+' : ''}฿${profit.toLocaleString('th-TH')}</div>
      </div>`;
  }).join('');
}

// ── private helpers ───────────────────────────
function isCS(f)         { return f.priceMin === 0 && f.stock === 0; }
function statsEmpty(msg) { return `<div class="admin-empty-state"><div class="admin-empty-icon">📊</div><div class="admin-empty-text">${msg}</div></div>`; }