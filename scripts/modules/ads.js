import { supabase } from '../supabase.js';
import { showToast } from './shared/utils.js';

export function initAds() {
  loadAdsAdmin();
}

window.saveAd       = saveAd;
window.deleteAd     = deleteAd;
window.toggleAd     = toggleAd;
window.previewAdImg = previewAdImg;

// ── โหลดรายการ ads ทั้งหมด ──
async function loadAdsAdmin() {
  const { data, error } = await supabase
    .from('ads')
    .select('*')
    .order('created_at', { ascending: false });

  const el = document.getElementById('ads-list');
  if (!el) return;

  if (error) { el.innerHTML = '<p style="color:red">โหลดไม่ได้: ' + error.message + '</p>'; return; }
  if (!data.length) {
    el.innerHTML = '<div class="admin-empty-state"><div class="admin-empty-icon">📢</div><div class="admin-empty-text">ยังไม่มีโฆษณา</div></div>';
    return;
  }

  el.innerHTML = data.map(ad => `
    <div class="ads-item" id="ad-${ad.id}">
      <div class="ads-item-img">
        ${ad.image_url
          ? `<img src="${ad.image_url}" alt="${ad.title || ''}">`
          : `<div class="ads-no-img">📢</div>`}
      </div>
      <div class="ads-item-info">
        <div class="ads-item-title">${ad.title || '(ไม่มีชื่อ)'}</div>
        <div class="ads-item-sub">${ad.link_url ? '🔗 ' + ad.link_url : 'ไม่มีลิงก์'}</div>
      </div>
      <div class="ads-item-actions">
        <label class="ads-toggle" title="${ad.active ? 'เปิดอยู่' : 'ปิดอยู่'}">
          <input type="checkbox" ${ad.active ? 'checked' : ''}
            onchange="toggleAd('${ad.id}', this.checked)">
          <span class="ads-toggle-slider"></span>
        </label>
        <button class="action-btn action-delete" onclick="deleteAd('${ad.id}', '${ad.image_path || ''}')">
          <i class="ph ph-trash"></i>
        </button>
      </div>
    </div>`).join('');
}

// ── บันทึก ad ใหม่ ──
async function saveAd() {
  const title    = document.getElementById('adTitle').value.trim();
  const linkUrl  = document.getElementById('adLink').value.trim();
  const file     = document.getElementById('adImageFile').files[0];
  const btn      = document.getElementById('adSaveBtn');

  if (!file && !title) { showToast('⚠️ กรุณาใส่ชื่อหรือรูปภาพ'); return; }

  btn.disabled = true;
  btn.textContent = 'กำลังบันทึก...';

  let imageUrl  = null;
  let imagePath = null;

  if (file) {
    const ext      = file.name.split('.').pop();
    imagePath      = `ad_${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('ads')
      .upload(imagePath, file, { contentType: file.type, upsert: false });

    if (upErr) { showToast('❌ อัปโหลดรูปไม่ได้: ' + upErr.message); btn.disabled = false; btn.textContent = 'บันทึก'; return; }

    const { data: urlData } = supabase.storage.from('ads').getPublicUrl(imagePath);
    imageUrl = urlData.publicUrl;
  }

  const { error } = await supabase.from('ads').insert({
    title, link_url: linkUrl || null,
    image_url: imageUrl, image_path: imagePath,
    active: true
  });

  btn.disabled = false;
  btn.textContent = 'บันทึก';

  if (error) { showToast('❌ บันทึกไม่ได้: ' + error.message); return; }

  showToast('✅ เพิ่มโฆษณาเรียบร้อย');
  document.getElementById('adTitle').value    = '';
  document.getElementById('adLink').value     = '';
  document.getElementById('adImageFile').value = '';
  document.getElementById('adImgPreview').style.display = 'none';
  loadAdsAdmin();
}

// ── toggle เปิด/ปิด ──
async function toggleAd(id, active) {
  const { error } = await supabase.from('ads').update({ active }).eq('id', id);
  if (error) { showToast('❌ อัปเดตไม่ได้'); return; }
  showToast(active ? '✅ เปิดโฆษณาแล้ว' : '🔕 ปิดโฆษณาแล้ว');
}

// ── ลบ ──
async function deleteAd(id, imagePath) {
  if (!confirm('ลบโฆษณานี้?')) return;

  if (imagePath) {
    await supabase.storage.from('ads').remove([imagePath]);
  }
  const { error } = await supabase.from('ads').delete().eq('id', id);
  if (error) { showToast('❌ ลบไม่ได้'); return; }

  showToast('🗑️ ลบโฆษณาแล้ว');
  loadAdsAdmin();
}

// ── preview รูป ──
function previewAdImg(input) {
  const prev = document.getElementById('adImgPreview');
  if (!input.files[0]) { prev.style.display = 'none'; return; }
  prev.src = URL.createObjectURL(input.files[0]);
  prev.style.display = 'block';
}