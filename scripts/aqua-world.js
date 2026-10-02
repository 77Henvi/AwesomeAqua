/**
 * scripts/aqua-world.js
 * Controller for Aqua World page
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
let currentContinent = null;

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
  return normalizeContinent(raw);
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

// ── Render Continent Selector Pills ──
function renderContinentPills() {
  const pillWrap = document.getElementById('continentPills');
  if (!pillWrap) return;

  const isEn = isEnLang();
  const counts = countSpeciesByContinent(allFish);
  const totalSpecies = allFish.length;

  let html = `
    <button class="aqua-pill ${currentContinent === null ? 'active' : ''}" data-continent="all" onclick="window.selectContinent(null)">
      <span class="aqua-pill-icon">🌍</span>
      <span class="aqua-pill-name">${isEn ? 'All Continents' : 'ทุกทวีป'}</span>
      <span class="aqua-pill-count">${totalSpecies}</span>
    </button>
  `;

  for (const c of CONTINENTS) {
    const meta = CONTINENT_META[c];
    const count = counts[c] || 0;
    const isSelected = currentContinent === c;

    html += `
      <button class="aqua-pill ${isSelected ? 'active' : ''}" data-continent="${c}" onclick="window.selectContinent('${c}')">
        <span class="aqua-pill-icon">${meta.icon}</span>
        <span class="aqua-pill-name">${isEn ? meta.name_en : meta.name_th}</span>
        <span class="aqua-pill-count">${count}</span>
      </button>
    `;
  }

  pillWrap.innerHTML = html;
}

// ── Render Species Panel (Desktop & Mobile) ──
function renderSpeciesPanel() {
  const panel = document.getElementById('speciesPanel');
  if (!panel) return;

  const isEn = isEnLang();

  if (!currentContinent) {
    // Overview state (No specific continent selected)
    const counts = countSpeciesByContinent(allFish);

    panel.innerHTML = `
      <div class="aqua-panel-card">
        <div class="aqua-panel-header">
          <div class="aqua-panel-tag">
            <i class="ph-bold ph-compass"></i>
            <span>${isEn ? 'World Atlas' : 'แผนที่โลกชีวภาพ'}</span>
          </div>
          <h3 class="aqua-panel-title">${isEn ? 'Explore by Continent' : 'สำรวจตามทวีป'}</h3>
          <p class="aqua-panel-desc">${isEn ? 'Click any continent on the 3D globe or select from the list above to view species native to that region.' : 'คลิกเลือกทวีปบนลูกโลก 3 มิติ หรือเลือกจากแถบด้านบนเพื่อดูสายพันธุ์ปลาประจำถิ่น'}</p>
        </div>

        <div class="aqua-continent-summary-grid">
          ${CONTINENTS.map(c => {
            const meta = CONTINENT_META[c];
            const count = counts[c] || 0;
            return `
              <div class="aqua-continent-tile" onclick="window.selectContinent('${c}')" role="button" tabindex="0">
                <div class="tile-top">
                  <span class="tile-icon">${meta.icon}</span>
                  <span class="tile-count">${count} ${isEn ? 'species' : 'ชนิด'}</span>
                </div>
                <div class="tile-name">${isEn ? meta.name_en : meta.name_th}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
    return;
  }

  const meta = CONTINENT_META[currentContinent];
  const speciesList = filterFishByContinent(allFish, currentContinent);
  const count = speciesList.length;

  panel.innerHTML = `
    <div class="aqua-panel-card aqua-panel-card--active">
      <div class="aqua-panel-header">
        <div class="aqua-panel-top-row">
          <div class="aqua-panel-tag">
            <span class="aqua-tag-icon">${meta.icon}</span>
            <span>${isEn ? 'Region Collection' : 'คอลเลกชันประจำทวีป'}</span>
          </div>
          <button class="aqua-panel-close-btn" onclick="window.selectContinent(null)" title="${isEn ? 'Reset view' : 'กลับสู่ภาพรวม'}">
            <i class="ph ph-x"></i>
          </button>
        </div>

        <h3 class="aqua-panel-title">${isEn ? meta.name_en : meta.name_th}</h3>
        <div class="aqua-panel-badge-row">
          <span class="aqua-count-badge">
            <i class="ph-bold ph-fish"></i>
            <span>${count} ${isEn ? 'species discovered' : 'ชนิดที่ค้นพบ'}</span>
          </span>
        </div>
        <p class="aqua-panel-desc">${isEn ? meta.description_en : meta.description_th}</p>
      </div>

      <div class="aqua-species-list-container">
        ${count === 0 ? `
          <div class="aqua-empty-state">
            <i class="ph ph-magnifying-glass-minus"></i>
            <p>${isEn ? 'No species mapped to this region yet.' : 'ยังไม่มีรายการปลาที่ระบุแหล่งกำเนิดในทวีปนี้'}</p>
          </div>
        ` : `
          <div class="aqua-species-grid">
            ${speciesList.map(f => {
              const name = isEn && f.name_en ? f.name_en : f.name_th;
              const price = f.priceMin ? `฿${f.priceMin.toLocaleString()}` : '';
              return `
                <div class="aqua-species-card" onclick="window.openFishDetail('${f.id}')" role="button" tabindex="0">
                  <div class="species-card-img-wrap">
                    ${f.image
                      ? `<img src="${f.image}" alt="${name}" loading="lazy" class="species-card-img">`
                      : `<div class="species-card-emoji">${f.emoji || '🐟'}</div>`
                    }
                  </div>
                  <div class="species-card-body">
                    <h4 class="species-card-name">${name}</h4>
                    <div class="species-card-sub">${f.species || '—'}</div>
                    ${f.country || f.origin_region ? `
                      <div class="species-card-origin">
                        <i class="ph ph-map-pin"></i>
                        <span>${f.origin_region || f.country}</span>
                      </div>
                    ` : ''}
                    <div class="species-card-foot">
                      <span class="species-card-price">${price}</span>
                      <span class="species-card-btn">${isEn ? 'View →' : 'ดูข้อมูล →'}</span>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    </div>
  `;

  // Attach 3D card tilt to species cards
  setTimeout(() => {
    initCard3DTilt();
  }, 50);
}

// ── Global Continent Selection Handler ──
window.selectContinent = function(continentName, fromGlobe = false) {
  const normalized = normalizeContinent(continentName);
  currentContinent = normalized;

  if (globeInstance && !fromGlobe) {
    if (normalized) {
      globeInstance.selectContinent(normalized, true);
    } else {
      globeInstance.resetView();
    }
  }

  updateURL(normalized);
  renderContinentPills();
  renderSpeciesPanel();
};

window.resetGlobeView = function() {
  window.selectContinent(null);
};

window.toggleAutoRotate = function() {
  if (!globeInstance) return;
  globeInstance.autoRotate = !globeInstance.autoRotate;
  const btn = document.getElementById('btnAutoRotate');
  if (btn) {
    btn.classList.toggle('active', globeInstance.autoRotate);
    const icon = btn.querySelector('i');
    if (icon) {
      icon.className = globeInstance.autoRotate ? 'ph-bold ph-pause' : 'ph-bold ph-play';
    }
  }
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

  renderContinentPills();
  renderSpeciesPanel();

  // Check if direct species ID was requested in URL
  const speciesId = getInitialSpeciesFromURL();
  if (speciesId) {
    const f = allFish.find(x => String(x.id) === String(speciesId));
    if (f) {
      setTimeout(() => {
        openFishDetail(f.id);
      }, 300);
    }
  }

  window.hideLoader();
}

// Re-render when language changes
window.addEventListener('languageChanged', () => {
  renderContinentPills();
  renderSpeciesPanel();
});

// Start
document.addEventListener('DOMContentLoaded', initAquaWorld);
