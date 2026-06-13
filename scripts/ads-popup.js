import { supabase } from '/supabase.js';

(async () => {
  // ดึงเฉพาะ ad ที่ active อยู่ ตัวล่าสุด
  const { data, error } = await supabase
    .from('ads')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return;

  // เช็คว่า user ปิดไปแล้วในเซสชันนี้ไหม (sessionStorage)
  const dismissed = sessionStorage.getItem('ad_dismissed_' + data.id);
  if (dismissed) return;

  showAdPopup(data);
})();

function showAdPopup(ad) {
  // สร้าง overlay + popup
  const overlay = document.createElement('div');
  overlay.id = 'ad-popup-overlay';
  overlay.innerHTML = `
    <div id="ad-popup">
      <button id="ad-popup-close" onclick="closeAdPopup('${ad.id}')" aria-label="ปิด">✕</button>
      ${ad.image_url
        ? `<img src="${ad.image_url}" alt="${ad.title || 'โปรโมชั่น'}" id="ad-popup-img"
             ${ad.link_url ? `onclick="window.open('${ad.link_url}','_blank')"` : ''}>`
        : ''}
    </div>`;

  document.body.appendChild(overlay);

  // animate in
  requestAnimationFrame(() => {
    overlay.classList.add('ad-popup-show');
  });

  // ปิดเมื่อคลิก overlay
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeAdPopup(ad.id);
  });
}

window.closeAdPopup = function(adId) {
  const overlay = document.getElementById('ad-popup-overlay');
  if (!overlay) return;
  overlay.classList.remove('ad-popup-show');
  overlay.classList.add('ad-popup-hide');
  overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
  sessionStorage.setItem('ad_dismissed_' + adId, '1');
};