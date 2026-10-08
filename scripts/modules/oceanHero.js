/**
 * scripts/modules/oceanHero.js
 * SeaGuard-inspired Living Ocean Hero Engine
 * Awesome Aqua — Interactive Mouse-Following Swimmer & Ocean Environment
 */

export class OceanHeroEngine {
  constructor() {
    this.section = document.getElementById('heroOceanSection');
    this.bubbleWrap = document.getElementById('heroBubbles');
    this.swimmer = document.getElementById('oceanSwimmerCursor');
    this.isVisible = true;

    if (!this.section) return;

    this.initBubbles();
    this.initCursorSwimmer();
    this.initObserver();
  }

  initBubbles() {
    if (!this.bubbleWrap) return;
    this.bubbleWrap.innerHTML = '';

    const isMobile = window.innerWidth < 768;
    const bubbleCount = isMobile ? 10 : 20;
    const frag = document.createDocumentFragment();

    for (let i = 0; i < bubbleCount; i++) {
      const b = document.createElement('div');
      const size = 5 + Math.random() * 11;
      b.className = 'hero-bubble';
      b.style.width = `${size}px`;
      b.style.height = `${size}px`;
      b.style.left = `${Math.random() * 100}%`;
      b.style.animationDuration = `${7 + Math.random() * 9}s`;
      b.style.animationDelay = `${Math.random() * 7}s`;

      // Interactive bubble popping
      b.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.popBubble(b, e.clientX, e.clientY);
      });

      frag.appendChild(b);
    }

    this.bubbleWrap.appendChild(frag);
  }

  popBubble(bubble, clientX, clientY) {
    if (bubble.classList.contains('popping')) return;
    bubble.classList.add('popping');

    for (let j = 0; j < 6; j++) {
      const sp = document.createElement('div');
      sp.className = 'bubble-sparkle';
      const angle = (Math.PI * 2 / 6) * j + (Math.random() * 0.4);
      const dist = 18 + Math.random() * 24;
      const tx = Math.cos(angle) * dist;
      const ty = Math.sin(angle) * dist;

      sp.style.left = `${bubble.offsetLeft + bubble.offsetWidth / 2}px`;
      sp.style.top = `${bubble.offsetTop + bubble.offsetHeight / 2}px`;
      sp.style.setProperty('--tx', `${tx}px`);
      sp.style.setProperty('--ty', `${ty}px`);

      this.bubbleWrap.appendChild(sp);
      setTimeout(() => sp.remove(), 700);
    }

    setTimeout(() => {
      bubble.remove();
      this.spawnSingleBubble();
    }, 180);
  }

  spawnSingleBubble() {
    if (!this.bubbleWrap) return;
    const b = document.createElement('div');
    const size = 5 + Math.random() * 11;
    b.className = 'hero-bubble';
    b.style.width = `${size}px`;
    b.style.height = `${size}px`;
    b.style.left = `${Math.random() * 100}%`;
    b.style.animationDuration = `${7 + Math.random() * 9}s`;
    b.style.animationDelay = '0s';

    b.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.popBubble(b, e.clientX, e.clientY);
    });

    this.bubbleWrap.appendChild(b);
  }

  initCursorSwimmer() {
    if (!this.swimmer || window.innerWidth < 768) return;

    let targetX = window.innerWidth * 0.52;
    let targetY = window.innerHeight * 0.36;
    let curX = targetX;
    let curY = targetY;
    let curRot = 0;
    let scaleX = 1;
    let targetScaleX = 1;
    let rafId = null;

    const creatureStage = document.getElementById('heroCreatureStage');
    let stageCurX = 0, stageCurY = 0, stageTargetX = 0, stageTargetY = 0;

    const onMouseMove = (e) => {
      if (!this.isVisible) return;
      const rect = this.section.getBoundingClientRect();
      if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
        targetX = e.clientX;
        targetY = e.clientY - rect.top;

        // Subtle stage tilt
        const normX = (e.clientX / window.innerWidth) - 0.5;
        const normY = ((e.clientY - rect.top) / rect.height) - 0.5;
        stageTargetX = normX * -18;
        stageTargetY = normY * -14;
      }
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });

    const updateSwimmer = (time) => {
      if (this.isVisible && !document.hidden && window.innerWidth >= 768) {
        const dx = targetX - curX;
        const dy = targetY - curY;
        const dist = Math.hypot(dx, dy);

        // Smooth follow easing
        const ease = Math.min(0.065, Math.max(0.025, dist * 0.00015));
        curX += dx * ease;
        curY += dy * ease;

        // Determine orientation facing direction
        if (dx > 4) {
          targetScaleX = 1;
        } else if (dx < -4) {
          targetScaleX = -1;
        }

        // Smooth scale flip
        scaleX += (targetScaleX - scaleX) * 0.12;

        // Banking tilt when swimming up/down
        const targetRot = Math.max(-24, Math.min(24, dy * 0.25)) * (targetScaleX > 0 ? 1 : -1);
        curRot += (targetRot - curRot) * 0.08;

        // Ambient hovering wave offset when near cursor
        const hoverFloatY = Math.sin(time * 0.003) * 5;
        const hoverFloatX = Math.cos(time * 0.002) * 3;

        // Depth scale (slight zoom when swimming fast)
        const depthScale = 0.95 + Math.min(0.25, dist * 0.0008);

        this.swimmer.style.transform = `translate3d(${curX + hoverFloatX}px, ${curY + hoverFloatY}px, 0) scale(${depthScale}) scaleX(${scaleX}) rotate(${curRot}deg)`;

        // Parallax update on creature stage
        if (creatureStage) {
          stageCurX += (stageTargetX - stageCurX) * 0.05;
          stageCurY += (stageTargetY - stageCurY) * 0.05;
          creatureStage.style.transform = `translate3d(${stageCurX}px, calc(-50% + ${stageCurY}px), 0)`;
        }
      }

      rafId = requestAnimationFrame(updateSwimmer);
    };

    rafId = requestAnimationFrame(updateSwimmer);
  }

  initObserver() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        this.isVisible = entry.isIntersecting;
      });
    }, { threshold: 0.05 });

    if (this.section) {
      observer.observe(this.section);
    }
  }
}

export function initOceanHero() {
  return new OceanHeroEngine();
}

export function injectHeroBubbles() {
  return new OceanHeroEngine();
}
