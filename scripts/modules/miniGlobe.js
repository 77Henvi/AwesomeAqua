/**
 * scripts/modules/miniGlobe.js
 * 3D Photorealistic Interactive Virtual Earth Mini-Engine for Homepage
 * Awesome Aqua — Powered by Three.js WebGL
 */

import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

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
      float intensity = pow(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.2);
      gl_FragColor = vec4(0.35, 0.82, 0.95, 1.0) * intensity * 1.8;
    }
  `
};

const HOTSPOTS = [
  { name: 'Amazon Basin', lat: -3.46, lon: -62.21 },
  { name: 'Southeast Asia', lat: 13.75, lon: 100.50 },
  { name: 'African Rift Lakes', lat: -6.00, lon: 29.50 },
  { name: 'Coral Triangle', lat: -18.28, lon: 147.70 },
  { name: 'Europe Rhine', lat: 48.85, lon: 7.75 },
  { name: 'Mississippi Basin', lat: 35.14, lon: -90.04 }
];

export class MiniVirtualGlobe {
  constructor(hostElement) {
    this.host = hostElement;
    if (!this.host) return;

    this.width = this.host.clientWidth || 260;
    this.height = this.host.clientHeight || 260;
    this.globeRadius = 5.2;

    this.rotY = -0.6;
    this.rotX = 0.25;
    this.targetRotY = -0.6;
    this.targetRotX = 0.25;

    this.isDragging = false;
    this.lastPointerX = 0;
    this.lastPointerY = 0;
    this.autoRotateSpeed = 0.0035;
    this.isVisible = false;
    this.rafId = null;

    this.initScene();
    this.initEarthSystem();
    this.initHotspots();
    this.initEvents();
    this.initObserver();
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, this.width / this.height, 0.1, 100);
    this.camera.position.set(0, 0, 15.5);

    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.canvas = this.renderer.domElement;
    this.canvas.className = 'mini-globe-canvas';
    this.host.appendChild(this.canvas);

    // Dynamic Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
    this.scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xa5f3fc, 2.4);
    sunLight.position.set(12, 8, 12);
    this.scene.add(sunLight);

    const backRimLight = new THREE.DirectionalLight(0x0284c7, 1.6);
    backRimLight.position.set(-10, -6, -10);
    this.scene.add(backRimLight);
  }

  initEarthSystem() {
    this.globePivot = new THREE.Group();
    this.scene.add(this.globePivot);

    const earthGeo = new THREE.SphereGeometry(this.globeRadius, 48, 48);
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
      roughness: 0.58,
      metalness: 0.08,
      roughnessMap: specularMap
    });

    this.earthMesh = new THREE.Mesh(earthGeo, this.earthMaterial);
    this.globePivot.add(this.earthMesh);

    // Glowing Atmospheric Aura
    const atmosGeo = new THREE.SphereGeometry(this.globeRadius * 1.04, 48, 48);
    const atmosMat = new THREE.ShaderMaterial({
      vertexShader: AtmosphereShader.vertexShader,
      fragmentShader: AtmosphereShader.fragmentShader,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true
    });
    this.atmosphereMesh = new THREE.Mesh(atmosGeo, atmosMat);
    this.scene.add(this.atmosphereMesh);

    // Floating Clouds Layer
    const cloudGeo = new THREE.SphereGeometry(this.globeRadius * 1.018, 48, 48);
    const cloudMap = textureLoader.load(TEXTURE_ASSETS.earthClouds, undefined, undefined, () => {});
    const cloudMat = new THREE.MeshStandardMaterial({
      map: cloudMap,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending
    });
    this.cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
    this.globePivot.add(this.cloudMesh);
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

  latLonToVector3(lat, lon, radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    return new THREE.Vector3(
      -radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    );
  }

  initHotspots() {
    this.hotspotMeshes = [];
    const r = this.globeRadius * 1.008;

    HOTSPOTS.forEach(spot => {
      const pos = this.latLonToVector3(spot.lat, spot.lon, r);
      const group = new THREE.Group();
      group.position.copy(pos);
      group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), pos.clone().normalize());

      // Luminous Core Dot
      const dotGeo = new THREE.SphereGeometry(0.12, 16, 16);
      const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      group.add(dot);

      // Radar Shockwave Ring
      const ringGeo = new THREE.RingGeometry(0.14, 0.26, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x75e2e0,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85
      });
      const radarRing = new THREE.Mesh(ringGeo, ringMat);
      group.add(radarRing);

      this.globePivot.add(group);
      this.hotspotMeshes.push({ group, radarRing });
    });
  }

  initEvents() {
    const el = this.host;

    el.addEventListener('pointerdown', (e) => {
      this.isDragging = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      el.setPointerCapture?.(e.pointerId);
    });

    el.addEventListener('pointermove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;

      this.targetRotY += dx * 0.008;
      this.targetRotX += dy * 0.008;
      this.targetRotX = THREE.MathUtils.clamp(this.targetRotX, -1.1, 1.1);

      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
    });

    const stopDrag = (e) => {
      this.isDragging = false;
      el.releasePointerCapture?.(e?.pointerId);
    };

    el.addEventListener('pointerup', stopDrag);
    el.addEventListener('pointercancel', stopDrag);
  }

  initObserver() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        this.isVisible = entry.isIntersecting;
        if (this.isVisible && !this.rafId) {
          this.animate();
        }
      });
    }, { threshold: 0.1 });

    observer.observe(this.host);
  }

  animate = (timestamp = performance.now()) => {
    if (!this.isVisible || document.hidden) {
      this.rafId = null;
      return;
    }

    this.rafId = requestAnimationFrame(this.animate);

    // Auto spin when not manually dragging
    if (!this.isDragging) {
      this.targetRotY += this.autoRotateSpeed;
    }

    // Smooth inertia lerp
    this.rotX += (this.targetRotX - this.rotX) * 0.1;
    this.rotY += (this.targetRotY - this.rotY) * 0.1;

    if (this.globePivot) {
      this.globePivot.rotation.x = this.rotX;
      this.globePivot.rotation.y = this.rotY;
    }

    if (this.cloudMesh) {
      this.cloudMesh.rotation.y += 0.0006;
    }

    // Animate radar beacons
    const radarScale = 1.0 + (Math.sin(timestamp * 0.004) * 0.5 + 0.5) * 1.5;
    const radarOpacity = Math.max(0.1, 0.85 - (Math.sin(timestamp * 0.004) * 0.5 + 0.5) * 0.75);

    for (const item of this.hotspotMeshes) {
      if (item.radarRing) {
        item.radarRing.scale.set(radarScale, radarScale, radarScale);
        item.radarRing.material.opacity = radarOpacity;
      }
    }

    this.renderer.render(this.scene, this.camera);
  };
}

export function initMiniVirtualGlobe() {
  const host = document.getElementById('miniGlobeCanvasHost');
  if (!host) return null;
  return new MiniVirtualGlobe(host);
}
