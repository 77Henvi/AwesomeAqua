/**
 * scripts/modules/globe.js
 * High-Performance 60fps Canvas 3D Interactive Ocean Globe Engine
 * Awesome Aqua — Aqua World
 */

import { CONTINENTS, CONTINENT_META, normalizeContinent } from '../shared/continents.js';

// Continent approximate boundary vertices (lat, lon pairs) for detailed rendering
const CONTINENT_OUTLINES = {
  'South America': [
    [12, -72], [10, -60], [5, -52], [0, -50], [-5, -35], [-10, -36],
    [-22, -41], [-33, -53], [-45, -66], [-55, -68], [-53, -75],
    [-40, -74], [-20, -70], [-5, -80], [4, -77], [8, -77], [12, -72]
  ],
  'North America': [
    [70, -160], [70, -130], [60, -85], [55, -60], [45, -65], [30, -80],
    [25, -80], [20, -88], [15, -90], [8, -78], [15, -95], [22, -105],
    [32, -117], [45, -124], [58, -140], [65, -168], [70, -160]
  ],
  'Africa': [
    [36, -5], [37, 10], [32, 32], [28, 34], [12, 44], [12, 51],
    [0, 42], [-10, 40], [-25, 33], [-34, 18], [-34, 26], [-20, 12],
    [-5, 12], [4, 9], [5, -4], [15, -17], [28, -13], [36, -5]
  ],
  'Europe': [
    [70, 25], [60, 30], [55, 38], [45, 35], [40, 26], [36, -5],
    [43, -9], [48, -5], [55, 5], [58, 6], [62, 5], [70, 25]
  ],
  'Asia': [
    [75, 100], [70, 170], [60, 160], [40, 130], [30, 122], [22, 115],
    [10, 105], [1, 104], [15, 95], [22, 90], [20, 70], [12, 51],
    [30, 48], [40, 50], [50, 60], [60, 60], [70, 70], [75, 100]
  ],
  'Oceania': [
    [-12, 130], [-12, 142], [-20, 148], [-33, 152], [-38, 145],
    [-35, 117], [-22, 114], [-15, 125], [-12, 130]
  ]
};

export class InteractiveGlobe {
  constructor(containerElement, options = {}) {
    this.container = containerElement;
    this.options = Object.assign({
      onContinentSelect: () => {},
      onContinentHover: () => {},
      initialContinent: null
    }, options);

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'aqua-globe-canvas';
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);

    this.width = 0;
    this.height = 0;
    this.radius = 200;

    // Rotation state (radians)
    this.rotX = 0.2; // Slight tilt
    this.rotY = -1.2; // Initial facing Atlantic / Americas
    this.targetRotX = this.rotX;
    this.targetRotY = this.rotY;
    this.isAnimatingFocus = false;

    // Interaction state
    this.isDragging = false;
    this.lastPointerX = 0;
    this.lastPointerY = 0;
    this.velocityRotX = 0;
    this.velocityRotY = 0;
    this.autoRotate = true;
    this.autoRotateSpeed = 0.0025;
    this.lastInteractionTime = Date.now();
    this.hoveredContinent = null;
    this.selectedContinent = this.options.initialContinent ? normalizeContinent(this.options.initialContinent) : null;

    // Ambient floating particles
    this.particles = [];
    this.initParticles(35);

    this.rafId = null;
    this.boundResize = this.resize.bind(this);
    this.boundRender = this.render.bind(this);

    this.initEvents();
    this.resize();
    this.start();

    if (this.selectedContinent) {
      this.focusContinent(this.selectedContinent, false);
    }
  }

  initParticles(count) {
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: (Math.random() - 0.5) * 600,
        y: (Math.random() - 0.5) * 600,
        z: Math.random() * 400 - 200,
        size: 1 + Math.random() * 2.5,
        opacity: 0.15 + Math.random() * 0.5,
        speedX: (Math.random() - 0.5) * 0.2,
        speedY: -0.15 - Math.random() * 0.3
      });
    }
  }

  resize() {
    if (!this.container) return;
    const rect = this.container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.max(rect.width, 280);
    this.height = Math.max(rect.height, 280);

    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.ctx.scale(dpr, dpr);

    // Responsive globe radius
    const minDim = Math.min(this.width, this.height);
    this.radius = Math.min(minDim * 0.38, 260);
  }

  initEvents() {
    window.addEventListener('resize', this.boundResize);

    const onPointerDown = (e) => {
      this.isDragging = true;
      this.isAnimatingFocus = false;
      this.lastPointerX = e.clientX || (e.touches && e.touches[0].clientX);
      this.lastPointerY = e.clientY || (e.touches && e.touches[0].clientY);
      this.velocityRotX = 0;
      this.velocityRotY = 0;
      this.lastInteractionTime = Date.now();
    };

    const onPointerMove = (e) => {
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);

      if (this.isDragging) {
        const dx = clientX - this.lastPointerX;
        const dy = clientY - this.lastPointerY;

        this.velocityRotY = dx * 0.0055;
        this.velocityRotX = dy * 0.0055;

        this.rotY += this.velocityRotY;
        this.rotX = Math.max(-1.1, Math.min(1.1, this.rotX + this.velocityRotX));

        this.lastPointerX = clientX;
        this.lastPointerY = clientY;
        this.lastInteractionTime = Date.now();
      } else {
        // Hover detection on desktop
        this.checkHover(clientX, clientY);
      }
    };

    const onPointerUp = (e) => {
      if (!this.isDragging) return;
      this.isDragging = false;
      this.lastInteractionTime = Date.now();

      // Check if this was a click (little or no move)
      const clientX = e.clientX || (e.changedTouches && e.changedTouches[0].clientX);
      const clientY = e.clientY || (e.changedTouches && e.changedTouches[0].clientY);

      if (clientX !== undefined && clientY !== undefined) {
        const clickedContinent = this.hitTestContinent(clientX, clientY);
        if (clickedContinent) {
          this.selectContinent(clickedContinent, true);
        }
      }
    };

    // Desktop & Touch events
    this.canvas.addEventListener('mousedown', onPointerDown, { passive: true });
    window.addEventListener('mousemove', onPointerMove, { passive: true });
    window.addEventListener('mouseup', onPointerUp, { passive: true });

    this.canvas.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp, { passive: true });
  }

  latLonTo3D(lat, lon, r = this.radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);

    let x = -(r * Math.sin(phi) * Math.cos(theta));
    let z = r * Math.sin(phi) * Math.sin(theta);
    let y = r * Math.cos(phi);

    // Apply rotation around Y axis (longitude rotation)
    const cosY = Math.cos(this.rotY);
    const sinY = Math.sin(this.rotY);
    const x1 = x * cosY + z * sinY;
    const z1 = -x * sinY + z * cosY;

    // Apply rotation around X axis (latitude tilt)
    const cosX = Math.cos(this.rotX);
    const sinX = Math.sin(this.rotX);
    const y2 = y * cosX - z1 * sinX;
    const z2 = y * sinX + z1 * cosX;

    return { x: x1, y: y2, z: z2 };
  }

  project3D(pt) {
    const cx = this.width / 2;
    const cy = this.height / 2;
    return {
      x: cx + pt.x,
      y: cy - pt.y,
      visible: pt.z > -this.radius * 0.15,
      z: pt.z
    };
  }

  checkHover(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const cont = this.hitTestCoords(x, y);
    if (cont !== this.hoveredContinent) {
      this.hoveredContinent = cont;
      this.canvas.style.cursor = cont ? 'pointer' : 'grab';
      this.options.onContinentHover(cont);
    }
  }

  hitTestContinent(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return this.hitTestCoords(clientX - rect.left, clientY - rect.top);
  }

  hitTestCoords(screenX, screenY) {
    let closest = null;
    let minDist = 58; // hit target radius in pixels

    for (const c of CONTINENTS) {
      const meta = CONTINENT_META[c];
      const p3d = this.latLonTo3D(meta.lat, meta.lon);
      if (p3d.z > 0) { // On visible front side
        const proj = this.project3D(p3d);
        const dist = Math.hypot(screenX - proj.x, screenY - proj.y);
        if (dist < minDist) {
          minDist = dist;
          closest = c;
        }
      }
    }

    return closest;
  }

  selectContinent(continentName, animate = true) {
    const normalized = normalizeContinent(continentName);
    this.selectedContinent = normalized;
    if (normalized) {
      this.focusContinent(normalized, animate);
    }
    this.options.onContinentSelect(normalized);
  }

  focusContinent(continentName, animate = true) {
    const meta = CONTINENT_META[continentName];
    if (!meta) return;

    // Convert target coordinates
    // When lon faces front (z > 0), targetRotY is offset
    const targetY = -((meta.lon + 180) * (Math.PI / 180)) + Math.PI / 2;
    const targetX = Math.max(-0.8, Math.min(0.8, meta.lat * (Math.PI / 180) * 0.7));

    if (!animate) {
      this.rotY = targetY;
      this.rotX = targetX;
      this.targetRotY = targetY;
      this.targetRotX = targetX;
      return;
    }

    this.isAnimatingFocus = true;
    this.targetRotY = targetY;
    this.targetRotX = targetX;
    this.lastInteractionTime = Date.now();
  }

  start() {
    if (!this.rafId) {
      this.rafId = requestAnimationFrame(this.boundRender);
    }
  }

  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  render() {
    this.updatePhysics();
    this.draw();
    this.rafId = requestAnimationFrame(this.boundRender);
  }

  updatePhysics() {
    const now = Date.now();

    // Slerp to target if focusing continent
    if (this.isAnimatingFocus) {
      const ease = 0.085;
      // Handle angular wrap-around on rotY
      let diffY = (this.targetRotY - this.rotY) % (Math.PI * 2);
      if (diffY < -Math.PI) diffY += Math.PI * 2;
      if (diffY > Math.PI) diffY -= Math.PI * 2;

      this.rotY += diffY * ease;
      this.rotX += (this.targetRotX - this.rotX) * ease;

      if (Math.abs(diffY) < 0.002 && Math.abs(this.targetRotX - this.rotX) < 0.002) {
        this.rotY = this.targetRotY;
        this.rotX = this.targetRotX;
        this.isAnimatingFocus = false;
      }
    } else if (!this.isDragging) {
      // Inactive auto-rotation after 6s of stillness
      if (this.autoRotate && (now - this.lastInteractionTime > 4500)) {
        this.rotY += this.autoRotateSpeed;
      } else {
        // Inertia damping
        this.rotY += this.velocityRotY;
        this.rotX = Math.max(-1.1, Math.min(1.1, this.rotX + this.velocityRotX));
        this.velocityRotY *= 0.92;
        this.velocityRotX *= 0.92;
      }
    }

    // Update ambient particles
    this.particles.forEach(p => {
      p.y += p.speedY;
      p.x += p.speedX;
      if (p.y < -this.height / 2 - 50) p.y = this.height / 2 + 50;
      if (p.x < -this.width / 2 - 50) p.x = this.width / 2 + 50;
      if (p.x > this.width / 2 + 50) p.x = -this.width / 2 - 50;
    });
  }

  draw() {
    const ctx = this.ctx;
    const cx = this.width / 2;
    const cy = this.height / 2;
    const r = this.radius;

    ctx.clearRect(0, 0, this.width, this.height);

    // 1. Draw Space / Ocean Atmosphere Glow Behind Sphere
    const bgGlow = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r * 1.45);
    bgGlow.addColorStop(0, 'rgba(44, 172, 173, 0.22)');
    bgGlow.addColorStop(0.5, 'rgba(2, 77, 96, 0.12)');
    bgGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = bgGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.45, 0, Math.PI * 2);
    ctx.fill();

    // 2. Draw Floating Bioluminescent Ambient Dust Particles
    this.particles.forEach(p => {
      ctx.fillStyle = `rgba(117, 226, 224, ${p.opacity})`;
      ctx.beginPath();
      ctx.arc(cx + p.x, cy + p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });

    // 3. Draw Deep Ocean Sphere
    const oceanGrad = ctx.createRadialGradient(
      cx - r * 0.35, cy - r * 0.35, r * 0.1,
      cx, cy, r
    );
    oceanGrad.addColorStop(0, '#0a3240');
    oceanGrad.addColorStop(0.5, '#05222c');
    oceanGrad.addColorStop(0.85, '#02151b');
    oceanGrad.addColorStop(1, '#010c10');

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = oceanGrad;
    ctx.fill();
    ctx.clip(); // Clip everything inside the globe sphere

    // 4. Draw Latitude & Longitude Coordinate Grid Lines
    ctx.strokeStyle = 'rgba(117, 226, 224, 0.08)';
    ctx.lineWidth = 1;

    // Latitudes (-60 to +60 in steps of 30)
    for (let lat = -60; lat <= 60; lat += 30) {
      ctx.beginPath();
      let first = true;
      for (let lon = -180; lon <= 180; lon += 10) {
        const pt = this.latLonTo3D(lat, lon);
        const proj = this.project3D(pt);
        if (proj.visible) {
          if (first) { ctx.moveTo(proj.x, proj.y); first = false; }
          else { ctx.lineTo(proj.x, proj.y); }
        } else {
          first = true;
        }
      }
      ctx.stroke();
    }

    // Longitudes (-180 to +180 in steps of 45)
    for (let lon = -180; lon < 180; lon += 45) {
      ctx.beginPath();
      let first = true;
      for (let lat = -80; lat <= 80; lat += 5) {
        const pt = this.latLonTo3D(lat, lon);
        const proj = this.project3D(pt);
        if (proj.visible) {
          if (first) { ctx.moveTo(proj.x, proj.y); first = false; }
          else { ctx.lineTo(proj.x, proj.y); }
        } else {
          first = true;
        }
      }
      ctx.stroke();
    }

    // 5. Draw Continents Geometry
    for (const [continentName, outline] of Object.entries(CONTINENT_OUTLINES)) {
      const isSelected = this.selectedContinent === continentName;
      const isHovered = this.hoveredContinent === continentName;

      ctx.beginPath();
      let validPoints = 0;
      let first = true;

      outline.forEach(([lat, lon]) => {
        const pt = this.latLonTo3D(lat, lon);
        const proj = this.project3D(pt);
        if (proj.visible) {
          if (first) { ctx.moveTo(proj.x, proj.y); first = false; }
          else { ctx.lineTo(proj.x, proj.y); }
          validPoints++;
        }
      });

      if (validPoints > 2) {
        ctx.closePath();

        // Fill style based on hover & select
        if (isSelected) {
          ctx.fillStyle = 'rgba(44, 172, 173, 0.45)';
          ctx.strokeStyle = '#75E2E0';
          ctx.lineWidth = 2.2;
        } else if (isHovered) {
          ctx.fillStyle = 'rgba(117, 226, 224, 0.32)';
          ctx.strokeStyle = 'rgba(117, 226, 224, 0.85)';
          ctx.lineWidth = 1.8;
        } else {
          ctx.fillStyle = 'rgba(44, 172, 173, 0.16)';
          ctx.strokeStyle = 'rgba(117, 226, 224, 0.4)';
          ctx.lineWidth = 1.2;
        }

        ctx.fill();
        ctx.stroke();
      }
    }

    ctx.restore(); // Restore from clipping

    // 6. Draw Atmosphere Rim Light & Specular Edge
    const rimGrad = ctx.createRadialGradient(cx, cy, r * 0.88, cx, cy, r);
    rimGrad.addColorStop(0, 'rgba(117, 226, 224, 0)');
    rimGrad.addColorStop(0.7, 'rgba(117, 226, 224, 0.15)');
    rimGrad.addColorStop(0.95, 'rgba(117, 226, 224, 0.45)');
    rimGrad.addColorStop(1, 'rgba(255, 255, 255, 0.8)');

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = rimGrad;
    ctx.lineWidth = 3;
    ctx.stroke();

    // 7. Draw Continent Centroid Beacons & Labels
    for (const c of CONTINENTS) {
      const meta = CONTINENT_META[c];
      const p3d = this.latLonTo3D(meta.lat, meta.lon);

      // Only draw if on the visible front hemisphere
      if (p3d.z > 5) {
        const proj = this.project3D(p3d);
        const isSelected = this.selectedContinent === c;
        const isHovered = this.hoveredContinent === c;

        const pulseScale = 1 + Math.sin(Date.now() * 0.003 + meta.lat) * 0.2;

        // Outer pulsing radar ring
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, (isSelected ? 14 : 9) * pulseScale, 0, Math.PI * 2);
        ctx.strokeStyle = isSelected ? 'rgba(117, 226, 224, 0.8)' : isHovered ? 'rgba(117, 226, 224, 0.6)' : 'rgba(44, 172, 173, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Inner glowing dot
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, isSelected ? 5.5 : 4, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? '#ffffff' : isHovered ? '#75E2E0' : '#2CACAD';
        ctx.shadowColor = '#75E2E0';
        ctx.shadowBlur = isSelected ? 12 : 6;
        ctx.fill();
        ctx.shadowBlur = 0; // Reset shadow

        // Label pill (Shown when hovered or selected)
        if (isSelected || isHovered) {
          const label = meta.name_en;
          ctx.font = '600 11px Jost, sans-serif';
          const textW = ctx.measureText(label).width;

          ctx.fillStyle = 'rgba(6, 28, 34, 0.88)';
          ctx.strokeStyle = isSelected ? '#75E2E0' : 'rgba(117, 226, 224, 0.4)';
          ctx.lineWidth = 1;

          const pillX = proj.x - (textW + 16) / 2;
          const pillY = proj.y - 28;
          const pillW = textW + 16;
          const pillH = 20;
          const rad = 10;

          ctx.beginPath();
          ctx.roundRect(pillX, pillY, pillW, pillH, rad);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, proj.x, pillY + pillH / 2);
        }
      }
    }
  }

  destroy() {
    this.stop();
    window.removeEventListener('resize', this.boundResize);
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}
