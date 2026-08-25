let currentSlide = 0;

export function goSlide(index) {
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

// ── ฟองอากาศลอยขึ้นใน Hero (ตกแต่งอย่างเดียว ไม่กระทบระบบ slideshow ด้านบน) ──
// สร้าง element ครั้งเดียวตอนโหลดหน้า แล้วปล่อยให้ CSS animation (bubbleRise ใน style.css)
// จัดการการเคลื่อนไหวเองทั้งหมด ไม่ผูก JS loop ที่กิน performance ต่อเนื่อง
export function injectHeroBubbles() {
  const wrap = document.getElementById('heroBubbles');
  if (!wrap) return;

  // มือถือ (จอแคบ) ใช้ฟองน้อยลง ลดภาระ layout/paint บนเครื่องที่แรงน้อยกว่า
  const BUBBLE_COUNT = window.innerWidth < 768 ? 8 : 16;
  const frag = document.createDocumentFragment();

  for (let i = 0; i < BUBBLE_COUNT; i++) {
    const b = document.createElement('div');
    const size = 4 + Math.random() * 9;
    b.className = 'hero-bubble';
    b.style.width = `${size}px`;
    b.style.height = `${size}px`;
    b.style.left = `${Math.random() * 100}%`;
    b.style.animationDuration = `${9 + Math.random() * 10}s`;
    b.style.animationDelay = `${Math.random() * 10}s`;
    frag.appendChild(b);
  }

  wrap.appendChild(frag);
}