// scripts/modules/fishForm.js
// ฟอร์มเพิ่มปลาใหม่ + แก้ไขปลา (แยกออกจาก admin.js — ก้อนใหญ่ที่สุดในการแตกไฟล์)
import { supabase }                       from '../../supabase.js';
import { showToast }                      from '../shared/utils.js';
import { getSelectedTags, setSelectedTags } from '../shared/tags.js';
import { uploadImage }                    from '../shared/image.js';
import { calcPricePreview }               from './profit.js';

// ════════════════════════════════════════════
//   Coming Soon toggle (ใช้ทั้งฟอร์มเพิ่มและแก้ไข)
// ════════════════════════════════════════════
export function handleComingSoon(prefix) {
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

export function updateAddFishTotal() {
  const c = parseFloat(document.getElementById('newCost')?.value) || 0;
  const s = parseInt(document.getElementById('newStock')?.value) || 0;
  const display = document.getElementById('totalFinanceDisplay');
  if (display) {
    display.value = (c * s).toLocaleString('th-TH') + ' บาท';
  }
}

// ════════════════════════════════════════════
//   CLEAR FORM (ฟอร์มเพิ่มปลาใหม่)
// ════════════════════════════════════════════
export function clearForm() {
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
//   ADD FISH (ส่ง fish_id เข้า finance ด้วย)
//   @param {Function} onDone callback หลังสำเร็จ (admin.js ใช้ toggleAddPanel(false) + รีเฟรช fish/finance)
// ════════════════════════════════════════════
export async function addFish(onDone) {
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
    imageUrl = await uploadImage(file, supabase, showToast);
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
      fish_id: newFish.id
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
  onDone?.();
}

// ════════════════════════════════════════════
//   EDIT MODAL
// ════════════════════════════════════════════
export function openEditModal(id, fishData) {
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

export function closeEditModal() {
  document.getElementById('editModal').classList.remove('open');
}

/**
 * บันทึกการแก้ไขปลา
 * @param {Array} fishData array ปลาปัจจุบัน (ใช้หาข้อมูลเดิมของปลาที่กำลังแก้)
 * @param {Function} onDone callback หลังสำเร็จ (admin.js ใช้รีเฟรชตารางปลา)
 */
export async function saveEdit(fishData, onDone) {
  const id   = document.getElementById('editFishId').value;
  const file = document.getElementById('editImageFile').files[0];

  const oldData = fishData.find(f => f.id === id);

  let imageUrl = oldData?.image || null;
  if (file) {
    imageUrl = await uploadImage(file, supabase, showToast);
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

  // แจ้งลูกค้าที่กด "แจ้งเตือน" ไว้ตอนปลาหมดสต็อก ถ้าแก้ไขแล้วสต็อกกลับมาเป็นบวก
  if (oldData?.stock === 0 && stock > 0) {
    fetch('/api/notify-restock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fish_id: id }),
    }).catch(() => {});
  }

  showToast('<i class="ph-fill ph-check-circle" style="color:#10b981; font-size:1.1em; vertical-align:-2px;"></i> บันทึกการแก้ไขเรียบร้อย');
  closeEditModal();
  onDone?.();
}

// ════════════════════════════════════════════
//   TAG SYNC (ติ๊ก tag TH แล้ว sync ไป EN อัตโนมัติ)
// ════════════════════════════════════════════
export function toggleSyncTag(element, mode) {
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