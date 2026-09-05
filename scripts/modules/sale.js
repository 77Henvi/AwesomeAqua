import { supabase }   from '../../supabase.js';
import { showToast, escapeHTML }  from '../shared/utils.js';
import { hasSizeOptions as _hasSizeOptions, priceForSize as _priceForSize, shouldPromptArchive, isLowStock, LOW_STOCK_THRESHOLD } from '../shared/calc.js';
import { EMS_COST_OPTIONS, resolveShippingCost, searchPendingShipmentGroups, groupShipments, SHIPPING_METHOD_LABEL } from '../shared/shipments.js';

let _currentFish = null;
let _onSaved     = null;
let _pendingGroups   = [];  // แคชพัสดุที่ "รอจัดส่ง" อยู่ทั้งหมด — ใช้ค้นหาตอนพิมพ์ชื่อลูกค้า (ดึงใหม่ทุกครั้งที่ติ๊ก "มีการจัดส่ง")
let _attachedGroupId = null; // ถ้าเลือกแนบเข้าพัสดุเดิม จะเก็บ shipment_group_id ไว้ตรงนี้ (null = จะสร้างพัสดุใหม่)

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

      <label class="sale-ship-toggle">
        <input type="checkbox" id="saleShipToggle">
        <i class="ph ph-truck"></i> มีการจัดส่ง
      </label>

      <div id="saleShipFields" style="display:none;">
        <label class="sale-label">ชื่อลูกค้า</label>
        <div style="position:relative;">
          <input type="text" id="saleCustomerName" class="sale-input" placeholder="พิมพ์ชื่อลูกค้า..." autocomplete="off">
          <div id="saleCustomerSuggest" class="sale-suggest"></div>
        </div>
        <div id="saleAttachedNote" style="display:none;font-size:0.78rem;color:#2563eb;background:#eff6ff;padding:6px 8px;border-radius:6px;margin-top:6px;">
          <i class="ph ph-link"></i> <span id="saleAttachedText"></span>
          <a href="#" onclick="window.__saleDetachGroup();return false;" style="color:#2563eb;text-decoration:underline;float:right;">ยกเลิก</a>
        </div>

        <label class="sale-label">วิธีจัดส่ง</label>
        <select id="saleShipMethod" class="sale-input">
          <option value="ems">EMS (ต่างจังหวัด)</option>
          <option value="lalamove">Lalamove (ในกรุง)</option>
        </select>

        <div id="saleEmsCostGroup">
          <label class="sale-label">ค่าส่ง EMS</label>
          <select id="saleEmsCost" class="sale-input">
            ${EMS_COST_OPTIONS.map(c => `<option value="${c}">฿${c}</option>`).join('')}
          </select>
        </div>
        <div id="saleLalaCostGroup" style="display:none;">
          <label class="sale-label">ค่าส่ง Lalamove (ถ้ามี)</label>
          <input type="number" id="saleLalaCost" class="sale-input" placeholder="เช่น 120" min="0">
        </div>

        <label class="sale-label">วันที่จัดส่ง</label>
        <input type="date" id="saleShipDate" class="sale-input">
      </div>

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
      .sale-ship-toggle {
        display: flex; align-items: center; gap: 8px; font-size: 0.9rem; font-weight: 500;
        padding: 10px 2px; margin-top: 12px; border-top: 1px solid var(--border,#eee); cursor: pointer;
      }
      .sale-ship-toggle input { width: 16px; height: 16px; cursor: pointer; }
      .sale-suggest {
        display: none; position: absolute; left: 0; right: 0; top: calc(100% + 2px); z-index: 10;
        background: #fff; border: 1px solid var(--border,#ddd); border-radius: 8px;
        box-shadow: 0 6px 16px rgba(0,0,0,0.12); max-height: 180px; overflow-y: auto;
      }
      .sale-suggest.open { display: block; }
      .sale-suggest-item { padding: 8px 12px; cursor: pointer; font-size: 0.85rem; border-bottom: 1px solid #f1f5f9; }
      .sale-suggest-item:last-child { border-bottom: none; }
      .sale-suggest-item:hover { background: #f8fafc; }
      .sale-suggest-item small { display: block; color: #64748b; font-size: 0.75rem; margin-top: 2px; }
    `;
    document.head.appendChild(style);
  }

  // ── live summary คำนวณยอดเงินรวม ──
  document.getElementById('saleQty').addEventListener('input', _updateSummary);
  document.getElementById('saleSize').addEventListener('change', () => {
    _updateFishInfo();
    _updateSummary();
  });

  // ── toggle ฟิลด์จัดส่ง + สลับ EMS/Lalamove ──
  document.getElementById('saleShipToggle').addEventListener('change', (e) => {
    document.getElementById('saleShipFields').style.display = e.target.checked ? 'block' : 'none';
    if (e.target.checked) _fetchPendingGroups();
  });
  document.getElementById('saleShipMethod').addEventListener('change', (e) => {
    const isEms = e.target.value === 'ems';
    document.getElementById('saleEmsCostGroup').style.display  = isEms ? 'block' : 'none';
    document.getElementById('saleLalaCostGroup').style.display = isEms ? 'none'  : 'block';
  });

  // ── ค้นหาชื่อลูกค้า: พิมพ์แล้วโชว์พัสดุที่ "รอจัดส่ง" อยู่แล้วที่ชื่อตรงกัน ให้เลือกแนบได้เลย ──
  document.getElementById('saleCustomerName').addEventListener('input', (e) => {
    _attachedGroupId = null; // พิมพ์ใหม่ = ยกเลิกการแนบเดิม (ถ้ามี) จนกว่าจะเลือกจาก suggestion อีกครั้ง
    document.getElementById('saleAttachedNote').style.display = 'none';
    _renderCustomerSuggestions(e.target.value);
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#saleCustomerSuggest') && e.target.id !== 'saleCustomerName') {
      document.getElementById('saleCustomerSuggest')?.classList.remove('open');
    }
  });
  window.__saleDetachGroup = () => {
    _attachedGroupId = null;
    document.getElementById('saleAttachedNote').style.display = 'none';
    document.getElementById('saleShipMethod').disabled = false;
    document.getElementById('saleShipDate').disabled   = false;
  };

  // expose สำหรับ inline onclick
  window.closeSaleModal = closeSaleModal;
  window.confirmSale    = confirmSale;
}

// ── โหลดพัสดุที่ "รอจัดส่ง" อยู่ทั้งหมด มาแคชไว้ค้นหาตอนพิมพ์ชื่อลูกค้า (เรียกครั้งเดียวตอนติ๊กเปิด) ──
async function _fetchPendingGroups() {
  const { data, error } = await supabase.from('shipments').select('*').eq('status', 'pending')
    .order('created_at', { ascending: true }); // เรียงลำดับให้แน่นอน กันรายการปลาในพัสดุสลับที่ไปมาทุกครั้งที่โหลด
  if (error) { _pendingGroups = []; return; }
  // รวมเป็นพัสดุ (ไม่ใช่รายแถว) ด้วยฟังก์ชันเดียวกับที่แท็บ "จัดส่ง" ใช้ กันลอจิกเพี้ยนกันคนละที่
  _pendingGroups = groupShipments(data || []);
}

function _renderCustomerSuggestions(query) {
  const box = document.getElementById('saleCustomerSuggest');
  const matches = searchPendingShipmentGroups(_pendingGroups, query);

  if (!matches.length) { box.classList.remove('open'); box.innerHTML = ''; return; }

  box.innerHTML = matches.map(g => `
    <div class="sale-suggest-item" onclick="window.__saleAttachGroup('${g.group_id}')">
      ${escapeHTML(g.customer_name)}
      <small>แนบเข้าพัสดุเดิม · ${SHIPPING_METHOD_LABEL[g.shipping_method] || g.shipping_method} · จัดส่ง ${g.shipping_date}</small>
    </div>
  `).join('');
  box.classList.add('open');
}

function _attachGroup(groupId) {
  const g = _pendingGroups.find(x => x.group_id === groupId);
  if (!g) return;

  _attachedGroupId = groupId;
  document.getElementById('saleCustomerName').value = g.customer_name;
  document.getElementById('saleCustomerSuggest').classList.remove('open');

  document.getElementById('saleShipMethod').value = g.shipping_method;
  document.getElementById('saleShipMethod').dispatchEvent(new Event('change'));
  document.getElementById('saleShipMethod').disabled = true;
  if (g.shipping_method === 'ems') document.getElementById('saleEmsCost').value = g.shipping_cost;
  else document.getElementById('saleLalaCost').value = g.shipping_cost;

  document.getElementById('saleShipDate').value    = g.shipping_date;
  document.getElementById('saleShipDate').disabled = true;

  document.getElementById('saleAttachedText').textContent = `แนบเข้าพัสดุของ "${g.customer_name}" (${g.items.length} รายการ) — ไม่ต้องกรอกวิธีจัดส่ง/วันที่ซ้ำ`;
  document.getElementById('saleAttachedNote').style.display = 'block';
}
window.__saleAttachGroup = _attachGroup;

// ── สร้าง uuid ไว้ใช้เป็น shipment_group_id — crypto.randomUUID() ใช้ได้เฉพาะ secure context
// (https/localhost) และเบราว์เซอร์ที่ค่อนข้างใหม่ ถ้าไม่มีให้ fallback เป็น RFC4122-v4 แบบมือ
function _genGroupId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
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

  // ── รีเซ็ตฟิลด์จัดส่งทุกครั้งที่เปิดป๊อปอัปใหม่ (ไม่ให้ค้างจากการขายครั้งก่อน) ──
  _attachedGroupId = null;
  document.getElementById('saleShipToggle').checked = false;
  document.getElementById('saleShipFields').style.display = 'none';
  document.getElementById('saleCustomerName').value = '';
  document.getElementById('saleCustomerSuggest').classList.remove('open');
  document.getElementById('saleAttachedNote').style.display = 'none';
  document.getElementById('saleShipMethod').value = 'ems';
  document.getElementById('saleShipMethod').disabled = false;
  document.getElementById('saleEmsCostGroup').style.display  = 'block';
  document.getElementById('saleLalaCostGroup').style.display = 'none';
  document.getElementById('saleLalaCost').value = '';
  document.getElementById('saleShipDate').value = new Date().toLocaleDateString('en-CA');
  document.getElementById('saleShipDate').disabled = false;

  _updateSummary(); // แสดงยอดรวมเริ่มต้นทันที

  document.getElementById('saleModal').classList.add('open');
  document.getElementById('saleQty').focus();
}

export function closeSaleModal() {
  document.getElementById('saleModal')?.classList.remove('open');
  _currentFish = null;
  _attachedGroupId = null;
}

// ── แจ้งเตือนแอดมินผ่าน Messenger ตอนสต็อกใกล้หมด/หมดแล้ว ──
// fire-and-forget: ไม่ await ผลลัพธ์ตรงๆ ในจุดเรียกใช้ กันไม่ให้ error เรื่องแจ้งเตือนไปกระทบ flow การขายหลัก
async function _notifyLowStock(fishName, stock) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return; // ไม่มี session ก็ข้ามไปเงียบๆ ไม่ต้อง error ให้กวนใจ

    const res = await fetch('/api/notify-low-stock', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ fishName, stock, threshold: LOW_STOCK_THRESHOLD }),
    });

    if (!res.ok) console.warn('แจ้งเตือนสต็อกใกล้หมดไม่สำเร็จ:', await res.text());
  } catch (err) {
    console.warn('แจ้งเตือนสต็อกใกล้หมด: เกิดข้อผิดพลาด', err);
  }
}

export async function confirmSale() {
  const fish = _currentFish;
  if (!fish) return;

  const qty = parseInt(document.getElementById('saleQty').value) || 0;
  if (qty <= 0) { showToast('⚠️ กรุณากรอกจำนวนที่ขาย'); return; }
  // เช็คเบื้องต้นจาก cache ให้ UX เร็ว (ตัวเช็คจริงที่กันพลาดคือใน DB ผ่าน RPC ด้านล่าง)
  if (qty > fish.stock) { showToast(`⚠️ จำนวนเกินสต็อกที่มี (${fish.stock} ตัว)`); return; }

  // ── ข้อมูลจัดส่ง (ถ้าติ๊ก "มีการจัดส่ง" ไว้) ──
  const wantsShipping = document.getElementById('saleShipToggle').checked;
  const customerName  = document.getElementById('saleCustomerName').value.trim();
  const shipMethod    = document.getElementById('saleShipMethod').value;
  const shipDate       = document.getElementById('saleShipDate').value;
  if (wantsShipping) {
    if (!customerName) { showToast('⚠️ กรุณากรอกชื่อลูกค้า'); return; }
    if (!shipDate)      { showToast('⚠️ กรุณาเลือกวันที่จัดส่ง'); return; }
  }
  const shipCostRaw = shipMethod === 'ems'
    ? document.getElementById('saleEmsCost').value
    : document.getElementById('saleLalaCost').value;
  const shipCost = resolveShippingCost(shipMethod, shipCostRaw);

  const btn = document.getElementById('confirmSaleBtn');
  btn.disabled = true;
  btn.textContent = 'กำลังบันทึก...';

  const sizeChoice   = _currentSizeChoice();
  const sellPrice    = _priceForSize(fish, sizeChoice);
  const sizeLabel    = _hasSizeOptions(fish)
    ? ` (ไซส์ ${sizeChoice === 'max' ? fish.sizeMax : fish.sizeMin} นิ้ว)`
    : '';
  const today        = new Date().toLocaleDateString('en-CA');
  const totalIncome  = qty * sellPrice;

  try {
    // หัก stock + บันทึกรายรับ ใน transaction เดียวที่ฝั่ง DB (ล็อกแถวกันขายซ้อนพร้อมกัน)
    // ดู docs/PHASE0_ATOMIC_STOCK_SETUP.md — ต้องรัน SQL สร้าง RPC นี้ก่อนใช้งานได้
    const { data: newStock, error: rpcErr } = await supabase.rpc('record_fish_sale', {
      p_fish_id: fish.id,
      p_qty: qty,
      p_amount: totalIncome,
      p_name: `ขายปลา: ${fish.name_th || fish.name}${sizeLabel} x${qty} ตัว`,
      p_date: today,
    });

    if (rpcErr) {
      // ข้อความ error จาก DB function กรณีสต็อกไม่พอ/ไม่เจอปลา (แปลงให้อ่านง่ายขึ้น)
      if (rpcErr.message?.includes('INSUFFICIENT_STOCK')) {
        showToast('⚠️ สต็อกไม่พอแล้ว (มีคนขายไปพร้อมกันหรือสต็อกเปลี่ยนไป) กรุณาเช็คสต็อกอีกครั้ง');
      } else if (rpcErr.message?.includes('FISH_NOT_FOUND')) {
        showToast('⚠️ ไม่พบปลาตัวนี้แล้ว (อาจถูกลบไปแล้ว)');
      } else {
        throw rpcErr;
      }
      return;
    }

    showToast(`✅ ขาย ${fish.name_th || fish.name}${sizeLabel} x${qty} ตัว สำเร็จ (รับเงิน ฿${totalIncome.toLocaleString('th-TH')})`);

    if (typeof window.loadFinanceFromDB === 'function') {
      window.loadFinanceFromDB();
    }

    // ── บันทึกข้อมูลจัดส่งแยกลงตาราง shipments (ถ้าติ๊ก "มีการจัดส่ง" ไว้) ──
    // ดู docs/SHIPPING_CHECKLIST_SETUP.md — ต้องรัน SQL สร้างตารางนี้ก่อนใช้งานได้
    // หา finance_id ของรายรับที่เพิ่งสร้างจาก RPC ด้านบน (RPC คืนแค่ยอดสต็อกใหม่ ไม่คืน id ของแถว finance)
    if (wantsShipping) {
      const { data: financeRow } = await supabase
        .from('finance')
        .select('id')
        .eq('fish_id', fish.id)
        .eq('date', today)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { error: shipErr } = await supabase.from('shipments').insert({
        finance_id:        financeRow?.id || null,
        fish_id:           fish.id,
        fish_name:         `${fish.name_th || fish.name}${sizeLabel} x${qty} ตัว`,
        customer_name:     customerName,
        shipping_method:   shipMethod,
        shipping_cost:     shipCost,
        shipping_date:     shipDate,
        shipment_group_id: _attachedGroupId || _genGroupId(), // แนบเข้าพัสดุเดิม หรือสร้างพัสดุใหม่ (เผื่อมีคนมาแนบเข้าทีหลัง)
      });

      if (shipErr) {
        showToast('<i class="ph-fill ph-warning-circle" style="color:#f59e0b;"></i> ขายสำเร็จ แต่บันทึกข้อมูลจัดส่งไม่สำเร็จ (เพิ่มในแท็บ "จัดส่ง" เองได้)');
      } else if (typeof window.loadShipments === 'function') {
        window.loadShipments();
      }
    }

    closeSaleModal();
    if (_onSaved) _onSaved();

    // ── สต็อกใกล้หมด/หมดแล้ว แจ้งเตือนแอดมินผ่าน Messenger (เผื่อไม่ได้อยู่หน้าจอตอนนั้น) ──
    if (isLowStock(newStock)) {
      _notifyLowStock(fish.name_th || fish.name, newStock);
    }

    // ── สต็อกหมดพอดี ถามว่าจะรีสต็อคอีกไหม ถ้าไม่รีสต็อค ให้ "เลิกขาย" ไปเลย ──
    // (เลิกขาย = ซ่อนจากหน้าร้าน/ตารางหลัก แต่ไม่ลบข้อมูล รายรับ/รายจ่ายเดิมยังอยู่ครบ)
    if (shouldPromptArchive(newStock)) {
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