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
  document.getElementById('editName_th').value  = f.name_th || '';
  document.getElementById('editName_en').value  = f.name_en || '';
  document.getElementById('editSpecies').value  = f.species;
  document.getElementById('editPriceMin').value = f.priceMin;
  document.getElementById('editPriceMax').value = f.priceMax || '';
  document.getElementById('editStock').value    = f.stock;
  document.getElementById('editLevel').value    = f.level;
  document.getElementById('editDesc_th').value  = f.desc_th || '';
  document.getElementById('editDesc_en').value  = f.desc_en || '';
  
  const preview = document.getElementById('editImagePreview');
  preview.src = f.image || '';
  preview.style.display = f.image ? 'block' : 'none';
  
  // โหลด Tags 2 ภาษา
  setSelectedTags('editTags_th', f.tags_th || []);
  setSelectedTags('editTags_en', f.tags_en || []);
  
  document.getElementById('editModal').classList.add('open');
}

export function closeEditModal() {
  document.getElementById('editModal').classList.remove('open');
}

export async function saveEdit() {
  const id = document.getElementById('editFishId').value;
  const f  = fishData.find(x => x.id === id);
  if (!f) return;

  const btn = document.querySelector('#editModal button[type="submit"], #editModal .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก...'; }

  const priceMaxRaw = document.getElementById('editPriceMax').value.trim();

  // ยุบรวมตัวแปร updated เป็นก้อนเดียวให้ครบทุกฟิลด์
  const updated = {
    name_th:  document.getElementById('editName_th').value,
    name_en:  document.getElementById('editName_en').value,
    desc_th:  document.getElementById('editDesc_th').value,
    desc_en:  document.getElementById('editDesc_en').value,
    tags_th:  getSelectedTags('editTags_th'),
    tags_en:  getSelectedTags('editTags_en'),
    species:  document.getElementById('editSpecies').value,
    priceMin: parseInt(document.getElementById('editPriceMin').value, 10) || 0,
    priceMax: priceMaxRaw === '' ? null : (parseInt(priceMaxRaw, 10) || 0),
    stock:    parseInt(document.getElementById('editStock').value, 10) || 0,
    level:    document.getElementById('editLevel').value,
  };

  const persist = async (imageValue) => {
    // จัดเตรียมข้อมูลส่งไป Database
    const payload = {
      name_th:   updated.name_th,
      name_en:   updated.name_en,
      desc_th:   updated.desc_th,
      desc_en:   updated.desc_en,
      tags_th:   updated.tags_th,
      tags_en:   updated.tags_en,
      species:   updated.species,
      price_min: updated.priceMin,
      price_max: updated.priceMax,
      stock:     updated.stock,
      level:     updated.level,
    };
    
    if (imageValue !== undefined) payload.image = imageValue;

    const { error } = await supabase.from('fish').update(payload).eq('id', id);

    if (btn) { btn.disabled = false; btn.textContent = 'บันทึก'; }

    if (error) {
      showToast('❌ บันทึกไม่สำเร็จ: ' + error.message);
      return; 
    }

    // อัปเดตข้อมูลบน Frontend 
    Object.assign(f, updated);
    if (imageValue !== undefined) f.image = imageValue;

    renderFishGrid();
    renderFishTable();
    closeEditModal();
    
    // เปลี่ยนจาก f.name เป็น f.name_th เพื่อให้แสดงผล Toast ได้ถูกต้อง
    showToast('✅ บันทึกข้อมูล ' + f.name_th + ' เรียบร้อย');
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