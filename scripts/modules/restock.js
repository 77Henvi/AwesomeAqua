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
  const wasOutOfStock = f?.stock === 0; // เช็คจาก cache ไว้ก่อนเรียก RPC เพื่อรู้ว่าต้องแจ้งเตือนลูกค้าที่รอไหม
  const btn = document.getElementById('btnConfirmRestock');
  btn.disabled = true; btn.textContent = 'กำลังบันทึก...';

  try {
    const amount = qty * cost;

    // เพิ่ม stock + บันทึกรายจ่าย (ถ้ามี) ใน transaction เดียวที่ฝั่ง DB
    // ดู docs/PHASE0_ATOMIC_STOCK_SETUP.md — ต้องรัน SQL สร้าง RPC นี้ก่อนใช้งานได้
    const { error: rpcErr } = await supabase.rpc('record_fish_restock', {
      p_fish_id: id,
      p_qty: qty,
      p_amount: amount,
      p_name: `เติมสต็อก: ${f?.name_th || f?.name || ''} x${qty} ตัว`,
      p_date: date || new Date().toLocaleDateString('en-CA'),
    });

    if (rpcErr) {
      if (rpcErr.message?.includes('FISH_NOT_FOUND')) {
        showToast('<i class="ph-fill ph-x-circle" style="color:#ef4444;"></i> ไม่พบปลาตัวนี้แล้ว (อาจถูกลบไปแล้ว)');
      } else {
        showToast('<i class="ph-fill ph-x-circle" style="color:#ef4444;"></i> ผิดพลาด: เติมสต็อกไม่สำเร็จ');
      }
      return;
    }

    // แจ้งลูกค้าที่กด "แจ้งเตือน" ไว้ตอนปลาหมดสต็อก (ไม่บล็อก flow หลักถ้าแจ้งไม่สำเร็จ)
    if (wasOutOfStock) {
      fetch('/api/notify-restock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fish_id: id }),
      }).catch(() => {});
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