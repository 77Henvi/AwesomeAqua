// ── Dictionary คำแปล สำหรับข้อความ static ในหน้าเว็บ ──
// (ชื่อปลา/คำอธิบายที่มาจาก DB ยังไม่รวมอยู่ในเฟสนี้)
export const translations = {
  th: {
    loaderText:       'กำลังเตรียมน้ำเข้าตู้...',
    navFish:          'ปลาทั้งหมด',
    navAbout:         'เกี่ยวกับเรา',
    heroTag:          'จำหน่ายปลาสวยงามและความรู้',
    heroTitle:        'ปลาสวยงาม<br/><span>คัดสรรพิเศษ</span><br/>ส่งตรงถึงบ้าน',
    heroDesc:         'คัดสรรปลาสวยงามคุณภาพดี พร้อมความรู้การดูแลรักษาปลาที่ถูกต้อง',
    heroCta:          'ดูปลาทั้งหมด',
    statExpNum:       '3 ปี',
    statTypesLabel:   'ชนิดปลาในร้าน',
    statExpLabel:     'ประสบการณ์',
    statQualityLabel: 'คัดสรรคุณภาพ',
    comingTitle:      'กำลังจะมาในเร็วๆ นี้',
    comingDesc:       'ปลาที่อยู่ในแผนนำเข้า สนใจตัวไหนทักมาจองล่วงหน้าได้เลยครับ',
    fishTag:          'คอลเลกชั่นปลา',
    fishTitle:        'ปลาสวยงามของเรา',
    fishDesc:         'คัดสรรปลาคุณภาพพร้อมข้อมูลครบ กดสั่งซื้อผ่านไลน์ได้เลย',
    aboutTag:         'เกี่ยวกับเรา',
    aboutTitle:       'ความรักในปลาสวยงาม<br/>ที่ส่งต่อถึงคุณ',
    aboutDesc:        'Awesome Aqua ตั้งขึ้นจากความหลงใหลในปลาสวยงาม เราคัดสรรปลาคุณภาพดี พร้อมแบ่งปันความรู้การเลี้ยงปลาที่ถูกต้อง เพื่อให้ทุกคนสามารถเลี้ยงปลาได้อย่างมีความสุข',
    value1Title:      'คัดสรรคุณภาพ',
    value1Desc:       'เราคัดปลาและรับเลือกปลาที่ผ่านการตรวจสอบสุขภาพก่อนส่งถึงมือลูกค้า',
    value2Title:      'ความรู้คู่ปลา',
    value2Desc:       'ไม่ใช่แค่ขายปลา แต่เราแบ่งปันความรู้การดูแลปลาให้ถูกต้องและมีความสุข',
    value3Title:      'บริการใส่ใจ',
    value3Desc:       'พร้อมให้คำปรึกษาตลอด ไม่ว่าจะก่อนหรือหลังการซื้อ',
    value4Title:      'ส่งถึงบ้าน',
    value4Desc:       'บรรจุภัณฑ์ปลอดภัย ปลาถึงมือคุณอย่างสดใสพร้อมเลี้ยง',
    contactTag:       'ติดต่อเรา',
    contactTitle:     'ช่องทางติดต่อ',
    socialPhoneLabel: 'โทรศัพท์',
  },
  en: {
    loaderText:       'Getting the tank ready...',
    navFish:          'All Fish',
    navAbout:         'About Us',
    heroTag:          'Premium Aquarium Fish & Knowledge',
    heroTitle:        'Beautiful Fish<br/><span>Hand-Picked</span><br/>Delivered To You',
    heroDesc:         'Hand-picked quality fish, paired with the right care knowledge.',
    heroCta:          'View All Fish',
    statExpNum:       '3 yrs',
    statTypesLabel:   'Fish Species',
    statExpLabel:     'Experience',
    statQualityLabel: 'Quality Selected',
    comingTitle:      'Coming Soon',
    comingDesc:       'Fish we plan to bring in — message us to reserve one in advance.',
    fishTag:          'Fish Collection',
    fishTitle:        'Our Beautiful Fish',
    fishDesc:         'Quality fish with full details — order via Messenger in one tap.',
    aboutTag:         'About Us',
    aboutTitle:       'A Love For Fish,<br/>Passed On To You',
    aboutDesc:        'Awesome Aqua was founded out of a passion for ornamental fish. We hand-pick quality fish and share the right care knowledge, so everyone can keep fish happily.',
    value1Title:      'Quality Selected',
    value1Desc:       'We select only fish that pass a health check before they reach you.',
    value2Title:      'Knowledge Included',
    value2Desc:       'It\'s not just about selling fish — we share the right way to care for them too.',
    value3Title:      'Caring Service',
    value3Desc:       'We\'re here to advise you, before and after your purchase.',
    value4Title:      'Delivered To You',
    value4Desc:       'Safely packaged, your fish arrive fresh and ready to thrive.',
    contactTag:       'Contact',
    contactTitle:     'Get In Touch',
    socialPhoneLabel: 'Phone',
  }
};

const STORAGE_KEY = 'aqua-lang';

// ── อัปเดต UI ของปุ่มสลับภาษา ─
export function updateLangButtonUI(lang) {
  const toggleBtns = document.querySelectorAll('.lang-toggle-btn');
  
  toggleBtns.forEach(btn => {
    btn.querySelectorAll('.lang-opt').forEach(opt => opt.classList.remove('active'));
    
    const activeOpt = btn.querySelector(`.opt-${lang}`);
    if (activeOpt) {
      activeOpt.classList.add('active');
    }
  });
}

// ── ใช้แปลภาษาทั้งหน้าเว็บ ──
export function applyLanguage(lang) {
  const dict = translations[lang] || translations.th;

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (dict[key] !== undefined) el.innerHTML = dict[key];
  });

  const langText = document.querySelector('.lang-text');
  if (langText) langText.textContent = lang.toUpperCase();

  document.documentElement.lang = lang;
  localStorage.setItem(STORAGE_KEY, lang);

  updateLangButtonUI(lang);

  window.dispatchEvent(new CustomEvent('languageChanged', { detail: lang }));
}

// ── เรียกตอนโหลดหน้า ──
export function initLanguage() {
  const saved = localStorage.getItem(STORAGE_KEY) || 'th';
  applyLanguage(saved);
}

// ── สลับภาษา ──
export function toggleLanguage() {
  const currentLang = localStorage.getItem(STORAGE_KEY) || 'th';
  const newLang = currentLang === 'th' ? 'en' : 'th';
  applyLanguage(newLang);
}