export const MESSENGER_ICON = (size = 16) => `
  <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="white">
    <path d="M12 2C6.477 2 2 6.145 2 11.243c0 2.913 1.454 5.512 3.726 7.21V22l3.405-1.87c.909.252 1.871.388 2.869.388 5.523 0 10-4.145 10-9.243C22 6.145 17.523 2 12 2zm1.008 12.443l-2.55-2.72-4.977 2.72 5.475-5.814 2.612 2.72 4.914-2.72-5.474 5.814z"/>
  </svg>`;

export function escapeHTML(str) {
  return str.replace(/[&<>"']/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#39;'
  }[tag]));
}

export function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return; // ป้องกัน Error ถ้าหาแท็กไม่เจอ
  t.innerHTML = msg; // <--- แก้จาก textContent เป็น innerHTML แล้ว
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

const MESSENGER_USERNAME = '778588831999884'; // Page ID จริงของ Awesome Aqua (จาก Messenger API settings)

export function openMessenger(fishId) {
  showToast('<i class="ph ph-facebook-logo"></i> กำลังเปิด Messenger...');
  const url = fishId
    ? `https://m.me/${MESSENGER_USERNAME}?ref=fish_${fishId}`
    : `https://m.me/${MESSENGER_USERNAME}`;
  window.open(url, '_blank');
}

export function toggleMobile() {
  const menu = document.getElementById('mobileMenu');
  const btn  = document.querySelector('.hamburger');
  menu.classList.toggle('open');
  btn.classList.toggle('open');
  btn.setAttribute('aria-expanded', menu.classList.contains('open') ? 'true' : 'false');
}

export function scrollToSection(id) {
  document.querySelector(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Empty-state ฝั่งหน้าร้าน (การ์ดปลา) — ใช้จุดเดียวกันทุกที่ ไม่ให้แต่ละหน้าเขียน markup เอง
export function storeEmpty(iconClass, text) {
  return `<div class="store-empty-state"><i class="${iconClass}"></i><p>${text}</p></div>`;
}

// Empty-state ฝั่ง admin — เดิมชื่อ _empty() อยู่ใน admin.js ย้ายมาไว้ที่เดียวเพื่อให้ finance.js ใช้ร่วมได้
export function adminEmpty(icon, text) {
  return `<div class="admin-empty-state"><div class="admin-empty-icon">${icon}</div><div class="admin-empty-text">${text}</div></div>`;
}