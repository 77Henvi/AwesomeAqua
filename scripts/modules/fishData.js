import { supabase } from '../../supabase.js';

export let fishData = [];

export async function loadFishFromDB() {
  const { data, error } = await supabase
    .from('fish_public')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    if (typeof window.hideLoader === 'function') window.hideLoader();
    const grid = document.getElementById('fishGrid');
    if (grid) {
      grid.innerHTML = `<div class="store-empty-state" style="grid-column:1/-1;">
        <i class="ph ph-wifi-slash"></i>
        <div>โหลดข้อมูลปลาไม่สำเร็จ ลองรีเฟรชหน้าใหม่อีกครั้งนะครับ</div>
      </div>`;
    }
    return;
  }

  fishData = data
    .filter(f => !f.is_archived) // กันไว้ชั้นหนึ่ง เผื่อ view fish_public ยังไม่ได้กรองที่ DB
    .map(f => ({
      id:       f.id,
      name_th:  f.name_th,    
      name_en:  f.name_en,    
      species:  f.species,
      sizeMin:  f.size_min,
      sizeMax:  f.size_max,
      emoji:    f.emoji,
      image:    f.image,
      priceMin: f.price_min,
      priceMax: f.price_max,
      stock:    f.stock,
      level:    f.level,
      desc_th:  f.desc_th,   
      desc_en:  f.desc_en,    
      tags_th:  f.tags_th || [], 
      tags_en:  f.tags_en || []  
  }));

  const { renderFishGrid } = await import('./render.js');
  renderFishGrid();

  // ซ่อน splash loader ทันทีที่ข้อมูลพร้อมแสดงจริง (ไม่ใช่แค่เดาเวลาด้วย setTimeout)
  if (typeof window.hideLoader === 'function') window.hideLoader();
}