import { fishData } from './fishData.js';
import { renderFishGrid, renderFishTable } from './render.js';
import { compressImage } from '../shared/image.js';
import { getSelectedTags, setSelectedTags } from '../shared/tags.js';
import { showToast } from '../shared/utils.js';

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

export function saveEdit() {
  const id = document.getElementById('editFishId').value;
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
    renderFishGrid(); renderFishTable();
    closeEditModal();
    showToast('✅ บันทึกข้อมูล ' + f.name + ' เรียบร้อย');
  };
  const fileInput = document.getElementById('editImageFile');
  if (fileInput.files[0]) {
    compressImage(fileInput.files[0], compressed => { f.image = compressed; finish(); });
  } else { finish(); }
}

export function deleteFish(id) {
  if (!confirm('ยืนยันลบปลานี้?')) return;
  const idx = fishData.findIndex(f => f.id === id);
  if (idx !== -1) fishData.splice(idx, 1);
  renderFishGrid(); renderFishTable();
  showToast('🗑️ ลบปลาเรียบร้อย');
}
