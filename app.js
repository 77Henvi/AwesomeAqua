import { supabase } from './supabase.js';

let fishData = [];

async function loadFishFromDB() {
  const { data, error } = await supabase
    .from('fish')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { console.error(error); return; }

  fishData = data.map(f => ({
    id:       f.id,
    name:     f.name,
    species:  f.species,
    emoji:    f.emoji,
    image:    f.image,
    priceMin: f.price_min,
    priceMax: f.price_max,
    stock:    f.stock,
    level:    f.level,
    desc:     f.desc,
    tags:     f.tags || []
  }));

  renderFishGrid();
}

const LINE_ICON = (size = 16) => `
  <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="white">
    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0
    .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349
    0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211
    0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195
    0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741
    0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349
    0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348
    0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24
    4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258
    1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539
    6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
  </svg>`;

function escapeHTML(str) {
  return str.replace(/[&<>"']/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#39;'
  }[tag]));
}

// ── Expose functions to global scope ──
window.openFishDetail        = openFishDetail;
window.closeFishModal        = closeFishModal;
window.closeFishModalOutside = closeFishModalOutside;
window.openEditModal         = openEditModal;
window.closeEditModal        = closeEditModal;
window.saveEdit              = saveEdit;
window.deleteFish            = deleteFish;
window.openLine              = openLine;
window.toggleTag             = toggleTag;
window.toggleMobile          = toggleMobile;
window.scrollToSection       = scrollToSection;
window.goSlide               = goSlide;
window.previewEditImage      = previewEditImage;
window.openModal             = openModal;
window.closeModal            = closeModal;
window.closeModalOutside     = closeModalOutside;
window.switchTab             = switchTab;
window.fakeLogin             = fakeLogin;


// ============================================
//   RENDER — การ์ดปลา
// ============================================

// Fish that are "coming soon" — no stock AND no price set (price_min = 0)
// They render as a special teaser card with tape animation
function isComingSoon(f) {
  return f.stock === 0 && f.priceMin === 0;
}

const TAPE_TEXT = '✦ COMING SOON ✦ เร็วๆ นี้ ✦ COMING SOON ✦ เร็วๆ นี้ ✦ COMING SOON ✦ เร็วๆ นี้ ✦ ';

function renderFishGrid() {
  const grid = document.getElementById('fishGrid');
  if (!grid) return;

  grid.innerHTML = fishData.map(f => {
    if (isComingSoon(f)) {
      return `
        <div class="fish-card fish-card--coming" tabindex="0">
          <div class="fish-img fish-img--coming">
            ${f.image
              ? `<img src="${f.image}" alt="${f.name}" onerror="this.parentElement.innerHTML='<span>${f.emoji || '🐟'}</span>'">`
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
            <div class="fish-species">${f.species}</div>
            <div class="fish-tags">${(f.tags || []).map(t => `<span class="tag tag--dim">${t}</span>`).join('')}</div>
            <div class="coming-badge">🔔 แจ้งเตือนเมื่อมีสินค้า</div>
          </div>
        </div>`;
    }

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
  }).join('');
}


// ============================================
//   RENDER — ตารางสต็อก
// ============================================
function renderFishTable() {
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
        <button class="action-btn action-edit"   onclick="openEditModal(${f.id})">แก้ไข</button>
        <button class="action-btn action-delete" onclick="deleteFish(${f.id})">ลบ</button>
      </td>
    </tr>
  `).join('');
}


// ============================================
//   IMAGE — บีบอัดรูปก่อน save
// ============================================
function compressImage(file, callback) {
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX = 800;
      let w = img.width, h = img.height;
      if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      callback(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function previewNewImage(input) {
  if (input.files[0]) {
    const preview = document.getElementById('newImagePreview');
    preview.src = URL.createObjectURL(input.files[0]);
    preview.style.display = 'block';
  }
}

function previewEditImage(input) {
  if (input.files[0]) {
    const preview = document.getElementById('editImagePreview');
    preview.src = URL.createObjectURL(input.files[0]);
    preview.style.display = 'block';
  }
}


// ============================================
//   TAG SELECTOR
// ============================================
function toggleTag(el) { el.classList.toggle('selected'); }

function getSelectedTags(containerId) {
  return [...document.querySelectorAll(`#${containerId} .tag-option.selected`)]
    .map(el => el.textContent.trim());
}

function setSelectedTags(containerId, tags) {
  document.querySelectorAll(`#${containerId} .tag-option`).forEach(el => {
    el.classList.toggle('selected', (tags || []).includes(el.textContent.trim()));
  });
}


// ============================================
//   ADMIN — แก้ไขปลา
// ============================================
function openEditModal(id) {
  const f = fishData.find(x => x.id === id);
  if (!f) return;
  document.getElementById('editFishId').value   = f.id;
  document.getElementById('editName').value     = f.name;
  document.getElementById('editSpecies').value  = f.species;
  document.getElementById('editPriceMin').value = f.priceMin;
  document.getElementById('editPriceMax').value = f.priceMax || '';
  document.getElementById('editStock').value    = f.stock;
  document.getElementById('editLevel').value    = f.level;
  document.getElementById('editDesc').value     = f.desc || '';
  const preview = document.getElementById('editImagePreview');
  preview.src = f.image || '';
  preview.style.display = f.image ? 'block' : 'none';
  setSelectedTags('editTags', f.tags || []);
  document.getElementById('editModal').classList.add('open');
}

function closeEditModal() {
  document.getElementById('editModal').classList.remove('open');
}

function saveEdit() {
  const id = document.getElementById('editFishId').value;
  const f  = fishData.find(x => x.id === id);
  if (!f) return;
  f.name     = document.getElementById('editName').value;
  f.species  = document.getElementById('editSpecies').value;
  f.priceMin = parseInt(document.getElementById('editPriceMin').value) || 0;
  f.priceMax = parseInt(document.getElementById('editPriceMax').value) || 0;
  f.stock    = parseInt(document.getElementById('editStock').value)    || 0;
  f.level    = document.getElementById('editLevel').value;
  f.desc     = document.getElementById('editDesc').value;
  f.tags     = getSelectedTags('editTags');
  const finish = () => {
    renderFishGrid(); renderFishTable();
    closeEditModal();
    showToast('✅ บันทึกข้อมูล ' + f.name + ' เรียบร้อย');
  };
  const fileInput = document.getElementById('editImageFile');
  if (fileInput.files[0]) {
    compressImage(fileInput.files[0], compressed => { f.image = compressed; finish(); });
  } else { finish(); }
}

function deleteFish(id) {
  if (!confirm('ยืนยันลบปลานี้?')) return;
  fishData = fishData.filter(f => f.id !== id);
  renderFishGrid(); renderFishTable();
  showToast('🗑️ ลบปลาเรียบร้อย');
}


// ============================================
//   MODAL — รายละเอียดปลา
// ============================================
function openFishDetail(id) {
  const f = fishData.find(x => x.id === id);
  if (!f) return;

  const outOfStock = f.stock === 0;
  const levelColor = { 'มือใหม่': '#22c55e', 'ปานกลาง': '#f59e0b', 'ผู้เชี่ยวชาญ': '#ef4444' };
  const lc = levelColor[f.level] || '#6b7280';

  document.getElementById('fishDetailContent').innerHTML = `
    <div class="fd-hero">
      ${f.image
        ? `<img src="${f.image}" alt="${f.name}" class="fd-hero-img" onerror="this.outerHTML='<div class=fd-hero-emoji>${f.emoji||'🐟'}</div>'">`
        : `<div class="fd-hero-emoji">${f.emoji || '🐟'}</div>`
      }
      ${outOfStock ? `<div class="fd-out-ribbon">หมดสต็อก</div>` : ''}
      <div class="fd-hero-grad"></div>
      <div class="fd-hero-bottom">
        <div class="fd-name">${f.name}</div>
        <div class="fd-species">${f.species}</div>
      </div>
    </div>

    <div class="fd-body">
      <!-- Tags -->
      <div class="fd-tags">
        ${(f.tags || []).map(t => `<span class="fd-tag">${t}</span>`).join('')}
        <span class="fd-tag fd-tag--level" style="--lc:${lc}">${f.level}</span>
      </div>

      <!-- Price + Stock row -->
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

      <!-- Description -->
      ${f.desc ? `
        <div class="fd-desc-wrap">
          <div class="fd-desc-title">📖 รายละเอียด</div>
          <div class="fd-desc">${f.desc}</div>
        </div>` : ''
      }

      <!-- CTA -->
      <div class="fd-cta">
        ${f.stock > 0
          ? `<button class="btn-line fd-btn-line" onclick="openLine('${f.name}')">
               ${LINE_ICON(20)} สั่งซื้อผ่านไลน์
             </button>`
          : `<button class="btn fd-btn-disabled" disabled>หมดสต็อก</button>`
        }
      </div>
    </div>
  `;
  document.getElementById('fishModal').classList.add('open');
}

function closeFishModal() {
  document.getElementById('fishModal').classList.remove('open');
}
function closeFishModalOutside(e) {
  if (e.target === document.getElementById('fishModal')) closeFishModal();
}


// ============================================
//   MODAL — Login / Signup
// ============================================
function openModal(tab) {
  document.getElementById('authModal').classList.add('open');
  switchTab(tab);
}
function closeModal() {
  document.getElementById('authModal').classList.remove('open');
}
function closeModalOutside(e) {
  if (e.target === document.getElementById('authModal')) closeModal();
}
function switchTab(tab) {
  document.getElementById('loginForm').style.display  = tab === 'login'  ? 'flex' : 'none';
  document.getElementById('signupForm').style.display = tab === 'signup' ? 'flex' : 'none';
  document.getElementById('tabLogin').classList.toggle('active',  tab === 'login');
  document.getElementById('tabSignup').classList.toggle('active', tab === 'signup');
}

function fakeLogin() {
  const email    = document.querySelector('#loginForm input[type="email"]').value;
  const password = document.querySelector('#loginForm input[type="password"]').value;
  if (email === 'admin' && password === 'aqua1234') {
    sessionStorage.setItem('isAdmin', 'true');
    showToast('🔐 เข้าสู่ระบบ Admin...');
    setTimeout(() => { window.location.href = 'admin.html'; }, 500);
    return;
  }
  closeModal();
  showToast('✅ เข้าสู่ระบบเรียบร้อย');
}


// ============================================
//   LINE
// ============================================
function openLine(fishName) {
  const msg = fishName ? `สนใจสั่งซื้อ ${fishName}` : 'สนใจสั่งซื้อปลา';
  showToast('📱 กำลังเปิด LINE...');
  window.open(`https://line.me/R/ti/p/~ltz321?text=${encodeURIComponent(msg)}`);
}


// ============================================
//   UTILITIES
// ============================================
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function toggleMobile() {
  document.getElementById('mobileMenu').classList.toggle('open');
  document.querySelector('.hamburger').classList.toggle('open');
}

function scrollToSection(id) {
  document.querySelector(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}


// ============================================
//   SLIDESHOW
// ============================================
let currentSlide = 0;

function goSlide(index) {
  const slides = document.querySelectorAll('.slide');
  const dots   = document.querySelectorAll('.dot');
  slides[currentSlide].classList.remove('active');
  dots[currentSlide].classList.remove('active');
  currentSlide = index;
  slides[currentSlide].classList.add('active');
  dots[currentSlide].classList.add('active');
}

function nextSlide() {
  const slides = document.querySelectorAll('.slide');
  if (!slides.length) return;
  goSlide((currentSlide + 1) % slides.length);
}

setInterval(nextSlide, 5000);

window.addEventListener('scroll', () => {
  document.querySelector('nav').classList.toggle('scrolled', window.scrollY > 40);
});


// ============================================
//   SCROLL ANIMATION
// ============================================
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      observer.unobserve(e.target);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));


// ============================================
//   FISH MOTION BACKGROUND
// ============================================

// ── ปลา emoji — ไม่ต้องวาด SVG เอง, flip ด้วย scaleX ได้เลย
// 🐟 หัวชี้ขวาโดย default ใน Unicode
const FISH_EMOJIS = ['🐟', '🐠', '🐡', '🐟', '🐠', '🐡'];

function injectFishBackgrounds() {
  const targets = [
    { selector: '#fish',                dark: false },
    { selector: '.stats',               dark: true  },
    { selector: '.about-values',        dark: false },
    { selector: '.about-contact-info',  dark: false },
    { selector: '.about-contact-visual',dark: true  },
  ];

  targets.forEach(({ selector, dark }) => {
    const el = document.querySelector(selector);
    if (!el) return;
    const cs = getComputedStyle(el);
    if (cs.position === 'static') el.style.position = 'relative';

    const wrap = document.createElement('div');
    wrap.className = 'fish-bg' + (dark ? ' fish-bg--dark' : '');

    for (let i = 1; i <= 6; i++) {
      const fish = document.createElement('div');
      fish.className = `fish-bg__fish fish-bg__fish--${i}`;
      fish.textContent = FISH_EMOJIS[i - 1];
      wrap.appendChild(fish);
    }

    el.insertBefore(wrap, el.firstChild);
  });
}

// Run after DOM is ready (called at bottom after loadFishFromDB)
injectFishBackgrounds();

// ============================================
//   INIT
// ============================================
loadFishFromDB();