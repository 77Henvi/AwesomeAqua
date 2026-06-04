import { supabase } from '../../supabase.js';

export let fishData = [];

export async function loadFishFromDB() {
  const { data, error } = await supabase
    .from('fish')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { console.error(error); return; }

  fishData = data.map(f => ({
    id:       f.id,
    name:     f.name,
    species:  f.species,
    sizeMin:  f.size_min, 
    sizeMax:  f.size_max,
    emoji:    f.emoji,
    image:    f.image,
    priceMin: f.price_min,
    priceMax: f.price_max,
    stock:    f.stock,
    level:    f.level,
    desc:     f.desc,
    tags:     f.tags || []
  }));

  const { renderFishGrid } = await import('./render.js');
  renderFishGrid();
}
