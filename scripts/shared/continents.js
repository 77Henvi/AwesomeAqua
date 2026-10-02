/**
 * scripts/shared/continents.js
 * Controlled vocabulary and geographic metadata for Aqua World
 */

export const CONTINENTS = [
  'Africa',
  'Asia',
  'Europe',
  'North America',
  'South America',
  'Oceania'
];

export const CONTINENT_META = {
  'South America': {
    id: 'South America',
    slug: 'south-america',
    name_en: 'South America',
    name_th: 'อเมริกาใต้',
    code: 'SA',
    case_no: 'HABITAT 01',
    icon: '🌎',
    lat: -14.0,
    lon: -60.0,
    river_basin_en: 'Amazon & Orinoco River Basins',
    river_basin_th: 'ลุ่มน้ำอเมซอนและโอริโนโก',
    water_params: 'pH 5.5 - 6.8 · 26 - 30°C · Blackwater',
    hero_image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=900&q=80',
    description_en: 'The mighty Amazon and Orinoco basins represent the world epicenter of aquatic biodiversity — native home to Discus, Angelfish, Cardinal Tetras, and Plecos.',
    description_th: 'ลุ่มน้ำอเมซอนและโอริโนโก แหล่งรวมความหลากหลายทางชีวภาพของปลาสวยงามอันดับ 1 ของโลก เช่น ปอมปาดัวร์ เทวดา เตตร้า และซัคเกอร์',
    hotspots: [
      { name: 'Amazon Mainstem', lat: -3.46, lon: -62.21 },
      { name: 'Rio Negro (Blackwater)', lat: -1.28, lon: -61.64 },
      { name: 'Orinoco Basin', lat: 8.35, lon: -62.71 },
      { name: 'Pantanal Wetlands', lat: -16.29, lon: -56.62 }
    ]
  },
  'Asia': {
    id: 'Asia',
    slug: 'asia',
    name_en: 'Asia',
    name_th: 'เอเชีย',
    code: 'AS',
    case_no: 'HABITAT 02',
    icon: '🌏',
    lat: 18.0,
    lon: 100.0,
    river_basin_en: 'Chao Phraya, Mekong & Sundaland Streams',
    river_basin_th: 'ลุ่มน้ำเจ้าพระยา แม่โขง และป่าพรุซุนดาแลนด์',
    water_params: 'pH 6.0 - 7.5 · 24 - 29°C · Tropical Streams',
    hero_image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=900&q=80',
    description_en: 'Vast river deltas, peat swamps, and tropical stream networks hosting wild Bettas, Gouramis, Rasboras, Barbs, and legendary Asian Arowanas.',
    description_th: 'ลุ่มน้ำเขตร้อนอันอุดมสมบูรณ์ ต้นกำเนิดของปลากัด ปลากระดี่ ปลาซิว และปลามังกรอันทรงคุณค่า',
    hotspots: [
      { name: 'Chao Phraya Basin', lat: 14.5, lon: 100.5 },
      { name: 'Mekong River', lat: 15.2, lon: 105.8 },
      { name: 'Borneo Peat Swamps', lat: 0.5, lon: 114.0 },
      { name: 'Ganges & Brahmaputra', lat: 24.0, lon: 88.0 }
    ]
  },
  'Africa': {
    id: 'Africa',
    slug: 'africa',
    name_en: 'Africa',
    name_th: 'แอฟริกา',
    code: 'AF',
    case_no: 'HABITAT 03',
    icon: '🌍',
    lat: 0.0,
    lon: 22.0,
    river_basin_en: 'African Great Lakes & Congo Basin',
    river_basin_th: 'ทะเลสาบเกรตริฟต์และลุ่มน้ำคองโก',
    water_params: 'pH 7.8 - 8.6 · 24 - 28°C · Hard Alkaline Water',
    hero_image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80',
    description_en: 'The spectacular Great Rift Lakes (Malawi, Tanganyika, Victoria) famous for vibrant endemic Cichlids and rapid evolutionary adaptation.',
    description_th: 'ทะเลสาบน้ำจืดขนาดใหญ่และแม่น้ำสายสำคัญ ชุมทางของปลากลุ่มซิคลิิด (Cichlids) หลากสีสันและปลาคองโกเตตร้า',
    hotspots: [
      { name: 'Lake Malawi', lat: -12.18, lon: 34.36 },
      { name: 'Lake Tanganyika', lat: -6.29, lon: 29.57 },
      { name: 'Congo River Basin', lat: -0.5, lon: 21.0 },
      { name: 'Lake Victoria', lat: -1.0, lon: 33.0 }
    ]
  },
  'North America': {
    id: 'North America',
    slug: 'north-america',
    name_en: 'North America',
    name_th: 'อเมริกาเหนือ',
    code: 'NA',
    case_no: 'HABITAT 04',
    icon: '🌎',
    lat: 38.0,
    lon: -98.0,
    river_basin_en: 'Mississippi Drainage & Cenote Springs',
    river_basin_th: 'ลุ่มน้ำมิสซิสซิปปีและถ้ำน้ำจืดเซโนเต้',
    water_params: 'pH 7.0 - 8.2 · 20 - 26°C · Clear Mineral Spring',
    hero_image: 'https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?auto=format&fit=crop&w=900&q=80',
    description_en: 'Diverse freshwater habitats from Appalachian creeks to Central American limestone cenotes, home to livebearers, gars, and flagfish.',
    description_th: 'ระบบนิเวศน้ำจืดตั้งแต่ลำธารหินปูนถึงเซโนเต้ในอเมริกากลาง แหล่งกำเนิดปลาสอด หางนกยูง และปลากลุ่มการ์',
    hotspots: [
      { name: 'Mississippi River', lat: 35.0, lon: -90.0 },
      { name: 'Yucatan Cenotes', lat: 20.6, lon: -89.0 },
      { name: 'Florida Springs', lat: 28.5, lon: -82.0 }
    ]
  },
  'Europe': {
    id: 'Europe',
    slug: 'europe',
    name_en: 'Europe',
    name_th: 'ยุโรป',
    code: 'EU',
    case_no: 'HABITAT 05',
    icon: '🌍',
    lat: 50.0,
    lon: 15.0,
    river_basin_en: 'Danube, Rhine & Alpine Lake Systems',
    river_basin_th: 'ลุ่มน้ำดานูบ ไรน์ และทะเลสาบอัลไพน์',
    water_params: 'pH 6.8 - 7.6 · 16 - 22°C · Cold Mountain Stream',
    hero_image: 'https://images.unsplash.com/photo-1498084393753-b411b2d26b34?auto=format&fit=crop&w=900&q=80',
    description_en: 'Temperate river networks and cold glacial lakes preserving ancient Sturgeons, European loaches, minnows, and endemic killifish.',
    description_th: 'แม่น้ำและทะเลสาบเขตหนาว แหล่งรวมพันธุ์ปลาน้ำเย็น สเตอร์เจียน และปลาน้ำจืดพื้นถิ่นยุโรป',
    hotspots: [
      { name: 'Danube Delta', lat: 45.2, lon: 29.5 },
      { name: 'Rhine River', lat: 50.0, lon: 7.6 },
      { name: 'Alpine Lakes', lat: 46.5, lon: 8.0 }
    ]
  },
  'Oceania': {
    id: 'Oceania',
    slug: 'oceania',
    name_en: 'Oceania',
    name_th: 'โอเชียเนีย',
    code: 'OC',
    case_no: 'HABITAT 06',
    icon: '🌏',
    lat: -24.0,
    lon: 135.0,
    river_basin_en: 'Queensland Rainforest Streams & New Guinea Lakes',
    river_basin_th: 'ลำธารป่าฝนควีนส์แลนด์และทะเลสาบนิวกินี',
    water_params: 'pH 6.5 - 7.5 · 23 - 28°C · Crystal Clear Stream',
    hero_image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80',
    description_en: 'Isolated crystal streams and ancient rainforest rivers of Australia and Papua, renowned for iridescent Rainbowfish and freshwater gobies.',
    description_th: 'แหล่งน้ำบริสุทธิ์ของออสเตรเลียและนิวกินี ถิ่นกำเนิดของปลากลุ่มเรนโบว์ (Rainbowfish) เกล็ดสะท้อนแสงแวววาว',
    hotspots: [
      { name: 'Lake Kutubu (PNG)', lat: -6.4, lon: 143.4 },
      { name: 'Queensland Streams', lat: -17.5, lon: 145.5 },
      { name: 'Murray-Darling Basin', lat: -34.0, lon: 141.0 }
    ]
  }
};

/**
 * Normalize continent string safely
 */
export function normalizeContinent(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();

  for (const c of CONTINENTS) {
    if (c.toLowerCase() === lower) return c;
    const meta = CONTINENT_META[c];
    if (meta.slug === lower || meta.name_th.toLowerCase() === lower || meta.code.toLowerCase() === lower) {
      return c;
    }
  }

  // Handle common variations
  if (lower.includes('south america') || lower.includes('s. america') || lower.includes('อเมริกาใต้')) return 'South America';
  if (lower.includes('north america') || lower.includes('n. america') || lower.includes('อเมริกาเหนือ')) return 'North America';
  if (lower.includes('africa') || lower.includes('แอฟริกา')) return 'Africa';
  if (lower.includes('asia') || lower.includes('เอเชีย')) return 'Asia';
  if (lower.includes('europe') || lower.includes('ยุโรป')) return 'Europe';
  if (lower.includes('oceania') || lower.includes('australia') || lower.includes('โอเชียเนีย')) return 'Oceania';

  return null;
}

/**
 * Filter list of fish by continent
 */
export function filterFishByContinent(fishList, continent) {
  if (!Array.isArray(fishList)) return [];
  const normalized = normalizeContinent(continent);
  if (!normalized) return [];

  return fishList.filter(f => {
    if (!f || f.is_archived) return false;
    const fishCont = normalizeContinent(f.continent);
    return fishCont === normalized;
  });
}

/**
 * Count unique public species per continent
 */
export function countSpeciesByContinent(fishList) {
  const counts = {};
  for (const c of CONTINENTS) counts[c] = 0;

  if (!Array.isArray(fishList)) return counts;

  fishList.forEach(f => {
    if (!f || f.is_archived) return;
    const cont = normalizeContinent(f.continent);
    if (cont && counts[cont] !== undefined) {
      counts[cont] += 1;
    }
  });

  return counts;
}

/**
 * Format continent display name by language
 */
export function formatContinentName(continent, isEn = false) {
  const normalized = normalizeContinent(continent);
  if (!normalized) return isEn ? 'Unknown' : 'ไม่ระบุ';
  const meta = CONTINENT_META[normalized];
  return isEn ? meta.name_en : meta.name_th;
}
