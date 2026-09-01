(() => {
  const selectors = [...document.querySelectorAll('[data-locale-selector]')];
  if (!selectors.length) return;

  const close = (selector, returnFocus = false) => {
    const button = selector.querySelector('[data-locale-toggle]');
    const menu = selector.querySelector('[data-locale-menu]');
    button?.setAttribute('aria-expanded', 'false');
    if (menu) menu.hidden = true;
    if (returnFocus) button?.focus();
  };

  selectors.forEach((selector) => {
    const button = selector.querySelector('[data-locale-toggle]');
    const menu = selector.querySelector('[data-locale-menu]');
    const options = [...selector.querySelectorAll('.locale-selector__option')];
    if (!button || !menu) return;
    button.setAttribute('aria-haspopup', 'menu');
    menu.setAttribute('role', 'menu');
    options.forEach((option) => option.setAttribute('role', 'menuitem'));

    button.addEventListener('click', () => {
      const willOpen = menu.hidden;
      selectors.forEach((item) => close(item));
      menu.hidden = !willOpen;
      button.setAttribute('aria-expanded', String(willOpen));
      if (willOpen) options[0]?.focus();
    });

    selector.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(selector, true);
        return;
      }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) || menu.hidden) return;
      event.preventDefault();
      const current = options.indexOf(document.activeElement);
      const next = event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? options.length - 1
          : event.key === 'ArrowDown'
            ? (current + 1 + options.length) % options.length
            : (current - 1 + options.length) % options.length;
      options[next]?.focus();
    });
  });

  document.addEventListener('pointerdown', (event) => {
    selectors.forEach((selector) => {
      if (!selector.contains(event.target)) close(selector);
    });
  });

  if (document.documentElement.lang.toLowerCase().startsWith('es')) {
    const menuButton = document.querySelector('[data-menu-button]');
    const localizeMenuButton = () => {
      if (!menuButton) return;
      const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
      const label = isOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación';
      if (menuButton.getAttribute('aria-label') !== label) menuButton.setAttribute('aria-label', label);
    };
    localizeMenuButton();
    if (menuButton) new MutationObserver(localizeMenuButton).observe(menuButton, { attributes: true, attributeFilter: ['aria-expanded', 'aria-label'] });

    const count = document.querySelector('[data-service-count]');
    const localizeCount = () => {
      if (!count) return;
      const visible = Number.parseInt(count.textContent || '0', 10);
      const next = `${visible} ${visible === 1 ? 'categoría visible' : 'categorías visibles'}`;
      if (count.textContent !== next) count.textContent = next;
    };
    localizeCount();
    if (count) new MutationObserver(localizeCount).observe(count, { childList: true, characterData: true, subtree: true });
  }
})();
