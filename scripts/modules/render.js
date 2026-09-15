// scripts/modules/render.js
import { fishData } from './fishData.js';
import { MESSENGER_ICON, storeEmpty } from '../shared/utils.js';
import { isWishlisted } from '../shared/wishlist.js'; // นำเข้าฟังก์ชัน wishlist

// --- State Management ---
let currentFilter = 'ทั้งหมด';
let searchQuery = '';

export function getCurrentFilter() {
    return currentFilter;
}

export function setFishChip(filterValue, btnElement) {
    currentFilter = filterValue;
    
    // จัดการ UI ของ Chip
    const chips = document.querySelectorAll('.filter-chips .chip');
    chips.forEach(c => c.classList.remove('active'));
    if (btnElement) {
        btnElement.classList.add('active');
    }
    
    renderFishGrid();
}

export function filterFish(query) {
    searchQuery = query.toLowerCase().trim();
    renderFishGrid();
}
// ------------------------

export function isComingSoon(f) {
  return f.stock === 0 && f.priceMin === 0;
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

  const liked = isWishlisted(f.id);
  const heartIcon = liked ? `<i class="ph-fill ph-heart"></i>` : `<i class="ph ph-heart"></i>`;
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
          <button class="wishlist-btn ${liked ? 'active' : ''}" onclick="onWishToggle('${f.id}', this, event)" aria-label="${liked ? 'นำออกจากรายการโปรด' : 'เพิ่มในรายการโปรด'}" aria-pressed="${liked}">
            ${heartIcon}
          </button>
        ${f.image
          ? `<img src="${f.image}" alt="${displayName}" loading="lazy" onerror="this.parentElement.innerHTML='<span>${f.emoji || fallbackIconEsc}</span>'">`
          : `<span>${f.emoji || fallbackIcon}</span>`
        }
        <div class="card-img-gradient"></div>
        ${outOfStock ? `<div class="out-badge">${txtOut}</div>` : ''}
      </div>
      <div class="fish-info">
        <div class="fish-name">${displayName}</div>
        <div class="fish-species">${f.species || '—'}</div>
        
        <div class="fish-meta">
          <div class="fish-price ${outOfStock ? 'fish-price--dim' : ''}">
            ฿${f.priceMin.toLocaleString()}${f.priceMax ? ' – ' + f.priceMax.toLocaleString() : ''}
          </div>
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
  
  const liked = isWishlisted(f.id);
  const heartIcon = liked ? `<i class="ph-fill ph-heart"></i>` : `<i class="ph ph-heart"></i>`;
  const fallbackIcon = `<i class="ph ph-fish"></i>`;
  const fallbackIconEsc = `<i class=&quot;ph ph-fish&quot;></i>`;

  return `
    <div class="fish-card fish-card--coming" role="button" tabindex="0" aria-label="ดูรายละเอียด ${displayName} (เร็วๆ นี้)"
         onclick="openComingSoonDetail('${f.id}')"
         onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openComingSoonDetail('${f.id}')}">
      <div class="fish-card-img-wrap fish-img--coming">
         <button class="wishlist-btn ${liked ? 'active' : ''}" onclick="onWishToggle('${f.id}', this, event)" aria-label="${liked ? 'นำออกจากรายการโปรด' : 'เพิ่มในรายการโปรด'}" aria-pressed="${liked}">
            ${heartIcon}
          </button>
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
export function renderFishGrid() {
  const grid = document.getElementById('fishGrid');
  const csSection = document.getElementById('comingSoonSection');
  const csGrid    = document.getElementById('comingSoonGrid');

  // 1. กรองข้อมูล (Apply Filter + Search)
  const filteredData = fishData.filter(f => {
      // เช็ค Search
      const nameTh = (f.name_th || '').toLowerCase();
      const nameEn = (f.name_en || '').toLowerCase();
      const species = (f.species || '').toLowerCase();
      const matchSearch = nameTh.includes(searchQuery) || nameEn.includes(searchQuery) || species.includes(searchQuery);

      // เช็ค Chip
      let matchChip = false;
      if (currentFilter === 'ทั้งหมด') {
          matchChip = true;
      } else if (currentFilter === 'ถูกใจ') {
          matchChip = isWishlisted(f.id);
      } else if (currentFilter === 'มือใหม่') {
          matchChip = f.level === 'มือใหม่';
      } else {
          // หาใน tags array
          matchChip = (Array.isArray(f.tags_th) && f.tags_th.includes(currentFilter)) || 
                      (Array.isArray(f.tags_en) && f.tags_en.includes(currentFilter));
      }

      return matchSearch && matchChip;
  });

  // แยก Available และ Coming Soon จากข้อมูลที่ถูกกรองแล้ว
  const available  = filteredData.filter(f => !isComingSoon(f));
  const comingSoon = filteredData.filter(f =>  isComingSoon(f));

  // Render Available
  if (grid) {
      if (available.length > 0) {
          grid.innerHTML = available.map(_availableCard).join('');
      } else {
          // Empty State Logic
          if (currentFilter === 'ถูกใจ' && searchQuery === '') {
             grid.innerHTML = storeEmpty('ph ph-heart-break', 'ยังไม่มีปลาถูกใจ');
          } else {
             grid.innerHTML = storeEmpty('ph ph-magnifying-glass-minus', 'ไม่พบผลลัพธ์ที่ค้นหา');
          }
      }
  }

  // Update Bento Spotlight if present
  const featured = available.find(f => f.stock > 0 && f.image) || available[0];
  if (featured) {
    const lang = localStorage.getItem('aqua-lang') || 'th';
    const isEn = lang === 'en';
    const bentoName = document.getElementById('bentoFeaturedName');
    const bentoPrice = document.getElementById('bentoFeaturedPrice');
    const bentoImg = document.getElementById('bentoFeaturedImg');
    const bentoCard = document.getElementById('bentoFeaturedCard');
    if (bentoName) bentoName.textContent = isEn && featured.name_en ? featured.name_en : featured.name_th;
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
  if (!csSection || !csGrid) return;
  if (comingSoon.length < 3) {
    csSection.style.display = 'none';
    return;
  }
  csSection.style.display = '';
  csGrid.innerHTML = comingSoon.map(_comingSoonCard).join('');
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

  const chipTexts = isEn 
    ? ['All', 'Freshwater', 'Marine', 'Beginner', 'Colorful', '<i class="ph ph-heart"></i> Wishlist']
    : ['ทั้งหมด', 'น้ำจืด', 'ทะเล', 'มือใหม่', 'สีสวย', '<i class="ph ph-heart"></i> ถูกใจ'];

  const chips = document.querySelectorAll('.filter-chips .chip');
  chips.forEach((chip, index) => {
    if (chipTexts[index]) {
      // ใช้ innerHTML แทน textContent เดิม เพราะ chip "ถูกใจ" มี <i> icon อยู่ในข้อความ
      // (ถ้าใช้ textContent เหมือนเดิม icon จะโดนลบทิ้งทุกครั้งที่สลับภาษา)
      chip.innerHTML = chipTexts[index];
    }
  });
});