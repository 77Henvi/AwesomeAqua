const ADMIN_PASS = 'aqua1234';
let fishData = JSON.parse(localStorage.getItem('fishData')) || [];

function saveToStorage() {
  localStorage.setItem('fishData', JSON.stringify(fishData));
}

// ── LOGIN ──
function adminLogin() {
  const pass = document.getElementById('adminPassInput').value;
  const err  = document.getElementById('adminError');
  if (pass === ADMIN_PASS) {
    sessionStorage.setItem('adminAuth', 'true');
    err.style.display = 'none';
    showDashboard();
  } else {
    err.style.display = 'block';
    document.getElementById('adminPassInput').value = '';
    document.getElementById('adminPassInput').focus();
  }
}

function adminLogout() {
  sessionStorage.removeItem('adminAuth');
  document.getElementById('adminDashboard').style.display = 'none';
  document.getElementById('loginScreen').style.display    = 'flex';
  document.getElementById('adminPassInput').value = '';
  sessionStorage.removeItem('isAdmin'); 
  location.reload();
}

function showDashboard() {
  document.getElementById('loginScreen').style.display    = 'none';
  document.getElementById('adminDashboard').style.display = 'block';
  renderFishTable();
  renderAdminStats();
}

// ── STATS ──
function renderAdminStats() {
  const total    = fishData.length;
  const inStock  = fishData.filter(f => f.stock > 0).length;
  const lowStock = fishData.filter(f => f.stock > 0 && f.stock <= 5).length;
  const outStock = fishData.filter(f => f.stock === 0).length;

  document.getElementById('adminStats').innerHTML = `
    <div class="admin-stat-card">
      <div class="admin-stat-icon">🐠</div>
      <div><div class="admin-stat-num">${total}</div><div class="admin-stat-label">ชนิดปลาทั้งหมด</div></div>
    </div>
    <div class="admin-stat-card">
      <div class="admin-stat-icon">✅</div>
      <div><div class="admin-stat-num">${inStock}</div><div class="admin-stat-label">มีในสต็อก</div></div>
    </div>
    <div class="admin-stat-card">
      <div class="admin-stat-icon">⚠️</div>
      <div><div class="admin-stat-num">${lowStock}</div><div class="admin-stat-label">สต็อกเหลือน้อย</div></div>
    </div>
    <div class="admin-stat-card">
      <div class="admin-stat-icon">❌</div>
      <div><div class="admin-stat-num">${outStock}</div><div class="admin-stat-label">หมดสต็อก</div></div>
    </div>
  `;
}

// ── RENDER TABLE ──
function renderFishTable() {
  const tbody = document.getElementById('fishTableBody');
  if (!tbody) return;
  tbody.innerHTML = fishData.length === 0
    ? `<tr><td colspan="6" style="text-align:center;color:var(--gray);padding:2rem">
        ยังไม่มีปลา — กรอกแบบฟอร์มด้านบนเพื่อเพิ่มครับ
       </td></tr>`
    : fishData.map(f => `
      <tr>
        <td>${f.image
          ? `<img src="${f.image}" style="width:44px;height:44px;object-fit:cover;border-radius:8px">`
          : f.emoji || '🐟'}</td>
        <td><strong>${f.name}</strong><br><small style="color:var(--gray)">${f.species}</small></td>
        <td>฿${f.priceMin.toLocaleString()}${f.priceMax ? ' – ' + f.priceMax.toLocaleString() : ''}</td>
        <td>
          <span class="status-dot ${f.stock === 0 ? 'out' : f.stock <= 5 ? 'low' : 'ok'}"></span>
          ${f.stock} ตัว
        </td>
        <td>${f.level}</td>
        <td>
          <button class="action-btn action-edit"   onclick="openEditModal(${f.id})">แก้ไข</button>
          <button class="action-btn action-delete" onclick="deleteFish(${f.id})">ลบ</button>
        </td>
      </tr>
    `).join('');
}

// ── ADD FISH ──
function addFish() {
  const name     = document.getElementById('newName').value;
  const emoji    = document.getElementById('newEmoji').value    || '🐟';
  const species  = document.getElementById('newSpecies').value;
  const priceMin = parseInt(document.getElementById('newPriceMin').value) || 0;
  const priceMax = parseInt(document.getElementById('newPriceMax').value) || 0;
  const stock    = parseInt(document.getElementById('newStock').value)    || 0;
  const level    = document.getElementById('newLevel').value;
  const desc     = document.getElementById('newDesc').value;
  const file     = document.getElementById('newImageFile').files[0];

  if (!name) { showToast('⚠️ กรุณากรอกชื่อปลา'); return; }

  const newFish = {
    id: Date.now(), emoji, name,
    species: species || '-',
    priceMin, priceMax, stock, level, desc,
    tags: getSelectedTags('newTags'),
    image: null
  };

  const finish = () => {
    fishData.push(newFish);
    saveToStorage();
    renderFishTable();
    renderAdminStats();
    clearForm();
    showToast('✅ เพิ่มปลา ' + name + ' เรียบร้อย!');
  };

  file ? compressImage(file, c => { newFish.image = c; finish(); }) : finish();
}

function deleteFish(id) {
  if (!confirm('ยืนยันลบปลานี้?')) return;
  fishData = fishData.filter(f => f.id !== id);
  saveToStorage();
  renderFishTable();
  renderAdminStats();
  showToast('🗑️ ลบปลาเรียบร้อย');
}

function clearForm() {
  ['newEmoji','newName','newSpecies','newPriceMin','newPriceMax','newStock','newDesc']
    .forEach(id => document.getElementById(id).value = '');
  document.getElementById('newEmoji').value = '🐡';
  document.getElementById('newImageFile').value = '';
  document.getElementById('newImagePreview').style.display = 'none';
  document.querySelectorAll('#newTags .tag-option').forEach(el => el.classList.remove('selected'));
}

// ── EDIT ──
function openEditModal(id) {
  const f = fishData.find(x => x.id === id);
  if (!f) return;
  document.getElementById('editFishId').value   = f.id;
  document.getElementById('editName').value     = f.name;
  document.getElementById('editSpecies').value  = f.species;
  document.getElementById('editPriceMin').value = f.priceMin;
  document.getElementById('editPriceMax').value = f.priceMax || '';
  document.getElementById('editStock').value    = f.stock;
  document.getElementById('editLevel').value    = f.level;
  document.getElementById('editDesc').value     = f.desc || '';
  const preview = document.getElementById('editImagePreview');
  preview.src = f.image || '';
  preview.style.display = f.image ? 'block' : 'none';
  setSelectedTags('editTags', f.tags || []);
  document.getElementById('editModal').classList.add('open');
}

function closeEditModal() {
  document.getElementById('editModal').classList.remove('open');
}

function saveEdit() {
  const id = parseInt(document.getElementById('editFishId').value);
  const f  = fishData.find(x => x.id === id);
  if (!f) return;
  f.name     = document.getElementById('editName').value;
  f.species  = document.getElementById('editSpecies').value;
  f.priceMin = parseInt(document.getElementById('editPriceMin').value) || 0;
  f.priceMax = parseInt(document.getElementById('editPriceMax').value) || 0;
  f.stock    = parseInt(document.getElementById('editStock').value)    || 0;
  f.level    = document.getElementById('editLevel').value;
  f.desc     = document.getElementById('editDesc').value;
  f.tags     = getSelectedTags('editTags');

  const finish = () => {
    saveToStorage();
    renderFishTable();
    renderAdminStats();
    closeEditModal();
    showToast('✅ บันทึกข้อมูล ' + f.name + ' เรียบร้อย');
  };

  const fi = document.getElementById('editImageFile');
  fi.files[0] ? compressImage(fi.files[0], c => { f.image = c; finish(); }) : finish();
}

// ── IMAGE ──
function compressImage(file, callback) {
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX = 800;
      let w = img.width, h = img.height;
      if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      callback(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function previewNewImage(input) {
  if (input.files[0]) {
    const p = document.getElementById('newImagePreview');
    p.src = URL.createObjectURL(input.files[0]);
    p.style.display = 'block';
  }
}

function previewEditImage(input) {
  if (input.files[0]) {
    const p = document.getElementById('editImagePreview');
    p.src = URL.createObjectURL(input.files[0]);
    p.style.display = 'block';
  }
}

// ── TAGS ──
function toggleTag(el) { el.classList.toggle('selected'); }
function getSelectedTags(id) {
  return [...document.querySelectorAll(`#${id} .tag-option.selected`)]
    .map(el => el.textContent.trim());
}
function setSelectedTags(id, tags) {
  document.querySelectorAll(`#${id} .tag-option`).forEach(el => {
    el.classList.toggle('selected', (tags || []).includes(el.textContent.trim()));
  });
}

// ── TOAST ──
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ── INIT ──
if (sessionStorage.getItem('adminAuth') === 'true') {
  showDashboard();
}