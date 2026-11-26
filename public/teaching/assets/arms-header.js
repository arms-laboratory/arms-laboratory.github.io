'use strict';
// The header and links are in the HTML so navigation also works without JavaScript.
(() => {
  const header = document.querySelector('.arms-site-header');
  const toggle = header?.querySelector('.arms-menu-toggle');
  const menu = header?.querySelector('.arms-main-nav');
  if (!header || !toggle || !menu) return;
  const icon = toggle.querySelector('span');
  const close = () => {
    header.dataset.menuOpen = 'false';
    toggle.setAttribute('aria-expanded', 'false');
    if (icon) icon.textContent = '+';
  };
  close();
  toggle.hidden = false;
  toggle.addEventListener('click', () => {
    const open = header.dataset.menuOpen !== 'true';
    header.dataset.menuOpen = String(open);
    toggle.setAttribute('aria-expanded', String(open));
    if (icon) icon.textContent = open ? '\u2212' : '+';
  });
  header.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && header.dataset.menuOpen === 'true') {
      close();
      toggle.focus();
    }
  });
  menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', close));
  window.matchMedia('(max-width: 1100px)').addEventListener('change', close);
})();
