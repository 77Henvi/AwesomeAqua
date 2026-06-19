import { loadFishFromDB }                          from './modules/fishData.js';
import { openFishDetail, closeFishModal,
         closeFishModalOutside,
         openComingSoonDetail, closeCsModal,
         closeCsModalOutside }                     from './modules/fishModal.js';
import { goSlide }                                 from './modules/slideshow.js';
import { injectFishBackgrounds }                   from './modules/fishBackground.js';
import { openLine, toggleMobile,
         scrollToSection }                         from './shared/utils.js';
import { toggleTag }                               from './shared/tags.js';
import { previewEditImage }                        from './shared/image.js';


window.openFishDetail        = openFishDetail;
window.closeFishModal        = closeFishModal;
window.closeFishModalOutside = closeFishModalOutside;
window.openLine              = openLine;
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


document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => { 
    hideLoader(); 
  }, 300); 
});


setTimeout(() => {
  hideLoader();
}, 3000);

function toggleLanguage() {
  const langText = document.querySelector('.lang-text');
  const currentLang = langText.innerText;
  const newLang = currentLang === 'TH' ? 'EN' : 'TH';
  
  langText.innerText = newLang;

  console.log("Language changed to:", newLang);
}

// ── Init ──
injectFishBackgrounds();
loadFishFromDB();