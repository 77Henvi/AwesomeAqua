// ============================================
//   ENTRY POINT — admin.html
// ============================================

import { supabase }                       from '../supabase.js';
import { showToast }                      from './shared/utils.js';
import { compressImage, previewNewImage,
         previewEditImage }               from './shared/image.js';
import { toggleTag, getSelectedTags,
         setSelectedTags }                from './shared/tags.js';
import { renderStats }                   from './modules/stats.js';
import { calcPricePreview, profitCell }  from './modules/profit.js';

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
window.deleteFish       = deleteFish;
window.saveEdit         = saveEdit;
window.openEditModal    = openEditModal;
window.closeEditModal   = closeEditModal;
window.clearForm        = clearForm;
window.toggleTag        = toggleTag;
window.previewNewImage  = previewNewImage;
window.previewEditImage = previewEditImage;
window.handleComingSoon = handleComingSoon;
window.onFinMonthChange  = onFinMonthChange;
window.setFinFilter      = setFinFilter;
window.openFinanceModal  = openFinanceModal;
window.closeFinanceModal = closeFinanceModal;
window.saveFinanceModal  = saveFinanceModal;

// ── UI helpers (called from inline onclick in HTML) ──
window.switchTab        = switchTab;
window.toggleAddPanel   = toggleAddPanel;
window.calcPricePreview = calcPricePreview;
window.setStockFilter   = setStockFilter;
window.addFinance = addFinance;
window.deleteFinance = deleteFinance;

// ── State ──
let fishData     = [];
let financeData = [];
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
    err.textContent  = '❌ ' + error.message;
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
  loadFinanceFromDB(); 
}
// ════════════════════════════════════════════
//   LOAD
// ════════════════════════════════════════════
async function loadFishFromDB() {
  const { data, error } = await supabase
    .from('fish')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { showToast('❌ โหลดข้อมูลไม่ได้'); return; }

  fishData = data.map(f => ({
    id:       f.id,
    name:     f.name,
    species:  f.species,
    emoji:    f.emoji,
    image:    f.image,
    priceMin: f.price_min,
    priceMax: f.price_max,
    cost:     f.cost || 0,
    stock:    f.stock,
    level:    f.level,
    desc:     f.desc,
    tags:     f.tags || [],
    sizeMin:  f.size_min || null,
    sizeMax:  f.size_max || null
  }));

  renderAll();

  setTimeout(() => { hideLoader(); }, 300);
}

// ════════════════════════════════════════════
//   RENDER ALL
// ════════════════════════════════════════════
function renderAll() {
  renderAdminStats();
  renderFishTable();
  renderFinancePage();
  renderDashboardCards();
}

// ════════════════════════════════════════════
//   ADD
// ════════════════════════════════════════════
async function addFish() {
  const name     = document.getElementById('newName').value.trim();
  const emoji    = document.getElementById('newEmoji').value    || '🐟';
  const species  = document.getElementById('newSpecies').value;
  const isCS = document.getElementById('newIsComingSoon').checked;
  const priceMin = isCS ? 0 : (parseInt(document.getElementById('newPriceMin').value) || 0);
  const priceMax = isCS ? 0 : (parseInt(document.getElementById('newPriceMax').value) || 0);
  const stock    = isCS ? 0 : (parseInt(document.getElementById('newStock').value)    || 0);
  const level    = document.getElementById('newLevel').value;
  const desc     = document.getElementById('newDesc').value;
  const sizeMin  = parseFloat(document.getElementById('newSizeMin').value) || null;
  const sizeMax  = parseFloat(document.getElementById('newSizeMax').value) || null;
  const cost     = parseFloat(document.getElementById('newCost').value) || 0;
  const file     = document.getElementById('newImageFile').files[0];

  if (!name) { showToast('⚠️ กรุณากรอกชื่อปลา'); return; }

  let imageUrl = null;
  if (file) {
    imageUrl = await uploadImage(file);
    if (!imageUrl) return;
  }

  const { error } = await supabase.from('fish').insert({
    name, emoji, species: species || '-',
    price_min: priceMin, price_max: priceMax,
    stock, level, desc,
    tags: getSelectedTags('newTags'),
    image: imageUrl,
    size_min: sizeMin,
    size_max: sizeMax,
    cost: cost
  });
  if (error) { showToast('❌ เพิ่มปลาไม่ได้: ' + error.message); return; }

  showToast('✅ เพิ่มปลา ' + name + ' เรียบร้อย!');
  clearForm();
  toggleAddPanel(false); // ปิด panel
  loadFishFromDB();
}

// ════════════════════════════════════════════
//   DELETE
// ════════════════════════════════════════════
async function deleteFish(id) {
  if (!confirm('ยืนยันลบปลานี้?')) return;

  const { error } = await supabase.from('fish').delete().eq('id', id);

  if (error) { showToast('❌ ลบไม่ได้'); return; }

  showToast('🗑️ ลบปลาเรียบร้อย');
  loadFishFromDB();
}

// ════════════════════════════════════════════
//   SAVE EDIT
// ════════════════════════════════════════════
async function saveEdit() {
  const id   = document.getElementById('editFishId').value;
  const file = document.getElementById('editImageFile').files[0];

  let imageUrl = fishData.find(f => f.id === id)?.image || null;
  if (file) {
    imageUrl = await uploadImage(file);
    if (!imageUrl) return;
  }


  const isCS = document.getElementById('editIsComingSoon').checked;
  const priceMin = isCS ? 0 : (parseInt(document.getElementById('editPriceMin').value) || 0);
  const priceMax = isCS ? 0 : (parseInt(document.getElementById('editPriceMax').value) || 0);
  const stock    = isCS ? 0 : (parseInt(document.getElementById('editStock').value)    || 0);

  const { error } = await supabase.from('fish').update({
    name:      document.getElementById('editName').value,
    species:   document.getElementById('editSpecies').value,
    price_min: priceMin, 
    price_max: priceMax, 
    stock:     stock,    
    level:     document.getElementById('editLevel').value,
    desc:      document.getElementById('editDesc').value,
    tags:      getSelectedTags('editTags'),
    image:     imageUrl,
    size_min:  parseFloat(document.getElementById('editSizeMin').value) || null,
    size_max:  parseFloat(document.getElementById('editSizeMax').value) || null,
    cost:      parseFloat(document.getElementById('editCost').value) || 0
  }).eq('id', id);

  if (error) { showToast('❌ บันทึกไม่ได้'); return; }

  showToast('✅ บันทึกเรียบร้อย');
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
    showToast('❌ อัปโหลดรูปไม่ได้: ' + error.message);
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
  const total    = fishData.length;
  const inStock  = fishData.filter(f => f.stock > 0).length;
  const lowStock = fishData.filter(f => f.stock > 0 && f.stock <= 5).length;
  const outStock = fishData.filter(f => f.stock === 0).length;

  document.getElementById('adminStats').innerHTML = `
    <div class="admin-stat-card">
      <div class="admin-stat-icon" style="color: var(--royal-blue);"><i class="ph ph-fish-simple"></i></div>
      <div><div class="admin-stat-num">${total}</div><div class="admin-stat-label">ชนิดปลาทั้งหมด</div></div>
    </div>
    <div class="admin-stat-card">
      <div class="admin-stat-icon" style="color: #059669;"><i class="ph ph-check-circle"></i></div>
      <div><div class="admin-stat-num">${inStock}</div><div class="admin-stat-label">มีในสต็อก</div></div>
    </div>
    <div class="admin-stat-card">
      <div class="admin-stat-icon" style="color: #d97706;"><i class="ph ph-warning-circle"></i></div>
      <div><div class="admin-stat-num">${lowStock}</div><div class="admin-stat-label">สต็อกเหลือน้อย</div></div>
    </div>
    <div class="admin-stat-card">
      <div class="admin-stat-icon" style="color: #dc2626;"><i class="ph ph-x-circle"></i></div>
      <div><div class="admin-stat-num">${outStock}</div><div class="admin-stat-label">หมดสต็อก</div></div>
    </div>
  `;
}

// ════════════════════════════════════════════
//   DASHBOARD CARDS (low stock + recent)
// ════════════════════════════════════════════
function renderDashboardCards() {
  // Low stock
  const lowEl    = document.getElementById('dash-lowstock');
  const lowItems = fishData.filter(f => f.stock <= 5);

  if (!lowItems.length) {
    lowEl.innerHTML = _empty('<i class="ph ph-confetti"></i>', 'สต็อกครบทุกรายการ');
  } else {
    lowEl.innerHTML = lowItems.slice(0, 5).map(f => {
      const cls  = f.stock === 0 ? 'out' : 'low';
      const text = f.stock === 0 ? 'หมด' : `${f.stock} ตัว`;
      return `
        <div class="dash-mini-row">
          <div>
            <div class="dash-mini-name">${f.emoji || '🐟'} ${f.name}</div>
            <div class="dash-mini-sub">${f.species || '—'}</div>
          </div>
          <span class="admin-stock-badge ${cls}">${text}</span>
        </div>`;
    }).join('');
  }

  // Recent
  const recEl = document.getElementById('dash-recent');
  if (!fishData.length) {
    recEl.innerHTML = _empty('<i class="ph ph-fish-simple"></i>', 'ยังไม่มีปลา');
  } else {
    recEl.innerHTML = [...fishData].slice(0, 5).map(f => `
      <div class="dash-mini-row">
        <div>
          <div class="dash-mini-name">${f.emoji || '🐟'} ${f.name}</div>
          <div class="dash-mini-sub">${f.species || '—'}</div>
        </div>
        <span style="font-size:0.82rem;font-weight:600;color:var(--royal-blue);font-family:var(--font-number);">
          ฿${(f.priceMin || 0).toLocaleString('th-TH')}
        </span>
      </div>`).join('');
  }
}

// ════════════════════════════════════════════
//   FISH TABLE
// ════════════════════════════════════════════
function renderFishTable() {
  const q    = (document.getElementById('fishSearch')?.value || '').toLowerCase();
  const list = fishData.filter(f => {
    const match = (f.name + ' ' + (f.species || '')).toLowerCase().includes(q);
    if (_stockFilter === 'ok')  return match && f.stock > 5;
    if (_stockFilter === 'low') return match && f.stock > 0 && f.stock <= 5;
    if (_stockFilter === 'out') return match && f.stock === 0;
    return match;
  });

  const countEl = document.getElementById('fishCount');
  if (countEl) countEl.textContent = list.length + ' รายการ';

  const tbody = document.getElementById('fishTableBody');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--gray);padding:2rem">
      ${q ? 'ไม่พบปลาที่ค้นหา' : 'ยังไม่มีปลาครับ'}
    </td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(f => {
    const sc   = f.stock === 0 ? 'out' : f.stock <= 5 ? 'low' : 'ok';
    const st   = f.stock === 0 ? 'หมดสต็อก' : f.stock <= 5 ? `⚠️ ${f.stock} ตัว` : `${f.stock} ตัว`;
    const lvMap = { 'มือใหม่': 'easy', 'ปานกลาง': 'medium', 'ผู้เชี่ยวชาญ': 'hard' };
    const lvCls = lvMap[f.level] || '';
    const imgCell = f.image
      ? `<img src="${f.image}" style="width:44px;height:44px;object-fit:cover;border-radius:8px;">`
      : `<span style="font-size:1.8rem;">${f.emoji || '🐟'}</span>`;

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
        <td><span class="admin-stock-badge ${sc}">${st}</span></td>
        <td><span class="admin-level-badge ${lvCls}">${f.level}</span></td>
        <td>
          <button class="action-btn action-edit"   onclick="openEditModal('${f.id}')"><i class="ph ph-pencil-simple"></i> แก้ไข</button>
          <button class="action-btn action-delete" onclick="deleteFish('${f.id}')"><i class="ph ph-trash"></i> ลบ</button>
        </td>
      </tr>`;
  }).join('');
}


// ════════════════════════════════════════════
//   EDIT MODAL
// ════════════════════════════════════════════
function openEditModal(id) {
  const f = fishData.find(x => x.id === id);
  if (!f) return;

  document.getElementById('editFishId').value   = f.id;
  document.getElementById('editName').value     = f.name;
  document.getElementById('editSpecies').value  = f.species || '';
  document.getElementById('editPriceMin').value = f.priceMin;
  document.getElementById('editPriceMax').value = f.priceMax || '';
  document.getElementById('editStock').value    = f.stock;
  document.getElementById('editLevel').value    = f.level;
  document.getElementById('editDesc').value     = f.desc || '';
  document.getElementById('editSizeMin').value  = f.sizeMin || '';
  document.getElementById('editSizeMax').value  = f.sizeMax || '';
  document.getElementById('editCost').value     = f.cost || '';

  const preview     = document.getElementById('editImagePreview');
  preview.src       = f.image || '';
  preview.style.display = f.image ? 'block' : 'none';

  // clear file input
  document.getElementById('editImageFile').value = '';

  setSelectedTags('editTags', f.tags || []);
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
  ['newEmoji', 'newName', 'newSpecies', 'newPriceMin', 'newPriceMax', 'newStock', 'newSizeMin', 'newSizeMax', 'newDesc', 'newCost']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  document.getElementById('newEmoji').value = '🐡';
  document.getElementById('newImageFile').value = '';

  const preview = document.getElementById('newImagePreview');
  if (preview) { preview.src = ''; preview.style.display = 'none'; }

  document.querySelectorAll('#newTags .tag-option').forEach(el => el.classList.remove('selected'));

  const pp = document.getElementById('pricePreview');
  if (pp) { pp.textContent = '—'; pp.className = 'price-preview'; }

  document.getElementById('newIsComingSoon').checked = false;
  handleComingSoon('new');
}

// ════════════════════════════════════════════
//   UI HELPERS
// ════════════════════════════════════════════

/** Tab switching */
function switchTab(tab) {
  document.querySelectorAll('.admin-page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.admin-nav-tab, .bnav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + tab)?.classList.add('active');
  document.getElementById('nav-'  + tab)?.classList.add('active');
  document.getElementById('bnav-' + tab)?.classList.add('active');
  if (tab === 'finance') renderFinancePage();
  if (tab === 'stats')   renderStats(fishData, financeData);
}

/** Collapsible add panel  — forceOpen: true = open, false = close, undefined = toggle */
function toggleAddPanel(forceOpen) {
  const body   = document.getElementById('addPanelBody');
  const toggle = document.getElementById('addPanelToggle');
  const open   = forceOpen !== undefined ? forceOpen : !body.classList.contains('open');
  body.classList.toggle('open', open);
  toggle.classList.toggle('open', open);
}

/** Price range preview — see scripts/modules/profit.js */

/** Stock filter chips */
function setStockFilter(f, el) {
  _stockFilter = f;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderFishTable();
}

/** Date headers */
function _setDateHeaders() {
  const str = new Date().toLocaleDateString('th-TH', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  const hd = document.getElementById('headerDate');
  const tl = document.getElementById('todayLabel');
  if (hd) hd.textContent = str;
  if (tl) tl.textContent = str;
}

/** Empty state HTML */
function _empty(icon, text) {
  return `<div class="admin-empty-state"><div class="admin-empty-icon">${icon}</div><div class="admin-empty-text">${text}</div></div>`;
}

// ════════════════════════════════════════════
//   COMING SOON HELPER
// ════════════════════════════════════════════
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
}

// ════════════════════════════════════════════
//   FINANCE SYSTEM (แปลงร่างจาก Todo)
// ════════════════════════════════════════════
async function loadFinanceFromDB() {
  const { data, error } = await supabase
    .from('finance')
    .select('*')
    .order('created_at', { ascending: false });

  if (!error) {
    financeData = data;
    renderTodayFinance();
    renderFinancePage(); // 👈 เพิ่มบรรทัดนี้ลงไป
  }
}

async function addFinance(type) {
  const name = document.getElementById('finItemName').value.trim();
  const amount = parseFloat(document.getElementById('finItemAmount').value);

  if (!name || !amount) {
    showToast('⚠️ กรุณากรอกชื่อรายการและจำนวนเงิน');
    return;
  }

  // ดึงวันที่ปัจจุบัน YYYY-MM-DD
  const today = new Date().toLocaleDateString('en-CA'); 

  const { error } = await supabase.from('finance').insert({
    type: type,
    name: name,
    amount: amount,
    date: today
  });

  if (error) {
    showToast('❌ บันทึกไม่ได้: ' + error.message);
    return;
  }

  showToast('✅ บันทึกยอดเรียบร้อย');
  document.getElementById('finItemName').value = '';
  document.getElementById('finItemAmount').value = '';
  loadFinanceFromDB(); // โหลดข้อมูลใหม่มาแสดง
}

async function deleteFinance(id) {
  if (!confirm('ลบรายการนี้?')) return;
  const { error } = await supabase.from('finance').delete().eq('id', id);
  
  if (error) {
    showToast('❌ ลบไม่ได้'); return;
  }
  
  showToast('🗑️ ลบรายการแล้ว');
  loadFinanceFromDB();
}

function renderTodayFinance() {
  const el = document.getElementById('financeTodayList');
  if (!el) return;

  const today = new Date().toLocaleDateString('en-CA');
  const list = financeData.filter(f => f.date === today);

  if (!list.length) {
    el.innerHTML = _empty('<i class="ph ph-leaf"></i>', 'ยังไม่มีรายการเคลื่อนไหววันนี้');
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
//   FINANCE PAGE (Minimal Style)
// ════════════════════════════════════════════
let finFilter = 'all';
let selectedFinMonth = new Date().toLocaleDateString('en-CA').slice(0, 7);

function populateFinMonthSelect() {
  const select = document.getElementById('fin-month-select');
  if (!select) return;

  const months = new Set(financeData.map(f => (f.date || '').slice(0, 7)).filter(Boolean));
  months.add(new Date().toLocaleDateString('en-CA').slice(0, 7));

  const sorted = [...months].sort((a, b) => b.localeCompare(a));
  const monthNames = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

  select.innerHTML = sorted.map(m => {
    const [y, mo] = m.split('-');
    const yearTh = parseInt(y) + 543;
    const label = `${monthNames[parseInt(mo) - 1]} ${yearTh}`;
    const isNow = m === new Date().toLocaleDateString('en-CA').slice(0, 7) ? ' (เดือนนี้)' : '';
    return `<option value="${m}" ${m === selectedFinMonth ? 'selected' : ''}>${label}${isNow}</option>`;
  }).join('');
}

function onFinMonthChange() {
  selectedFinMonth = document.getElementById('fin-month-select').value;
  renderFinancePage();
}

function setFinFilter(f, el) {
  finFilter = f;
  document.querySelectorAll('.fin-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderFinancePage();
}

function renderFinancePage() {
  populateFinMonthSelect();

  const isCurrentMonth = selectedFinMonth === new Date().toLocaleDateString('en-CA').slice(0, 7);
  const monthFin = financeData.filter(f => (f.date || '').startsWith(selectedFinMonth));

  const income  = monthFin.filter(f => f.type === 'income').reduce((s,f) => s + f.amount, 0);
  const expense = monthFin.filter(f => f.type === 'expense').reduce((s,f) => s + f.amount, 0);
  const profit  = income - expense;

  const suffix = isCurrentMonth ? 'เดือนนี้' : 'เดือนนั้น';
  
  if(document.getElementById('fin-label-income')) document.getElementById('fin-label-income').textContent  = `รายรับ${suffix}`;
  if(document.getElementById('fin-label-expense')) document.getElementById('fin-label-expense').textContent  = `รายจ่าย${suffix}`;
  if(document.getElementById('fin-label-profit')) document.getElementById('fin-label-profit').textContent  = `กำไร/ขาดทุน${suffix}`;

  if(document.getElementById('fin-month-income')) document.getElementById('fin-month-income').textContent  = '฿' + income.toLocaleString('th-TH');
  if(document.getElementById('fin-month-expense')) document.getElementById('fin-month-expense').textContent  = '฿' + expense.toLocaleString('th-TH');

  const elProVal = document.getElementById('fin-profit');
  if(elProVal) {
    elProVal.textContent = (profit >= 0 ? '+' : '') + '฿' + profit.toLocaleString('th-TH');
    elProVal.className   = 'fin-profit-val ' + (profit >= 0 ? 'good' : 'bad');
  }

  let list = [...monthFin].sort((a,b) => (b.date||'').localeCompare(a.date||''));
  if (finFilter === 'income')  list = list.filter(f => f.type === 'income');
  if (finFilter === 'expense') list = list.filter(f => f.type === 'expense');

  const elList = document.getElementById('finance-list');
  if (!elList) return;

  if (!list.length) { 
    elList.innerHTML = `<div class="admin-empty-state" style="background:white;border-radius:12px;border:1px solid var(--border);"><div class="admin-empty-icon">🍃</div><div class="admin-empty-text">ไม่มีรายการในเดือนนี้</div></div>`; 
    return; 
  }

  elList.innerHTML = list.map(f => {
    const [y, mo, d] = f.date.split('-');
    const dateStr = `${parseInt(d)} ${['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'][parseInt(mo)-1]} ${(parseInt(y)+543).toString().slice(-2)}`;
    
    return `
    <div class="fin-item">
      <div class="fin-item-left">
        <div class="fin-item-name">${f.name}</div>
        <div class="fin-item-sub">${dateStr} · ${f.type === 'income' ? 'รายรับ' : 'รายจ่าย'}</div>
      </div>
      <div class="fin-item-right">
        <div class="fin-item-amt ${f.type === 'income' ? 'inc' : 'exp'}">${f.type === 'income' ? '+' : '-'}฿${f.amount.toLocaleString('th-TH')}</div>
        <button class="fin-item-del" onclick="deleteFinance('${f.id}')">🗑</button>
      </div>
    </div>`;
  }).join('');
}

function openFinanceModal() {
  document.getElementById('finModalName').value = '';
  document.getElementById('finModalAmount').value = '';
  document.getElementById('finModalDate').value = new Date().toLocaleDateString('en-CA');
  document.getElementById('finModalType').value = 'income';
  document.getElementById('financeModal').classList.add('open');
}

function closeFinanceModal() {
  document.getElementById('financeModal').classList.remove('open');
}

async function saveFinanceModal() {
  const type = document.getElementById('finModalType').value;
  const name = document.getElementById('finModalName').value.trim();
  const amount = parseFloat(document.getElementById('finModalAmount').value);
  const date = document.getElementById('finModalDate').value;

  if (!name || !amount || !date) {
    showToast('⚠️ กรุณากรอกข้อมูลให้ครบ');
    return;
  }

  const { error } = await supabase.from('finance').insert({
    type: type,
    name: name,
    amount: amount,
    date: date
  });

  if (error) {
    showToast('❌ บันทึกไม่ได้: ' + error.message);
    return;
  }

  showToast('✅ บันทึกรายการเรียบร้อย');
  closeFinanceModal();
  loadFinanceFromDB();
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