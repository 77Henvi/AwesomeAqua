/**
 * scripts/aqua-world.js
 * Controller for Aqua World (Leonardo DiCaprio Foundation Editorial Edition)
 * Awesome Aqua — Explore the World of Fish
 */

import { supabase } from '../supabase.js';
import { CONTINENTS, CONTINENT_META, normalizeContinent, filterFishByContinent, countSpeciesByContinent, formatContinentName } from './shared/continents.js';
import { toggleLanguage, initLanguage } from './shared/i18n.js';
import { toggleMobile, storeEmpty } from './shared/utils.js';
import { InteractiveGlobe } from './modules/globe.js';
import { openFishDetail, closeFishModal, closeFishModalOutside } from './modules/fishModal.js';
import { initCard3DTilt } from './modules/animations.js';

// Expose globals for HTML inline handlers
window.toggleLanguage = toggleLanguage;
window.toggleMobile = toggleMobile;
window.openFishDetail = openFishDetail;
window.closeFishModal = closeFishModal;
window.closeFishModalOutside = closeFishModalOutside;

let allFish = [];
let globeInstance = null;
let currentContinent = 'South America'; // Default iconic continent

const isEnLang = () => (localStorage.getItem('aqua-lang') || 'th') === 'en';

// ── Hide Splash Loader ──
window.hideLoader = function() {
  const loader = document.getElementById('global-loader');
  if (loader) loader.classList.add('hidden');
};

async function loadPublicFish() {
  try {
    const { data, error } = await supabase
      .from('fish_public')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !Array.isArray(data)) {
      console.error('Error loading fish for Aqua World:', error);
      allFish = [];
    } else {
      allFish = data.filter(f => !f.is_archived).map(f => ({
        id: f.id,
        name_th: f.name_th,
        name_en: f.name_en,
        species: f.species,
        sizeMin: f.size_min,
        sizeMax: f.size_max,
        emoji: f.emoji,
        image: f.image,
        priceMin: f.price_min,
        priceMax: f.price_max,
        stock: f.stock,
        level: f.level,
        desc_th: f.desc_th,
        desc_en: f.desc_en,
        tags_th: f.tags_th || [],
        tags_en: f.tags_en || [],
        continent: f.continent || null,
        country: f.country || null,
        origin_region: f.origin_region || null
      }));
    }
  } catch (err) {
    console.error('Unexpected error loading fish:', err);
    allFish = [];
  }
}

function getInitialContinentFromURL() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('continent') || params.get('region');
  return normalizeContinent(raw) || 'South America';
}

function getInitialSpeciesFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('species') || params.get('id');
}

function updateURL(continent) {
  const url = new URL(window.location);
  if (continent) {
    url.searchParams.set('continent', continent);
  } else {
    url.searchParams.delete('continent');
  }
  window.history.replaceState({}, '', url);
}

// ── Render Bottom Habitat Scrubber Timeline ──
function renderHabitatScrubber() {
  const scrubber = document.getElementById('habitatScrubber');
  if (!scrubber) return;

  const isEn = isEnLang();
  const counts = countSpeciesByContinent(allFish);

  let html = `
    <div class="scrubber-track">
      <div class="scrubber-line"></div>
      <div class="scrubber-nodes">
  `;

  CONTINENTS.forEach((c, idx) => {
    const meta = CONTINENT_META[c];
    const isSelected = currentContinent === c;
    const count = counts[c] || 0;

    html += `
      <button class="scrubber-node ${isSelected ? 'active' : ''}" 
              onclick="window.selectContinent('${c}')" 
              title="${isEn ? meta.name_en : meta.name_th}">
        <span class="scrubber-dot"></span>
        <span class="scrubber-case">${meta.case_no || `0${idx + 1}`}</span>
        <span class="scrubber-label">${isEn ? meta.name_en : meta.name_th}</span>
        <span class="scrubber-count">${count}</span>
      </button>
    `;
  });

  html += `
      </div>
    </div>
  `;

  scrubber.innerHTML = html;
}

// ── Render Left Editorial Story & Species Panel ──
function renderEditorialPanel() {
  const panel = document.getElementById('speciesPanel');
  if (!panel) return;

  const isEn = isEnLang();
  const activeCont = currentContinent || 'South America';
  const meta = CONTINENT_META[activeCont];
  const speciesList = filterFishByContinent(allFish, activeCont);
  const count = speciesList.length;

  const basinName = isEn ? (meta.river_basin_en || meta.name_en) : (meta.river_basin_th || meta.name_th);
  const desc = isEn ? meta.description_en : meta.description_th;

  panel.innerHTML = `
    <div class="ldf-card fade-in">
      <!-- Case Header & Indicator -->
      <div class="ldf-case-header">
        <span class="ldf-case-num">${meta.case_no || 'HABITAT'}</span>
        <span class="ldf-case-divider">/</span>
        <span class="ldf-case-continent">${isEn ? meta.name_en.toUpperCase() : meta.name_th}</span>
      </div>

      <!-- Hero Habitat Visual -->
      <div class="ldf-hero-visual">
        <img src="${meta.hero_image}" alt="${basinName}" class="ldf-hero-img" loading="lazy">
        <div class="ldf-hero-overlay"></div>
        <div class="ldf-hero-badge">
          <i class="ph-fill ph-drop"></i>
          <span>${meta.water_params || 'Freshwater Ecosystem'}</span>
        </div>
      </div>

      <!-- Habitat Title & Editorial Description -->
      <div class="ldf-story-body">
        <h2 class="ldf-story-title">${basinName}</h2>
        <p class="ldf-story-desc">${desc}</p>
      </div>

      <!-- Native Species Showcase -->
      <div class="ldf-species-section">
        <div class="ldf-section-head">
          <div class="ldf-section-title">
            <i class="ph-bold ph-fish-simple"></i>
            <span>${isEn ? 'Native Species' : 'สายพันธุ์ประจำถิ่น'}</span>
            <span class="ldf-count-chip">${count}</span>
          </div>
        </div>

        <div class="ldf-species-scroll">
          ${count === 0 ? `
            <div class="ldf-empty">
              <i class="ph ph-waves"></i>
              <p>${isEn ? 'No species recorded in database yet.' : 'ยังไม่มีรายการปลาที่บันทึกในฐานข้อมูล'}</p>
            </div>
          ` : `
            <div class="ldf-species-grid">
              ${speciesList.map(f => {
                const name = isEn && f.name_en ? f.name_en : f.name_th;
                const price = f.priceMin ? `฿${f.priceMin.toLocaleString()}` : '';
                return `
                  <div class="ldf-species-item" onclick="window.openFishDetail('${f.id}')" role="button" tabindex="0">
                    <div class="ldf-item-thumb">
                      ${f.image
                        ? `<img src="${f.image}" alt="${name}" loading="lazy" class="ldf-thumb-img">`
                        : `<div class="ldf-thumb-emoji">${f.emoji || '🐟'}</div>`
                      }
                    </div>
                    <div class="ldf-item-info">
                      <div class="ldf-item-name">${name}</div>
                      <div class="ldf-item-sub">${f.species || '—'}</div>
                      <div class="ldf-item-foot">
                        <span class="ldf-item-price">${price}</span>
                        <span class="ldf-item-action">${isEn ? 'Explore →' : 'ดูปลา →'}</span>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>
      </div>
    </div>
  `;

  // Attach 3D card tilt
  setTimeout(() => {
    initCard3DTilt();
  }, 50);
}

// ── Global Continent Selection Handler ──
window.selectContinent = function(continentName, fromGlobe = false) {
  const normalized = normalizeContinent(continentName) || 'South America';
  currentContinent = normalized;

  if (globeInstance && !fromGlobe) {
    globeInstance.selectContinent(normalized, true);
  }

  updateURL(normalized);
  renderHabitatScrubber();
  renderEditorialPanel();
};

window.resetGlobeView = function() {
  window.selectContinent('South America');
};

// ── Initialize Aqua World ──
async function initAquaWorld() {
  initLanguage();

  await loadPublicFish();

  const globeContainer = document.getElementById('globeViewport');
  const initialContinent = getInitialContinentFromURL();
  currentContinent = initialContinent;

  if (globeContainer) {
    globeInstance = new InteractiveGlobe(globeContainer, {
      initialContinent,
      onContinentSelect: (continent) => {
        window.selectContinent(continent, true);
      },
      onContinentHover: (continent) => {
        const hoverIndicator = document.getElementById('globeHoverText');
        if (hoverIndicator) {
          const isEn = isEnLang();
          if (continent) {
            const meta = CONTINENT_META[continent];
            hoverIndicator.textContent = isEn ? meta.name_en : meta.name_th;
            hoverIndicator.classList.add('visible');
          } else {
            hoverIndicator.classList.remove('visible');
          }
        }
      }
    });
  }

  renderHabitatScrubber();
  renderEditorialPanel();

  // Check if direct species ID was requested in URL
  const speciesId = getInitialSpeciesFromURL();
  if (speciesId) {
    const f = allFish.find(x => String(x.id) === String(speciesId));
    if (f) {
      setTimeout(() => {
        openFishDetail(f.id);
      }, 400);
    }
  }

  window.hideLoader();
}

// Re-render when language changes
window.addEventListener('languageChanged', () => {
  renderHabitatScrubber();
  renderEditorialPanel();
});

// Start
document.addEventListener('DOMContentLoaded', initAquaWorld);
