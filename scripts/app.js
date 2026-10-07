import { loadFishFromDB }                          from './modules/fishData.js';
import { openFishDetail, closeFishModal,
         closeFishModalOutside,
         openComingSoonDetail, closeCsModal,
         closeCsModalOutside }                     from './modules/fishModal.js';
import { goSlide }                                 from './modules/slideshow.js';
import { injectFishBackgrounds }                   from './modules/fishBackground.js';
import { setFishSort, filterFish }                 from './modules/render.js';
import { openMessenger, toggleMobile,
         scrollToSection }                         from './shared/utils.js';
import { toggleTag }                               from './shared/tags.js';
import { previewEditImage }                        from './shared/image.js';
import { toggleLanguage, initLanguage }            from './shared/i18n.js';
import { initAntigravityAnimations }               from './modules/animations.js';
import { initMiniVirtualGlobe }                    from './modules/miniGlobe.js';

window.setFishSort = setFishSort;
window.filterFish = filterFish;

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
}, { passive: true });

// ════════════════════════════════════════════
//   LOADING SCREEN CONTROLLER
// ════════════════════════════════════════════

window.hideLoader = function() {
  const loader = document.getElementById('global-loader');
  if (loader) loader.classList.add('hidden');
};

// Failsafe: เผื่อโหลดข้อมูลช้าผิดปกติหรือ error ที่ไม่คาดคิด ไม่ให้ loader ค้างตลอดไป
setTimeout(() => {
  hideLoader();
}, 4000);

window.toggleLanguage = toggleLanguage;

// ── Init ──
initLanguage();
injectFishBackgrounds();
initAntigravityAnimations();
initMiniVirtualGlobe();
loadFishFromDB();