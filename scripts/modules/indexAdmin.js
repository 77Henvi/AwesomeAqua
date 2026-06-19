import { fishData } from './fishData.js';
import { renderFishGrid, renderFishTable } from './render.js';
import { compressImage } from '../shared/image.js';
import { getSelectedTags, setSelectedTags } from '../shared/tags.js';
import { showToast } from '../shared/utils.js';
import { supabase } from '../../supabase.js';

export function openEditModal(id) {
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

export function closeEditModal() {
  document.getElementById('editModal').classList.remove('open');
}

export async function saveEdit() {
  const id = document.getElementById('editFishId').value;
  const f  = fishData.find(x => x.id === id);
  if (!f) return;

  // ปุ่ม submit ในโมดัล — ปรับ selector ตรงนี้ให้ตรงกับ HTML จริงถ้าไม่ตรง (ใส่ if (btn) ไว้แล้วเลยไม่พังถ้าหาไม่เจอ)
  const btn = document.querySelector('#editModal button[type="submit"], #editModal .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก...'; }

  const priceMaxRaw = document.getElementById('editPriceMax').value.trim();

  const updated = {
    name:     document.getElementById('editName').value,
    species:  document.getElementById('editSpecies').value,
    priceMin: parseInt(document.getElementById('editPriceMin').value, 10) || 0,
    // เว้นว่าง = ไม่มีราคาสูงสุด (null) ไม่ใช่ 0 เหมือนของเดิม
    priceMax: priceMaxRaw === '' ? null : (parseInt(priceMaxRaw, 10) || 0),
    stock:    parseInt(document.getElementById('editStock').value, 10) || 0,
    level:    document.getElementById('editLevel').value,
    desc:     document.getElementById('editDesc').value,
    tags:     getSelectedTags('editTags'),
  };

  const persist = async (imageValue) => {
    const payload = {
      name:      updated.name,
      species:   updated.species,
      price_min: updated.priceMin,
      price_max: updated.priceMax,
      stock:     updated.stock,
      level:     updated.level,
      desc:      updated.desc,
      tags:      updated.tags,
    };
    if (imageValue !== undefined) payload.image = imageValue;

    const { error } = await supabase.from('fish').update(payload).eq('id', id);

    if (btn) { btn.disabled = false; btn.textContent = 'บันทึก'; }

    if (error) {
      showToast('❌ บันทึกไม่สำเร็จ: ' + error.message);
      return; 
    }

    Object.assign(f, updated);
    if (imageValue !== undefined) f.image = imageValue;

    renderFishGrid();
    renderFishTable();
    closeEditModal();
    showToast('✅ บันทึกข้อมูล ' + f.name + ' เรียบร้อย');
  };

  const fileInput = document.getElementById('editImageFile');
  if (fileInput.files[0]) {
    compressImage(fileInput.files[0], compressed => persist(compressed));
  } else {
    persist(undefined);
  }
}

// ── ลบปลา ──
export async function deleteFish(id) {
  if (!confirm('ยืนยันลบปลานี้?')) return;

  const { error } = await supabase.from('fish').delete().eq('id', id);

  if (error) {
    showToast('❌ ลบไม่สำเร็จ: ' + error.message);
    return;
  }

  const idx = fishData.findIndex(f => f.id === id);
  if (idx !== -1) fishData.splice(idx, 1);

  renderFishGrid();
  renderFishTable();
  showToast('🗑️ ลบปลาเรียบร้อย');
}