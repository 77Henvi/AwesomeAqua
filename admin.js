import { supabase } from './supabase.js';

// ── LOGIN ──
async function adminLogin() {
  const email    = document.getElementById('adminEmailInput').value;
  const password = document.getElementById('adminPassInput').value;
  const err      = document.getElementById('adminError');

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    err.textContent = '❌ ' + error.message;
    err.style.display = 'block';
    return;
  }

  err.style.display = 'none';
  showDashboard();
}

async function adminLogout() {
  await supabase.auth.signOut();
  document.getElementById('adminDashboard').style.display = 'none';
  document.getElementById('loginScreen').style.display    = 'flex';
}

function showDashboard() {
  document.getElementById('loginScreen').style.display    = 'none';
  document.getElementById('adminDashboard').style.display = 'block';
  loadFishFromDB();
  renderAdminStats();
}

// ── Expose functions to global scope ──
window.adminLogin      = adminLogin;
window.adminLogout     = adminLogout;
window.addFish         = addFish;
window.deleteFish      = deleteFish;
window.saveEdit        = saveEdit;
window.openEditModal   = openEditModal;
window.closeEditModal  = closeEditModal;
window.clearForm       = clearForm;
window.toggleTag       = toggleTag;
window.previewNewImage = previewNewImage;
window.previewEditImage= previewEditImage;

// ── LOAD จาก Supabase ──
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
    stock:    f.stock,
    level:    f.level,
    desc:     f.desc,
    tags:     f.tags || []
  }));

  renderFishTable();
  renderAdminStats();
}

// ── ADD FISH ──
async function addFish() {
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
    image: imageUrl
  });

  if (error) { showToast('❌ เพิ่มปลาไม่ได้: ' + error.message); return; }

  showToast('✅ เพิ่มปลา ' + name + ' เรียบร้อย!');
  clearForm();
  loadFishFromDB();
}

// ── DELETE FISH ──
async function deleteFish(id) {
  if (!confirm('ยืนยันลบปลานี้?')) return;

  const { error } = await supabase.from('fish').delete().eq('id', id);

  if (error) { showToast('❌ ลบไม่ได้'); return; }

  showToast('🗑️ ลบปลาเรียบร้อย');
  loadFishFromDB();
}

// ── SAVE EDIT ──
async function saveEdit() {
  const id = document.getElementById('editFishId').value;
  const file = document.getElementById('editImageFile').files[0];

  let imageUrl = fishData.find(f => f.id === id)?.image || null;
  if (file) {
    imageUrl = await uploadImage(file);
    if (!imageUrl) return;
  }

  const { error } = await supabase.from('fish').update({
    name:      document.getElementById('editName').value,
    species:   document.getElementById('editSpecies').value,
    price_min: parseInt(document.getElementById('editPriceMin').value) || 0,
    price_max: parseInt(document.getElementById('editPriceMax').value) || 0,
    stock:     parseInt(document.getElementById('editStock').value)    || 0,
    level:     document.getElementById('editLevel').value,
    desc:      document.getElementById('editDesc').value,
    tags:      getSelectedTags('editTags'),
    image:     imageUrl
  }).eq('id', id);

  if (error) { showToast('❌ บันทึกไม่ได้'); return; }

  showToast('✅ บันทึกเรียบร้อย');
  closeEditModal();
  loadFishFromDB();
}

// ── UPLOAD รูปไปยัง Supabase Storage ──
async function uploadImage(file) {
  const filename = `fish_${Date.now()}.jpg`;

  const compressed = await new Promise(resolve => compressImage(file, resolve));
  
  // แปลง base64 เป็น blob
  const res    = await fetch(compressed);
  const blob   = await res.blob();

  const { data, error } = await supabase.storage
    .from('fish-images')
    .upload(filename, blob, {
      contentType: 'image/jpeg',
      upsert: false
    });

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
let fishData = [];

function renderFishTable() {
  const tbody = document.getElementById('fishTableBody');
  if (!tbody) return;
  tbody.innerHTML = fishData.length === 0
    ? `<tr><td colspan="6" style="text-align:center;color:var(--gray);padding:2rem">ยังไม่มีปลาครับ</td></tr>`
    : fishData.map(f => `
      <tr>
        <td>${f.image ? `<img src="${f.image}" style="width:44px;height:44px;object-fit:cover;border-radius:8px">` : f.emoji || '🐟'}</td>
        <td><strong>${f.name}</strong><br><small style="color:var(--gray)">${f.species}</small></td>
        <td>฿${f.priceMin.toLocaleString()}${f.priceMax ? ' – ' + f.priceMax.toLocaleString() : ''}</td>
        <td>
          <span class="status-dot ${f.stock === 0 ? 'out' : f.stock <= 5 ? 'low' : 'ok'}"></span>
          ${f.stock} ตัว
        </td>
        <td>${f.level}</td>
        <td>
          <button class="action-btn action-edit"   onclick="openEditModal('${f.id}')">แก้ไข</button>
          <button class="action-btn action-delete" onclick="deleteFish('${f.id}')">ลบ</button>
        </td>
      </tr>
    `).join('');
}

// ── EDIT MODAL ──
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

function clearForm() {
  ['newEmoji','newName','newSpecies','newPriceMin','newPriceMax','newStock','newDesc']
    .forEach(id => document.getElementById(id).value = '');
  document.getElementById('newEmoji').value = '🐡';
  document.getElementById('newImageFile').value = '';
  document.getElementById('newImagePreview').style.display = 'none';
  document.querySelectorAll('#newTags .tag-option').forEach(el => el.classList.remove('selected'));
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
(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) showDashboard();
})();