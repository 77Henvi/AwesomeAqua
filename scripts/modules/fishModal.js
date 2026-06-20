import { fishData } from './fishData.js';
import { LINE_ICON } from '../shared/utils.js';

// ── Modal ปลาปกติ ──
export function openFishDetail(id) {
  const f = fishData.find(x => x.id === id);
  if (!f) return; 

  const lang = localStorage.getItem('language') || 'th';
  const displayName = lang === 'en' && f.name_en ? f.name_en : f.name_th;
  const displayDesc = lang === 'en' && f.desc_en ? f.desc_en : f.desc_th;
  const displayTags = lang === 'en' && f.tags_en?.length ? f.tags_en : f.tags_th;

  const outOfStock = f.stock === 0;
  const levelColor = { 'มือใหม่': '#22c55e', 'ปานกลาง': '#f59e0b', 'ผู้เชี่ยวชาญ': '#ef4444' };
  const lc = levelColor[f.level] || '#6b7280';

  document.getElementById('fishDetailContent').innerHTML = `
    <div class="fd-hero">
      ${f.image
        ? `<img src="${f.image}" alt="${displayName}" class="fd-hero-img" onerror="this.outerHTML='<div class=fd-hero-emoji>${f.emoji||'🐟'}</div>'">`
        : `<div class="fd-hero-emoji">${f.emoji || '🐟'}</div>`
      }
      ${outOfStock ? `<div class="fd-out-ribbon">หมดสต็อก</div>` : ''}
      <div class="fd-hero-grad"></div>
      <div class="fd-hero-bottom">
        <div class="fd-name">${displayName}</div>
        <div class="fd-species">${f.species}</div>
      </div>
    </div>
    <div class="fd-body">
      <div class="fd-tags">
        ${(displayTags || []).map(t => `<span class="fd-tag">${t}</span>`).join('')}
        <span class="fd-tag fd-tag--level" style="--lc:${lc}">${f.level}</span>
      </div>
      <div class="fd-info-row">
        <div class="fd-info-block">
          <div class="fd-info-label">ราคา</div>
          <div class="fd-info-value fd-price ${outOfStock ? 'fd-price--dim' : ''}">
            ฿${f.priceMin.toLocaleString()}${f.priceMax ? '<span class="fd-price-sep">–</span>฿' + f.priceMax.toLocaleString() : ''}
          </div>
        </div>
        <div class="fd-info-block">
          <div class="fd-info-label">สต็อก</div>
          <div class="fd-info-value">
            ${f.stock === 0
              ? `<span style="color:#ef4444">❌ หมดแล้ว</span>`
              : f.stock <= 5
                ? `<span style="color:#f59e0b">⚠️ เหลือ ${f.stock} ตัว</span>`
                : `<span style="color:#22c55e">✅ ${f.stock} ตัว</span>`
            }
          </div>
        </div>
      </div>
      ${displayDesc ? `
        <div class="fd-desc-wrap">
          <div class="fd-desc-title">📖 รายละเอียด</div>
          <div class="fd-desc">${displayDesc}</div>
        </div>` : ''}
      <div class="fd-cta">
        ${f.stock > 0
          ? `<button class="btn-line fd-btn-line" onclick="openLine('${f.id}')">
               ${LINE_ICON(20)} สั่งซื้อผ่านไลน์
             </button>`
          : `<button class="btn fd-btn-disabled" disabled>หมดสต็อก</button>`
        }
      </div>
    </div>
  `;
  document.getElementById('fishModal').classList.add('open');
}

// ── Modal Coming Soon ──
export function openComingSoonDetail(id) {
  const f = fishData.find(x => x.id === id);
  if (!f) return; // 👈 ย้ายมาเช็คตรงนี้เช่นกัน

  const lang = localStorage.getItem('language') || 'th';
  const displayName = lang === 'en' && f.name_en ? f.name_en : f.name_th;
  const displayDesc = lang === 'en' && f.desc_en ? f.desc_en : f.desc_th;
  const displayTags = lang === 'en' && f.tags_en?.length ? f.tags_en : f.tags_th;

  const levelColor = { 'มือใหม่': '#22c55e', 'ปานกลาง': '#f59e0b', 'ผู้เชี่ยวชาญ': '#ef4444' };
  const lc = levelColor[f.level] || '#6b7280';

  document.getElementById('csModalContent').innerHTML = `
    <div class="fd-hero cs-hero">
      ${f.image
        ? `<img src="${f.image}" alt="${displayName}" class="fd-hero-img cs-hero-img" onerror="this.outerHTML='<div class=fd-hero-emoji>${f.emoji||'🐟'}</div>'">`
        : `<div class="fd-hero-emoji">${f.emoji || '🐟'}</div>`
      }
      <div class="coming-badge-center">✨ เร็วๆ นี้</div>
      <div class="fd-hero-grad"></div>
      <div class="fd-hero-bottom">
        <div class="fd-name">${displayName}</div>
        <div class="fd-species">${f.species || '—'}</div>
      </div>
    </div>
    <div class="fd-body">
      <div class="fd-tags">
        ${(displayTags || []).map(t => `<span class="fd-tag">${t}</span>`).join('')}
        ${f.level ? `<span class="fd-tag fd-tag--level" style="--lc:${lc}">${f.level}</span>` : ''}
      </div>

      ${displayDesc ? `
        <div class="fd-desc-wrap">
          <div class="fd-desc-title">📖 เกี่ยวกับปลาชนิดนี้</div>
          <div class="fd-desc">${displayDesc}</div>
        </div>` : ''}

      <div class="cs-cta-row">
        <button class="btn-line fd-btn-line" onclick="openLine('${f.id}')">
          ${LINE_ICON(18)} สอบถามผ่านไลน์
        </button>
        <button class="cs-notify-btn" onclick="closeCsModal()">
          🔔 รับทราบ
        </button>
      </div>
    </div>
  `;
  document.getElementById('csModal').classList.add('open');
}

export function closeFishModal() {
  document.getElementById('fishModal').classList.remove('open');
}

export function closeFishModalOutside(e) {
  if (e.target === document.getElementById('fishModal')) closeFishModal();
}

export function closeCsModal() {
  document.getElementById('csModal').classList.remove('open');
}

export function closeCsModalOutside(e) {
  if (e.target === document.getElementById('csModal')) closeCsModal();
}