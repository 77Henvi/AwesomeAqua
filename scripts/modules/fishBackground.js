// ── SVG path จาก fish-c-os-332987.svg (stroke white, outline only) ──
const FISH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="100%" height="100%">
  <g fill="none" stroke="white" stroke-linecap="round" stroke-width="3">
    <path stroke-linejoin="round" d="M30 39c9 0 15-8.571 15-15S39 9 30 9c-7.996 0-14.66 5.233-18.217 9.676a10.8 10.8 0 0 0-.8-2.181c-1.089-2.24-3.586-3.787-5.38-4.655c-1.06-.514-2.232.153-2.38 1.321c-.29 2.276-.483 5.849.661 8.203c.572 1.177 1.209 2.044 1.875 2.636c-.666.592-1.303 1.459-1.875 2.636c-1.144 2.354-.951 5.927-.662 8.203c.149 1.168 1.322 1.835 2.381 1.322c1.794-.869 4.291-2.415 5.38-4.655c.372-.767.635-1.496.8-2.182C15.34 33.767 22.004 39 30 39"/>
    <path d="M29.334 14.4c-3.385 4.76-3.385 14.441 0 19.2M21 20c-.667 1.983-.667 6.017 0 8m14-8v1"/>
  </g>
</svg>`;

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
      fish.innerHTML = FISH_SVG;
      wrap.appendChild(fish);
    }

    el.insertBefore(wrap, el.firstChild);
  });
}