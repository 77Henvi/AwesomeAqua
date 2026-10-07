/**
 * scripts/modules/animations.js
 * Antigravity High-Performance 60fps Visual FX & Animation Suite
 * Awesome Aqua — Interactive Aquatic Experience
 */

const isReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isDesktopPointer = () => window.matchMedia('(pointer: fine)').matches && window.innerWidth >= 768;

// ══════════════════════════════════════════════════════════════
// 0. CINEMATIC BIOLUMINESCENT AQUATIC LOADER CONTROLLER
// ══════════════════════════════════════════════════════════════
let loaderCurrentPercent = 0;
let loaderTargetPercent = 88;
let loaderAnimationId = null;
let isLoaderHiding = false;

export function initCinematicLoader() {
  const loader = document.getElementById('global-loader');
  if (!loader) return;

  const bar = document.getElementById('loaderProgressBar');
  const percentText = document.getElementById('loaderPercent');

  function updateLoaderProgress() {
    if (!loader || loader.classList.contains('hidden')) return;

    // Smooth physics lerp
    const ease = isLoaderHiding ? 0.22 : 0.06;
    loaderCurrentPercent += (loaderTargetPercent - loaderCurrentPercent) * ease;

    if (bar) bar.style.width = `${loaderCurrentPercent.toFixed(1)}%`;
    if (percentText) percentText.textContent = `${Math.min(100, Math.round(loaderCurrentPercent))}%`;

    if (isLoaderHiding && loaderCurrentPercent >= 99.2) {
      if (bar) bar.style.width = '100%';
      if (percentText) percentText.textContent = '100%';
      setTimeout(() => {
        loader.classList.add('hidden');
      }, 160);
      return;
    }

    loaderAnimationId = requestAnimationFrame(updateLoaderProgress);
  }

  loaderAnimationId = requestAnimationFrame(updateLoaderProgress);

  // Global smooth hideLoader hook
  window.hideLoader = function() {
    isLoaderHiding = true;
    loaderTargetPercent = 100;
  };

  // Safe timeout fallback
  setTimeout(() => {
    if (window.hideLoader) window.hideLoader();
  }, 3500);
}

// ══════════════════════════════════════════════════════════════
// 1. 3D MAGNETIC TILT & SPECULAR LIGHT GLARE PHYSICS
// ══════════════════════════════════════════════════════════════
const activeTiltCards = new WeakSet();

export function initCard3DTilt() {
  if (isReducedMotion() || !isDesktopPointer()) return;

  const selector = '.bento-card, .fish-card:not(.is-skeleton), .stats-glass, .about-value-card, .social-card';
  const cards = document.querySelectorAll(selector);

  cards.forEach(card => {
    if (activeTiltCards.has(card)) return;
    activeTiltCards.add(card);

    // Insert glare element if not exists
    let glare = card.querySelector('.card-glare');
    if (!glare) {
      glare = document.createElement('div');
      glare.className = 'card-glare';
      card.appendChild(glare);
    }

    let bounds;
    let rafId = null;
    let mouseX = 0;
    let mouseY = 0;
    let currentRotateX = 0;
    let currentRotateY = 0;
    let targetRotateX = 0;
    let targetRotateY = 0;
    let isHovered = false;

    const maxTilt = card.classList.contains('bento-card--masterpiece') ? 6 :
                    card.classList.contains('stats-glass') ? 5 : 8;

    function updateTransform() {
      if (!isHovered && Math.abs(currentRotateX) < 0.05 && Math.abs(currentRotateY) < 0.05) {
        card.style.transform = '';
        if (glare) glare.style.opacity = '0';
        rafId = null;
        return;
      }

      // Smooth lerp damping
      const ease = 0.12;
      currentRotateX += (targetRotateX - currentRotateX) * ease;
      currentRotateY += (targetRotateY - currentRotateY) * ease;

      const scale = isHovered ? 1.018 : 1;
      card.style.transform = `perspective(1000px) rotateX(${currentRotateX.toFixed(2)}deg) rotateY(${currentRotateY.toFixed(2)}deg) scale3d(${scale}, ${scale}, ${scale})`;

      if (isHovered && bounds && glare) {
        const px = ((mouseX - bounds.left) / bounds.width) * 100;
        const py = ((mouseY - bounds.top) / bounds.height) * 100;
        glare.style.background = `radial-gradient(circle at ${px.toFixed(1)}% ${py.toFixed(1)}%, rgba(255, 255, 255, 0.22) 0%, rgba(117, 226, 224, 0.08) 40%, transparent 80%)`;
        glare.style.opacity = '1';
      }

      rafId = requestAnimationFrame(updateTransform);
    }

    card.addEventListener('mouseenter', (e) => {
      bounds = card.getBoundingClientRect();
      isHovered = true;
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!rafId) rafId = requestAnimationFrame(updateTransform);
    }, { passive: true });

    card.addEventListener('mousemove', (e) => {
      if (!bounds) bounds = card.getBoundingClientRect();
      mouseX = e.clientX;
      mouseY = e.clientY;

      const x = (e.clientX - bounds.left) / bounds.width;  // 0 to 1
      const y = (e.clientY - bounds.top) / bounds.height; // 0 to 1

      // Tilt angles
      targetRotateX = (0.5 - y) * (maxTilt * 2);
      targetRotateY = (x - 0.5) * (maxTilt * 2);

      // Card spotlight variables
      card.style.setProperty('--mouse-x', `${(e.clientX - bounds.left).toFixed(1)}px`);
      card.style.setProperty('--mouse-y', `${(e.clientY - bounds.top).toFixed(1)}px`);

      if (!rafId) rafId = requestAnimationFrame(updateTransform);
    }, { passive: true });

    card.addEventListener('mouseleave', () => {
      isHovered = false;
      targetRotateX = 0;
      targetRotateY = 0;
      if (glare) glare.style.opacity = '0';
      if (!rafId) rafId = requestAnimationFrame(updateTransform);
    }, { passive: true });
  });
}

// ══════════════════════════════════════════════════════════════
// 2. INTERACTIVE BIOLUMINESCENT BUBBLES & BURST PARTICLES
// ══════════════════════════════════════════════════════════════
export function initInteractiveBubbles() {
  const container = document.getElementById('heroBubbles');
  if (!container) return;

  // Clear any existing simple bubbles
  container.innerHTML = '';

  const isMobile = window.innerWidth < 768;
  const bubbleCount = isMobile ? 12 : 24;

  function createSparkles(x, y) {
    const numSparkles = isMobile ? 6 : 10;
    for (let i = 0; i < numSparkles; i++) {
      const sp = document.createElement('div');
      sp.className = 'bubble-sparkle';
      const angle = (Math.PI * 2 * i) / numSparkles + (Math.random() - 0.5) * 0.5;
      const speed = 30 + Math.random() * 50;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      sp.style.left = `${x}px`;
      sp.style.top = `${y}px`;
      sp.style.setProperty('--tx', `${vx}px`);
      sp.style.setProperty('--ty', `${vy}px`);
      container.appendChild(sp);

      setTimeout(() => sp.remove(), 650);
    }
  }

  function spawnBubble(initialYRatio = null) {
    if (!container) return;
    const bubble = document.createElement('div');
    const size = 10 + Math.random() * 26; // 10px to 36px
    const left = Math.random() * 96 + 2; // 2% to 98%
    const duration = 8 + Math.random() * 12; // 8s to 20s
    const wobbleDelay = Math.random() * 4;
    const wobbleDuration = 2.5 + Math.random() * 2;

    bubble.className = 'hero-bubble interactive-bubble';
    bubble.style.width = `${size}px`;
    bubble.style.height = `${size}px`;
    bubble.style.left = `${left}%`;
    bubble.style.setProperty('--wobble-dur', `${wobbleDuration}s`);
    bubble.style.setProperty('--wobble-delay', `${wobbleDelay}s`);

    if (initialYRatio !== null) {
      bubble.style.bottom = `${initialYRatio * 100}%`;
      bubble.style.animation = `heroBubbleRise ${duration}s linear infinite`;
      bubble.style.animationDelay = `-${Math.random() * duration}s`;
    } else {
      bubble.style.bottom = '-40px';
      bubble.style.animation = `heroBubbleRise ${duration}s linear forwards`;
    }

    // Interactive Pop Event
    const popBubble = (e) => {
      if (bubble.dataset.popped) return;
      bubble.dataset.popped = 'true';
      const rect = bubble.getBoundingClientRect();
      const contRect = container.getBoundingClientRect();
      const x = rect.left + rect.width / 2 - contRect.left;
      const y = rect.top + rect.height / 2 - contRect.top;

      createSparkles(x, y);
      bubble.classList.add('popping');
      setTimeout(() => {
        bubble.remove();
        spawnBubble(); // Respawn
      }, 150);
    };

    bubble.addEventListener('click', popBubble);
    bubble.addEventListener('mouseenter', (e) => {
      // Small pop chance or pop on fast hover
      popBubble(e);
    });

    bubble.addEventListener('animationend', () => {
      bubble.remove();
      spawnBubble();
    });

    container.appendChild(bubble);
  }

  // Populate initial bubbles evenly
  for (let i = 0; i < bubbleCount; i++) {
    spawnBubble(Math.random());
  }
}

// ══════════════════════════════════════════════════════════════
// 3. SMOOTH ANIMATED LIVE NUMBER COUNTERS (COUNTUP)
// ══════════════════════════════════════════════════════════════
export function initCountUpObserver() {
  const statNumbers = document.querySelectorAll('.stat-num, .metric-num');
  if (!statNumbers.length) return;

  const countUpMap = new WeakSet();

  const parseNumber = (text) => {
    const trimmed = text.trim();
    // Check for range like "26–28°C" or numbers with text
    const match = trimmed.match(/^(\D*)(\d+)(.*)$/);
    if (!match) return null;
    return {
      prefix: match[1] || '',
      value: parseInt(match[2], 10),
      suffix: match[3] || ''
    };
  };

  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  const animateCount = (el) => {
    const originalText = el.textContent;
    const parsed = parseNumber(originalText);
    if (!parsed || isNaN(parsed.value)) return;

    const targetVal = parsed.value;
    const prefix = parsed.prefix;
    const suffix = parsed.suffix;
    const duration = 1800; // ms
    const startTime = performance.now();

    const frame = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      const current = Math.round(eased * targetVal);

      el.textContent = `${prefix}${current}${suffix}`;

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        el.textContent = originalText; // Ensure exact final string (respects i18n)
      }
    };

    requestAnimationFrame(frame);
  };

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        if (!countUpMap.has(el)) {
          countUpMap.add(el);
          animateCount(el);
        }
        obs.unobserve(el);
      }
    });
  }, { threshold: 0.2 });

  statNumbers.forEach(num => observer.observe(num));
}

// ══════════════════════════════════════════════════════════════
// 4. LIQUID RIPPLE & GLOWING MICRO-INTERACTIONS
// ══════════════════════════════════════════════════════════════
export function initLiquidRipple() {
  document.addEventListener('click', (e) => {
    const target = e.target.closest('.btn, .bento-btn-order, .chip, .lang-toggle-btn, .social-card, .bento-card--explore');
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'liquid-ripple';

    const size = Math.max(rect.width, rect.height) * 2;
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;

    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;

    target.appendChild(ripple);

    setTimeout(() => {
      ripple.remove();
    }, 600);
  }, { passive: true });
}

// ══════════════════════════════════════════════════════════════
// 5. AMBIENT BIOLUMINESCENT CURSOR AURA (DESKTOP)
// ══════════════════════════════════════════════════════════════
export function initAmbientCursorGlow() {
  if (!isDesktopPointer() || isReducedMotion()) return;

  let aura = document.getElementById('aquaCursorAura');
  if (!aura) {
    aura = document.createElement('div');
    aura.id = 'aquaCursorAura';
    aura.className = 'aqua-cursor-aura';
    document.body.appendChild(aura);
  }

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let auraX = mouseX;
  let auraY = mouseY;
  let isMoving = false;
  let isVisible = false;

  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (!isVisible) {
      isVisible = true;
      aura.style.opacity = '1';
    }
    if (!isMoving) {
      isMoving = true;
      requestAnimationFrame(renderAura);
    }
  }, { passive: true });

  document.addEventListener('mouseleave', () => {
    isVisible = false;
    aura.style.opacity = '0';
  });

  function renderAura() {
    // Lerp towards mouse
    auraX += (mouseX - auraX) * 0.12;
    auraY += (mouseY - auraY) * 0.12;

    aura.style.transform = `translate3d(${auraX.toFixed(1)}px, ${auraY.toFixed(1)}px, 0) translate(-50%, -50%)`;

    if (Math.abs(mouseX - auraX) > 0.1 || Math.abs(mouseY - auraY) > 0.1) {
      requestAnimationFrame(renderAura);
    } else {
      isMoving = false;
    }
  }
}

// ══════════════════════════════════════════════════════════════
// 6. STAGGERED CASCADE GRID REVEAL
// ══════════════════════════════════════════════════════════════
export function triggerStaggeredGridReveal(gridSelector = '#fishGrid, #fishOutGrid, #comingSoonGrid') {
  const grids = document.querySelectorAll(gridSelector);
  grids.forEach(grid => {
    const cards = grid.querySelectorAll('.fish-card');
    cards.forEach((card, index) => {
      card.style.setProperty('--stagger-i', `${index % 12}`);
      card.classList.add('cascade-reveal');
    });
  });

  // Re-bind tilt to newly rendered cards
  setTimeout(() => {
    initCard3DTilt();
  }, 50);
}

// ══════════════════════════════════════════════════════════════
// 7. ENHANCED SECTION INTERSECTION & KINETIC ENTRANCE
// ══════════════════════════════════════════════════════════════
export function initKineticScrollReveal() {
  const elements = document.querySelectorAll('.fade-up:not(.visible)');
  if (!elements.length) return;

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        obs.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.12,
    rootMargin: '0px 0px -40px 0px'
  });

  elements.forEach(el => observer.observe(el));
}

// ══════════════════════════════════════════════════════════════
// MASTER INITIALIZER
// ══════════════════════════════════════════════════════════════
export function initAntigravityAnimations() {
  initCinematicLoader();
  initCard3DTilt();
  initInteractiveBubbles();
  initCountUpObserver();
  initLiquidRipple();
  initAmbientCursorGlow();
  initKineticScrollReveal();

  // Listen to re-renders or custom events
  window.addEventListener('fishGridRendered', () => {
    triggerStaggeredGridReveal();
    initCard3DTilt();
  });

  window.addEventListener('languageChanged', () => {
    setTimeout(() => {
      initCard3DTilt();
      initKineticScrollReveal();
    }, 100);
  });
}
