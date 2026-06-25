import { supabase } from '../supabase.js';
import { state } from './adminState.js';
import * as UI from './adminUI.js';
import { showToast } from './shared/utils.js';
import { compressImage } from './shared/image.js';
import { getSelectedTags } from './shared/tags.js';

export async function adminLogin(onSuccess) {
  const email = document.getElementById('adminEmailInput').value;
  const password = document.getElementById('adminPassInput').value;
  const err = document.getElementById('adminError');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    err.innerHTML = '<i class="ph-fill ph-x-circle" style="color:#ef4444;"></i> ' + error.message;
    err.style.display = 'block';
    return;
  }
  err.style.display = 'none';
  if (onSuccess) onSuccess();
}

export async function adminLogout() {
  if (!confirm('ต้องการออกจากระบบ?')) return;
  await supabase.auth.signOut();
  document.getElementById('adminDashboard').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
}

export async function loadFinanceFromDB() {
  const { data, error } = await supabase.from('finance').select('*').order('created_at', { ascending: false });
  if (!error) {
    state.financeData = data;
    state.profitMap = {};
    state.financeData.forEach(r => {
      if (!r.fish_id) return;
      state.profitMap[r.fish_id] = (state.profitMap[r.fish_id] || 0) + (r.type === 'income' ? r.amount : -r.amount);
    });
    UI.renderTodayFinance();
    UI.renderFinancePage(); 
    if (state.fishData.length > 0) UI.renderFishTable();
  }
}

export async function loadFishFromDB() {
  const { data, error } = await supabase.from('fish').select('*').order('created_at', { ascending: false });
  if (error) { showToast('โหลดข้อมูลไม่ได้'); return; }

  state.fishData = data.map(f => ({
    id: f.id, name: f.name_th, name_th: f.name_th, name_en: f.name_en, species: f.species, image: f.image,
    priceMin: f.price_min, priceMax: f.price_max, cost: f.cost || 0, sale_price: f.sale_price || 0,
    stock: f.stock, level: f.level, desc_th: f.desc_th, desc_en: f.desc_en,
    tags_th: f.tags_th || [], tags_en: f.tags_en || [], sizeMin: f.size_min || null, sizeMax: f.size_max || null
  }));

  UI.renderAll();
  setTimeout(() => window.hideLoader(), 300);
}

export async function addFish() {
  const name_th = document.getElementById('newName_th').value.trim();
  const isCS = document.getElementById('newIsComingSoon').checked;
  const costRaw = document.getElementById('newCost')?.value;
  const rDate = document.getElementById('receiveDate')?.value;

  if (!name_th || !rDate || costRaw === '' || (!isCS && document.getElementById('newStock').value === '')) {
    showToast('<i class="ph-fill ph-warning-circle" style="color:#f59e0b;"></i> กรุณากรอกข้อมูลให้ครบ'); return;
  }

  const stock = isCS ? 0 : parseInt(document.getElementById('newStock').value);
  const cost = parseFloat(costRaw);
  const file = document.getElementById('newImageFile').files[0];
  let imageUrl = null;
  if (file) { imageUrl = await uploadImage(file); if (!imageUrl) return; }

  const { data: newFishData, error: fishError } = await supabase.from('fish').insert({
    name_th: name_th, name_en: document.getElementById('newName_en').value.trim(),
    desc_th: document.getElementById('newDesc_th').value, desc_en: document.getElementById('newDesc_en').value,
    tags_th: getSelectedTags('newTags_th'), tags_en: getSelectedTags('newTags_en'),
    species: document.getElementById('newSpecies').value || '-',
    price_min: isCS ? 0 : parseInt(document.getElementById('newPriceMin').value), 
    price_max: isCS ? 0 : parseInt(document.getElementById('newPriceMax').value || 0),
    stock: stock, level: document.getElementById('newLevel').value, image: imageUrl,
    size_min: parseFloat(document.getElementById('newSizeMin').value) || null,
    size_max: parseFloat(document.getElementById('newSizeMax').value) || null,
    cost: cost, sale_price: parseFloat(document.getElementById('newSalePrice')?.value) || 0
  }).select();

  if (fishError || !newFishData) { showToast('<i class="ph-fill ph-x-circle" style="color:#ef4444;"></i> เพิ่มปลาไม่ได้'); return; }

  const totalAmount = cost * stock;
  if (totalAmount > 0) {
    const { error: finError } = await supabase.from('finance').insert({
      type: 'expense', name: `ซื้อปลา: ${name_th} x${stock} ตัว`, amount: totalAmount, date: rDate, fish_id: newFishData[0].id
    });
    if (finError) showToast('เพิ่มปลาสำเร็จ แต่บันทึกรายจ่ายไม่สำเร็จ');
    else showToast('<i class="ph-fill ph-check-circle" style="color:#10b981;"></i> เพิ่มปลาและบันทึกรายจ่ายเรียบร้อย');
  } else { showToast('<i class="ph-fill ph-check-circle" style="color:#10b981;"></i> เพิ่มปลาเรียบร้อย'); }

  UI.clearForm(); UI.toggleAddPanel(false); 
  loadFishFromDB(); loadFinanceFromDB();
}

export async function deleteFish(id) {
  if (!confirm('ยืนยันลบปลานี้? (รายรับ/รายจ่ายที่ผูกกับปลานี้จะถูกลบไปด้วย)')) return;
  const { error } = await supabase.from('fish').delete().eq('id', id);
  if (error) { showToast('<i class="ph-fill ph-x-circle" style="color:#ef4444;"></i> ลบไม่ได้'); return; }
  showToast('<i class="ph-fill ph-trash" style="color:#6b7280;"></i> ลบปลาเรียบร้อย');
  loadFishFromDB(); loadFinanceFromDB();
}

export async function saveEdit() {
  const id = document.getElementById('editFishId').value;
  const oldData = state.fishData.find(f => f.id === id);
  const file = document.getElementById('editImageFile').files[0];
  let imageUrl = oldData?.image || null;
  if (file) { imageUrl = await uploadImage(file); if (!imageUrl) return; }

  const isCS = document.getElementById('editIsComingSoon').checked;
  const { error } = await supabase.from('fish').update({
    name_th: document.getElementById('editName_th').value,
    name_en: document.getElementById('editName_en').value,
    species: document.getElementById('editSpecies').value,
    desc_th: document.getElementById('editDesc_th').value,
    desc_en: document.getElementById('editDesc_en').value,
    tags_th: getSelectedTags('editTags_th'), tags_en: getSelectedTags('editTags_en'),
    price_min: isCS ? 0 : parseInt(document.getElementById('editPriceMin').value || 0), 
    price_max: isCS ? 0 : parseInt(document.getElementById('editPriceMax').value || 0), 
    stock: isCS ? 0 : parseInt(document.getElementById('editStock').value || 0),    
    level: document.getElementById('editLevel').value, image: imageUrl,
    size_min: parseFloat(document.getElementById('editSizeMin').value) || null,
    size_max: parseFloat(document.getElementById('editSizeMax').value) || null,
    cost: parseFloat(document.getElementById('editCost')?.value) || oldData?.cost || 0,
    sale_price: parseFloat(document.getElementById('editSalePrice')?.value) || oldData?.sale_price || 0
  }).eq('id', id);

  if (error) { showToast('บันทึกไม่ได้'); return; }
  showToast('<i class="ph-fill ph-check-circle" style="color:#10b981;"></i> บันทึกแก้ไขเรียบร้อย');
  UI.closeEditModal(); loadFishFromDB();
}

export async function confirmRestock() {
  const id = document.getElementById('rsFishId').value;
  const qty = parseInt(document.getElementById('rsQty').value) || 0;
  const cost = parseFloat(document.getElementById('rsCost').value) || 0;
  if (qty <= 0 || isNaN(qty)) { showToast('<i class="ph-fill ph-warning-circle" style="color:#f59e0b;"></i> ระบุจำนวน'); return; }
  
  const btn = document.getElementById('btnConfirmRestock');
  btn.disabled = true; btn.textContent = 'กำลังบันทึก...';

  try {
    const f = state.fishData.find(x => x.id === id);
    const { error: stockErr } = await supabase.from('fish').update({ stock: f.stock + qty }).eq('id', id);
    if (stockErr) { showToast('ผิดพลาด: อัปเดตสต็อกไม่สำเร็จ'); return; }

    const amount = qty * cost;
    if (amount > 0) {
      const { error: finErr } = await supabase.from('finance').insert({
        type: 'expense', name: `เติมสต็อก: ${f.name_th || f.name} x${qty} ตัว`,
        amount: amount, date: document.getElementById('rsDate').value || new Date().toLocaleDateString('en-CA'), fish_id: id
      });
      if (finErr) showToast('<i class="ph-fill ph-warning-circle"></i> สำเร็จ แต่บันทึกรายจ่ายพลาด');
    }
    showToast('<i class="ph-fill ph-check-circle" style="color:#10b981;"></i> เติมสต็อกเรียบร้อย');
    UI.closeRestockModal(); loadFishFromDB(); loadFinanceFromDB();
  } catch(e) { showToast('เกิดข้อผิดพลาด'); } 
  finally { btn.disabled = false; btn.innerHTML = '<i class="ph ph-check-circle"></i> ยืนยันการเติม'; }
}

export async function addFinance(type) {
  const name = document.getElementById('finItemName').value.trim();
  const amount = parseFloat(document.getElementById('finItemAmount').value);
  if (!name || !amount) { showToast('กรุณากรอกข้อมูลให้ครบ'); return; }
  
  const { error } = await supabase.from('finance').insert({ type, name, amount, date: new Date().toLocaleDateString('en-CA') });
  if (error) { showToast('บันทึกไม่ได้: ' + error.message); return; }
  showToast('<i class="ph-fill ph-check-circle" style="color:#10b981;"></i> บันทึกยอดเรียบร้อย');
  document.getElementById('finItemName').value = ''; document.getElementById('finItemAmount').value = '';
  loadFinanceFromDB(); 
}

export async function saveFinanceModal() {
  const type = document.getElementById('finModalType').value;
  const name = document.getElementById('finModalName').value.trim();
  const amount = parseFloat(document.getElementById('finModalAmount').value);
  const date = document.getElementById('finModalDate').value;
  if (!name || !amount || !date) { showToast('กรุณากรอกข้อมูลให้ครบ'); return; }

  const { error } = await supabase.from('finance').insert({ type, name, amount, date });
  if (error) { showToast('บันทึกไม่ได้'); return; }
  showToast('<i class="ph-fill ph-check-circle" style="color:#10b981;"></i> บันทึกรายการเรียบร้อย');
  UI.closeFinanceModal(); loadFinanceFromDB();
}

export async function deleteFinance(id) {
  if (!confirm('ลบรายการนี้?')) return;
  const { error } = await supabase.from('finance').delete().eq('id', id);
  if (error) { showToast('ลบไม่ได้'); return; }
  showToast('ลบรายการแล้ว'); loadFinanceFromDB();
}

async function uploadImage(file) {
  const filename = `fish_${Date.now()}.jpg`;
  const compressed = await new Promise(res => compressImage(file, res));
  const r = await fetch(compressed);
  const blob = await r.blob();
  const { error } = await supabase.storage.from('fish-images').upload(filename, blob, { contentType: 'image/jpeg' });
  if (error) { showToast('อัปโหลดรูปไม่ได้'); return null; }
  return supabase.storage.from('fish-images').getPublicUrl(filename).data.publicUrl;
}