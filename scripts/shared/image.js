export function compressImage(file, callback) {
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX = 800;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w >= h) { h = Math.round(h * MAX / w); w = MAX; }
        else        { w = Math.round(w * MAX / h); h = MAX; }
      }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      callback(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

export function previewNewImage(input) {
  if (input.files[0]) {
    const p = document.getElementById('newImagePreview');
    p.src = URL.createObjectURL(input.files[0]);
    p.style.display = 'block';
  }
}

export function previewEditImage(input) {
  if (input.files[0]) {
    const p = document.getElementById('editImagePreview');
    p.src = URL.createObjectURL(input.files[0]);
    p.style.display = 'block';
  }
}

/**
 * บีบอัด + อัปโหลดรูปปลาขึ้น Supabase Storage แล้วคืน public URL
 * ใช้ทั้งตอนเพิ่มปลาใหม่ (addFish) และแก้ไขปลา (saveEdit)
 * @param {File} file ไฟล์รูปจาก input[type=file]
 * @param {SupabaseClient} supabase client ที่ตั้งค่าไว้แล้ว (ส่งเข้ามาแทนการ import ตรงๆ กันปัญหา circular import)
 * @param {Function} showToast ฟังก์ชันแจ้งเตือน
 * @returns {Promise<string|null>} public URL หรือ null ถ้าอัปโหลดไม่สำเร็จ
 */
export async function uploadImage(file, supabase, showToast) {
  const filename   = `fish_${Date.now()}.jpg`;
  const compressed = await new Promise(resolve => compressImage(file, resolve));
  const res        = await fetch(compressed);
  const blob       = await res.blob();

  const { error } = await supabase.storage
    .from('fish-images')
    .upload(filename, blob, { contentType: 'image/jpeg', upsert: false });

  if (error) {
    console.error('Upload error:', error);
    showToast('<i class="ph-fill ph-x-circle" style="color:#ef4444; font-size:1.1em; vertical-align:-2px;"></i> อัปโหลดรูปไม่ได้: ' + error.message);
    return null;
  }

  const { data: urlData } = supabase.storage
    .from('fish-images')
    .getPublicUrl(filename);

  return urlData.publicUrl;
}