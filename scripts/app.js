// ============================================
//   ENTRY POINT — index.html
// ============================================

import { loadFishFromDB }                          from './modules/fishData.js';
import { openFishDetail, closeFishModal,
         closeFishModalOutside,
         openComingSoonDetail, closeCsModal,
         closeCsModalOutside }                     from './modules/fishModal.js';
import { openEditModal, closeEditModal,
         saveEdit, deleteFish }                    from './modules/indexAdmin.js';
import { openModal, closeModal,
         closeModalOutside, switchTab,
         fakeLogin }                               from './modules/authModal.js';
import { goSlide }                                 from './modules/slideshow.js';
import { injectFishBackgrounds }                   from './modules/fishBackground.js';
import { openLine, toggleMobile,
         scrollToSection }                         from './shared/utils.js';
import { toggleTag }                               from './shared/tags.js';
import { previewEditImage }                        from './shared/image.js';

// ── Expose ไว้บน window เพื่อให้ HTML inline onclick ทำงานได้ ──
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

// 1. สร้างฟังก์ชันสำหรับซ่อนหน้าโหลด
window.hideLoader = function() {
  const loader = document.getElementById('global-loader');
  if (loader) loader.classList.add('hidden');
};

// 2. สั่งให้ซ่อนหน้าโหลด ทันทีที่โครงสร้างเว็บ (HTML) โหลดเสร็จ
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => { 
    hideLoader(); 
  }, 300); // หน่วงเวลา 0.3 วินาทีให้ภาพสมูท
});

// 🌟 ท่าไม้ตายกันเหนียว: ถ้าเว็บค้างเกิน 5 วินาที บังคับปิดจอโหลดไปเลย!
setTimeout(() => {
  hideLoader();
}, 5000);

// ── Init ──
injectFishBackgrounds();
loadFishFromDB();