import { supabase }                       from '../supabase.js';
import { showToast, paginate, renderPager } from './shared/utils.js';
import { LOW_STOCK_THRESHOLD }            from './shared/calc.js';
import { previewNewImage, previewEditImage } from './shared/image.js';
import { toggleTag }                      from './shared/tags.js';
import { renderStats }                   from './modules/stats.js';
import { initAds }                       from './modules/ads.js';
import { renderAdminUsers, addAdminUser, removeAdminUser } from './modules/adminUsers.js';
import { loadOrders, setOrderStatusFilter, updateOrderStatus, askCancelReason, closeLostReasonModal, confirmCancelWithReason } from './modules/orders.js';
import { loadCustomers, setCustomerSegmentFilter, openCustomerModal, closeCustomerModal, saveCustomer } from './modules/customers.js';
import { calcPricePreview, profitCell }  from './modules/profit.js';
import { openSaleModal }                 from './modules/sale.js';
import { loadFinanceFromDB, getFinanceData, getProfitMap,
         renderTodayFinance, renderFinancePage, onFinMonthChange, setFinFilter,
         openFinanceModal, closeFinanceModal, saveFinanceModal,
         showDayBreakdown, addFinance, deleteFinance,
         bindFinanceWindowFunctions }     from './modules/finance.js';
import { archiveFish as _archiveFish, restoreFish as _restoreFish,
         hardDeleteFish as _hardDeleteFish }  from './modules/fishArchive.js';
import { openRestockModal as _openRestockModal, closeRestockModal,
         calcRestockTotal, confirmRestock as _confirmRestock } from './modules/restock.js';
import { addFish as _addFish, updateAddFishTotal, clearForm, handleComingSoon,
         openEditModal as _openEditModal, closeEditModal,
         saveEdit as _saveEdit, toggleSyncTag,
         viewPriceHistory, closePriceHistoryModal } from './modules/fishForm.js';
import { loadTodos, bindTodoWindowFunctions } from './modules/todo.js';
import { openFishStatsModal as _openFishStatsModal, closeFishStatsModal } from './modules/fishStats.js';

// ── Expose ไว้บน window ──
window.hideLoader = function() {
  const loader = document.getElementById('global-loader');
  if (loader) loader.classList.add('hidden');
};

setTimeout(() => {
    hideLoader();
  }, 3000);

window.adminLogin       = adminLogin;
window.adminLogout      = adminLogout;
window.addFish          = addFish;
window.archiveFish      = archiveFish;
window.restoreFish      = restoreFish;
window.hardDeleteFish   = hardDeleteFish;
window.saveEdit         = saveEdit;
window.openEditModal    = openEditModal;
window.closeEditModal   = closeEditModal;
window.viewPriceHistory       = viewPriceHistory;
window.closePriceHistoryModal = closePriceHistoryModal;
window.clearForm        = clearForm;
window.toggleTag        = toggleTag;
window.toggleSyncTag    = toggleSyncTag; 
window.previewNewImage  = previewNewImage;
window.previewEditImage = previewEditImage;
window.handleComingSoon = handleComingSoon;
window.openSaleModal    = openSaleModal;
window.openSale         = openSale;
window.openFishStatsModal  = openFishStatsModal;
window.closeFishStatsModal = closeFishStatsModal;

bindFinanceWindowFunctions(); // ผูก onFinMonthChange, setFinFilter, openFinanceModal ฯลฯ (ดู modules/finance.js)
bindTodoWindowFunctions();    // ผูก openTodoModal, addTodo, toggleTodo ฯลฯ (ดู modules/todo.js)

// ── Expose ใหม่สำหรับ Quick Restock และ Calendar ──
window.openRestockModal = openRestockModal;
window.closeRestockModal = closeRestockModal;
window.calcRestockTotal = calcRestockTotal;
window.confirmRestock   = confirmRestock;

// ── UI helpers (called from inline onclick in HTML) ──
window.switchTab        = switchTab;
window.setOrderStatusFilter = setOrderStatusFilter;
window.updateOrderStatus    = updateOrderStatus;
window.askCancelReason        = askCancelReason;
window.closeLostReasonModal   = closeLostReasonModal;
window.confirmCancelWithReason = confirmCancelWithReason;
window.setCustomerSegmentFilter = setCustomerSegmentFilter;
window.openCustomerModal        = openCustomerModal;
window.closeCustomerModal       = closeCustomerModal;
window.saveCustomer             = saveCustomer;
window.addAdminUser     = addAdminUser;
window.removeAdminUser  = removeAdminUser;
window.renderFishTable  = renderFishTable; // แก้บั๊กเดิม: ช่องค้นหาปลา (oninput) เรียกฟังก์ชันนี้แต่ไม่เคยถูก bind ไว้เลย
window.toggleAddPanel   = toggleAddPanel;
window.calcPricePreview = calcPricePreview;
window.setStockFilter   = setStockFilter;
window.onFishPageChange   = onFishPageChange;
window.onFishSearchInput  = onFishSearchInput;

// ── State ──
let fishData     = [];
let profitMap    = {}; // { fish_id: number } — sync มาจาก getProfitMap() ทุกครั้งที่โหลดการเงินใหม่
let _stockFilter = 'all';
let _fishPage     = 1;
const FISH_PAGE_SIZE = 15;

// ════════════════════════════════════════════
//   AUTH
// ════════════════════════════════════════════
async function adminLogin() {
  const email    = document.getElementById('adminEmailInput').value;
  const password = document.getElementById('adminPassInput').value;
  const err      = document.getElementById('adminError');

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    err.innerHTML  = '<i class="ph-fill ph-x-circle" style="color:#ef4444; font-size:1.1em; vertical-align:-2px;"></i> ' + error.message;
    err.style.display = 'block';
    return;
  }

  err.style.display = 'none';
  showDashboard();
}

async function adminLogout(skipConfirm = false) {
  if (!skipConfirm && !confirm('ต้องการออกจากระบบ?')) return;

  // ไม่ใช้ try/catch เฉยๆ เพราะถ้า session เสีย/หมดอายุอยู่แล้ว signOut() อาจ throw
  // ตอนพยายามคุยกับ server เพื่อ revoke token — ต้องสลับกลับหน้า login เสมอไม่ว่าจะสำเร็จหรือไม่
  try {
    await supabase.auth.signOut();
  } catch (e) {
    console.warn('signOut ล้มเหลว (session อาจเสีย/หมดอายุอยู่แล้ว) — เคลียร์ต่อฝั่ง client แทน', e);
  } finally {
    // กันไว้อีกชั้น เผื่อ signOut() ไม่ throw แต่ก็ไม่เคลียร์ token ออกจาก localStorage จริงๆ
    // (เช่น เน็ตหลุดระหว่าง revoke) — ลบ key ของ supabase auth ทิ้งเองด้วยเลย
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
        .forEach(k => localStorage.removeItem(k));
    } catch (e) { /* localStorage เข้าไม่ได้ก็ไม่เป็นไร ข้ามไป */ }

    document.body.classList.remove('logged-in');
  }
}

function showDashboard() {
  document.body.classList.add('logged-in');
  _setDateHeaders();
  loadFishFromDB();
  refreshFinance();
  loadTodos();
}

// ════════════════════════════════════════════
//   LOAD DATA & PROFIT CALCULATION
//   (logic จริงอยู่ที่ scripts/modules/finance.js)
// ════════════════════════════════════════════
function refreshFinance() {
  return loadFinanceFromDB(() => {
    profitMap = getProfitMap(); // sync ให้ renderFishTable() อ่านค่าล่าสุดได้
    if (fishData.length > 0) renderFishTable(); // รีเรนเดอร์ตารางปลาเพื่ออัปเดตกำไรสะสม
  });
}

async function loadFishFromDB() {
  const { data, error } = await supabase
    .from('fish')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    // 401/PGRST301 = token หมดอายุ/ใช้ไม่ได้แล้ว (เจอบ่อยตอนเปิดค้างไว้นาน) — เด้งกลับไปหน้า login
    // ให้เอง แทนที่จะปล่อยให้ค้างอยู่ที่หน้า dashboard ที่โหลดข้อมูลไม่ได้ตลอดไป
    if (error.code === '401' || error.status === 401 || /jwt|401/i.test(error.message || '')) {
      showToast('<i class="ph-fill ph-warning-circle" style="color:#f59e0b;"></i> เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
      await adminLogout(true); // true = ข้าม confirm() เพราะไม่ใช่การกดออกเองของผู้ใช้
      return;
    }
    showToast('<i class="ph-fill ph-x-circle" style="color:#ef4444; font-size:1.1em; vertical-align:-2px;"></i> โหลดข้อมูลไม่ได้');
    return;
  }

  fishData = data.map(f => ({
    id:       f.id,
    name:     f.name_th,    
    name_th:  f.name_th,
    name_en:  f.name_en,
    species:  f.species,
    image:    f.image,
    priceMin: f.price_min,
    priceMax: f.price_max,
    cost:     f.cost || 0,
    sale_price: f.sale_price || 0,
    stock:    f.stock,
    level:    f.level,
    desc_th:  f.desc_th,
    desc_en:  f.desc_en,
    tags_th:  f.tags_th || [],
    tags_en:  f.tags_en || [],
    sizeMin:  f.size_min || null,
    sizeMax:  f.size_max || null,
    is_archived: f.is_archived || false,
    createdAt: f.created_at || null,
    color:            f.color || null,
    body_shape:       f.body_shape || null,
    feeding_behavior: f.feeding_behavior || null,
    is_premium:       f.is_premium || false,
    premium_factors:  f.premium_factors || null
  }));

  renderAll();

  setTimeout(() => { hideLoader(); }, 300);
}

function renderAll() {
  renderAdminStats();
  renderFishTable();
  renderFinancePage();
  renderDashboardCards();
}

// ════════════════════════════════════════════
//   ADD FISH (logic จริงอยู่ที่ scripts/modules/fishForm.js)
// ════════════════════════════════════════════
function addFish() {
  return _addFish(() => { toggleAddPanel(false); loadFishFromDB(); refreshFinance(); });
}

document.addEventListener('DOMContentLoaded', () => {
  const newCostInput = document.getElementById('newCost');
  const newStockInput = document.getElementById('newStock');
  const submitBtn = document.getElementById('submitAddFishBtn');

  // คำนวณยอดเงินอัตโนมัติเวลาพิมพ์
  if (newCostInput) newCostInput.addEventListener('input', updateAddFishTotal);
  if (newStockInput) newStockInput.addEventListener('input', updateAddFishTotal);
  
  // ผูกปุ่มเพิ่มปลา
  if (submitBtn) submitBtn.addEventListener('click', addFish);
});

// ════════════════════════════════════════════
//   QUICK RESTOCK (Spec 1)
// ════════════════════════════════════════════
// ════════════════════════════════════════════
//   เติมสต็อก (logic จริงอยู่ที่ scripts/modules/restock.js)
// ════════════════════════════════════════════
function openRestockModal(id) { return _openRestockModal(id, fishData); }
function confirmRestock()     { return _confirmRestock(fishData, () => { loadFishFromDB(); refreshFinance(); }); }

// ════════════════════════════════════════════
//   เลิกขาย / เปิดขายอีกครั้ง / ลบถาวร
//   (logic จริงอยู่ที่ scripts/modules/fishArchive.js)
// ════════════════════════════════════════════
function archiveFish(id)    { return _archiveFish(id, loadFishFromDB); }
function restoreFish(id)    { return _restoreFish(id, loadFishFromDB); }
function hardDeleteFish(id) { return _hardDeleteFish(id, () => { loadFishFromDB(); refreshFinance(); }); }

// ════════════════════════════════════════════
//   SAVE EDIT
// ════════════════════════════════════════════
// ════════════════════════════════════════════
//   SAVE EDIT (logic จริงอยู่ที่ scripts/modules/fishForm.js)
// ════════════════════════════════════════════
function saveEdit() { return _saveEdit(fishData, () => { loadFishFromDB(); refreshFinance(); }); }

// ════════════════════════════════════════════
//   STATS
// ════════════════════════════════════════════
function renderAdminStats() {
  const active   = fishData.filter(f => !f.is_archived);
  const total    = active.length;
  const inStock  = active.filter(f => f.stock > 0).length;
  const lowStock = active.filter(f => f.stock > 0 && f.stock <= 5).length;
  const outStock = active.filter(f => f.stock === 0).length;

  document.getElementById('adminStats').innerHTML = `
    <div class="admin-stat-card stat-card-total">
      <div class="admin-stat-icon"><i class="ph ph-fish-simple"></i></div>
      <div><div class="admin-stat-num">${total}</div><div class="admin-stat-label">ชนิดปลาทั้งหมด</div></div>
    </div>
    <div class="admin-stat-card stat-card-ok">
      <div class="admin-stat-icon"><i class="ph ph-check-circle"></i></div>
      <div><div class="admin-stat-num">${inStock}</div><div class="admin-stat-label">มีในสต็อก</div></div>
    </div>
    <div class="admin-stat-card stat-card-low">
      <div class="admin-stat-icon"><i class="ph ph-warning-circle"></i></div>
      <div><div class="admin-stat-num">${lowStock}</div><div class="admin-stat-label">สต็อกเหลือน้อย</div></div>
    </div>
    <div class="admin-stat-card stat-card-out">
      <div class="admin-stat-icon"><i class="ph ph-x-circle"></i></div>
      <div><div class="admin-stat-num">${outStock}</div><div class="admin-stat-label">หมดสต็อก</div></div>
    </div>
  `;
}

// ════════════════════════════════════════════
//   DASHBOARD CARDS (low stock + recent - Spec 1)
// ════════════════════════════════════════════
function renderDashboardCards() {
  const lowEl    = document.getElementById('dash-lowstock');
  const lowItems = fishData.filter(f => !f.is_archived && f.stock <= LOW_STOCK_THRESHOLD && f.priceMin > 0);

  if (!lowItems.length) {
    lowEl.innerHTML = _empty('<i class="ph ph-confetti"></i>', 'สต็อกครบทุกรายการ');
  } else {
    lowEl.innerHTML = lowItems.slice(0, 5).map(f => {
      const cls  = f.stock === 0 ? 'out' : 'low';
      const text = f.stock === 0 ? 'หมด' : `${f.stock} ตัว`;
      return `
        <div class="dash-mini-row" style="align-items:center;">
          <div style="flex:1;">
            <div class="dash-mini-name"><i class="ph ph-fish-simple" style="color:var(--royal-blue);margin-right:4px;"></i>${f.name}</div>
            <div class="dash-mini-sub">${f.species || '—'}</div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="admin-stock-badge ${cls}">${text}</span>
            <button class="btn-restock-tiny" onclick="openRestockModal('${f.id}')">+ เติม</button>
          </div>
        </div>`;
    }).join('');
  }

  const recEl = document.getElementById('dash-recent');
  const recentActive = fishData.filter(f => !f.is_archived);
  if (!recentActive.length) {
    recEl.innerHTML = _empty('<i class="ph ph-fish-simple"></i>', 'ยังไม่มีปลา');
  } else {
    recEl.innerHTML = recentActive.slice(0, 5).map(f => `
      <div class="dash-mini-row">
        <div>
          <div class="dash-mini-name"><i class="ph ph-fish-simple" style="color:var(--royal-blue);margin-right:4px;"></i>${f.name}</div>
          <div class="dash-mini-sub">${f.species || '—'}</div>
        </div>
        <span style="font-size:0.82rem;font-weight:600;color:var(--royal-blue);font-family:var(--font-number);">
          ฿${(f.priceMin || 0).toLocaleString('th-TH')}
        </span>
      </div>`).join('');
  }
}

// ════════════════════════════════════════════
//   FISH TABLE (คอลัมน์กำไรสะสม - Spec 2)
// ════════════════════════════════════════════
function renderFishTable() {
  _ensureProfitHeader();
  _ensureAccProfitHeader();

  const q    = (document.getElementById('fishSearch')?.value || '').toLowerCase();
  const list = fishData.filter(f => {
    const match = (f.name + ' ' + (f.species || '')).toLowerCase().includes(q);
    if (_stockFilter === 'archived') return match && f.is_archived;
    if (f.is_archived) return false; // ปลาที่เลิกขายแล้วไม่ต้องแสดงในแท็บอื่น
    if (_stockFilter === 'ok')  return match && f.stock > 5;
    if (_stockFilter === 'low') return match && f.stock > 0 && f.stock <= 5;
    if (_stockFilter === 'out') return match && f.stock === 0;
    return match;
  });

  const countEl = document.getElementById('fishCount');
  if (countEl) countEl.textContent = list.length + ' รายการ';

  const tbody = document.getElementById('fishTableBody');
  const pagerEl = document.getElementById('fishTablePager');
  if (!list.length) {
    const icon = q ? 'ph-magnifying-glass-minus' : _stockFilter === 'archived' ? 'ph-archive' : 'ph-fish-simple';
    const msg  = q ? 'ไม่พบปลาที่ค้นหา' : _stockFilter === 'archived' ? 'ยังไม่มีปลาที่เลิกขาย' : 'ยังไม่มีปลาครับ';
    tbody.innerHTML = `<tr><td colspan="8">${_empty(`<i class="ph ${icon}"></i>`, msg)}</td></tr>`;
    if (pagerEl) pagerEl.innerHTML = '';
    return;
  }

  const { items: pageList, page, totalPages, total } = paginate(list, _fishPage, FISH_PAGE_SIZE);
  _fishPage = page; // clamp กลับถ้าหน้าเดิมเกินขอบเขต (เช่น ลบปลาจนหน้าสุดท้ายว่าง)
  renderPager(pagerEl, { page, totalPages, total }, 'onFishPageChange', FISH_PAGE_SIZE);

  tbody.innerHTML = pageList.map(f => {
    const sc   = f.stock === 0 ? 'out' : f.stock <= 5 ? 'low' : 'ok';
    const st = f.stock === 0 ? '<i class="ph ph-x-circle"></i> หมด' : f.stock <= 5 ? `<i class="ph ph-warning-circle"></i> ${f.stock} ตัว` : `<i class="ph ph-check-circle"></i> ${f.stock} ตัว`;
    const lvMap = { 'มือใหม่': 'easy', 'ปานกลาง': 'medium', 'ผู้เชี่ยวชาญ': 'hard' };
    const lvCls = lvMap[f.level] || '';
    
    const imgCell = f.image
      ? `<img src="${f.image}" loading="lazy" style="width:44px;height:44px;object-fit:cover;border-radius:8px;">`
      : `<div style="width:44px;height:44px;background:#f1f5f9;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:1.5rem;"><i class="ph ph-image"></i></div>`;

    // คำนวณการแสดงผลกำไรสะสม
    let accProfHTML = '—';
    if (profitMap[f.id] !== undefined) {
      const p = profitMap[f.id];
      const cls = p > 0 ? 'color:#10b981' : p < 0 ? 'color:#ef4444' : 'color:#64748b';
      accProfHTML = `<span style="font-family:var(--font-number);font-weight:700;${cls}">${p > 0 ? '+' : ''}฿${p.toLocaleString('th-TH')}</span>`;
    }

    return `
      <tr>
        <td>${imgCell}</td>
        <td>
        <strong>${f.name}</strong>
        <br><small style="color:var(--gray)">${f.species || '—'}</small>
        ${f.sizeMin || f.sizeMax ? `<br><small style="color:var(--bright-blue)">📏 ${f.sizeMin || '?'}${f.sizeMax && f.sizeMax !== f.sizeMin ? '–' + f.sizeMax : ''} นิ้ว</small>` : ''}
      </td>
        <td style="font-family:var(--font-number);font-weight:600;color:var(--royal-blue);">
          ฿${(f.priceMin || 0).toLocaleString('th-TH')}${f.priceMax ? ' – ฿' + f.priceMax.toLocaleString('th-TH') : ''}
        </td>
        <td style="font-family:var(--font-number);font-weight:600;">
          ${profitCell(f)}
        </td>
        <td>${accProfHTML}</td>
        <td><span class="admin-stock-badge ${sc}">${st}</span></td>
        <td><span class="admin-level-badge ${lvCls}">${f.level}</span></td>
        <td>
          <div class="row-actions">
            <button class="action-btn" style="background:#7c3aed;color:#fff;border:none;" onclick="openFishStatsModal('${f.id}')" title="ดูสถิติกำไร/ต้นทุนรายเดือน"><i class="ph ph-chart-line-up"></i> <span class="action-btn-label">สถิติ</span></button>
            ${f.is_archived ? `
              <button class="action-btn" style="background:#2563eb;color:#fff;border:none;" onclick="restoreFish('${f.id}')"><i class="ph ph-arrow-counter-clockwise"></i> <span class="action-btn-label">เปิดขายอีกครั้ง</span></button>
              <button class="action-btn action-delete" onclick="hardDeleteFish('${f.id}')" title="ลบถาวร"><i class="ph ph-trash"></i></button>
            ` : `
              <button class="action-btn" style="background:#059669;color:#fff;border:none;" onclick="openSale('${f.id}')"><i class="ph ph-shopping-cart-simple"></i> <span class="action-btn-label">ขาย</span></button>
              <button class="action-btn action-edit"   onclick="openEditModal('${f.id}')"><i class="ph ph-pencil-simple"></i> <span class="action-btn-label">แก้ไข</span></button>
              <button class="action-btn action-delete" onclick="archiveFish('${f.id}')"><i class="ph ph-archive"></i> <span class="action-btn-label">เลิกขาย</span></button>
            `}
          </div>
        </td>
      </tr>`;
  }).join('');
}

function _ensureAccProfitHeader() {
  const thead = document.querySelector('#fishTableBody')?.closest('table')?.querySelector('thead tr');
  if (!thead || thead.querySelector('.th-acc-profit')) return;
  const profitTh = thead.querySelector('.th-profit');
  if (profitTh) {
    const th = document.createElement('th');
    th.className = 'th-acc-profit';
    th.textContent = 'กำไรสะสม';
    profitTh.after(th);
  }
}

function _ensureProfitHeader() {
  const thead = document.querySelector('#fishTableBody')?.closest('table')?.querySelector('thead tr');
  if (!thead) return;
  if (thead.querySelector('.th-profit')) return;

  const ths = thead.querySelectorAll('th');
  const priceTh = ths[2];
  const th = document.createElement('th');
  th.className = 'th-profit';
  th.textContent = 'กำไร';
  if (priceTh && priceTh.nextSibling) {
    thead.insertBefore(th, priceTh.nextSibling);
  } else {
    thead.appendChild(th);
  }
}

function openSale(id) {
  const f = fishData.find(x => x.id === id);
  if (!f) return;
  openSaleModal(f, () => {
    loadFishFromDB();
    refreshFinance();
  });
}

// ════════════════════════════════════════════
//   สถิติรายตัว (กราฟกำไร/ต้นทุนรายเดือน — logic จริงอยู่ที่ modules/fishStats.js)
// ════════════════════════════════════════════
function openFishStatsModal(id) {
  _openFishStatsModal(id, fishData, getFinanceData());
}

// ════════════════════════════════════════════
//   EDIT MODAL (logic จริงอยู่ที่ scripts/modules/fishForm.js)
// ════════════════════════════════════════════
function openEditModal(id) { return _openEditModal(id, fishData); }


// ════════════════════════════════════════════
//   UI HELPERS
// ════════════════════════════════════════════
function switchTab(tab) {
  document.querySelectorAll('.admin-page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.admin-nav-tab, .bnav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + tab)?.classList.add('active');
  document.getElementById('nav-'  + tab)?.classList.add('active');
  document.getElementById('bnav-' + tab)?.classList.add('active');
  if (tab === 'finance') renderFinancePage();
  if (tab === 'stats')   renderStats(fishData, getFinanceData());
  if (tab === 'ads')     initAds();
  if (tab === 'admins')  renderAdminUsers();
  if (tab === 'orders')  loadOrders();
  if (tab === 'customers') loadCustomers();
}

function toggleAddPanel(forceOpen) {
  const body   = document.getElementById('addPanelBody');
  const toggle = document.getElementById('addPanelToggle');
  const open   = forceOpen !== undefined ? forceOpen : !body.classList.contains('open');
  body.classList.toggle('open', open);
  toggle.classList.toggle('open', open);
}

function setStockFilter(f, el) {
  _stockFilter = f;
  _fishPage = 1;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderFishTable();
}

// ── เปลี่ยนหน้าตารางปลา (เรียกจากปุ่มใน table-pager) ──
function onFishPageChange(page) {
  _fishPage = page;
  renderFishTable();
}

// ── ค้นหาปลา: reset กลับหน้า 1 ทุกครั้งที่พิมพ์ค้นหาใหม่ ──
function onFishSearchInput() {
  _fishPage = 1;
  renderFishTable();
}

function _setDateHeaders() {
  const str = new Date().toLocaleDateString('th-TH', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  const hd = document.getElementById('headerDate');
  const tl = document.getElementById('todayLabel');
  if (hd) hd.textContent = str;
  if (tl) tl.textContent = str;
}

function _empty(icon, text) {
  return `<div class="admin-empty-state"><div class="admin-empty-icon">${icon}</div><div class="admin-empty-text">${text}</div></div>`;
}

// ════════════════════════════════════════════
//   INIT
// ════════════════════════════════════════════
(async () => {
  // สำคัญ: ต้องเริ่มจาก "ไม่ login" เสมอก่อนเช็ค session จริง — กันเคส CSS/media query
  // ไปบังคับโชว์ .admin-dashboard ทับหน้า login ไว้ (ดู body.logged-in ใน admin.css)
  document.body.classList.remove('logged-in');

  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    showDashboard();
  } else {
    hideLoader();
  }
})();