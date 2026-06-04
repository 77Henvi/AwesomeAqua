const FISH_EMOJIS = ['🐟', '🐠', '🐡', '🐟', '🐠', '🐡'];

export function injectFishBackgrounds() {
  const targets = [
    { selector: '#fish',                 dark: false },
    { selector: '.stats',                dark: true  },
    { selector: '.about-values',         dark: false },
    { selector: '.about-contact-info',   dark: false },
    { selector: '.about-contact-visual', dark: true  },
  ];

  targets.forEach(({ selector, dark }) => {
    const el = document.querySelector(selector);
    if (!el) return;
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';

    const wrap = document.createElement('div');
    wrap.className = 'fish-bg' + (dark ? ' fish-bg--dark' : '');

    for (let i = 1; i <= 6; i++) {
      const fish = document.createElement('div');
      fish.className = `fish-bg__fish fish-bg__fish--${i}`;
      // ไม่มี span wrapper — animate left บน div โดยตรง
      fish.textContent = FISH_EMOJIS[i - 1];
      wrap.appendChild(fish);
    }

    el.insertBefore(wrap, el.firstChild);
  });
}