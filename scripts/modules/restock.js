// scripts/modules/restock.js
// Modal "เติมสต็อก" — แยกออกจาก admin.js (ก้าวต่อไปของการแตกไฟล์ใหญ่เป็นโมดูลย่อย)
import { supabase }  from '../../supabase.js';
import { showToast } from '../shared/utils.js';

/** เปิด modal เติมสต็อก ต้องส่ง fishData (array ปัจจุบัน) เข้ามาเพื่อหาปลาตัวนั้น */
export function openRestockModal(id, fishData) {
  const f = fishData.find(x => x.id === id);
  if (!f) return;
  document.getElementById('rsFishId').value = f.id;
  document.getElementById('rsFishName').value = f.name_th || f.name;
  document.getElementById('rsQty').value = '';
  document.getElementById('rsCost').value = f.cost || 0;
  document.getElementById('rsDate').value = new Date().toLocaleDateString('en-CA');
  calcRestockTotal();
  document.getElementById('restockModal').classList.add('open');
}

export function closeRestockModal() {
  document.getElementById('restockModal').classList.remove('open');
}

export function calcRestockTotal() {
  const q = parseInt(document.getElementById('rsQty').value) || 0;
  const c = parseFloat(document.getElementById('rsCost').value) || 0;
  document.getElementById('rsTotal').value = (q * c).toLocaleString('th-TH');
}

/**
 * ยืนยันการเติมสต็อก — อัปเดต stock ในตาราง fish + บันทึกรายจ่ายเข้า finance
 * @param {Array} fishData array ปลาปัจจุบัน (ใช้หาข้อมูลปลาที่กำลังเติม)
 * @param {Function} onDone callback หลังสำเร็จ (ปกติคือรีเฟรชทั้ง fish + finance)
 */
export async function confirmRestock(fishData, onDone) {
  const id   = document.getElementById('rsFishId').value;
  const qty  = parseInt(document.getElementById('rsQty').value) || 0;
  const cost = parseFloat(document.getElementById('rsCost').value) || 0;
  const date = document.getElementById('rsDate').value;

  if (qty <= 0 || isNaN(qty)) { showToast('<i class="ph-fill ph-warning-circle" style="color:#f59e0b;"></i> กรุณากรอกจำนวนที่ต้องการเติม'); return; }
  if (isNaN(cost)) { showToast('<i class="ph-fill ph-warning-circle" style="color:#f59e0b;"></i> กรุณากรอกต้นทุนให้ถูกต้อง'); return; }

  const f = fishData.find(x => x.id === id);
  const btn = document.getElementById('btnConfirmRestock');
  btn.disabled = true; btn.textContent = 'กำลังบันทึก...';

  try {
    const newStock = f.stock + qty;
    // 1. อัปเดตสต็อก
    const { error: stockErr } = await supabase.from('fish').update({ stock: newStock }).eq('id', id);
    if (stockErr) { showToast('<i class="ph-fill ph-x-circle" style="color:#ef4444;"></i> ผิดพลาด: อัปเดตสต็อกไม่สำเร็จ'); return; }

    const amount = qty * cost;
    // 2. บันทึกรายจ่าย
    if (amount > 0) {
      const { error: finErr } = await supabase.from('finance').insert({
        type: 'expense',
        name: `เติมสต็อก: ${f.name_th || f.name} x${qty} ตัว`,
        amount: amount,
        date: date || new Date().toLocaleDateString('en-CA'),
        fish_id: id
      });
      if (finErr) { showToast('<i class="ph-fill ph-warning-circle" style="color:#f59e0b;"></i> เติมสต็อกสำเร็จ แต่บันทึกรายจ่ายไม่สำเร็จ'); }
    }

    showToast('<i class="ph-fill ph-check-circle" style="color:#10b981;"></i> เติมสต็อกเรียบร้อย');
    closeRestockModal();
    onDone?.();
  } catch (e) {
    showToast('<i class="ph-fill ph-x-circle" style="color:#ef4444;"></i> เกิดข้อผิดพลาด');
  } finally {
    btn.disabled = false; btn.innerHTML = '<i class="ph ph-check-circle"></i> ยืนยันการเติม';
  }
}