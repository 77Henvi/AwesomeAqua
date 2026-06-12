// ============================================
//   MODULE: SALE POPUP (ขายได้)
//   path: scripts/modules/sale.js
//
//   - เปิด popup จากปุ่ม "ขายได้" ใน editModal
//   - ครั้งแรก: กรอก จำนวน / ต้นทุนต่อตัว / ราคาขายต่อตัว
//     -> บันทึก cost, sale_price ไว้ใน record ปลา (เป็นค่า default)
//   - ครั้งต่อไป: ถ้ามี cost & sale_price อยู่แล้ว จะให้กรอกแค่ "จำนวนที่ขายได้"
//   - เมื่อยืนยัน:
//       - ลด stock ของปลาตามจำนวนที่ขาย
//       - insert รายรับ (income) เข้าตาราง finance = จำนวน * ราคาขาย
//       - insert รายจ่าย (expense) เข้าตาราง finance = จำนวน * ต้นทุน
//         (ทำให้หน้า "รายรับ-รายจ่าย" คำนวณกำไรสุทธิถูกต้องอัตโนมัติ)
//
//   หมายเหตุ: ต้องมีคอลัมน์ "cost" และ "sale_price" (numeric) ในตาราง fish
// ============================================

import { supabase }   from '../../supabase.js';
import { showToast }  from '../shared/utils.js';

let _currentFish = null;
let _onSaved     = null;

// ── สร้าง modal แบบ dynamic (ไม่ต้องแก้ HTML) ──
export function initSaleModal() {
  if (document.getElementById('saleModal')) return;

  const wrap = document.createElement('div');
  wrap.id = 'saleModal';
  wrap.className = 'sale-modal-overlay';
  wrap.innerHTML = `
    <div class="sale-modal-box">
      <h3 style="margin:0 0 4px;font-size:1.05rem;">🛒 บันทึกการขาย</h3>
      <div id="saleFishName" style="font-size:0.85rem;color:var(--gray,#666);margin-bottom:14px;"></div>

      <div id="saleDetailGroup">
        <label class="sale-label">ต้นทุนต่อตัว (บาท)</label>
        <input type="number" id="saleCost" class="sale-input" placeholder="0" min="0">

        <label class="sale-label">ราคาที่ขายได้ต่อตัว (บาท)</label>
        <input type="number" id="saleSellPrice" class="sale-input" placeholder="0" min="0">
      </div>

      <div id="saleQtyGroup">
        <label class="sale-label">จำนวนที่ขายได้ (ตัว)</label>
        <input type="number" id="saleQty" class="sale-input" placeholder="0" min="1">
      </div>

      <div id="saleSummary" style="margin-top:10px;font-size:0.85rem;color:var(--gray,#666);"></div>

      <div style="display:flex;gap:8px;margin-top:18px;">
        <button type="button" onclick="window.closeSaleModal()" class="sale-btn sale-btn-ghost">ยกเลิก</button>
        <button type="button" onclick="window.confirmSale()" class="sale-btn sale-btn-primary">✅ บันทึกการขาย</button>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);

  // ── style ขั้นต่ำ (กันกรณี admin.css ยังไม่มี class เหล่านี้) ──
  if (!document.getElementById('saleModalStyle')) {
    const style = document.createElement('style');
    style.id = 'saleModalStyle';
    style.textContent = `
      .sale-modal-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.45);
        display: none; align-items: center; justify-content: center;
        z-index: 9999;
      }
      .sale-modal-overlay.open { display: flex; }
      .sale-modal-box {
        background: #fff; border-radius: 14px; padding: 20px;
        width: 90%; max-width: 360px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      }
      .sale-label { display:block; font-size:0.8rem; color:#555; margin:10px 0 4px; }
      .sale-input {
        width: 100%; padding: 10px 12px; border: 1px solid var(--border,#ddd);
        border-radius: 8px; font-size: 0.95rem; box-sizing: border-box;
      }
      .sale-btn { flex: 1; padding: 10px; border-radius: 10px; border: none;
        font-weight: 600; cursor: pointer; font-size: 0.9rem; }
      .sale-btn-primary { background: var(--royal-blue,#2563eb); color: #fff; }
      .sale-btn-ghost { background: #f1f1f1; color: #333; }
    `;
    document.head.appendChild(style);
  }

  // ── live summary คำนวณกำไรเบื้องต้น ──
  ['saleCost', 'saleSellPrice', 'saleQty'].forEach(id => {
    document.getElementById(id).addEventListener('input', _updateSummary);
  });

  // expose สำหรับ inline onclick
  window.closeSaleModal = closeSaleModal;
  window.confirmSale    = confirmSale;
}

function _updateSummary() {
  const cost = parseFloat(document.getElementById('saleCost').value) || (_currentFish?.cost || 0);
  const sell = parseFloat(document.getElementById('saleSellPrice').value) || (_currentFish?.sale_price || 0);
  const qty  = parseInt(document.getElementById('saleQty').value) || 0;

  const el = document.getElementById('saleSummary');
  if (!qty || !sell) { el.textContent = ''; return; }

  const income = qty * sell;
  const expense = qty * cost;
  const profit  = income - expense;

  el.innerHTML = `รายรับ ฿${income.toLocaleString('th-TH')}`
    + (cost ? ` | ต้นทุน ฿${expense.toLocaleString('th-TH')} | กำไร ฿${profit.toLocaleString('th-TH')}` : '');
}

/**
 * เปิด popup บันทึกการขาย
 * @param {object} fish - object ปลา (ต้องมี id, name, emoji, stock, cost, sale_price)
 * @param {function} onSaved - callback หลังบันทึกสำเร็จ (เช่น โหลดข้อมูลใหม่)
 */
export function openSaleModal(fish, onSaved) {
  initSaleModal();
  _currentFish = fish;
  _onSaved     = onSaved;

  const hasDefaults = !!(fish.cost && fish.sale_price);

  document.getElementById('saleFishName').textContent =
    `${fish.emoji || '🐟'} ${fish.name} — เหลือในสต็อก ${fish.stock} ตัว`;

  document.getElementById('saleDetailGroup').style.display = hasDefaults ? 'none' : 'block';
  document.getElementById('saleCost').value      = fish.cost || '';
  document.getElementById('saleSellPrice').value = fish.sale_price || fish.priceMin || '';

  document.getElementById('saleQty').value = '';
  document.getElementById('saleQty').max   = fish.stock;
  document.getElementById('saleSummary').textContent = '';

  document.getElementById('saleModal').classList.add('open');
  document.getElementById('saleQty').focus();
}

export function closeSaleModal() {
  document.getElementById('saleModal')?.classList.remove('open');
  _currentFish = null;
}

/**
 * ยืนยันการขาย:
 *  - ลด stock
 *  - จำ cost / sale_price ไว้ในตาราง fish (เป็น default ครั้งถัดไป)
 *  - บันทึกรายรับ-รายจ่ายลงตาราง finance
 */
export async function confirmSale() {
  const fish = _currentFish;
  if (!fish) return;

  const qty = parseInt(document.getElementById('saleQty').value) || 0;
  if (qty <= 0) { showToast('⚠️ กรุณากรอกจำนวนที่ขาย'); return; }
  if (qty > fish.stock) { showToast('⚠️ จำนวนเกินสต็อกที่มี (' + fish.stock + ' ตัว)'); return; }

  const detailVisible = document.getElementById('saleDetailGroup').style.display !== 'none';

  let cost      = fish.cost || 0;
  let sellPrice = fish.sale_price || fish.priceMin || 0;

  if (detailVisible) {
    cost      = parseFloat(document.getElementById('saleCost').value) || 0;
    sellPrice = parseFloat(document.getElementById('saleSellPrice').value) || 0;
  }

  if (!sellPrice) { showToast('⚠️ กรุณากรอกราคาที่ขายได้'); return; }

  const today      = new Date().toLocaleDateString('en-CA');
  const totalIncome = qty * sellPrice;
  const totalCost   = qty * cost;
  const newStock    = fish.stock - qty;

  // 1) อัปเดตสต็อก + จำค่า cost/sale_price เป็น default
  const { error: fishErr } = await supabase.from('fish')
    .update({ stock: newStock, cost, sale_price: sellPrice })
    .eq('id', fish.id);

  if (fishErr) { showToast('❌ อัปเดตสต็อกไม่ได้: ' + fishErr.message); return; }

  // 2) บันทึกรายรับ (และรายจ่ายต้นทุน ถ้ามี) เข้าหน้ารายรับ-รายจ่าย
  // บันทึกเฉพาะ "กำไร" เป็นรายรับ (ไม่แยกต้นทุนเป็นรายจ่าย)
  const profit = totalIncome - totalCost;
  const rows = [{
    type: 'income',
    name: `ขาย ${fish.name} x${qty} ตัว`,
    amount: profit,
    date: today
  }];

  const { error: finErr } = await supabase.from('finance').insert(rows);
  if (finErr) { showToast('⚠️ ลดสต็อกแล้ว แต่บันทึกรายรับไม่ได้: ' + finErr.message); }

  showToast(`✅ ขาย ${fish.name} x${qty} ตัว สำเร็จ (กำไร ฿${profit.toLocaleString('th-TH')})`);

  closeSaleModal();
  if (_onSaved) _onSaved();
}