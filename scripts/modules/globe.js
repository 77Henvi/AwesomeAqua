/**
 * scripts/modules/globe.js
 * 2D Modern Scientific World Atlas Engine — AwesomeAqua (Aqua World)
 * Minimalist 2D Oceanic Map with Dashed Orbital Rings, Translucent Continents,
 * Pulsing Sonar Target Beacons, Smooth Pan/Zoom Physics, and Touch Gestures.
 */

import { CONTINENTS, CONTINENT_META, normalizeContinent } from '../shared/continents.js';

// 2D Normalized Continental Landmass Outlines (Equirectangular / Orthographic projection coords: -1.0 to 1.0)
const CONTINENT_LANDFORMS = {
  'South America': {
    center: { x: -0.36, y: 0.26 },
    shapes: [
      // Main continental body
      [
        { x: -0.48, y: -0.05 }, { x: -0.32, y: -0.08 }, { x: -0.22, y: 0.05 },
        { x: -0.20, y: 0.18 }, { x: -0.28, y: 0.35 }, { x: -0.38, y: 0.58 },
        { x: -0.44, y: 0.62 }, { x: -0.46, y: 0.45 }, { x: -0.52, y: 0.18 },
        { x: -0.54, y: 0.05 }, { x: -0.48, y: -0.05 }
      ]
    ]
  },
  'North America': {
    center: { x: -0.46, y: -0.38 },
    shapes: [
      [
        { x: -0.68, y: -0.62 }, { x: -0.42, y: -0.65 }, { x: -0.26, y: -0.52 },
        { x: -0.22, y: -0.32 }, { x: -0.32, y: -0.18 }, { x: -0.42, y: -0.10 },
        { x: -0.48, y: -0.06 }, { x: -0.54, y: -0.15 }, { x: -0.65, y: -0.32 },
        { x: -0.72, y: -0.50 }, { x: -0.68, y: -0.62 }
      ]
    ]
  },
  'Africa': {
    center: { x: 0.04, y: 0.08 },
    shapes: [
      [
        { x: -0.08, y: -0.28 }, { x: 0.12, y: -0.26 }, { x: 0.22, y: -0.12 },
        { x: 0.26, y: 0.04 }, { x: 0.20, y: 0.25 }, { x: 0.12, y: 0.45 },
        { x: 0.04, y: 0.48 }, { x: -0.04, y: 0.32 }, { x: -0.12, y: 0.15 },
        { x: -0.16, y: -0.05 }, { x: -0.12, y: -0.22 }, { x: -0.08, y: -0.28 }
      ]
    ]
  },
  'Europe': {
    center: { x: 0.06, y: -0.42 },
    shapes: [
      [
        { x: -0.08, y: -0.58 }, { x: 0.12, y: -0.60 }, { x: 0.22, y: -0.48 },
        { x: 0.18, y: -0.32 }, { x: 0.08, y: -0.30 }, { x: -0.04, y: -0.32 },
        { x: -0.10, y: -0.42 }, { x: -0.08, y: -0.58 }
      ]
    ]
  },
  'Asia': {
    center: { x: 0.44, y: -0.25 },
    shapes: [
      [
        { x: 0.18, y: -0.62 }, { x: 0.52, y: -0.65 }, { x: 0.74, y: -0.52 },
        { x: 0.76, y: -0.28 }, { x: 0.65, y: -0.08 }, { x: 0.52, y: 0.08 },
        { x: 0.42, y: 0.15 }, { x: 0.34, y: 0.02 }, { x: 0.26, y: -0.12 },
        { x: 0.20, y: -0.35 }, { x: 0.18, y: -0.62 }
      ]
    ]
  },
  'Oceania': {
    center: { x: 0.58, y: 0.35 },
    shapes: [
      [
        { x: 0.48, y: 0.24 }, { x: 0.68, y: 0.22 }, { x: 0.74, y: 0.35 },
        { x: 0.68, y: 0.48 }, { x: 0.54, y: 0.50 }, { x: 0.44, y: 0.40 },
        { x: 0.48, y: 0.24 }
      ]
    ]
  }
};

export class InteractiveGlobe {
  constructor(containerElement, options = {}) {
    this.container = containerElement;
    this.options = Object.assign({
      onContinentSelect: () => {},
      onContinentHover: () => {},
      initialContinent: 'South America'
    }, options);

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'aqua-globe-canvas';
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);

    this.width = 0;
    this.height = 0;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Camera / Pan & Zoom Physics
    this.scale = 1.0;
    this.targetScale = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.targetPanX = 0;
    this.targetPanY = 0;

    // Selection & hover
    this.selectedContinent = this.options.initialContinent ? normalizeContinent(this.options.initialContinent) : 'South America';
    this.hoveredContinent = null;

    // Interaction state
    this.isDragging = false;
    this.lastPointerX = 0;
    this.lastPointerY = 0;
    this.touchDistStart = 0;

    this.rafId = null;
    this.boundResize = this.resize.bind(this);
    this.boundAnimate = this.animate.bind(this);

    this.initEvents();
    this.initHUDControls();
    this.resize();

    if (this.selectedContinent) {
      this.focusContinent(this.selectedContinent, false);
    }

    this.rafId = requestAnimationFrame(this.boundAnimate);
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    this.width = rect.width || window.innerWidth;
    this.height = rect.height || window.innerHeight;

    if (this.width === 0 || this.height === 0) return;

    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.dpr, this.dpr);
  }

  // ── HUD Floating Controls ──
  initHUDControls() {
    const existing = document.querySelector('.ge-supremacy-hud');
    if (existing) existing.remove();

    const hud = document.createElement('div');
    hud.className = 'ge-supremacy-hud';
    hud.innerHTML = `
      <div class="ge-map-badge" title="Awesome Aqua World Atlas" onclick="window.resetGlobeView()">
        <div class="ge-map-thumb"></div>
        <div class="ge-map-label">2D Atlas Map</div>
      </div>

      <div class="ge-control-bar">
        <button class="ge-btn ge-compass-btn" id="btnGeCompass" title="Reset Map Center" aria-label="Center Map">
          <i class="ph-bold ph-crosshair"></i>
        </button>

        <div class="ge-zoom-group">
          <button class="ge-btn ge-zoom-btn" id="btnGeZoomIn" title="Zoom In (+)" aria-label="Zoom In">
            <i class="ph-bold ph-plus"></i>
          </button>
          <div class="ge-zoom-divider"></div>
          <button class="ge-btn ge-zoom-btn" id="btnGeZoomOut" title="Zoom Out (-)" aria-label="Zoom Out">
            <i class="ph-bold ph-minus"></i>
          </button>
        </div>

        <button class="ge-btn ge-home-btn" id="btnGeHome" title="Reset View" aria-label="Reset View">
          <i class="ph-bold ph-arrows-out-cardinal"></i>
        </button>
      </div>
    `;

    document.body.appendChild(hud);

    document.getElementById('btnGeCompass')?.addEventListener('click', () => this.resetView());
    document.getElementById('btnGeZoomIn')?.addEventListener('click', () => this.zoomStep(0.25));
    document.getElementById('btnGeZoomOut')?.addEventListener('click', () => this.zoomStep(-0.25));
    document.getElementById('btnGeHome')?.addEventListener('click', () => this.resetView());
  }

  zoomStep(delta) {
    this.targetScale = Math.max(0.75, Math.min(2.4, this.targetScale + delta));
  }

  resetView() {
    this.focusContinent('South America', true);
  }

  // ── Focus on Continent (Smooth 2D Pan & Gentle Zoom) ──
  focusContinent(continentName, animate = true) {
    const normalized = normalizeContinent(continentName) || 'South America';
    const land = CONTINENT_LANDFORMS[normalized];
    if (!land) return;

    this.selectedContinent = normalized;

    const isDesktop = this.width >= 1024;
    // On desktop, shift map center towards the right to make room for the left editorial panel
    const baseRadius = Math.min(this.width, this.height) * 0.38;
    const centerOffsetX = isDesktop ? this.width * 0.18 : 0;

    // Target pan coordinates
    this.targetPanX = centerOffsetX - land.center.x * baseRadius * 0.4;
    this.targetPanY = -land.center.y * baseRadius * 0.4;
    this.targetScale = isDesktop ? 1.05 : 0.95;

    if (!animate) {
      this.panX = this.targetPanX;
      this.panY = this.targetPanY;
      this.scale = this.targetScale;
    }
  }

  selectContinent(continentName, animate = true) {
    this.focusContinent(continentName, animate);
  }

  // ── Interaction Events (Drag, Wheel, Touch) ──
  initEvents() {
    const el = this.canvas;

    el.addEventListener('pointerdown', (e) => {
      this.isDragging = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      el.setPointerCapture?.(e.pointerId);
    });

    el.addEventListener('pointermove', (e) => {
      if (this.isDragging) {
        const dx = e.clientX - this.lastPointerX;
        const dy = e.clientY - this.lastPointerY;

        this.targetPanX += dx;
        this.targetPanY += dy;

        // Soft boundary clamping
        const maxPan = this.width * 0.4;
        this.targetPanX = Math.max(-maxPan, Math.min(maxPan + (this.width * 0.2), this.targetPanX));
        this.targetPanY = Math.max(-maxPan, Math.min(maxPan, this.targetPanY));

        this.lastPointerX = e.clientX;
        this.lastPointerY = e.clientY;
      } else {
        this.checkHover(e.clientX, e.clientY);
      }
    });

    const stopDrag = (e) => {
      if (this.isDragging) {
        this.isDragging = false;
        el.releasePointerCapture?.(e?.pointerId);
      }
    };

    el.addEventListener('pointerup', (e) => {
      stopDrag(e);
      this.checkClick(e.clientX, e.clientY);
    });
    el.addEventListener('pointercancel', stopDrag);
    el.addEventListener('pointerleave', () => {
      if (this.hoveredContinent) {
        this.hoveredContinent = null;
        this.options.onContinentHover(null);
      }
    });

    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 0.08 : -0.08;
      this.zoomStep(factor);
    }, { passive: false });

    // Touch pinch
    el.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        this.touchDistStart = Math.hypot(dx, dy);
      }
    }, { passive: true });

    el.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const diff = (dist - this.touchDistStart) * 0.005;
        this.zoomStep(diff);
        this.touchDistStart = dist;
      }
    }, { passive: true });

    window.addEventListener('resize', this.boundResize);
  }

  getScreenCoordsForContinent(continent) {
    const land = CONTINENT_LANDFORMS[continent];
    if (!land) return null;

    const isDesktop = this.width >= 1024;
    const defaultCenterOffset = isDesktop ? this.width * 0.18 : 0;
    const cx = (this.width / 2) + defaultCenterOffset + this.panX;
    const cy = (this.height / 2) + this.panY;
    const baseRadius = Math.min(this.width, this.height) * 0.38 * this.scale;

    return {
      x: cx + land.center.x * baseRadius,
      y: cy + land.center.y * baseRadius,
      radius: 35 * this.scale
    };
  }

  checkHover(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;

    let found = null;
    for (const c of CONTINENTS) {
      const pos = this.getScreenCoordsForContinent(c);
      if (pos) {
        const dist = Math.hypot(mx - pos.x, my - pos.y);
        if (dist <= pos.radius + 15) {
          found = c;
          break;
        }
      }
    }

    if (this.hoveredContinent !== found) {
      this.hoveredContinent = found;
      this.canvas.style.cursor = found ? 'pointer' : (this.isDragging ? 'grabbing' : 'grab');
      this.options.onContinentHover(found);
    }
  }

  checkClick(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;

    for (const c of CONTINENTS) {
      const pos = this.getScreenCoordsForContinent(c);
      if (pos) {
        const dist = Math.hypot(mx - pos.x, my - pos.y);
        if (dist <= pos.radius + 20) {
          this.focusContinent(c, true);
          this.options.onContinentSelect(c);
          break;
        }
      }
    }
  }

  // ── 60 FPS Canvas 2D Render Loop ──
  animate(timestamp) {
    this.rafId = requestAnimationFrame(this.boundAnimate);

    // Smooth camera interpolation
    const ease = 0.08;
    this.panX += (this.targetPanX - this.panX) * ease;
    this.panY += (this.targetPanY - this.panY) * ease;
    this.scale += (this.targetScale - this.scale) * ease;

    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);

    const isDesktop = w >= 1024;
    const defaultCenterOffset = isDesktop ? w * 0.18 : 0;
    const cx = (w / 2) + defaultCenterOffset + this.panX;
    const cy = (h / 2) + this.panY;
    const baseRadius = Math.min(w, h) * 0.38 * this.scale;

    // 1. Deep Space Cosmic Background Glow
    const bgGrad = ctx.createRadialGradient(cx, cy, baseRadius * 0.2, cx, cy, baseRadius * 1.8);
    bgGrad.addColorStop(0, 'rgba(10, 38, 56, 0.45)');
    bgGrad.addColorStop(0.6, 'rgba(4, 18, 28, 0.2)');
    bgGrad.addColorStop(1, 'rgba(2, 7, 18, 0)');
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, baseRadius * 1.8, 0, Math.PI * 2);
    ctx.fill();

    // 2. Outer Dashed Orbital Ring (Matching user screenshot)
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, baseRadius * 1.28, 0, Math.PI * 2);
    ctx.setLineDash([5, 8]);
    ctx.lineDashOffset = -timestamp * 0.01;
    ctx.strokeStyle = 'rgba(117, 226, 224, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();

    // 3. Main Circular Ocean Globe Body
    const oceanGrad = ctx.createRadialGradient(cx - baseRadius * 0.2, cy - baseRadius * 0.2, baseRadius * 0.1, cx, cy, baseRadius);
    oceanGrad.addColorStop(0, '#062634');
    oceanGrad.addColorStop(0.7, '#041620');
    oceanGrad.addColorStop(1, '#020d14');

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2);
    ctx.fillStyle = oceanGrad;
    ctx.shadowColor = 'rgba(117, 226, 224, 0.3)';
    ctx.shadowBlur = 24;
    ctx.fill();

    // Subtle oceanic grid lines
    ctx.strokeStyle = 'rgba(117, 226, 224, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, baseRadius * 0.65, 0, Math.PI * 2);
    ctx.arc(cx, cy, baseRadius * 0.35, 0, Math.PI * 2);
    ctx.stroke();

    // Glowing Circular Boundary Rim
    ctx.strokeStyle = 'rgba(117, 226, 224, 0.65)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // 4. Clip inside oceanic circle for continents
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2);
    ctx.clip();

    // Render 2D Translucent Continent Shapes
    for (const continent of CONTINENTS) {
      const land = CONTINENT_LANDFORMS[continent];
      if (!land) continue;

      const isSelected = this.selectedContinent === continent;
      const isHovered = this.hoveredContinent === continent;

      for (const shape of land.shapes) {
        ctx.beginPath();
        shape.forEach((pt, idx) => {
          const px = cx + pt.x * baseRadius;
          const py = cy + pt.y * baseRadius;
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.closePath();

        // Organic Translucent Teal Landfill
        if (isSelected || isHovered) {
          ctx.fillStyle = 'rgba(44, 172, 173, 0.55)';
          ctx.strokeStyle = '#75e2e0';
          ctx.lineWidth = 2.0;
        } else {
          ctx.fillStyle = 'rgba(44, 172, 173, 0.28)';
          ctx.strokeStyle = 'rgba(117, 226, 224, 0.55)';
          ctx.lineWidth = 1.2;
        }

        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.restore();

    // 5. Interactive Pulsing Radar Nodes (Matching User Screenshot)
    const pulseT = timestamp * 0.003;

    for (const continent of CONTINENTS) {
      const land = CONTINENT_LANDFORMS[continent];
      if (!land) continue;

      const nx = cx + land.center.x * baseRadius;
      const ny = cy + land.center.y * baseRadius;

      const isSelected = this.selectedContinent === continent;
      const isHovered = this.hoveredContinent === continent;

      // Sonar Pulse Waves (Concentric translucent aura ellipses)
      const pulse1 = (pulseT % 1.0);
      const r1 = 12 + pulse1 * 32 * this.scale;
      const op1 = Math.max(0, 0.6 - pulse1 * 0.6);

      const pulse2 = ((pulseT + 0.5) % 1.0);
      const r2 = 12 + pulse2 * 32 * this.scale;
      const op2 = Math.max(0, 0.6 - pulse2 * 0.6);

      // Outer Aura Waves
      ctx.save();
      ctx.fillStyle = `rgba(117, 226, 224, ${op1 * (isSelected ? 1.2 : 0.7)})`;
      ctx.beginPath();
      ctx.ellipse(nx, ny, r1 * 1.25, r1 * 0.85, isSelected ? 0.2 : 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(44, 172, 173, ${op2 * (isSelected ? 1.2 : 0.7)})`;
      ctx.beginPath();
      ctx.ellipse(nx, ny, r2 * 1.15, r2 * 0.8, -0.15, 0, Math.PI * 2);
      ctx.fill();

      // Sharp Inner Target Ring
      ctx.strokeStyle = isSelected ? '#ffffff' : 'rgba(117, 226, 224, 0.85)';
      ctx.lineWidth = isSelected ? 1.8 : 1.2;
      ctx.beginPath();
      ctx.arc(nx, ny, 10 * this.scale, 0, Math.PI * 2);
      ctx.stroke();

      // Solid Bright White Center Dot with Bloom Glow
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#75e2e0';
      ctx.shadowBlur = isSelected ? 16 : 8;
      ctx.beginPath();
      ctx.arc(nx, ny, (isSelected ? 4.5 : 3.5) * this.scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  destroy() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.boundResize);
    this.canvas?.remove();
  }
}
