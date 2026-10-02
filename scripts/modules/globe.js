/**
 * scripts/modules/globe.js
 * 3D Photorealistic Interactive Earth Engine — AwesomeAqua (Aqua World)
 * Powered by Three.js WebGL with satellite imagery, atmospheric glow,
 * floating clouds, cosmic starfield, and 6 locked continent radar target beacons.
 */

import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { CONTINENTS, CONTINENT_META, normalizeContinent } from '../shared/continents.js';

const TEXTURE_ASSETS = {
  earthDay: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/textures/planets/earth_atmos_2048.jpg',
  earthSpecular: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/textures/planets/earth_specular_2048.jpg',
  earthClouds: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/textures/planets/earth_clouds_1024.png'
};

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
      float intensity = pow(0.68 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
      gl_FragColor = vec4(0.35, 0.70, 1.0, 1.0) * intensity * 1.5;
    }
  `
};

export class InteractiveGlobe {
  constructor(containerElement, options = {}) {
    this.container = containerElement;
    this.options = Object.assign({
      onContinentSelect: () => {},
      onContinentHover: () => {},
      initialContinent: 'South America'
    }, options);

    this.width = this.container.clientWidth || window.innerWidth;
    this.height = this.container.clientHeight || window.innerHeight;
    this.globeRadius = 5.0;

    // Camera parameters
    const isMobile = this.width < 768;
    this.camDistance = isMobile ? 17.5 : 14.2;
    this.minDistance = 8.5;
    this.maxDistance = 26.0;
    this.targetDistance = this.camDistance;

    // Rotation angles on the globe pivot (Radians)
    this.rotX = 0;
    this.rotY = 0;
    this.targetRotX = 0;
    this.targetRotY = 0;

    // State flags: When continent is selected, lock firmly with zero auto-rotate drift
    this.selectedContinent = this.options.initialContinent ? normalizeContinent(this.options.initialContinent) : 'South America';
    this.hoveredContinent = null;
    this.isLocked = true;
    this.autoRotate = false;
    this.is2DMode = false;

    // Drag interaction
    this.isUserInteracting = false;
    this.lastPointerX = 0;
    this.lastPointerY = 0;
    this.touchStartDist = 0;

    this.initThree();
    this.initStarfield();
    this.initEarthSystem();
    this.initRadarTargetHotspots();
    this.initEvents();
    this.initHUDControls();

    this.resize();

    if (this.selectedContinent) {
      this.focusContinent(this.selectedContinent, false);
    }

    this.animate = this.animate.bind(this);
    this.rafId = requestAnimationFrame(this.animate);
  }

  initThree() {
    this.scene = new THREE.Scene();

    const aspect = this.width / this.height;
    this.camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 2000);
    this.updateCameraPosition();

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(this.width, this.height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    this.canvas = this.renderer.domElement;
    this.canvas.className = 'aqua-globe-canvas';
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.container.appendChild(this.canvas);

    const ambientLight = new THREE.AmbientLight(0xddeeff, 0.55);
    this.scene.add(ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xffffff, 2.4);
    this.sunLight.position.set(16, 12, 16);
    this.scene.add(this.sunLight);

    const rimLight = new THREE.DirectionalLight(0x2cacad, 0.4);
    rimLight.position.set(-15, -6, -10);
    this.scene.add(rimLight);

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(-999, -999);
  }

  initStarfield() {
    const starCount = 1800;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 350 + Math.random() * 450;

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      const colorType = Math.random();
      if (colorType > 0.8) {
        colors[i * 3] = 0.65; colors[i * 3 + 1] = 0.88; colors[i * 3 + 2] = 1.0;
      } else if (colorType > 0.65) {
        colors[i * 3] = 1.0; colors[i * 3 + 1] = 0.94; colors[i * 3 + 2] = 0.8;
      } else {
        colors[i * 3] = 0.95; colors[i * 3 + 1] = 0.95; colors[i * 3 + 2] = 1.0;
      }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 1.35,
      vertexColors: true,
      transparent: true,
      opacity: 0.85
    });

    this.starfield = new THREE.Points(geometry, material);
    this.scene.add(this.starfield);
  }

  initEarthSystem() {
    this.globePivot = new THREE.Group();
    this.scene.add(this.globePivot);

    const earthGeo = new THREE.SphereGeometry(this.globeRadius, 64, 64);
    const textureLoader = new THREE.TextureLoader();

    const earthMap = textureLoader.load(TEXTURE_ASSETS.earthDay, () => {
      this.renderer.render(this.scene, this.camera);
    }, undefined, () => {
      this.earthMesh.material.map = this.createFallbackEarthTexture();
      this.earthMesh.material.needsUpdate = true;
    });

    const specularMap = textureLoader.load(TEXTURE_ASSETS.earthSpecular, undefined, undefined, () => {});

    this.earthMaterial = new THREE.MeshStandardMaterial({
      map: earthMap,
      roughness: 0.62,
      metalness: 0.05,
      roughnessMap: specularMap
    });

    this.earthMesh = new THREE.Mesh(earthGeo, this.earthMaterial);
    this.globePivot.add(this.earthMesh);

    // Atmosphere Glow
    const atmosGeo = new THREE.SphereGeometry(this.globeRadius * 1.032, 64, 64);
    const atmosMat = new THREE.ShaderMaterial({
      vertexShader: AtmosphereShader.vertexShader,
      fragmentShader: AtmosphereShader.fragmentShader,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true
    });
    this.atmosphereMesh = new THREE.Mesh(atmosGeo, atmosMat);
    this.globePivot.add(this.atmosphereMesh);

    // Floating Clouds
    const cloudGeo = new THREE.SphereGeometry(this.globeRadius * 1.014, 64, 64);
    const cloudMap = textureLoader.load(TEXTURE_ASSETS.earthClouds, undefined, undefined, () => {});
    this.cloudMat = new THREE.MeshStandardMaterial({
      map: cloudMap,
      transparent: true,
      opacity: 0.44,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.cloudMesh = new THREE.Mesh(cloudGeo, this.cloudMat);
    this.globePivot.add(this.cloudMesh);
  }

  initRadarTargetHotspots() {
    this.hotspotMeshes = [];

    for (const continent of CONTINENTS) {
      const meta = CONTINENT_META[continent];
      const pos = this.latLonToVector3(meta.lat, meta.lon, this.globeRadius * 1.02);

      const spotRoot = new THREE.Group();
      spotRoot.position.copy(pos);
      spotRoot.lookAt(pos.clone().multiplyScalar(2));
      spotRoot.userData = { continent, meta };

      // 1. Center Solid Dot
      const dotGeo = new THREE.CircleGeometry(0.18, 24);
      const dotMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95
      });
      const dotMesh = new THREE.Mesh(dotGeo, dotMat);
      spotRoot.add(dotMesh);

      // 2. Inner Sharp White Ring
      const innerRingGeo = new THREE.RingGeometry(0.26, 0.35, 32);
      const innerRingMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85
      });
      const innerRingMesh = new THREE.Mesh(innerRingGeo, innerRingMat);
      spotRoot.add(innerRingMesh);

      // 3. Outer Pulsating Radar Wave Ring
      const radarRingGeo = new THREE.RingGeometry(0.50, 0.78, 32);
      const radarRingMat = new THREE.MeshBasicMaterial({
        color: 0x75e2e0,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending
      });
      const radarRingMesh = new THREE.Mesh(radarRingGeo, radarRingMat);
      spotRoot.add(radarRingMesh);

      // 4. Hitbox for smooth raycasting
      const hitGeo = new THREE.SphereGeometry(1.2, 12, 12);
      const hitMat = new THREE.MeshBasicMaterial({ visible: false });
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.userData = { continent, meta };
      spotRoot.add(hitMesh);

      this.globePivot.add(spotRoot);

      this.hotspotMeshes.push({
        root: spotRoot,
        dot: dotMesh,
        innerRing: innerRingMesh,
        radarRing: radarRingMesh,
        hitbox: hitMesh,
        continent,
        meta
      });
    }
  }

  latLonToVector3(lat, lon, radius) {
    const phi = THREE.MathUtils.degToRad(90 - lat);
    const theta = THREE.MathUtils.degToRad(lon + 180);

    const x = -radius * Math.sin(phi) * Math.cos(theta);
    const z = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);

    return new THREE.Vector3(x, y, z);
  }

  createFallbackEarthTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#061c36');
    grad.addColorStop(0.5, '#0a2e58');
    grad.addColorStop(1, '#05182e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 512);

    ctx.fillStyle = '#26543b';
    ctx.beginPath();
    ctx.ellipse(260, 260, 70, 130, 0.2, 0, Math.PI * 2);
    ctx.ellipse(540, 260, 90, 120, 0, 0, Math.PI * 2);
    ctx.ellipse(750, 200, 140, 100, 0, 0, Math.PI * 2);
    ctx.ellipse(820, 360, 60, 45, 0, 0, Math.PI * 2);
    ctx.fill();

    return new THREE.CanvasTexture(canvas);
  }

  updateCameraPosition() {
    this.camera.position.set(0, 0, this.camDistance);

    const isDesktop = (this.width || window.innerWidth) >= 1024;
    const lookOffsetX = isDesktop ? -1.8 : 0;
    this.camera.lookAt(lookOffsetX, 0, 0);

    this.updateCompass();
  }

  updateCompass() {
    const compassNeedle = document.getElementById('geCompassNeedle');
    if (compassNeedle) {
      const headingDeg = THREE.MathUtils.radToDeg(this.rotY);
      compassNeedle.style.transform = `rotate(${headingDeg + 90}deg)`;
    }
  }

  initHUDControls() {
    const existing = document.querySelector('.ge-supremacy-hud');
    if (existing) existing.remove();

    const hud = document.createElement('div');
    hud.className = 'ge-supremacy-hud';
    hud.innerHTML = `
      <div class="ge-control-bar">
        <button class="ge-btn ge-compass-btn" id="btnGeCompass" title="Reset North" aria-label="North orientation">
          <div class="ge-compass-icon" id="geCompassNeedle">
            <span class="ge-compass-n">N</span>
            <span class="ge-compass-arrow"></span>
          </div>
        </button>

        <button class="ge-btn ge-mode-btn" id="btnGeTilt" title="Toggle 2D / 3D Tilt" aria-label="Toggle 2D/3D">
          <span id="geModeText">3D</span>
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

        <button class="ge-btn ge-home-btn" id="btnGeHome" title="Reset Camera View" aria-label="Reset Camera">
          <i class="ph-bold ph-arrows-out-cardinal"></i>
        </button>
      </div>
    `;

    const targetParent = this.container.closest('.ldf-globe-stage') || this.container || document.body;
    targetParent.appendChild(hud);

    document.getElementById('btnGeCompass')?.addEventListener('click', () => this.resetNorth());
    document.getElementById('btnGeTilt')?.addEventListener('click', () => this.toggle2D3D());
    document.getElementById('btnGeZoomIn')?.addEventListener('click', () => this.zoomStep(-2.0));
    document.getElementById('btnGeZoomOut')?.addEventListener('click', () => this.zoomStep(2.0));
    document.getElementById('btnGeHome')?.addEventListener('click', () => this.resetView());
  }

  zoomStep(delta) {
    this.targetDistance = THREE.MathUtils.clamp(this.targetDistance + delta, this.minDistance, this.maxDistance);
  }

  resetNorth() {
    this.targetRotX = 0;
  }

  toggle2D3D() {
    this.is2DMode = !this.is2DMode;
    const modeText = document.getElementById('geModeText');
    if (modeText) modeText.textContent = this.is2DMode ? '2D' : '3D';

    const isMobile = (this.width || window.innerWidth) < 768;
    if (this.is2DMode) {
      this.targetRotX = 0;
      this.targetDistance = isMobile ? 20.0 : 17.5;
    } else {
      this.targetDistance = isMobile ? 17.5 : 14.2;
    }
  }

  resetView() {
    this.focusContinent('South America', true);
  }

  focusContinent(continentName, animate = true) {
    const normalized = normalizeContinent(continentName) || 'South America';
    const meta = CONTINENT_META[normalized];
    if (!meta) return;

    this.selectedContinent = normalized;
    this.isLocked = true;

    const desiredRotY = THREE.MathUtils.degToRad(-meta.lon - 90);
    const desiredRotX = THREE.MathUtils.degToRad(meta.lat);

    const diffY = (desiredRotY - this.targetRotY) % (Math.PI * 2);
    const shortestDiffY = Math.atan2(Math.sin(diffY), Math.cos(diffY));
    this.targetRotY = this.targetRotY + shortestDiffY;
    this.targetRotX = desiredRotX;

    const isMobile = (this.width || window.innerWidth) < 768;
    this.targetDistance = isMobile ? 16.5 : 13.8;

    if (!animate) {
      this.rotX = this.targetRotX;
      this.rotY = this.targetRotY;
      this.camDistance = this.targetDistance;
      this.globePivot.rotation.x = this.rotX;
      this.globePivot.rotation.y = this.rotY;
      this.updateCameraPosition();
    }
  }

  selectContinent(continentName, animate = true) {
    this.focusContinent(continentName, animate);
  }

  initEvents() {
    const el = this.canvas;

    el.addEventListener('pointerdown', (e) => {
      this.isUserInteracting = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      el.setPointerCapture?.(e.pointerId);
    });

    el.addEventListener('pointermove', (e) => {
      const rect = el.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (this.isUserInteracting) {
        const dx = e.clientX - this.lastPointerX;
        const dy = e.clientY - this.lastPointerY;

        const sensitivity = 0.005;
        this.targetRotY += dx * sensitivity;
        this.targetRotX += dy * sensitivity;

        this.targetRotX = THREE.MathUtils.clamp(this.targetRotX, -1.2, 1.2);

        this.lastPointerX = e.clientX;
        this.lastPointerY = e.clientY;
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

    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY * 0.01;
      this.targetDistance = THREE.MathUtils.clamp(this.targetDistance + zoomFactor, this.minDistance, this.maxDistance);
    }, { passive: false });

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
        const diff = (this.touchStartDist - dist) * 0.04;
        this.targetDistance = THREE.MathUtils.clamp(this.targetDistance + diff, this.minDistance, this.maxDistance);
        this.touchStartDist = dist;
      }
    }, { passive: true });

    window.addEventListener('resize', () => this.resize());
  }

  checkRaycastHover() {
    if (!this.camera || !this.hotspotMeshes.length) return;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hitboxes = this.hotspotMeshes.map(b => b.hitbox);
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
    if (!this.camera || !this.hotspotMeshes.length) return;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hitboxes = this.hotspotMeshes.map(b => b.hitbox);
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

  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    if (w === 0 || h === 0) return;

    this.width = w;
    this.height = h;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.updateCameraPosition();
  }

  animate(timestamp) {
    this.rafId = requestAnimationFrame(this.animate);

    const ease = 0.08;
    this.rotX += (this.targetRotX - this.rotX) * ease;
    this.rotY += (this.targetRotY - this.rotY) * ease;
    this.camDistance += (this.targetDistance - this.camDistance) * ease;

    if (this.globePivot) {
      this.globePivot.rotation.x = this.rotX;
      this.globePivot.rotation.y = this.rotY;
    }

    this.updateCameraPosition();

    if (this.cloudMesh) {
      this.cloudMesh.rotation.y += 0.0003;
      this.cloudMesh.rotation.x = Math.sin(timestamp * 0.0002) * 0.01;
    }

    const radarScale = 1.0 + (Math.sin(timestamp * 0.004) * 0.5 + 0.5) * 0.8;
    const radarOpacity = Math.max(0.1, 0.75 - (Math.sin(timestamp * 0.004) * 0.5 + 0.5) * 0.65);

    for (const spot of this.hotspotMeshes) {
      const isSelected = this.selectedContinent === spot.continent;
      const isHovered = this.hoveredContinent === spot.continent;

      if (spot.radarRing) {
        spot.radarRing.scale.set(radarScale, radarScale, radarScale);
        spot.radarRing.material.opacity = isSelected || isHovered ? radarOpacity * 1.3 : radarOpacity * 0.7;
      }

      if (isSelected || isHovered) {
        spot.dot.scale.set(1.4, 1.4, 1.4);
        spot.innerRing.material.opacity = 1.0;
      } else {
        spot.dot.scale.set(1.0, 1.0, 1.0);
        spot.innerRing.material.opacity = 0.5;
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.renderer) {
      this.renderer.dispose();
      this.canvas?.remove();
    }
  }
}
