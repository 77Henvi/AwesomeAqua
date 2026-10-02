/**
 * scripts/modules/globe.js
 * Supremacy Google Earth 3D Engine — AwesomeAqua (Aqua World)
 * Powered by Three.js WebGL with satellite imagery, clouds, atmosphere glow,
 * deep cosmic starfield, orbital physics, raycasting, and Google Earth HUD controls.
 */

import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { CONTINENTS, CONTINENT_META, normalizeContinent } from '../shared/continents.js';

// Satellite earth textures (high availability CDNs with instant fallback)
const TEXTURE_ASSETS = {
  earthDay: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/textures/planets/earth_atmos_2048.jpg',
  earthSpecular: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/textures/planets/earth_specular_2048.jpg',
  earthClouds: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/textures/planets/earth_clouds_1024.png'
};

// Shader for Google Earth atmospheric rim scattering glow (Fresnel effect)
const AtmosphereShader = {
  vertexShader: `
    varying vec3 vNormal;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vNormal;
    void main() {
      float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.2);
      gl_FragColor = vec4(0.35, 0.65, 1.0, 1.0) * intensity * 1.3;
    }
  `
};

export class InteractiveGlobe {
  constructor(containerElement, options = {}) {
    this.container = containerElement;
    this.options = Object.assign({
      onContinentSelect: () => {},
      onContinentHover: () => {},
      initialContinent: null
    }, options);

    this.width = this.container.clientWidth || 600;
    this.height = this.container.clientHeight || 500;
    this.globeRadius = 5.0;

    // Camera orbit parameters
    this.camDistance = 14.5;
    this.minDistance = 8.0;
    this.maxDistance = 24.0;
    this.targetDistance = this.camDistance;

    // Rotation angles (spherical coordinates)
    this.lat = 15; // pitch
    this.lon = -50; // yaw
    this.targetLat = this.lat;
    this.targetLon = this.lon;

    // View mode (3D vs 2D top-down)
    this.is2DMode = false;
    this.heading = 0;

    // Auto rotate & physics
    this.autoRotate = true;
    this.autoRotateSpeed = 0.12; // deg per frame
    this.isUserInteracting = false;
    this.lastPointerX = 0;
    this.lastPointerY = 0;
    this.velocityLat = 0;
    this.velocityLon = 0;
    this.lastInteractionTime = Date.now();

    // Selection & hover
    this.selectedContinent = this.options.initialContinent ? normalizeContinent(this.options.initialContinent) : null;
    this.hoveredContinent = null;

    // Touch pinch state
    this.touchStartDist = 0;

    this.initThree();
    this.initStarfield();
    this.initEarth();
    this.initAtmosphere();
    this.initClouds();
    this.initContinentBeacons();
    this.initEvents();
    this.initHUDControls();

    if (this.selectedContinent) {
      this.focusContinent(this.selectedContinent, false);
    }

    this.animate = this.animate.bind(this);
    this.rafId = requestAnimationFrame(this.animate);
  }

  // ── Three.js Scene, Camera, Renderer ──
  initThree() {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.1, 2000);
    this.updateCameraPosition();

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.canvas = this.renderer.domElement;
    this.canvas.className = 'aqua-globe-canvas';
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.container.appendChild(this.canvas);

    // Realistic Space Lighting (Sunlight + Ambient space scatter)
    const ambientLight = new THREE.AmbientLight(0xddeeff, 0.45);
    this.scene.add(ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xffffff, 2.2);
    this.sunLight.position.set(18, 10, 18);
    this.scene.add(this.sunLight);

    const fillLight = new THREE.DirectionalLight(0x2cacad, 0.35);
    fillLight.position.set(-15, -8, -12);
    this.scene.add(fillLight);

    // Raycaster for continent picking
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(-999, -999);
  }

  // ── Deep Cosmic Starfield ──
  initStarfield() {
    const starCount = 1600;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 350 + Math.random() * 450;

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Subtle star color variance (white, cyan, warm gold)
      const colorType = Math.random();
      if (colorType > 0.8) {
        colors[i * 3] = 0.7; colors[i * 3 + 1] = 0.9; colors[i * 3 + 2] = 1.0; // Cyan-blue
      } else if (colorType > 0.65) {
        colors[i * 3] = 1.0; colors[i * 3 + 1] = 0.92; colors[i * 3 + 2] = 0.75; // Warm star
      } else {
        colors[i * 3] = 0.95; colors[i * 3 + 1] = 0.95; colors[i * 3 + 2] = 1.0; // Pure white
      }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 1.4,
      vertexColors: true,
      transparent: true,
      opacity: 0.85
    });

    this.starfield = new THREE.Points(geometry, material);
    this.scene.add(this.starfield);
  }

  // ── Photorealistic Earth Sphere ──
  initEarth() {
    const earthGeo = new THREE.SphereGeometry(this.globeRadius, 64, 64);
    const textureLoader = new THREE.TextureLoader();

    // Earth Day & Specular textures with procedural instant fallback
    const earthMap = textureLoader.load(TEXTURE_ASSETS.earthDay, () => {
      this.renderer.render(this.scene, this.camera);
    }, undefined, () => {
      // Offline fallback: generate beautiful procedural satellite map
      this.earthMesh.material.map = this.createFallbackEarthTexture();
      this.earthMesh.material.needsUpdate = true;
    });

    const specularMap = textureLoader.load(TEXTURE_ASSETS.earthSpecular, undefined, undefined, () => {});

    this.earthMaterial = new THREE.MeshStandardMaterial({
      map: earthMap,
      roughness: 0.65,
      metalness: 0.05,
      roughnessMap: specularMap
    });

    this.earthMesh = new THREE.Mesh(earthGeo, this.earthMaterial);
    this.scene.add(this.earthMesh);
  }

  // ── Google Earth Atmospheric Halo Glow ──
  initAtmosphere() {
    const atmosGeo = new THREE.SphereGeometry(this.globeRadius * 1.03, 64, 64);
    const atmosMat = new THREE.ShaderMaterial({
      vertexShader: AtmosphereShader.vertexShader,
      fragmentShader: AtmosphereShader.fragmentShader,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true
    });

    this.atmosphereMesh = new THREE.Mesh(atmosGeo, atmosMat);
    this.scene.add(this.atmosphereMesh);
  }

  // ── Floating Dynamic Cloud Layer ──
  initClouds() {
    const cloudGeo = new THREE.SphereGeometry(this.globeRadius * 1.014, 64, 64);
    const textureLoader = new THREE.TextureLoader();

    const cloudMap = textureLoader.load(TEXTURE_ASSETS.earthClouds, undefined, undefined, () => {});

    this.cloudMat = new THREE.MeshStandardMaterial({
      map: cloudMap,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.cloudMesh = new THREE.Mesh(cloudGeo, this.cloudMat);
    this.scene.add(this.cloudMesh);
  }

  // ── 3D Interactive Continent Beacons & Pins ──
  initContinentBeacons() {
    this.beaconsGroup = new THREE.Group();
    this.beaconMeshes = [];

    for (const continent of CONTINENTS) {
      const meta = CONTINENT_META[continent];
      const pos = this.latLonToVector3(meta.lat, meta.lon, this.globeRadius * 1.025);

      // Beacon Pin Root
      const beaconRoot = new THREE.Group();
      beaconRoot.position.copy(pos);
      beaconRoot.lookAt(pos.clone().multiplyScalar(2));
      beaconRoot.userData = { continent, meta };

      // Inner Glowing Core
      const coreGeo = new THREE.SphereGeometry(0.18, 16, 16);
      const coreMat = new THREE.MeshBasicMaterial({
        color: 0x75e2e0,
        transparent: true,
        opacity: 0.95
      });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      coreMesh.userData = { continent, meta };
      beaconRoot.add(coreMesh);

      // Animated Pulse Ring
      const ringGeo = new THREE.RingGeometry(0.22, 0.42, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x2cacad,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.userData = { continent, meta, isRing: true };
      beaconRoot.add(ringMesh);

      // Hitbox for raycasting (larger invisible sphere for easy hover & touch)
      const hitGeo = new THREE.SphereGeometry(0.8, 12, 12);
      const hitMat = new THREE.MeshBasicMaterial({ visible: false });
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.userData = { continent, meta, isHitbox: true };
      beaconRoot.add(hitMesh);

      this.beaconsGroup.add(beaconRoot);
      this.beaconMeshes.push({
        root: beaconRoot,
        core: coreMesh,
        ring: ringMesh,
        hitbox: hitMesh,
        continent,
        meta,
        basePos: pos
      });
    }

    this.scene.add(this.beaconsGroup);
  }

  // Convert Latitude / Longitude to 3D Cartesian coordinates
  latLonToVector3(lat, lon, radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);

    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const z = (radius * Math.sin(phi) * Math.sin(theta));
    const y = (radius * Math.cos(phi));

    return new THREE.Vector3(x, y, z);
  }

  // ── Procedural Fallback Earth Texture (If offline) ──
  createFallbackEarthTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Deep ocean background
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#061c36');
    grad.addColorStop(0.5, '#0a2e58');
    grad.addColorStop(1, '#05182e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 512);

    // Approximate continent land masses
    ctx.fillStyle = '#26543b';
    ctx.beginPath();
    ctx.ellipse(260, 260, 70, 130, 0.2, 0, Math.PI * 2); // Americas
    ctx.ellipse(540, 260, 90, 120, 0, 0, Math.PI * 2); // Africa / Europe
    ctx.ellipse(750, 200, 140, 100, 0, 0, Math.PI * 2); // Asia
    ctx.ellipse(820, 360, 60, 45, 0, 0, Math.PI * 2); // Australia
    ctx.fill();

    return new THREE.CanvasTexture(canvas);
  }

  // ── Camera Position Update (Spherical Orbit) ──
  updateCameraPosition() {
    const phi = THREE.MathUtils.degToRad(90 - this.lat);
    const theta = THREE.MathUtils.degToRad(this.lon);

    const x = this.camDistance * Math.sin(phi) * Math.sin(theta);
    const y = this.camDistance * Math.cos(phi);
    const z = this.camDistance * Math.sin(phi) * Math.cos(theta);

    this.camera.position.set(x, y, z);
    this.camera.lookAt(0, 0, 0);

    // Update compass needle orientation
    this.updateCompass();
  }

  updateCompass() {
    const compassNeedle = document.getElementById('geCompassNeedle');
    if (compassNeedle) {
      // Calculate heading angle
      const headingDeg = (this.lon % 360);
      compassNeedle.style.transform = `rotate(${-headingDeg}deg)`;
    }
  }

  // ── Google Earth HUD Controls (Bottom Right) ──
  initHUDControls() {
    const existingControls = this.container.querySelector('.ge-supremacy-hud');
    if (existingControls) existingControls.remove();

    const hud = document.createElement('div');
    hud.className = 'ge-supremacy-hud';
    hud.innerHTML = `
      <!-- Bottom Left Map Layer Badge -->
      <div class="ge-map-badge" title="Awesome Aqua Satellite Earth" onclick="window.resetGlobeView()">
        <div class="ge-map-thumb"></div>
        <div class="ge-map-label">Satellite 3D</div>
      </div>

      <!-- Bottom Right Google Earth Control Bar -->
      <div class="ge-control-bar">
        <!-- Compass North Button -->
        <button class="ge-btn ge-compass-btn" id="btnGeCompass" title="Reset North" aria-label="North orientation">
          <div class="ge-compass-icon" id="geCompassNeedle">
            <span class="ge-compass-n">N</span>
            <span class="ge-compass-arrow"></span>
          </div>
        </button>

        <!-- 2D / 3D Mode Toggle -->
        <button class="ge-btn ge-mode-btn" id="btnGeTilt" title="Toggle 2D / 3D Tilt" aria-label="Toggle 2D/3D">
          <span id="geModeText">3D</span>
        </button>

        <!-- Zoom Controls -->
        <div class="ge-zoom-group">
          <button class="ge-btn ge-zoom-btn" id="btnGeZoomIn" title="Zoom In (+)" aria-label="Zoom In">
            <i class="ph-bold ph-plus"></i>
          </button>
          <div class="ge-zoom-divider"></div>
          <button class="ge-btn ge-zoom-btn" id="btnGeZoomOut" title="Zoom Out (-)" aria-label="Zoom Out">
            <i class="ph-bold ph-minus"></i>
          </button>
        </div>

        <!-- Center / Home Button -->
        <button class="ge-btn ge-home-btn" id="btnGeHome" title="Reset Camera View" aria-label="Reset Camera">
          <i class="ph-bold ph-arrows-out-cardinal"></i>
        </button>
      </div>
    `;

    this.container.appendChild(hud);

    // Bind HUD events
    document.getElementById('btnGeCompass')?.addEventListener('click', () => this.resetNorth());
    document.getElementById('btnGeTilt')?.addEventListener('click', () => this.toggle2D3D());
    document.getElementById('btnGeZoomIn')?.addEventListener('click', () => this.zoomStep(-2.2));
    document.getElementById('btnGeZoomOut')?.addEventListener('click', () => this.zoomStep(2.2));
    document.getElementById('btnGeHome')?.addEventListener('click', () => this.resetView());
  }

  // ── Smooth Zoom ──
  zoomStep(delta) {
    this.targetDistance = THREE.MathUtils.clamp(this.targetDistance + delta, this.minDistance, this.maxDistance);
    this.lastInteractionTime = Date.now();
  }

  // ── Reset North Heading ──
  resetNorth() {
    this.targetLon = Math.round(this.targetLon / 360) * 360;
    this.lastInteractionTime = Date.now();
  }

  // ── Toggle 2D / 3D Tilt Mode ──
  toggle2D3D() {
    this.is2DMode = !this.is2DMode;
    const modeText = document.getElementById('geModeText');
    if (modeText) modeText.textContent = this.is2DMode ? '2D' : '3D';

    if (this.is2DMode) {
      this.targetLat = 0; // Flat nadir view
      this.targetDistance = 18.0;
    } else {
      this.targetLat = 22; // Cinematic tilted 3D orbit
      this.targetDistance = 14.5;
    }
    this.lastInteractionTime = Date.now();
  }

  // ── Reset Camera to Initial Overview ──
  resetView() {
    this.targetLat = 15;
    this.targetLon = -50;
    this.targetDistance = 14.5;
    this.selectedContinent = null;
    this.options.onContinentSelect(null);
    this.lastInteractionTime = Date.now();
  }

  // ── Cinematic Fly-To Continent Focus (Google Earth Style) ──
  focusContinent(continentName, animate = true) {
    const normalized = normalizeContinent(continentName);
    if (!normalized || !CONTINENT_META[normalized]) return;

    const meta = CONTINENT_META[normalized];
    this.selectedContinent = normalized;

    // Target lat/lon for optimal orbital framing
    this.targetLat = meta.lat;
    this.targetLon = meta.lon;
    this.targetDistance = 10.8; // Zoom in close to continent

    if (!animate) {
      this.lat = this.targetLat;
      this.lon = this.targetLon;
      this.camDistance = this.targetDistance;
      this.updateCameraPosition();
    }

    this.lastInteractionTime = Date.now();
  }

  selectContinent(continentName, animate = true) {
    this.focusContinent(continentName, animate);
  }

  // ── Pointer & Gesture Interaction Events ──
  initEvents() {
    const el = this.canvas;

    // Pointer Drag & Orbit
    el.addEventListener('pointerdown', (e) => {
      this.isUserInteracting = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.velocityLat = 0;
      this.velocityLon = 0;
      this.lastInteractionTime = Date.now();
      el.setPointerCapture?.(e.pointerId);
    });

    el.addEventListener('pointermove', (e) => {
      const rect = el.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (this.isUserInteracting) {
        const dx = e.clientX - this.lastPointerX;
        const dy = e.clientY - this.lastPointerY;

        const sensitivity = 0.28;
        this.velocityLon = -dx * sensitivity;
        this.velocityLat = dy * sensitivity;

        this.lon += this.velocityLon;
        this.lat += this.velocityLat;
        this.targetLon = this.lon;
        this.targetLat = this.lat;

        this.lat = THREE.MathUtils.clamp(this.lat, -85, 85);
        this.targetLat = this.lat;

        this.lastPointerX = e.clientX;
        this.lastPointerY = e.clientY;
        this.lastInteractionTime = Date.now();
      } else {
        this.checkRaycastHover();
      }
    });

    const stopInteraction = (e) => {
      if (this.isUserInteracting) {
        this.isUserInteracting = false;
        el.releasePointerCapture?.(e?.pointerId);
      }
    };

    el.addEventListener('pointerup', (e) => {
      stopInteraction(e);
      // Check if it was a quick click on a beacon
      this.checkRaycastClick();
    });
    el.addEventListener('pointercancel', stopInteraction);
    el.addEventListener('pointerleave', () => {
      this.mouse.set(-999, -999);
      if (this.hoveredContinent) {
        this.hoveredContinent = null;
        this.options.onContinentHover(null);
      }
    });

    // Mouse Wheel Zoom
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY * 0.012;
      this.targetDistance = THREE.MathUtils.clamp(this.targetDistance + zoomFactor, this.minDistance, this.maxDistance);
      this.lastInteractionTime = Date.now();
    }, { passive: false });

    // Touch Pinch-to-Zoom
    el.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        this.touchStartDist = Math.hypot(dx, dy);
      }
    }, { passive: true });

    el.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const diff = (this.touchStartDist - dist) * 0.05;
        this.targetDistance = THREE.MathUtils.clamp(this.targetDistance + diff, this.minDistance, this.maxDistance);
        this.touchStartDist = dist;
        this.lastInteractionTime = Date.now();
      }
    }, { passive: true });

    // Window Resize Observer
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
  }

  // ── Raycasting Hover & Click Detection ──
  checkRaycastHover() {
    if (!this.camera || !this.beaconMeshes.length) return;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hitboxes = this.beaconMeshes.map(b => b.hitbox);
    const intersects = this.raycaster.intersectObjects(hitboxes);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      const continent = hit.userData.continent;
      if (this.hoveredContinent !== continent) {
        this.hoveredContinent = continent;
        this.canvas.style.cursor = 'pointer';
        this.options.onContinentHover(continent);
      }
    } else {
      if (this.hoveredContinent !== null) {
        this.hoveredContinent = null;
        this.canvas.style.cursor = 'grab';
        this.options.onContinentHover(null);
      }
    }
  }

  checkRaycastClick() {
    if (!this.camera || !this.beaconMeshes.length) return;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hitboxes = this.beaconMeshes.map(b => b.hitbox);
    const intersects = this.raycaster.intersectObjects(hitboxes);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      const continent = hit.userData.continent;
      if (continent) {
        this.focusContinent(continent, true);
        this.options.onContinentSelect(continent);
      }
    }
  }

  // ── Responsive Resize ──
  resize() {
    const w = this.container.clientWidth || 600;
    const h = this.container.clientHeight || 500;
    if (w === 0 || h === 0) return;

    this.width = w;
    this.height = h;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  // ── 60 FPS Render & Animation Loop ──
  animate(timestamp) {
    this.rafId = requestAnimationFrame(this.animate);

    const now = Date.now();
    const timeSinceInteraction = now - this.lastInteractionTime;

    // Idle auto-rotate after 2.5s of no interaction
    if (this.autoRotate && !this.isUserInteracting && !this.selectedContinent && timeSinceInteraction > 2500) {
      this.lon += this.autoRotateSpeed;
      this.targetLon = this.lon;
    }

    // Smooth inertia and camera slerp interpolation
    const ease = 0.08;
    this.lat += (this.targetLat - this.lat) * ease;
    this.lon += (this.targetLon - this.lon) * ease;
    this.camDistance += (this.targetDistance - this.camDistance) * ease;

    this.updateCameraPosition();

    // Rotate cloud layer slightly faster than earth for dynamic atmospheric effect
    if (this.cloudMesh) {
      this.cloudMesh.rotation.y += 0.00035;
      this.cloudMesh.rotation.x = Math.sin(timestamp * 0.0002) * 0.01;
    }

    // Animate beacon pulsing rings & billboarding
    const pulseScale = 1.0 + Math.sin(timestamp * 0.0045) * 0.35;
    const pulseOpacity = 0.85 - Math.sin(timestamp * 0.0045) * 0.45;

    for (const b of this.beaconMeshes) {
      if (b.ring) {
        b.ring.scale.set(pulseScale, pulseScale, pulseScale);
        b.ring.material.opacity = pulseOpacity;
      }

      // Highlight selected or hovered beacon
      const isSelected = this.selectedContinent === b.continent;
      const isHovered = this.hoveredContinent === b.continent;

      if (isSelected || isHovered) {
        b.core.scale.set(1.5, 1.5, 1.5);
        b.core.material.color.setHex(0xffffff);
      } else {
        b.core.scale.set(1.0, 1.0, 1.0);
        b.core.material.color.setHex(0x75e2e0);
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  // ── Cleanup ──
  destroy() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.resizeObserver) this.resizeObserver.disconnect();
    if (this.renderer) {
      this.renderer.dispose();
      this.canvas?.remove();
    }
  }
}
