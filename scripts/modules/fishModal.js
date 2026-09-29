import { fishData } from './fishData.js';
import { describeSales } from '../shared/fishSales.js';
import { getDisplayedFish } from './render.js';
import { MESSENGER_ICON, openMessenger } from '../shared/utils.js';

// ══════════════════════════════════════════════════════════════
//  FISH DETAIL MODAL (ธีมมืด, namespace .fx-*)
//  โฟลว์เดียว:  fishData ──► buildModel() ──► template() ──► DOM
//  - buildModel  : แปลงข้อมูลดิบเป็นค่าที่ปลอดภัยแล้ว (null/NaN/ภาษา/รูปแบบราคา)
//  - template    : ทุกข้อความผ่าน esc() ไม่มี inline handler / ไม่ฝัง id ใน JS string
//  - events      : delegation ผูกครั้งเดียวบน container (ไม่ซ้อน/ไม่รั่วเมื่อ re-render)
// ══════════════════════════════════════════════════════════════
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const num = v => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v))) ? null : Number(v);
const baht = n => '฿' + n.toLocaleString('en-US');

const LEVEL_EN = { 'มือใหม่': 'Beginner', 'ปานกลาง': 'Intermediate', 'ผู้เชี่ยวชาญ': 'Expert' };
const TXT = {
  th: { specs: 'ข้อมูลจำเพาะ', size: 'ขนาด', level: 'ระดับการเลี้ยง', stock: 'สต็อก', price: 'ราคา',
        details: 'รายละเอียด', similar: 'ปลาที่คล้ายกัน', next: 'ถัดไป', prev: 'ก่อนหน้า', close: 'ปิด',
        order: 'สั่งซื้อผ่าน Messenger', sold: 'หมดสต็อก', inch: 'นิ้ว', out: 'หมดแล้ว',
        low: n => `เหลือ ${n} ตัว`, ok: n => `${n} ตัว` },
  en: { specs: 'Specifications', size: 'Size', level: 'Care level', stock: 'Stock', price: 'Price',
        details: 'Details', similar: 'Similar species', next: 'Next', prev: 'Previous', close: 'Close',
        order: 'Order via Messenger', sold: 'Out of stock', inch: 'in', out: 'Out of stock',
        low: n => `Only ${n} left`, ok: n => `${n} in stock` }
};

let currentFish = null, lastFocus = null, bound = false, savedOverflow = '';

function getLang() {
  try { return localStorage.getItem('aqua-lang') === 'en' ? 'en' : 'th'; } catch { return 'th'; }
}
const sameId = (a, b) => String(a) === String(b);
const pick = (en, th, isEn) => (isEn && en ? en : (th || en || ''));

function buildModel(f, lang) {
  const isEn = lang === 'en', t = TXT[lang];
  const pMin = num(f.priceMin), pMax = num(f.priceMax);
  const sMin = num(f.sizeMin), sMax = num(f.sizeMax);
  let size = '';
  if (sMin !== null || sMax !== null) {
    const a = sMin ?? sMax, b = sMax ?? sMin;
    size = (a === b ? `${a}` : `${Math.min(a, b)}–${Math.max(a, b)}`) + ` ${t.inch}`;
  }
  const stock = Math.max(0, Math.floor(num(f.stock) ?? 0));
  const sales = describeSales(f, isEn);
  const refPrice = sales.refMin ? baht(sales.refMin) + (sales.refMax ? ` – ${baht(sales.refMax)}` : '') : '';
  const tagsSrc = isEn && Array.isArray(f.tags_en) && f.tags_en.length ? f.tags_en : f.tags_th;
  return {
    id: f.id, t, isEn,
    name: pick(f.name_en, f.name_th, isEn) || '—',
    species: f.species || '',
    desc: pick(f.desc_en, f.desc_th, isEn),
    tags: (Array.isArray(tagsSrc) ? tagsSrc : []).filter(Boolean),
    image: typeof f.image === 'string' ? f.image.trim() : '',
    sales, refPrice,
    price: pMin === null ? '—' : baht(pMin),
    priceTo: (pMin !== null && pMax !== null && pMax > pMin) ? baht(pMax) : '',
    size,
    level: f.level ? (isEn ? (LEVEL_EN[f.level] || f.level) : f.level) : '',
    levelKey: { 'มือใหม่': 'easy', 'ปานกลาง': 'mid', 'ผู้เชี่ยวชาญ': 'hard' }[f.level] || 'none',
    stock,
    stockKey: stock === 0 ? 'out' : stock <= 5 ? 'low' : 'ok',
    stockText: stock === 0 ? t.out : stock <= 5 ? t.low(stock) : t.ok(stock)
  };
}

function similarOf(f) {
  const others = fishData.filter(x => !sameId(x.id, f.id));
  const bySpecies = f.species ? others.filter(x => x.species === f.species) : [];
  return (bySpecies.length ? bySpecies : others.filter(x => f.level && x.level === f.level)).slice(0, 8);
}

function img(src, cls, alt = '') {
  return src ? `<img class="${cls}" src="${esc(src)}" alt="${esc(alt)}" decoding="async" draggable="false">` : '';
}

function simCard(s, isEn) {
  const name = pick(s.name_en, s.name_th, isEn) || '—';
  const p = num(s.priceMin);
  return `<button type="button" class="fx-simcard" data-fx="go" data-id="${esc(s.id)}" aria-label="${esc(name)}">
    <span class="fx-simimg">${img(typeof s.image === 'string' ? s.image : '', 'fx-thumb')}<i class="ph ph-fish fx-fallback" aria-hidden="true"></i></span>
    <span class="fx-simname">${esc(name)}</span>
    ${p !== null ? `<span class="fx-simprice">${baht(p)}</span>` : ''}
  </button>`;
}

// ปุ่ม ถัดไป/ก่อนหน้า เดินตามลำดับที่ลูกค้าเห็นบนหน้าร้าน (รวมการค้นหา/การเรียง) ถ้าไม่เจอค่อย fallback เป็นลำดับเดิม
function navList(id) {
  const shown = getDisplayedFish();
  return shown.some(x => sameId(x.id, id)) ? shown : fishData;
}

function template(f, m) {
  const list = navList(f.id), n = list.length;
  const idx = list.findIndex(x => sameId(x.id, f.id));
  const canNav = n > 1 && idx >= 0;
  const nextF = canNav ? list[(idx + 1) % n] : null;
  const sim = similarOf(f);
  const simHtml = sim.map(s => simCard(s, m.isEn)).join('');
  const t = m.t;
  const sales = m.sales;

  const tiles = [
    m.size  ? ['ph-ruler', t.size, m.size, ''] : null,
    m.level ? ['ph-gauge', t.level, m.level, `lv-${m.levelKey}`] : null,
    ['ph-package', t.stock, m.stockText, `st-${m.stockKey}`]
  ].filter(Boolean).map(([ic, lb, val, cls]) =>
    `<div class="fx-tile ${cls}"><span class="fx-tile-lb"><i class="ph ${ic}" aria-hidden="true"></i>${esc(lb)}</span><span class="fx-tile-val">${esc(val)}</span></div>`
  ).join('');

  return `
  <div class="fx ${m.image ? '' : 'no-img'}" data-stock="${m.stockKey}">
    ${img(m.image, 'fx-bg-img')}
    <div class="fx-shade" aria-hidden="true"></div>

    <div class="fx-top">
      <button type="button" class="fx-iconbtn fx-close" data-fx="close" aria-label="${esc(t.close)}"><i class="ph ph-x" aria-hidden="true"></i></button>
    </div>

    <div class="fx-stage">
      <div class="fx-scroll">
        <div class="fx-media" aria-hidden="true">
          ${img(m.image, 'fx-photo')}<i class="ph ph-fish fx-fallback"></i>
        </div>

        <div class="fx-content">
          <div class="fx-headline">
            ${sales.kind !== 'none' ? `<span class="fx-salesbadge fx-salesbadge--${sales.kind === 'hot' ? 'hot' : 'sale'}"><i class="ph-fill ${sales.kind === 'hot' ? 'ph-fire' : 'ph-tag'}" aria-hidden="true"></i>${esc(sales.label)}</span>` : ''}
            ${m.species ? `<div class="fx-eyebrow">${esc(m.species)}</div>` : ''}
            <h2 class="fx-title" id="fxTitle">${esc(m.name)}</h2>
            <div class="fx-price" aria-label="${esc(t.price)}">
              <span class="fx-price-main">${esc(m.price)}</span>${m.priceTo ? `<span class="fx-price-to">– ${esc(m.priceTo)}</span>` : ''}${m.refPrice ? `<s class="fx-price-old" aria-label="${m.isEn ? 'Original price' : 'ราคาเดิม'}">${esc(m.refPrice)}</s>` : ''}
            </div>
            ${sales.soldText ? `<div class="fx-sold"><i class="ph ph-shopping-bag" aria-hidden="true"></i>${esc(sales.soldText)}</div>` : ''}
          </div>

          <div class="fx-panel">
            ${m.tags.length ? `<div class="fx-tags">${m.tags.map(x => `<span class="fx-tag">${esc(x)}</span>`).join('')}</div>` : ''}
            <div class="fx-sechead"><h3>${esc(t.specs)}</h3>
              <span class="fx-chip s-${m.stockKey}"><i class="fx-dot" aria-hidden="true"></i>${esc(m.stockText)}</span></div>
            <div class="fx-tiles">${tiles}</div>
            ${m.desc ? `<div class="fx-sechead"><h3>${esc(t.details)}</h3></div><p class="fx-desc">${esc(m.desc)}</p>` : ''}
            ${sim.length ? `<div class="fx-sim"><div class="fx-sechead"><h3>${esc(t.similar)}</h3></div><div class="fx-simrail">${simHtml}</div></div>` : ''}
          </div>
        </div>

        <div class="fx-cta">
          ${canNav ? `<div class="fx-nav">
            <button type="button" class="fx-iconbtn" data-fx="prev" aria-label="${esc(t.prev)}"><i class="ph ph-caret-left" aria-hidden="true"></i></button>
            <button type="button" class="fx-iconbtn" data-fx="next" aria-label="${esc(t.next)}"><i class="ph ph-caret-right" aria-hidden="true"></i></button></div>` : ''}
          ${m.stock > 0
            ? `<button type="button" class="fx-order" data-fx="order"><span class="fx-order-ic">${MESSENGER_ICON(20)}</span><span class="fx-order-tx">${esc(t.order)}</span><i class="ph ph-caret-double-right fx-order-arrow" aria-hidden="true"></i></button>`
            : `<button type="button" class="fx-order is-disabled" disabled>${esc(t.sold)}</button>`}
        </div>
      </div>
    </div>

    <aside class="fx-rail">
      ${nextF ? `<div class="fx-rail-head">${esc(t.next)}<span>${idx + 1} / ${n}</span></div>
        <button type="button" class="fx-nextcard" data-fx="next" aria-label="${esc(t.next)}: ${esc(pick(nextF.name_en, nextF.name_th, m.isEn))}">
          <span class="fx-nextimg">${img(typeof nextF.image === 'string' ? nextF.image : '', 'fx-thumb')}<i class="ph ph-fish fx-fallback" aria-hidden="true"></i></span>
          <span class="fx-nextname">${esc(pick(nextF.name_en, nextF.name_th, m.isEn) || '—')}</span>
          <span class="fx-nextsp">${esc(nextF.species || '')}</span></button>` : ''}
      ${sim.length ? `<div class="fx-rail-head">${esc(t.similar)}</div><div class="fx-railsim">${simHtml}</div>` : ''}
    </aside>

    <footer class="fx-bar">
      <span class="fx-chip s-${m.stockKey}"><i class="fx-dot" aria-hidden="true"></i>${esc(m.stockText)}</span>
      ${m.level ? `<span class="fx-barinfo"><i class="ph ph-gauge" aria-hidden="true"></i>${esc(m.level)}</span>` : ''}
      ${m.size ? `<span class="fx-barinfo"><i class="ph ph-ruler" aria-hidden="true"></i>${esc(m.size)}</span>` : ''}
    </footer>
  </div>`;
}

function attachImageFallbacks(root) {
  root.querySelectorAll('img').forEach(im => {
    const fail = () => {
      const host = im.closest('.fx-media, .fx-simimg, .fx-nextimg');
      im.remove();
      if (host) host.classList.add('is-broken');
      else root.querySelector('.fx')?.classList.add('no-img');     // fx-bg-img
      if (im.classList.contains('fx-photo')) root.querySelector('.fx')?.classList.add('no-img');
    };
    im.addEventListener('error', fail, { once: true });
    if (im.complete && im.naturalWidth === 0 && im.getAttribute('src')) fail();
  });
}

function focusables(root) {
  return [...root.querySelectorAll('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')]
    .filter(el => el.offsetParent !== null || el === document.activeElement);
}

function render(f) {
  const host = document.getElementById('fishDetailContent');
  const modal = document.getElementById('fishModal');
  if (!host || !modal) return;
  currentFish = f;
  host.innerHTML = template(f, buildModel(f, getLang()));
  attachImageFallbacks(host);
  host.querySelector('.fx-scroll')?.scrollTo?.(0, 0);
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'fxTitle');
}

function step(dir) {
  if (!currentFish) return;
  const list = navList(currentFish.id);
  if (list.length < 2) return;
  const i = list.findIndex(x => sameId(x.id, currentFish.id));
  if (i < 0) return;
  render(list[(i + dir + list.length) % list.length]);
  document.querySelector('#fishDetailContent .fx-content, #fishDetailContent .fx-close')?.focus?.({ preventScroll: true });
}

function isOpen() { return document.getElementById('fishModal')?.classList.contains('open'); }

function bindOnce() {
  if (bound) return;
  bound = true;
  document.getElementById('fishDetailContent')?.addEventListener('click', e => {
    const el = e.target.closest('[data-fx]');
    if (!el || !currentFish) return;
    switch (el.dataset.fx) {
      case 'close': return closeFishModal();
      case 'order': return openMessenger(currentFish.id);
      case 'prev':  return step(-1);
      case 'next':  return step(1);
      case 'go': {
        const f = fishData.find(x => sameId(x.id, el.dataset.id));
        if (f) render(f);
        return;
      }
    }
  });
  document.addEventListener('keydown', e => {
    if (!isOpen()) return;
    if (e.key === 'Escape') { e.preventDefault(); closeFishModal(); return; }
    const tag = (e.target.tagName || '').toLowerCase();
    if (['input', 'textarea', 'select'].includes(tag)) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (e.key === 'Tab') {
      const items = focusables(document.getElementById('fishModal'));
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  // เปลี่ยนภาษาตอนเปิดอยู่ → วาดใหม่ (ถ้าปลาหายไปจากข้อมูลแล้วให้ปิดอย่างสุภาพ)
  window.addEventListener('languageChanged', () => {
    if (!isOpen() || !currentFish) return;
    const f = fishData.find(x => sameId(x.id, currentFish.id));
    f ? render(f) : closeFishModal();
  });
}

// ── Modal ปลาปกติ ──
export function openFishDetail(id) {
  const f = fishData.find(x => sameId(x.id, id));
  if (!f) return;
  bindOnce();
  const modal = document.getElementById('fishModal');
  if (!modal) return;
  const wasOpen = isOpen();
  if (!wasOpen) lastFocus = document.activeElement;
  render(f);
  modal.classList.add('open');
  if (!wasOpen) { savedOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
  document.querySelector('#fishDetailContent .fx-close')?.focus?.({ preventScroll: true });
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
  const txtBadge = isEn ? '<i class="ph ph-sparkle"></i> Coming Soon' : '<i class="ph ph-sparkle"></i> เร็วๆ นี้';
  const txtDescTitle = isEn ? '<i class="ph ph-book-open"></i> About this fish' : '<i class="ph ph-book-open"></i> เกี่ยวกับปลาชนิดนี้';
  const txtLine = isEn ? 'Inquire via Messenger' : 'สอบถามผ่าน Messenger';
  const txtGotIt = isEn ? '<i class="ph ph-bell"></i> Got it' : '<i class="ph ph-bell"></i> รับทราบ';
  const fallbackIcon = `<i class="ph ph-fish"></i>`;
  const fallbackIconEsc = `<i class=&quot;ph ph-fish&quot;></i>`;

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
        ? `<img src="${f.image}" alt="${displayName}" class="fd-hero-img cs-hero-img" onerror="this.outerHTML='<div class=fd-hero-emoji>${f.emoji||fallbackIconEsc}</div>'">`
        : `<div class="fd-hero-emoji">${f.emoji || fallbackIcon}</div>`
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
  const modal = document.getElementById('fishModal');
  if (!modal || !modal.classList.contains('open')) return;
  modal.classList.remove('open');
  document.body.style.overflow = savedOverflow;
  currentFish = null;
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus?.({ preventScroll: true });
  lastFocus = null;
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