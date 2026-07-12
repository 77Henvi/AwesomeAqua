import { fishData } from './fishData.js';
import { MESSENGER_ICON } from '../shared/utils.js';

// ── Modal ปลาปกติ ──
export function openFishDetail(id) {
  const f = fishData.find(x => x.id === id);
  if (!f) return;

  const lang = localStorage.getItem('aqua-lang') || 'th';
  const isEn = lang === 'en';

  // สลับตัวแปร Database
  const displayName = isEn && f.name_en ? f.name_en : f.name_th;
  const displayDesc = isEn && f.desc_en ? f.desc_en : f.desc_th;
  const displayTags = isEn && f.tags_en?.length ? f.tags_en : f.tags_th;

  const outOfStock = f.stock === 0;

  // ── แปลคำศัพท์ UI ในป๊อปอัป ──
  const txtPrice = isEn ? 'Price' : 'ราคา';
  const txtStock = isEn ? 'Stock' : 'สต็อก';
  const txtOut = isEn ? '❌ Out of stock' : '❌ หมดแล้ว';
  const txtLow = isEn ? `⚠️ Only ${f.stock} left` : `⚠️ เหลือ ${f.stock} ตัว`;
  const txtIn = isEn ? `✅ ${f.stock} in stock` : `✅ ${f.stock} ตัว`;
  const txtDescTitle = isEn ? '📖 Details' : '📖 รายละเอียด';
  const txtOrder = isEn ? 'Order via Messenger' : 'สั่งซื้อผ่าน Messenger';
  const txtDisabled = isEn ? 'Out of stock' : 'หมดสต็อก';
  const txtOutRibbon = isEn ? 'Out of stock' : 'หมดสต็อก';

  // ── แปลระดับความยาก ──
  const levelColor = { 'มือใหม่': '#22c55e', 'ปานกลาง': '#f59e0b', 'ผู้เชี่ยวชาญ': '#ef4444' };
  const lc = levelColor[f.level] || '#6b7280';
  let displayLevel = f.level;
  if (isEn) {
    if (f.level === 'มือใหม่') displayLevel = 'Beginner';
    if (f.level === 'ปานกลาง') displayLevel = 'Intermediate';
    if (f.level === 'ผู้เชี่ยวชาญ') displayLevel = 'Expert';
  }

  document.getElementById('fishDetailContent').innerHTML = `
    <div class="fd-hero">
      ${f.image
        ? `<img src="${f.image}" alt="${displayName}" class="fd-hero-img" onerror="this.outerHTML='<div class=fd-hero-emoji>${f.emoji||'🐟'}</div>'">`
        : `<div class="fd-hero-emoji">${f.emoji || '🐟'}</div>`
      }
      ${outOfStock ? `<div class="fd-out-ribbon">${txtOutRibbon}</div>` : ''}
      <div class="fd-hero-grad"></div>
      <div class="fd-hero-bottom">
        <div class="fd-name">${displayName}</div>
        <div class="fd-species">${f.species}</div>
      </div>
    </div>
    <div class="fd-body">
      <div class="fd-tags">
        ${(displayTags || []).map(t => `<span class="fd-tag">${t}</span>`).join('')}
        ${displayLevel ? `<span class="fd-tag fd-tag--level" style="--lc:${lc}">${displayLevel}</span>` : ''}
      </div>
      <div class="fd-info-row">
        <div class="fd-info-block">
          <div class="fd-info-label">${txtPrice}</div>
          <div class="fd-info-value ${outOfStock ? 'fd-price--dim' : ''}">
            ฿${f.priceMin.toLocaleString()}${f.priceMax ? '<span class="fd-price-sep">–</span>฿' + f.priceMax.toLocaleString() : ''}
          </div>
        </div>
        <div class="fd-info-block">
          <div class="fd-info-label">${txtStock}</div>
          <div class="fd-info-value">
            ${f.stock === 0
              ? `<span style="color:#ef4444">${txtOut}</span>`
              : f.stock <= 5
                ? `<span style="color:#f59e0b">${txtLow}</span>`
                : `<span style="color:#22c55e">${txtIn}</span>`
            }
          </div>
        </div>
      </div>
      ${displayDesc ? `
        <div class="fd-desc-wrap">
          <div class="fd-desc-title">${txtDescTitle}</div>
          <div class="fd-desc">${displayDesc}</div>
        </div>` : ''}
      <div class="fd-cta">
        ${f.stock > 0
          ? `<button class="btn-messenger fd-btn-messenger" onclick="openMessenger('${f.id}')">
               ${MESSENGER_ICON(20)} ${txtOrder}
             </button>`
          : `<button class="btn fd-btn-disabled" disabled>${txtDisabled}</button>`
        }
      </div>
    </div>
  `;
  document.getElementById('fishModal').classList.add('open');
}

// ── Modal Coming Soon ──
export function openComingSoonDetail(id) {
  const f = fishData.find(x => x.id === id);
  if (!f) return;

  const lang = localStorage.getItem('aqua-lang') || 'th';
  const isEn = lang === 'en';

  const displayName = isEn && f.name_en ? f.name_en : f.name_th;
  const displayDesc = isEn && f.desc_en ? f.desc_en : f.desc_th;
  const displayTags = isEn && f.tags_en?.length ? f.tags_en : f.tags_th;

  // ── แปลคำศัพท์ UI ในป๊อปอัป Coming Soon ──
  const txtBadge = isEn ? '✨ Coming Soon' : '✨ เร็วๆ นี้';
  const txtDescTitle = isEn ? '📖 About this fish' : '📖 เกี่ยวกับปลาชนิดนี้';
  const txtLine = isEn ? 'Inquire via Messenger' : 'สอบถามผ่าน Messenger';
  const txtGotIt = isEn ? '🔔 Got it' : '🔔 รับทราบ';

  // ── แปลระดับความยาก ──
  const levelColor = { 'มือใหม่': '#22c55e', 'ปานกลาง': '#f59e0b', 'ผู้เชี่ยวชาญ': '#ef4444' };
  const lc = levelColor[f.level] || '#6b7280';
  let displayLevel = f.level;
  if (isEn) {
    if (f.level === 'มือใหม่') displayLevel = 'Beginner';
    if (f.level === 'ปานกลาง') displayLevel = 'Intermediate';
    if (f.level === 'ผู้เชี่ยวชาญ') displayLevel = 'Expert';
  }

  document.getElementById('csModalContent').innerHTML = `
    <div class="fd-hero cs-hero">
      ${f.image
        ? `<img src="${f.image}" alt="${displayName}" class="fd-hero-img cs-hero-img" onerror="this.outerHTML='<div class=fd-hero-emoji>${f.emoji||'🐟'}</div>'">`
        : `<div class="fd-hero-emoji">${f.emoji || '🐟'}</div>`
      }
      <div class="coming-badge-center">${txtBadge}</div>
      <div class="fd-hero-grad"></div>
      <div class="fd-hero-bottom">
        <div class="fd-name">${displayName}</div>
        <div class="fd-species">${f.species || '—'}</div>
      </div>
    </div>
    <div class="fd-body">
      <div class="fd-tags">
        ${(displayTags || []).map(t => `<span class="fd-tag">${t}</span>`).join('')}
        ${displayLevel ? `<span class="fd-tag fd-tag--level" style="--lc:${lc}">${displayLevel}</span>` : ''}
      </div>

      ${displayDesc ? `
        <div class="fd-desc-wrap">
          <div class="fd-desc-title">${txtDescTitle}</div>
          <div class="fd-desc">${displayDesc}</div>
        </div>` : ''}

      <div class="cs-cta-row">
        <button class="btn-messenger fd-btn-messenger" onclick="openMessenger('${f.id}')">
          ${MESSENGER_ICON(18)} ${txtLine}
        </button>
        <button class="cs-notify-btn" onclick="closeCsModal()">
          ${txtGotIt}
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