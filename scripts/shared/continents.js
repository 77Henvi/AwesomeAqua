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
  'Africa': {
    id: 'Africa',
    slug: 'africa',
    name_en: 'Africa',
    name_th: 'แอฟริกา',
    code: 'AF',
    icon: '🌍',
    // Geographic center for globe camera focusing
    lat: 2.0,
    lon: 22.0,
    description_en: 'Home to the great rift lakes (Malawi, Tanganyika, Victoria) famous for vibrant cichlids and diverse river basins.',
    description_th: 'แหล่งกำเนิดของทะเลสาบน้ำจืดขนาดใหญ่และแม่น้ำสายสำคัญ ชุมทางของปลากลุ่มซิคลิิด (Cichlids) หลากสีสัน'
  },
  'Asia': {
    id: 'Asia',
    slug: 'asia',
    name_en: 'Asia',
    name_th: 'เอเชีย',
    code: 'AS',
    icon: '🌏',
    lat: 30.0,
    lon: 100.0,
    description_en: 'Vast rivers, tropical islands, and freshwater streams hosting bettas, barbs, gouramis, and iconic arowanas.',
    description_th: 'ลุ่มน้ำเขตร้อนอันอุดมสมบูรณ์ ต้นกำเนิดของปลากัด ปลากระดี่ ปลาซิว และปลามังกรอันทรงคุณค่า'
  },
  'Europe': {
    id: 'Europe',
    slug: 'europe',
    name_en: 'Europe',
    name_th: 'ยุโรป',
    code: 'EU',
    icon: '🌍',
    lat: 50.0,
    lon: 15.0,
    description_en: 'Temperate rivers and lakes known for endemic coldwater species, loaches, and ancient river fishes.',
    description_th: 'แม่น้ำและทะเลสาบเขตหนาว แหล่งรวมพันธุ์ปลาน้ำเย็นและปลาน้ำจืดพื้นถิ่นยุโรป'
  },
  'North America': {
    id: 'North America',
    slug: 'north-america',
    name_en: 'North America',
    name_th: 'อเมริกาเหนือ',
    code: 'NA',
    icon: '🌎',
    lat: 38.0,
    lon: -98.0,
    description_en: 'Diverse freshwater ecosystems from Mississippi river valleys to Mexican cenotes, home to livebearers, gars, and sunfish.',
    description_th: 'ระบบนิเวศน้ำจืดตั้งแต่ลุ่มน้ำมิสซิสซิปปีถึงลำธารในอเมริกากลาง แหล่งกำเนิดปลาออกลูกเป็นตัวและปลากลุ่มการ์'
  },
  'South America': {
    id: 'South America',
    slug: 'south-america',
    name_en: 'South America',
    name_th: 'อเมริกาใต้',
    code: 'SA',
    icon: '🌎',
    lat: -14.0,
    lon: -60.0,
    description_en: 'The mighty Amazon and Orinoco basins, the world epicenter of aquarium biodiversity — Discus, Angelfish, Tetras, and Plecos.',
    description_th: 'ลุ่มน้ำอเมซอนและโอริโนโก แหล่งรวมความหลากหลายทางชีวภาพของปลาสวยงามอันดับ 1 ของโลก เช่น ปอมปาดัวร์ เทวดา เตตร้า และซัคเกอร์'
  },
  'Oceania': {
    id: 'Oceania',
    slug: 'oceania',
    name_en: 'Oceania',
    name_th: 'โอเชียเนีย',
    code: 'OC',
    icon: '🌏',
    lat: -24.0,
    lon: 135.0,
    description_en: 'Crystal clear streams and tropical reefs of Australia and New Guinea, legendary for shimmering Rainbowfish and gobies.',
    description_th: 'แหล่งน้ำบริสุทธิ์ของออสเตรเลียและนิวกินี ถิ่นกำเนิดของปลากลุ่มเรนโบว์ (Rainbowfish) เกล็ดสะท้อนแสงแวววาว'
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
