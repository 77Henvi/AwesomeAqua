import { supabase }                       from '../supabase.js';
import { showToast }                      from './shared/utils.js';
import { compressImage, previewNewImage,
         previewEditImage }               from './shared/image.js';
import { toggleTag, getSelectedTags,
         setSelectedTags }                from './shared/tags.js';
import { renderStats }                   from './modules/stats.js';
import { initAds }                       from './modules/ads.js';
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
window.clearForm        = clearForm;
window.toggleTag        = toggleTag;
window.toggleSyncTag    = toggleSyncTag; 
window.previewNewImage  = previewNewImage;
window.previewEditImage = previewEditImage;
window.handleComingSoon = handleComingSoon;
window.openSaleModal    = openSaleModal;
window.openSale         = openSale;

bindFinanceWindowFunctions(); // ผูก onFinMonthChange, setFinFilter, openFinanceModal ฯลฯ (ดู modules/finance.js)

// ── Expose ใหม่สำหรับ Quick Restock และ Calendar ──
window.openRestockModal = openRestockModal;
window.closeRestockModal = closeRestockModal;
window.calcRestockTotal = calcRestockTotal;
window.confirmRestock   = confirmRestock;

// ── UI helpers (called from inline onclick in HTML) ──
window.switchTab        = switchTab;
window.toggleAddPanel   = toggleAddPanel;
window.calcPricePreview = calcPricePreview;
window.setStockFilter   = setStockFilter;

// ── State ──
let fishData     = [];
let profitMap    = {}; // { fish_id: number } — sync มาจาก getProfitMap() ทุกครั้งที่โหลดการเงินใหม่
let _stockFilter = 'all';

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

async function adminLogout() {
  if (!confirm('ต้องการออกจากระบบ?')) return;
  await supabase.auth.signOut();
  document.getElementById('adminDashboard').style.display = 'none';
  document.getElementById('loginScreen').style.display    = 'flex';
}

function showDashboard() {
  document.getElementById('loginScreen').style.display    = 'none';
  document.getElementById('adminDashboard').style.display = 'block';
  _setDateHeaders();
  loadFishFromDB();
  refreshFinance(); 
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

  if (error) { showToast('<i class="ph-fill ph-x-circle" style="color:#ef4444; font-size:1.1em; vertical-align:-2px;"></i> โหลดข้อมูลไม่ได้'); return; }

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
    is_archived: f.is_archived || false
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
//   ADD FISH (ส่ง fish_id เข้า finance ด้วย - Spec 2)
// ════════════════════════════════════════════
async function addFish() {
  const name_th   = document.getElementById('newName_th').value.trim();
  const name_en   = document.getElementById('newName_en').value.trim();
  const species   = document.getElementById('newSpecies').value;
  const isCS      = document.getElementById('newIsComingSoon').checked;
  
  const priceMinRaw = document.getElementById('newPriceMin').value;
  const stockRaw    = document.getElementById('newStock').value;
  const costRaw     = document.getElementById('newCost')?.value;
  const rDate       = document.getElementById('receiveDate')?.value;

  if (!name_th || !rDate || costRaw === '' || (!isCS && (priceMinRaw === '' || stockRaw === ''))) {
    showToast('<i class="ph-fill ph-warning-circle" style="color:#f59e0b; font-size:1.1em; vertical-align:-2px;"></i> กรุณากรอกข้อมูลให้ครบถ้วน');
    return;
  }

  const priceMin = isCS ? 0 : parseInt(priceMinRaw);
  const priceMax = isCS ? 0 : (parseInt(document.getElementById('newPriceMax').value) || null);
  const stock    = isCS ? 0 : parseInt(stockRaw);
  const cost     = parseFloat(costRaw);
  const salePrice = parseFloat(document.getElementById('newSalePrice')?.value) || 0; 
  const level    = document.getElementById('newLevel').value;
  const desc_th  = document.getElementById('newDesc_th').value;
  const desc_en  = document.getElementById('newDesc_en').value;
  const sizeMin  = parseFloat(document.getElementById('newSizeMin').value) || null;
  const sizeMax  = parseFloat(document.getElementById('newSizeMax').value) || null;
  const file     = document.getElementById('newImageFile').files[0];

  let imageUrl = null;
  if (file) {
    imageUrl = await uploadImage(file);
    if (!imageUrl) return;
  }

  // ใช้ .select() เพื่อดึง ID ของปลาที่เพิ่งสร้างกลับมา
  const { data: newFishData, error: fishError } = await supabase.from('fish').insert({
    name_th:   name_th, 
    name_en:   name_en,
    desc_th:   desc_th,
    desc_en:   desc_en,
    tags_th:   getSelectedTags('newTags_th'),
    tags_en:   getSelectedTags('newTags_en'),
    species:   species || '-',
    price_min: priceMin, 
    price_max: priceMax,
    stock, 
    level, 
    image:     imageUrl,
    size_min:  sizeMin,
    size_max:  sizeMax,
    cost:      cost,
    sale_price: salePrice
  }).select();

  if (fishError || !newFishData) { 
    showToast('<i class="ph-fill ph-x-circle" style="color:#ef4444; font-size:1.1em; vertical-align:-2px;"></i> เพิ่มปลาไม่ได้'); 
    return; 
  }

  const newFish = newFishData[0];
  const totalAmount = cost * stock;
  
  if (totalAmount > 0) {
    const { error: financeError } = await supabase.from('finance').insert({
      type: 'expense', 
      name: `ซื้อปลา: ${name_th} x${stock} ตัว`, 
      amount: totalAmount, 
      date: rDate,
      fish_id: newFish.id // 👈 ใส่ fish_id
    });

    if (financeError) {
      showToast('<i class="ph-fill ph-warning-circle" style="color:#f59e0b; font-size:1.1em; vertical-align:-2px;"></i> เพิ่มปลาสำเร็จ แต่บันทึกรายจ่ายไม่สำเร็จ');
    } else {
      showToast('<i class="ph-fill ph-check-circle" style="color:#10b981; font-size:1.1em; vertical-align:-2px;"></i> เพิ่มปลาและบันทึกรายจ่ายเรียบร้อย');
    }
  } else {
    showToast('<i class="ph-fill ph-check-circle" style="color:#10b981; font-size:1.1em; vertical-align:-2px;"></i> เพิ่มปลาเรียบร้อย');
  }

  clearForm();
  toggleAddPanel(false); 
  loadFishFromDB();
  refreshFinance();
}

// ════════════════════════════════════════════
//   AUTO FINANCE & EVENT LISTENER
// ════════════════════════════════════════════
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

function updateAddFishTotal() {
  const c = parseFloat(document.getElementById('newCost')?.value) || 0;
  const s = parseInt(document.getElementById('newStock')?.value) || 0;
  const display = document.getElementById('totalFinanceDisplay');
  if (display) {
    display.value = (c * s).toLocaleString('th-TH') + ' บาท';
  }
}

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
async function saveEdit() {
  const id   = document.getElementById('editFishId').value;
  const file = document.getElementById('editImageFile').files[0];

  const oldData = fishData.find(f => f.id === id);

  let imageUrl = oldData?.image || null;
  if (file) {
    imageUrl = await uploadImage(file);
    if (!imageUrl) return;
  }

  const isCS = document.getElementById('editIsComingSoon').checked;
  const priceMin = isCS ? 0 : (parseInt(document.getElementById('editPriceMin').value) || 0);
  const priceMax = isCS ? 0 : (parseInt(document.getElementById('editPriceMax').value) || null);
  const stock    = isCS ? 0 : (parseInt(document.getElementById('editStock').value)    || 0);

  const elCost = document.getElementById('editCost');
  const elSale = document.getElementById('editSalePrice');
  const finalCost = elCost ? (parseFloat(elCost.value) || 0) : (oldData?.cost || 0);
  const finalSale = elSale ? (parseFloat(elSale.value) || 0) : (oldData?.sale_price || 0);

  const { error } = await supabase.from('fish').update({
    name_th:   document.getElementById('editName_th').value,
    name_en:   document.getElementById('editName_en').value,
    desc_th:   document.getElementById('editDesc_th').value,
    desc_en:   document.getElementById('editDesc_en').value,
    tags_th:   getSelectedTags('editTags_th'),
    tags_en:   getSelectedTags('editTags_en'),
    species:   document.getElementById('editSpecies').value,
    price_min: priceMin, 
    price_max: priceMax, 
    stock:     stock,    
    level:     document.getElementById('editLevel').value,
    image:     imageUrl,
    size_min:  parseFloat(document.getElementById('editSizeMin').value) || null,
    size_max:  parseFloat(document.getElementById('editSizeMax').value) || null,
    cost:      finalCost,
    sale_price: finalSale
  }).eq('id', id);

  if (error) { showToast('<i class="ph-fill ph-x-circle" style="color:#ef4444; font-size:1.1em; vertical-align:-2px;"></i> บันทึกไม่ได้'); return; }

  showToast('<i class="ph-fill ph-check-circle" style="color:#10b981; font-size:1.1em; vertical-align:-2px;"></i> บันทึกการแก้ไขเรียบร้อย');
  closeEditModal();
  loadFishFromDB();
}

// ════════════════════════════════════════════
//   UPLOAD IMAGE
// ════════════════════════════════════════════
async function uploadImage(file) {
  const filename   = `fish_${Date.now()}.jpg`;
  const compressed = await new Promise(resolve => compressImage(file, resolve));
  const res        = await fetch(compressed);
  const blob       = await res.blob();

  const { error } = await supabase.storage
    .from('fish-images')
    .upload(filename, blob, { contentType: 'image/jpeg', upsert: false });

  if (error) {
    console.error('Upload error:', error);
    showToast('<i class="ph-fill ph-x-circle" style="color:#ef4444; font-size:1.1em; vertical-align:-2px;"></i> อัปโหลดรูปไม่ได้: ' + error.message);
    return null;
  }

  const { data: urlData } = supabase.storage
    .from('fish-images')
    .getPublicUrl(filename);

  return urlData.publicUrl;
}

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
  const LOW_STOCK_THRESHOLD = 3; 
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
  if (!list.length) {
    const icon = q ? 'ph-magnifying-glass-minus' : _stockFilter === 'archived' ? 'ph-archive' : 'ph-fish-simple';
    const msg  = q ? 'ไม่พบปลาที่ค้นหา' : _stockFilter === 'archived' ? 'ยังไม่มีปลาที่เลิกขาย' : 'ยังไม่มีปลาครับ';
    tbody.innerHTML = `<tr><td colspan="8">${_empty(`<i class="ph ${icon}"></i>`, msg)}</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(f => {
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
          ${f.is_archived ? `
            <button class="action-btn" style="background:#2563eb;color:#fff;border:none;" onclick="restoreFish('${f.id}')"><i class="ph ph-arrow-counter-clockwise"></i> เปิดขายอีกครั้ง</button>
            <button class="action-btn action-delete" onclick="hardDeleteFish('${f.id}')" title="ลบถาวร"><i class="ph ph-trash"></i></button>
          ` : `
            <button class="action-btn" style="background:#059669;color:#fff;border:none;" onclick="openSale('${f.id}')"><i class="ph ph-shopping-cart-simple"></i> ขาย</button>
            <button class="action-btn action-edit"   onclick="openEditModal('${f.id}')"><i class="ph ph-pencil-simple"></i> แก้ไข</button>
            <button class="action-btn action-delete" onclick="archiveFish('${f.id}')"><i class="ph ph-archive"></i> เลิกขาย</button>
          `}
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

function openEditModal(id) {
  const f = fishData.find(x => x.id === id);
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
  if (preview) {
    preview.src = f.image || '';
    preview.style.display = f.image ? 'block' : 'none';
  }

  document.getElementById('editImageFile').value = '';

  setSelectedTags('editTags_th', f.tags_th || []);
  setSelectedTags('editTags_en', f.tags_en || []);
  
  document.getElementById('editModal').classList.add('open');
  const isCS = (f.priceMin === 0 && f.stock === 0);
  document.getElementById('editIsComingSoon').checked = isCS;
  handleComingSoon('edit');
}

function closeEditModal() {
  document.getElementById('editModal').classList.remove('open');
}

// ════════════════════════════════════════════
//   CLEAR FORM
// ════════════════════════════════════════════
function clearForm() {
  ['newName_th', 'newName_en', 'newSpecies', 'newPriceMin', 'newPriceMax', 'newStock', 'newSizeMin', 'newSizeMax', 'newDesc_th', 'newDesc_en', 'newCost', 'receiveDate', 'newSalePrice']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  document.getElementById('newImageFile').value = '';

  const display = document.getElementById('totalFinanceDisplay');
  if (display) display.value = '';

  const preview = document.getElementById('newImagePreview');
  if (preview) { preview.src = ''; preview.style.display = 'none'; }

  document.querySelectorAll('#newTags_th .tag-option, #newTags_en .tag-option').forEach(el => {
    el.classList.remove('active', 'selected');
  });

  const pp = document.getElementById('pricePreview');
  if (pp) { pp.textContent = '—'; pp.className = 'price-preview'; }

  document.getElementById('newIsComingSoon').checked = false;
  handleComingSoon('new');
}

// ════════════════════════════════════════════
//   TAG SYNC
// ════════════════════════════════════════════
function toggleSyncTag(element, mode) {
  const isSelecting = !element.classList.contains('selected');
  const idx = element.getAttribute('data-idx');
  
  const thSelector = document.getElementById(mode + 'Tags_th');
  const enSelector = document.getElementById(mode + 'Tags_en');
  
  const thTag = thSelector ? thSelector.querySelector(`[data-idx="${idx}"]`) : null;
  const enTag = enSelector ? enSelector.querySelector(`[data-idx="${idx}"]`) : null;
  
  if (isSelecting) {
    if (thTag) thTag.classList.add('selected');
    if (enTag) enTag.classList.add('selected');
  } else {
    if (thTag) thTag.classList.remove('selected');
    if (enTag) enTag.classList.remove('selected');
  }
}

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
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
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

function handleComingSoon(prefix) {
  const isCS  = document.getElementById(prefix + 'IsComingSoon').checked;
  const pMin  = document.getElementById(prefix + 'PriceMin');
  const pMax  = document.getElementById(prefix + 'PriceMax');
  const stock = document.getElementById(prefix + 'Stock');

  if (isCS) {
    pMin.value = 0; pMin.disabled = true;
    pMax.value = ''; pMax.disabled = true;
    stock.value = 0; stock.disabled = true;
  } else {
    pMin.disabled = false;
    pMax.disabled = false;
    stock.disabled = false;
  }
  
  if (prefix === 'new') calcPricePreview();
  if (prefix === 'new') updateAddFishTotal(); 
}

// ════════════════════════════════════════════
//   INIT
// ════════════════════════════════════════════
(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    showDashboard(); 
  } else {
    hideLoader();
    document.getElementById('loginScreen').style.display = 'flex';
  }
})();