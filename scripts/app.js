import { loadFishFromDB }                          from './modules/fishData.js';
import { openFishDetail, closeFishModal,
         closeFishModalOutside,
         openComingSoonDetail, closeCsModal,
         closeCsModalOutside }                     from './modules/fishModal.js';
import { goSlide, injectHeroBubbles }              from './modules/slideshow.js';
import { injectFishBackgrounds }                   from './modules/fishBackground.js';
import { setFishChip, filterFish,  
        renderFishGrid, getCurrentFilter }         from './modules/render.js';
import { openMessenger, toggleMobile,
         scrollToSection }                         from './shared/utils.js';
import { toggleTag }                               from './shared/tags.js';
import { previewEditImage }                        from './shared/image.js';
import { toggleLanguage, initLanguage }            from './shared/i18n.js';
import { toggleWishlist }                          from './shared/wishlist.js';

window.setFishChip = setFishChip;
window.filterFish = filterFish;

window.onWishToggle = function(id, btnElement, event) {
  if (event) event.stopPropagation();

  const isLiked = toggleWishlist(id);

  if (isLiked) {
    btnElement.classList.add('active');
    btnElement.innerHTML = `<i class="ph-fill ph-heart"></i>`;
  } else {
    btnElement.classList.remove('active');
    btnElement.innerHTML = `<i class="ph ph-heart"></i>`;
  }

  // หากอยู่ในหน้า "ถูกใจ" ให้ re-render เพื่อรีเฟรชรายการที่ถูกลบออกไป
  if (getCurrentFilter() === 'ถูกใจ') {
    renderFishGrid();
  }
};

window.openFishDetail        = openFishDetail;
window.closeFishModal        = closeFishModal;
window.closeFishModalOutside = closeFishModalOutside;
window.openMessenger          = openMessenger;
window.toggleTag             = toggleTag;
window.toggleMobile          = toggleMobile;
window.scrollToSection       = scrollToSection;
window.goSlide               = goSlide;
window.previewEditImage      = previewEditImage;
window.openComingSoonDetail = openComingSoonDetail;
window.closeCsModal         = closeCsModal;
window.closeCsModalOutside  = closeCsModalOutside;

// ── Nav shadow on scroll ──
window.addEventListener('scroll', () => {
  document.querySelector('nav').classList.toggle('scrolled', window.scrollY > 40);
});

// ── Scroll animation ──
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      observer.unobserve(e.target);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));

// ════════════════════════════════════════════
//   LOADING SCREEN CONTROLLER
// ════════════════════════════════════════════

window.hideLoader = function() {
  const loader = document.getElementById('global-loader');
  if (loader) loader.classList.add('hidden');
};

// Failsafe: เผื่อโหลดข้อมูลช้าผิดปกติหรือ error ที่ไม่คาดคิด ไม่ให้ loader ค้างตลอดไป
// (ปกติ loadFishFromDB() ใน fishData.js จะเรียก hideLoader() เองทันทีที่ข้อมูลพร้อมแสดงจริง)
setTimeout(() => {
  hideLoader();
}, 4000);

window.toggleLanguage = toggleLanguage;

// ── Init ──
initLanguage();
injectFishBackgrounds();
injectHeroBubbles();
loadFishFromDB();