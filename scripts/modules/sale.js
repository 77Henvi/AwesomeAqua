import { supabase }   from '../../supabase.js';
import { showToast }  from '../shared/utils.js';

let _currentFish = null;
let _onSaved     = null;

// คืนค่า true ถ้าปลาตัวนี้มี 2 ไซส์ที่ต้องให้เลือก (ราคาคนละราคากัน)
function _hasSizeOptions(fish) {
  return fish.sizeMin != null && fish.sizeMax != null && fish.sizeMin !== fish.sizeMax;
}

// คืนราคาตามไซส์ที่เลือก ('min' | 'max') หรือ fallback ตามเดิมถ้าไม่มีตัวเลือกไซส์
function _priceForSize(fish, sizeChoice) {
  if (fish.sale_price && fish.sale_price > 0) return fish.sale_price;
  if (_hasSizeOptions(fish)) {
    return sizeChoice === 'max' ? (fish.priceMax || fish.priceMin || 0) : (fish.priceMin || 0);
  }
  return fish.priceMax && !fish.priceMin ? fish.priceMax : (fish.priceMin || fish.priceMax || 0);
}

// ── สร้าง modal แบบ dynamic (ไม่ต้องแก้ HTML) ──
export function initSaleModal() {
  if (document.getElementById('saleModal')) return;

  const wrap = document.createElement('div');
  wrap.id = 'saleModal';
  wrap.className = 'sale-modal-overlay';
  wrap.innerHTML = `
    <div class="sale-modal-box">
      <h3 style="margin:0 0 4px;font-size:1.05rem;"><i class="ph ph-shopping-cart"></i> บันทึกการขาย</h3>
      <div id="saleFishName" style="font-size:0.9rem; color:#1e293b; margin-bottom:14px; background: #f8fafc; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0;"></div>

      <div id="saleSizeGroup" style="display:none;">
        <label class="sale-label">ไซส์ที่ขายได้</label>
        <select id="saleSize" class="sale-input"></select>
      </div>

      <div id="saleQtyGroup">
        <label class="sale-label">จำนวนที่ขายได้ (ตัว)</label>
        <input type="number" id="saleQty" class="sale-input" placeholder="1" min="1">
      </div>

      <div id="saleSummary" style="margin-top:10px;font-size:0.95rem;font-weight:600;color:var(--royal-blue,#2563eb);"></div>

      <div style="display:flex;gap:8px;margin-top:18px;">
        <button type="button" onclick="window.closeSaleModal()" class="sale-btn sale-btn-ghost"><i class="ph ph-x"></i> ยกเลิก</button>
        <button type="button" onclick="window.confirmSale()" id="confirmSaleBtn" class="sale-btn sale-btn-primary"><i class="ph ph-check-circle"></i> บันทึกการขาย</button>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);

  // ── style ขั้นต่ำ ──
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
      .sale-label { display:block; font-size:0.85rem; color:#555; margin:10px 0 6px; font-weight:500;}
      .sale-input {
        width: 100%; padding: 10px 12px; border: 1px solid var(--border,#ddd);
        border-radius: 8px; font-size: 1rem; box-sizing: border-box; font-family:var(--font-number);
      }
      select.sale-input { background: #fff; cursor: pointer; }
      .sale-btn { flex: 1; padding: 10px; border-radius: 10px; border: none;
        font-weight: 600; cursor: pointer; font-size: 0.95rem; transition: 0.2s;}
      .sale-btn-primary { background: #059669; color: #fff; }
      .sale-btn-primary:hover { opacity: 0.9; }
      .sale-btn-ghost { background: #f1f5f9; color: #475569; }
      .sale-btn-ghost:hover { background: #e2e8f0; }
    `;
    document.head.appendChild(style);
  }

  // ── live summary คำนวณยอดเงินรวม ──
  document.getElementById('saleQty').addEventListener('input', _updateSummary);
  document.getElementById('saleSize').addEventListener('change', () => {
    _updateFishInfo();
    _updateSummary();
  });

  // expose สำหรับ inline onclick
  window.closeSaleModal = closeSaleModal;
  window.confirmSale    = confirmSale;
}

function _currentSizeChoice() {
  const sel = document.getElementById('saleSize');
  return (sel && !sel.parentElement.style.display.includes('none')) ? sel.value : 'min';
}

function _updateFishInfo() {
  const fish = _currentFish;
  if (!fish) return;
  const sellPrice = _priceForSize(fish, _currentSizeChoice());

  document.getElementById('saleFishName').innerHTML = `
    <div style="font-weight: 600; margin-bottom: 4px;">${fish.emoji || '🐟'} ${fish.name_th || fish.name}</div>
    <div style="display: flex; justify-content: space-between; font-size: 0.8rem;">
      <span style="color: var(--gray);">เหลือในสต็อก: <strong>${fish.stock}</strong> ตัว</span>
      <span style="color: var(--royal-blue); font-weight:600;">ตัวละ ฿${sellPrice.toLocaleString('th-TH')}</span>
    </div>
  `;
}

function _updateSummary() {
  const fish = _currentFish;
  if (!fish) return;

  const qty  = parseInt(document.getElementById('saleQty').value) || 0;
  const sellPrice = _priceForSize(fish, _currentSizeChoice());

  const el = document.getElementById('saleSummary');
  if (!qty) { el.textContent = ''; return; }

  const income = qty * sellPrice;
  el.innerHTML = `ยอดรวมรายรับ: ฿${income.toLocaleString('th-TH')}`;
}

/**
 * เปิด popup บันทึกการขาย
 */
export function openSaleModal(fish, onSaved) {
  initSaleModal();
  _currentFish = fish;
  _onSaved     = onSaved;

  // ── ตั้งค่า dropdown เลือกไซส์ (แสดงเฉพาะเมื่อปลามี 2 ไซส์ ราคาต่างกัน) ──
  const sizeGroup = document.getElementById('saleSizeGroup');
  const sizeSel   = document.getElementById('saleSize');
  if (_hasSizeOptions(fish)) {
    sizeSel.innerHTML = `
      <option value="min">📏 ${fish.sizeMin} นิ้ว (฿${(fish.priceMin || 0).toLocaleString('th-TH')})</option>
      <option value="max">📏 ${fish.sizeMax} นิ้ว (฿${(fish.priceMax || fish.priceMin || 0).toLocaleString('th-TH')})</option>
    `;
    sizeSel.value = 'min';
    sizeGroup.style.display = 'block';
  } else {
    sizeSel.innerHTML = '';
    sizeGroup.style.display = 'none';
  }

  // อัปเดตข้อมูลบนป๊อปอัป
  _updateFishInfo();

  document.getElementById('saleQty').value = '1'; // ตั้งค่าเริ่มต้นที่ 1 ตัว
  document.getElementById('saleQty').max   = fish.stock;
  
  _updateSummary(); // แสดงยอดรวมเริ่มต้นทันที

  document.getElementById('saleModal').classList.add('open');
  document.getElementById('saleQty').focus();
}

export function closeSaleModal() {
  document.getElementById('saleModal')?.classList.remove('open');
  _currentFish = null;
}

export async function confirmSale() {
  const fish = _currentFish;
  if (!fish) return;

  const qty = parseInt(document.getElementById('saleQty').value) || 0;
  if (qty <= 0) { showToast('⚠️ กรุณากรอกจำนวนที่ขาย'); return; }
  if (qty > fish.stock) { showToast(`⚠️ จำนวนเกินสต็อกที่มี (${fish.stock} ตัว)`); return; }

  const btn = document.getElementById('confirmSaleBtn');
  btn.disabled = true;
  btn.textContent = 'กำลังบันทึก...';

  const sizeChoice   = _currentSizeChoice();
  const sellPrice    = _priceForSize(fish, sizeChoice);
  const sizeLabel    = _hasSizeOptions(fish)
    ? ` (ไซส์ ${sizeChoice === 'max' ? fish.sizeMax : fish.sizeMin} นิ้ว)`
    : '';
  const today     = new Date().toLocaleDateString('en-CA');
  const totalIncome = qty * sellPrice;
  const newStock  = fish.stock - qty;

  try {
    const { error: fishErr } = await supabase.from('fish')
      .update({ stock: newStock })
      .eq('id', fish.id);

    if (fishErr) throw fishErr;

    const { error: finErr } = await supabase.from('finance').insert([{
      type: 'income',
      name: `ขายปลา: ${fish.name_th || fish.name}${sizeLabel} x${qty} ตัว`,
      amount: totalIncome,
      date: today,
      fish_id: fish.id 
    }]);

    if (finErr) throw finErr;

    showToast(`✅ ขาย ${fish.name_th || fish.name}${sizeLabel} x${qty} ตัว สำเร็จ (รับเงิน ฿${totalIncome.toLocaleString('th-TH')})`);
    
    if (typeof window.loadFinanceFromDB === 'function') {
      window.loadFinanceFromDB();
    }

    closeSaleModal();
    if (_onSaved) _onSaved();

    // ── สต็อกหมดพอดี ถามว่าจะรีสต็อคอีกไหม ถ้าไม่รีสต็อค ให้ "เลิกขาย" ไปเลย ──
    // (เลิกขาย = ซ่อนจากหน้าร้าน/ตารางหลัก แต่ไม่ลบข้อมูล รายรับ/รายจ่ายเดิมยังอยู่ครบ)
    if (newStock === 0) {
      setTimeout(async () => {
        const willRestock = confirm(
          `🐟 "${fish.name_th || fish.name}" หมดสต็อกแล้ว!\n\n` +
          `จะรีสต็อคปลาตัวนี้อีกไหม?\n\n` +
          `กด "ตกลง" = จะรีสต็อค (เก็บไว้ในตารางเหมือนเดิม)\n` +
          `กด "ยกเลิก" = เลิกขายเลย (ซ่อนจากหน้าร้าน แต่ประวัติการขายเดิมไม่หายไป)`
        );
        if (!willRestock) {
          const { error } = await supabase.from('fish').update({ is_archived: true }).eq('id', fish.id);
          if (!error) {
            showToast('📦 เลิกขายปลาตัวนี้แล้ว (ย้ายไปแท็บ "เลิกขายแล้ว")');
            if (typeof window.loadFishFromDB === 'function') window.loadFishFromDB();
          }
        }
      }, 300);
    }
    
  } catch (err) {
    console.error(err);
    showToast('❌ ผิดพลาด: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ph ph-check-circle"></i> บันทึกการขาย';
  }
}