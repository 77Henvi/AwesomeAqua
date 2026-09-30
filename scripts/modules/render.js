// scripts/modules/render.js
import { fishData } from './fishData.js';
import { MESSENGER_ICON, storeEmpty } from '../shared/utils.js';
import { describeSales, sortFish } from '../shared/fishSales.js';

// --- State Management ---
let sortMode = 'default';
let searchQuery = '';
let displayedFish = []; // ลำดับที่แสดงบนหน้าจอจริง (พร้อมจำหน่าย → หมดสต็อก) ใช้ให้ปุ่ม ถัดไป/ก่อนหน้า ใน modal เดินตามลำดับที่ลูกค้าเห็น

const isEnLang = () => (localStorage.getItem('aqua-lang') || 'th') === 'en';

const SORT_LABELS = {
  th: { 'default': 'ทั้งหมด', 'price-desc': 'ราคาสูง → ต่ำ', 'price-asc': 'ราคาต่ำ → สูง', 'level-asc': 'เลี้ยงง่ายสุด → ยากสุด', 'level-desc': 'เลี้ยงยากสุด → ง่ายสุด' },
  en: { 'default': 'All',     'price-desc': 'Price: High → Low', 'price-asc': 'Price: Low → High', 'level-asc': 'Easiest → Hardest', 'level-desc': 'Hardest → Easiest' },
};

const GROUP_TEXT = {
  th: { inStock: 'พร้อมจำหน่าย', outStock: 'สินค้าหมดชั่วคราว', noResult: 'ไม่พบผลลัพธ์ที่ค้นหา' },
  en: { inStock: 'In Stock',     outStock: 'Out of Stock',      noResult: 'No results found' },
};

export function getDisplayedFish() {
  return displayedFish;
}

export function getCurrentSort() {
  return sortMode;
}

/** เปลี่ยนการเรียงลำดับ (กดชิปเดิมซ้ำ = กลับไปลำดับปกติ) */
export function setFishSort(mode, btnElement) {
  sortMode = (mode === sortMode && mode !== 'default') ? 'default' : mode;
  _syncChips();
  renderFishGrid();
}

function _syncChips() {
  document.querySelectorAll('.filter-chips .chip').forEach(c => {
    const on = c.dataset.sort === sortMode;
    c.classList.toggle('active', on);
    c.setAttribute('aria-pressed', String(on));
  });
}

export function filterFish(query) {
    searchQuery = query.toLowerCase().trim();
    renderFishGrid();
}
// ------------------------

export function isComingSoon(f) {
  return f.stock === 0 && f.priceMin === 0;
}

// ── ส่วนประกอบย่อยของการ์ด: ป้ายบนรูป / ราคา (+ราคาขีดฆ่า) / ยอดขาย ──
function _salesBadgeHtml(sales) {
  if (sales.kind === 'hot') {
    return `<div class="sales-badge sales-badge--hot"><i class="ph-fill ph-fire"></i> ${sales.label}</div>`;
  }
  if (sales.kind === 'discount') {
    return `<div class="sales-badge sales-badge--sale"><i class="ph-fill ph-tag"></i> ${sales.label}</div>`;
  }
  return '';
}

function _priceHtml(f, sales, outOfStock) {
  const range = `฿${f.priceMin.toLocaleString()}${f.priceMax ? ' – ' + f.priceMax.toLocaleString() : ''}`;
  const old = sales.refMin
    ? `<s class="fish-price-old" aria-label="ราคาเดิม">฿${sales.refMin.toLocaleString()}${sales.refMax ? ' – ' + sales.refMax.toLocaleString() : ''}</s>`
    : '';
  return `<div class="fish-price-wrap">${old}<div class="fish-price ${outOfStock ? 'fish-price--dim' : ''} ${sales.refMin ? 'fish-price--sale' : ''}">${range}</div></div>`;
}

/// ── การ์ดปลาขายปกติ (เวอร์ชันคลีน) ──
function _availableCard(f) {
  const outOfStock = f.stock === 0;
  
  const lang = localStorage.getItem('aqua-lang') || 'th'; 
  const isEn = lang === 'en';

  const displayName = isEn && f.name_en ? f.name_en : f.name_th;
  
  const txtUnit = isEn ? 'pcs' : 'ตัว';
  const txtOrder = isEn ? 'Order' : 'สั่งซื้อ';
  const txtOut = isEn ? 'Out of stock' : 'หมดสต็อก';
  const txtEmpty = isEn ? '<i class="ph ph-x-circle"></i> Out' : '<i class="ph ph-x-circle"></i> หมด';

  const sales = describeSales(f, isEn);
  const fallbackIcon = `<i class="ph ph-fish"></i>`;
  // ใช้เฉพาะใน onerror="..." ที่ซ้อน quote 3 ชั้น (attribute > JS string > HTML tag)
  // ถ้าใส่ fallbackIcon (มี " ตรงๆ) ตรงนี้ จะตัด attribute onerror="..." ก่อนกำหนด ทำให้ HTML พัง
  const fallbackIconEsc = `<i class=&quot;ph ph-fish&quot;></i>`;

  return `
    <div class="fish-card ${outOfStock ? 'fish-card--out' : ''}" role="button" tabindex="0" aria-label="ดูรายละเอียด ${displayName}"
         onclick="openFishDetail('${f.id}')"
         onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openFishDetail('${f.id}')}">
      <div class="card-spotlight"></div>
      <div class="fish-card-img-wrap">
        ${f.image
          ? `<img src="${f.image}" alt="${displayName}" loading="lazy" onerror="this.parentElement.innerHTML='<span>${f.emoji || fallbackIconEsc}</span>'">`
          : `<span>${f.emoji || fallbackIcon}</span>`
        }
        <div class="card-img-gradient"></div>
        ${outOfStock ? `<div class="out-badge">${txtOut}</div>` : ''}
        ${_salesBadgeHtml(sales)}
      </div>
      <div class="fish-info">
        <div class="fish-name">${displayName}</div>
        <div class="fish-species">${f.species || '—'}</div>
        ${sales.soldText ? `<div class="fish-sold"><i class="ph ph-shopping-bag" aria-hidden="true"></i> ${sales.soldText}</div>` : ''}
        
        <div class="fish-meta">
          ${_priceHtml(f, sales, outOfStock)}
          <div class="fish-stock ${f.stock > 0 && f.stock <= 5 ? 'low' : ''}">
            ${f.stock === 0 ? txtEmpty : f.stock <= 5 ? `<span class="stock-dot stock-dot--low"></span> ${f.stock} ${txtUnit}` : `<span class="stock-dot stock-dot--ok"></span> ${f.stock} ${txtUnit}`}
          </div>
        </div>
        
        ${f.stock > 0
          ? `<button class="btn-messenger" style="width:100%;justify-content:center"
               onclick="event.stopPropagation(); openMessenger('${f.id}')">
               ${MESSENGER_ICON(16)} <span>${txtOrder}</span>
             </button>`
          : `<button class="btn" style="width:100%;background:#f3f4f6;color:#9ca3af;cursor:not-allowed" disabled>${txtOut}</button>`
        }
      </div>
    </div>`;
}

// ── การ์ด Coming Soon ──
function _comingSoonCard(f) {
  const lang = localStorage.getItem('aqua-lang') || 'th'; 
  const isEn = lang === 'en';

  const displayName = isEn && f.name_en ? f.name_en : f.name_th;
  const displayTags = isEn && f.tags_en?.length ? f.tags_en : f.tags_th;
  
  const txtBadge = isEn ? '<i class="ph ph-bell"></i> View Details' : '<i class="ph ph-bell"></i> กดดูรายละเอียด';
  const tapeSep = '<i class="ph ph-sparkle"></i>';
  const txtTape = isEn ? `${tapeSep} COMING SOON ${tapeSep} ` : `${tapeSep} COMING SOON ${tapeSep} เร็วๆ นี้ ${tapeSep} `;
  
  const fallbackIcon = `<i class="ph ph-fish"></i>`;
  const fallbackIconEsc = `<i class=&quot;ph ph-fish&quot;></i>`;

  return `
    <div class="fish-card fish-card--coming" role="button" tabindex="0" aria-label="ดูรายละเอียด ${displayName} (เร็วๆ นี้)"
         onclick="openComingSoonDetail('${f.id}')"
         onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openComingSoonDetail('${f.id}')}">
      <div class="fish-card-img-wrap fish-img--coming">
        ${f.image
          ? `<img src="${f.image}" alt="${displayName}" loading="lazy" onerror="this.parentElement.innerHTML='<span class=coming-emoji>${f.emoji || fallbackIconEsc}</span>'">`
          : `<span class="coming-emoji">${f.emoji || fallbackIcon}</span>`
        }
        
        <div class="coming-tape-wrapper">
          <div class="coming-tape-content">
            <span>${txtTape.repeat(4)}</span>
            <span>${txtTape.repeat(4)}</span>
          </div>
        </div>
        
        <div class="coming-overlay"></div>
      </div>
      <div class="fish-info fish-info--coming">
        <div class="fish-name">${displayName}</div>
        <div class="fish-species">${f.species || '—'}</div>
        <div class="fish-tags">${(displayTags || []).map(t => `<span class="tag tag--dim">${t}</span>`).join('')}</div>
        <div class="coming-badge">${txtBadge}</div>
      </div>
    </div>`;
}

// ── Render หลัก ──
function _groupHead(label, count) {
  return `<h3 class="store-group-title">${label}</h3><span class="store-group-count">${count}</span>`;
}

export function renderFishGrid() {
  const grid      = document.getElementById('fishGrid');
  const inHead    = document.getElementById('fishInHead');
  const outSec    = document.getElementById('fishOutSection');
  const outHead   = document.getElementById('fishOutHead');
  const outGrid   = document.getElementById('fishOutGrid');
  const csSection = document.getElementById('comingSoonSection');
  const csGrid    = document.getElementById('comingSoonGrid');

  const gt = GROUP_TEXT[isEnLang() ? 'en' : 'th'];

  // 1. กรองด้วยคำค้นหา
  const filteredData = fishData.filter(f => {
      const nameTh = (f.name_th || '').toLowerCase();
      const nameEn = (f.name_en || '').toLowerCase();
      const species = (f.species || '').toLowerCase();
      return nameTh.includes(searchQuery) || nameEn.includes(searchQuery) || species.includes(searchQuery);
  });

  // 2. แยก Available / Coming Soon
  const available  = filteredData.filter(f => !isComingSoon(f));
  const comingSoon = filteredData.filter(f =>  isComingSoon(f));

  // 3. แยก "พร้อมจำหน่าย" กับ "หมดสต็อก" ออกจากกัน แล้วเรียงลำดับภายในแต่ละกลุ่ม
  //    (สินค้าหมดจะไม่ปนอยู่กลางรายการอีก ไม่ว่าจะเลือกเรียงแบบไหน)
  const inStock  = sortFish(available.filter(f => f.stock > 0),   sortMode);
  const outStock = sortFish(available.filter(f => !(f.stock > 0)), sortMode);
  displayedFish  = [...inStock, ...outStock];

  if (grid) {
      if (available.length === 0) {
          grid.style.display = '';
          grid.innerHTML = storeEmpty('ph ph-magnifying-glass-minus', gt.noResult);
          if (inHead) inHead.hidden = true;
      } else if (inStock.length === 0) {
          // มีแต่ของหมด → ซ่อนกลุ่มพร้อมจำหน่ายไปเลย ไม่ต้องโชว์กล่องว่าง
          grid.style.display = 'none';
          grid.innerHTML = '';
          if (inHead) inHead.hidden = true;
      } else {
          grid.style.display = '';
          grid.innerHTML = inStock.map(_availableCard).join('');
          // หัวข้อ "พร้อมจำหน่าย" โชว์เมื่อมีอีกกลุ่มให้แยกเท่านั้น (ถ้าไม่มีของหมดเลยก็ไม่ต้องมีหัวข้อ)
          if (inHead) {
              inHead.hidden = outStock.length === 0;
              inHead.innerHTML = _groupHead(gt.inStock, inStock.length);
          }
      }
  }

  if (outSec && outGrid) {
      if (outStock.length > 0) {
          outSec.hidden = false;
          if (outHead) outHead.innerHTML = _groupHead(gt.outStock, outStock.length);
          outGrid.innerHTML = outStock.map(_availableCard).join('');
      } else {
          outSec.hidden = true;
          outGrid.innerHTML = '';
      }
  }

  // Update Bento Spotlight if present (ใช้ลำดับเดิมจาก DB ไม่เปลี่ยนตามการเรียง)
  const featured = available.find(f => f.stock > 0 && f.image) || available[0];
  if (featured) {
    const lang = localStorage.getItem('aqua-lang') || 'th';
    const isEn = lang === 'en';
    const bentoName = document.getElementById('bentoFeaturedName');
    const bentoDesc = document.getElementById('bentoFeaturedDesc');
    const bentoPrice = document.getElementById('bentoFeaturedPrice');
    const bentoImg = document.getElementById('bentoFeaturedImg');
    const bentoCard = document.getElementById('bentoFeaturedCard');
    if (bentoName) bentoName.textContent = isEn && featured.name_en ? featured.name_en : featured.name_th;
    // มีคำอธิบายจริงของปลาตัวนี้ค่อยทับข้อความ default (ที่มาจาก data-i18n) —
    // ถ้าปลายังไม่มีคำอธิบายให้กรอก ปล่อยให้ข้อความ default ที่แปลไว้แล้วแสดงแทน
    if (bentoDesc) {
      const desc = isEn && featured.desc_en ? featured.desc_en : featured.desc_th;
      if (desc) bentoDesc.textContent = desc;
    }
    if (bentoPrice) bentoPrice.textContent = `฿${featured.priceMin.toLocaleString()}${featured.priceMax ? ' – ฿' + featured.priceMax.toLocaleString() : ''}`;
    if (bentoImg && featured.image) bentoImg.src = featured.image;
    if (bentoCard) {
      bentoCard.onclick = () => {
        if (typeof window.openFishDetail === 'function') window.openFishDetail(featured.id);
      };
      const bentoBtn = bentoCard.querySelector('.bento-btn-order');
      if (bentoBtn) {
        bentoBtn.onclick = (e) => {
          e.stopPropagation();
          if (typeof window.openMessenger === 'function') window.openMessenger(featured.id);
        };
      }
    }
  }

  // Render Coming Soon
  if (csSection && csGrid) {
    if (comingSoon.length < 3) {
      csSection.style.display = 'none';
    } else {
      csSection.style.display = '';
      csGrid.innerHTML = comingSoon.map(_comingSoonCard).join('');
    }
  }

  // Notify animation engine to trigger staggered entrance and attach 3D tilt
  window.dispatchEvent(new CustomEvent('fishGridRendered'));
}

export function renderFishTable() {
  const tbody = document.getElementById('fishTableBody');
  if (!tbody) return;
  
  const lang = localStorage.getItem('aqua-lang') || 'th'; 
  
  tbody.innerHTML = fishData.map(f => {
    const displayName = lang === 'en' && f.name_en ? f.name_en : f.name_th;
    
    return `
      <tr>
        <td>${f.image ? `<img src="${f.image}" style="width:40px;height:40px;object-fit:cover;border-radius:6px">` : f.emoji || '🐟'}</td>
        <td><strong>${displayName}</strong><br><small style="color:var(--gray)">${f.species}</small></td>
        <td>฿${f.priceMin.toLocaleString()}${f.priceMax ? ' – ' + f.priceMax.toLocaleString() : ''}</td>
        <td>
          <span class="status-dot ${f.stock === 0 ? 'out' : f.stock <= 5 ? 'low' : 'ok'}"></span>
          ${f.stock} ตัว
        </td>
        <td>${f.level}</td>
        <td>
          <button class="action-btn action-edit"   onclick="openEditModal('${f.id}')">แก้ไข</button>
          <button class="action-btn action-delete" onclick="deleteFish('${f.id}')">ลบ</button>
        </td>
      </tr>
    `;
  }).join('');
}

// ════════════════════════════════════════════
//   (Real-time Update & Language Change)
// ════════════════════════════════════════════
window.addEventListener('languageChanged', () => {
  if (document.getElementById('fishGrid')) {
    renderFishGrid();
  }
  if (document.getElementById('fishTableBody')) {
    renderFishTable();
  }
  
  const fishModal = document.getElementById('fishModal');
  if (fishModal && fishModal.classList.contains('open')) {
    fishModal.classList.remove('open');
  }

  const lang = localStorage.getItem('aqua-lang') || 'th'; 
  const isEn = lang === 'en';
  
  const searchInput = document.querySelector('.search-bar input');
  if (searchInput) {
    searchInput.placeholder = isEn 
      ? "Search for fish name or species..." 
      : "ค้นหาชื่อปลา หรือสายพันธุ์...";
  }

  const labels = SORT_LABELS[isEn ? 'en' : 'th'];
  document.querySelectorAll('.filter-chips .chip').forEach(chip => {
    const label = labels[chip.dataset.sort];
    if (label) chip.textContent = label;
  });
});
