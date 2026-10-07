/**
 * scripts/modules/oceanHero.js
 * SeaGuard-inspired Split-Level Deep Ocean Hero Engine
 * Awesome Aqua — Animated Text Overlay & Living Ocean Environment
 */

export class OceanHeroEngine {
  constructor() {
    this.section = document.getElementById('heroOceanSection');
    this.bubbleWrap = document.getElementById('heroBubbles');
    this.creaturesWrap = document.getElementById('oceanCreatures');
    this.isVisible = true;

    if (!this.section) return;

    this.initBubbles();
    this.initMouseParallax();
    this.initObserver();
  }

  initBubbles() {
    if (!this.bubbleWrap) return;
    this.bubbleWrap.innerHTML = '';

    const isMobile = window.innerWidth < 768;
    const bubbleCount = isMobile ? 12 : 22;
    const frag = document.createDocumentFragment();

    for (let i = 0; i < bubbleCount; i++) {
      const b = document.createElement('div');
      const size = 5 + Math.random() * 12;
      b.className = 'hero-bubble';
      b.style.width = `${size}px`;
      b.style.height = `${size}px`;
      b.style.left = `${Math.random() * 100}%`;
      b.style.animationDuration = `${7 + Math.random() * 9}s`;
      b.style.animationDelay = `${Math.random() * 7}s`;

      // Interactive popping
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

    // Spawn 6 luminous sparkles
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
      // Respawn a new bubble
      this.spawnSingleBubble();
    }, 180);
  }

  spawnSingleBubble() {
    if (!this.bubbleWrap) return;
    const b = document.createElement('div');
    const size = 5 + Math.random() * 12;
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

  initMouseParallax() {
    if (window.innerWidth < 1024) return;

    let targetX = 0;
    let targetY = 0;
    let curX = 0;
    let curY = 0;
    let rafId = null;

    const onMouseMove = (e) => {
      if (!this.isVisible) return;
      const nx = (e.clientX / window.innerWidth - 0.5) * 2;
      const ny = (e.clientY / window.innerHeight - 0.5) * 2;
      targetX = nx * 14;
      targetY = ny * 10;
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });

    const updateParallax = () => {
      if (this.isVisible && !document.hidden) {
        curX += (targetX - curX) * 0.06;
        curY += (targetY - curY) * 0.06;

        if (this.creaturesWrap) {
          this.creaturesWrap.style.transform = `translate3d(${curX * 0.7}px, ${curY * 0.5}px, 0)`;
        }
      }
      rafId = requestAnimationFrame(updateParallax);
    };

    rafId = requestAnimationFrame(updateParallax);
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

// Backward compatibility alias for bubble injector
export function injectHeroBubbles() {
  const engine = new OceanHeroEngine();
  return engine;
}
