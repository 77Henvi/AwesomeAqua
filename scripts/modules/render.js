import { fishData } from './fishData.js';
import { LINE_ICON } from '../shared/utils.js';

export function isComingSoon(f) {
  return f.stock === 0 && f.priceMin === 0;
}

const TAPE_TEXT = '✦ COMING SOON ✦ เร็วๆ นี้ ✦ COMING SOON ✦ เร็วๆ นี้ ✦ COMING SOON ✦ เร็วๆ นี้ ✦ ';

// ── การ์ดปลาขายปกติ ──
function _availableCard(f) {
  const outOfStock = f.stock === 0;
  return `
    <div class="fish-card ${outOfStock ? 'fish-card--out' : ''}" onclick="openFishDetail('${f.id}')">
      <div class="fish-img">
        ${f.image
          ? `<img src="${f.image}" alt="${f.name}" onerror="this.parentElement.innerHTML='<span>${f.emoji || '🐟'}</span>'">`
          : `<span>${f.emoji || '🐟'}</span>`
        }
        ${outOfStock ? `<div class="out-badge">หมดสต็อก</div>` : ''}
        <div class="card-admin-actions">
          <button onclick="event.stopPropagation(); openEditModal('${f.id}')" title="แก้ไข">✏️</button>
          <button onclick="event.stopPropagation(); deleteFish('${f.id}')" title="ลบ">🗑️</button>
        </div>
      </div>
      <div class="fish-info">
        <div class="fish-name">${f.name}</div>
        <div class="fish-species">${f.species}</div>
        <div class="fish-meta">
          <div class="fish-price ${outOfStock ? 'fish-price--dim' : ''}">
            ฿${f.priceMin.toLocaleString()}${f.priceMax ? ' – ' + f.priceMax.toLocaleString() : ''}
          </div>
          <div class="fish-stock ${f.stock > 0 && f.stock <= 5 ? 'low' : ''}">
            ${f.stock === 0 ? '❌ หมด' : f.stock <= 5 ? `⚠️ ${f.stock} ตัว` : `✅ ${f.stock} ตัว`}
          </div>
        </div>
        <div class="fish-tags">${(f.tags || []).map(t => `<span class="tag">${t}</span>`).join('')}</div>
        ${f.stock > 0
          ? `<button class="btn-line" style="width:100%;justify-content:center"
               onclick="event.stopPropagation(); openLine('${f.name}')">
               ${LINE_ICON(16)} สั่งซื้อ
             </button>`
          : `<button class="btn" style="width:100%;background:#f3f4f6;color:#9ca3af;cursor:not-allowed" disabled>หมดสต็อก</button>`
        }
      </div>
    </div>`;
}

// ── การ์ด Coming Soon ──
function _comingSoonCard(f) {
  return `
    <div class="fish-card fish-card--coming" tabindex="0" onclick="openComingSoonDetail('${f.id}')">
      <div class="fish-img fish-img--coming">
        ${f.image
          ? `<img src="${f.image}" alt="${f.name}" onerror="this.parentElement.innerHTML='<span class=coming-emoji>${f.emoji || '🐟'}</span>'">`
          : `<span class="coming-emoji">${f.emoji || '🐟'}</span>`
        }
        <div class="coming-tape-track" aria-hidden="true">
          <div class="coming-tape">
            <span>${TAPE_TEXT}${TAPE_TEXT}</span>
            <span aria-hidden="true">${TAPE_TEXT}${TAPE_TEXT}</span>
          </div>
        </div>
        <div class="coming-overlay"></div>
      </div>
      <div class="fish-info fish-info--coming">
        <div class="fish-name">${f.name}</div>
        <div class="fish-species">${f.species || '—'}</div>
        <div class="fish-tags">${(f.tags || []).map(t => `<span class="tag tag--dim">${t}</span>`).join('')}</div>
        <div class="coming-badge">🔔 กดดูรายละเอียด</div>
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
  tbody.innerHTML = fishData.map(f => `
    <tr>
      <td>${f.image ? `<img src="${f.image}" style="width:40px;height:40px;object-fit:cover;border-radius:6px">` : f.emoji || '🐟'}</td>
      <td><strong>${f.name}</strong><br><small style="color:var(--gray)">${f.species}</small></td>
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
  `).join('');
}