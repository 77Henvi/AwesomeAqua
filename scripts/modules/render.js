import { fishData } from './fishData.js';
import { LINE_ICON } from '../shared/utils.js';

export function isComingSoon(f) {
  return f.stock === 0 && f.priceMin === 0;
}

// ── การ์ดปลาขายปกติ ──
function _availableCard(f) {
  const outOfStock = f.stock === 0;
  
  // 🚨 แก้ชื่อ Key เป็น 'aqua-lang' ให้ตรงกับระบบของคุณ
  const lang = localStorage.getItem('aqua-lang') || 'th'; 
  const isEn = lang === 'en';

  const displayName = isEn && f.name_en ? f.name_en : f.name_th;
  const displayTags = isEn && f.tags_en?.length ? f.tags_en : f.tags_th;
  
  // แปลคำศัพท์ UI
  const txtSize = isEn ? 'Size:' : 'ขนาด:';
  const txtInch = isEn ? 'inch' : 'นิ้ว';
  const txtUnit = isEn ? 'pcs' : 'ตัว';
  const txtOrder = isEn ? 'Order' : 'สั่งซื้อ';
  const txtOut = isEn ? 'Out of stock' : 'หมดสต็อก';
  const txtEmpty = isEn ? '❌ Out' : '❌ หมด';

  return `
    <div class="fish-card ${outOfStock ? 'fish-card--out' : ''}" onclick="openFishDetail('${f.id}')">
      <div class="fish-img">
        ${f.image
          ? `<img src="${f.image}" alt="${displayName}" onerror="this.parentElement.innerHTML='<span>${f.emoji || '🐟'}</span>'">`
          : `<span>${f.emoji || '🐟'}</span>`
        }
        ${outOfStock ? `<div class="out-badge">${txtOut}</div>` : ''}
        <div class="card-admin-actions">
          <button onclick="event.stopPropagation(); openEditModal('${f.id}')" title="แก้ไข">✏️</button>
          <button onclick="event.stopPropagation(); deleteFish('${f.id}')" title="ลบ">🗑️</button>
        </div>
      </div>
      <div class="fish-info">
        <div class="fish-name">${displayName}</div>
        <div class="fish-species">${f.species}</div>
        
        ${f.sizeMin ? `<div style="font-size: 0.78rem; color: var(--gray); margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.35rem;"><i class="ph ph-ruler"></i> ${txtSize} ${f.sizeMin}${(f.sizeMax && f.sizeMax != f.sizeMin) ? ' – ' + f.sizeMax : ''} ${txtInch} </div>` : ''}
        <div class="fish-meta">
          <div class="fish-price ${outOfStock ? 'fish-price--dim' : ''}">
            ฿${f.priceMin.toLocaleString()}${f.priceMax ? ' – ' + f.priceMax.toLocaleString() : ''}
          </div>
          <div class="fish-stock ${f.stock > 0 && f.stock <= 5 ? 'low' : ''}">
            ${f.stock === 0 ? txtEmpty : f.stock <= 5 ? `⚠️ ${f.stock} ${txtUnit}` : `✅ ${f.stock} ${txtUnit}`}
          </div>
        </div>
        <div class="fish-tags">${(displayTags || []).map(t => `<span class="tag">${t}</span>`).join('')}</div>
        ${f.stock > 0
          ? `<button class="btn-line" style="width:100%;justify-content:center"
               onclick="event.stopPropagation(); openLine('${f.id}')">
               ${LINE_ICON(16)} ${txtOrder}
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
  
  const txtBadge = isEn ? '🔔 View Details' : '🔔 กดดูรายละเอียด';
  const txtTape = isEn ? '✦ COMING SOON ✦ ' : '✦ COMING SOON ✦ เร็วๆ นี้ ✦ ';

  return `
    <div class="fish-card fish-card--coming" tabindex="0" onclick="openComingSoonDetail('${f.id}')">
      <div class="fish-img fish-img--coming">
        ${f.image
          ? `<img src="${f.image}" alt="${displayName}" onerror="this.parentElement.innerHTML='<span class=coming-emoji>${f.emoji || '🐟'}</span>'">`
          : `<span class="coming-emoji">${f.emoji || '🐟'}</span>`
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

// ── Render หลัก — แยก 2 grids ──
export function renderFishGrid() {
  const available  = fishData.filter(f => !isComingSoon(f));
  const comingSoon = fishData.filter(f =>  isComingSoon(f));

  // Grid ปลาปกติ
  const grid = document.getElementById('fishGrid');
  if (grid) {
    grid.innerHTML = available.length
      ? available.map(_availableCard).join('')
      : `<p style="color:var(--gray);grid-column:1/-1;text-align:center;padding:2rem">ยังไม่มีปลาในสต็อกครับ</p>`;
  }

  // Section + Grid coming soon
  const csSection = document.getElementById('comingSoonSection');
  const csGrid    = document.getElementById('comingSoonGrid');
  if (!csSection || !csGrid) return;

  if (comingSoon.length === 0) {
    csSection.style.display = 'none';
    return;
  }

  csSection.style.display = '';
  csGrid.innerHTML = comingSoon.map(_comingSoonCard).join('');
}

export function renderFishTable() {
  const tbody = document.getElementById('fishTableBody');
  if (!tbody) return;
  
  const lang = localStorage.getItem('language') || 'th'; 
  
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

    window.addEventListener('languageChanged', () => {
    renderFishGrid();
  });
}