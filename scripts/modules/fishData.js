import { supabase } from '../../supabase.js';
import { storeEmpty } from '../shared/utils.js';

export let fishData = [];

// ดึงสถิติยอดขาย (view fish_sales_stats — ดู docs/SALES_STATS_SETUP.md)
// ถ้ายังไม่ได้สร้าง view / ดึงไม่สำเร็จ → คืน null แล้วหน้าร้านจะทำงานต่อได้ปกติ (แค่ไม่มีป้าย/ยอดขาย)
async function loadSalesStats() {
  try {
    const { data, error } = await supabase.from('fish_sales_stats').select('*');
    if (error || !Array.isArray(data)) return null;
    return new Map(data.map(r => [String(r.fish_id), r]));
  } catch {
    return null;
  }
}

export async function loadFishFromDB() {
  const [{ data, error }, salesMap] = await Promise.all([
    supabase.from('fish_public').select('*').order('created_at', { ascending: false }),
    loadSalesStats(),
  ]);

  if (error) {
    console.error(error);
    if (typeof window.hideLoader === 'function') window.hideLoader();
    const grid = document.getElementById('fishGrid');
    if (grid) {
      grid.innerHTML = storeEmpty('ph ph-wifi-slash', 'โหลดข้อมูลปลาไม่สำเร็จ ลองรีเฟรชหน้าใหม่อีกครั้งนะครับ');
    }
    return;
  }

  fishData = data
    .filter(f => !f.is_archived) // กันไว้ชั้นหนึ่ง เผื่อ view fish_public ยังไม่ได้กรองที่ DB
    .map(f => {
      const s = salesMap?.get(String(f.id));
      return {
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
      desc_th:       f.desc_th,   
      desc_en:       f.desc_en,    
      tags_th:       f.tags_th || [], 
      tags_en:       f.tags_en || [],
      // ── แหล่งกำเนิด (Aqua World) ──
      continent:     f.continent || null,
      country:       f.country || null,
      origin_region: f.origin_region || null,
      // ── ข้อมูลยอดขาย (สำหรับป้าย HOT / ลดหนัก และ "ขายแล้ว X+") ──
      createdAt:     f.created_at || null,
      salesKnown:    !!s,
      soldTotal:     Number(s?.sold_total) || 0,
      sold30d:       Number(s?.sold_30d) || 0,
      lastSoldAt:    s?.last_sold_at || null,
      lastRestockAt: s?.last_restock_at || null,
      };
    });

  const { renderFishGrid } = await import('./render.js');
  renderFishGrid();

  // ซ่อน splash loader ทันทีที่ข้อมูลพร้อมแสดงจริง (ไม่ใช่แค่เดาเวลาด้วย setTimeout)
  if (typeof window.hideLoader === 'function') window.hideLoader();
}