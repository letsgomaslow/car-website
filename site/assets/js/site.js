document.documentElement.classList.remove('no-js');
document.documentElement.classList.add('has-js');

const menuButton = document.querySelector('[data-menu-button]');
const navDrawer = document.querySelector('[data-nav-drawer]');
const pageMain = document.querySelector('main');
const siteHeader = document.querySelector('.site-header');
const scrollProgress = document.querySelector('[data-scroll-progress]');
const backToTop = document.querySelector('[data-back-to-top]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let lastFocusedElement = null;

if (navDrawer) navDrawer.inert = true;

const getFocusableElements = (container) => {
  if (!container) return [];
  return [...container.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter((element) => !element.hidden && element.getClientRects().length > 0);
};

const modalBackgroundElements = [
  ...[...document.body.children].filter((element) => element !== navDrawer && element !== siteHeader),
  ...[...(siteHeader?.querySelector('.site-header__inner')?.children || [])].filter((element) => element !== menuButton),
];

const setPageInert = (isInert) => {
  modalBackgroundElements.forEach((element) => {
    if (element) element.inert = isInert;
  });
};

const updateDrawerOffset = () => {
  if (!navDrawer || !siteHeader) return;
  const headerRect = siteHeader.getBoundingClientRect();
  navDrawer.style.insetBlockStart = `${Math.max(0, headerRect.height, headerRect.bottom)}px`;
};

const setBackToTopVisibility = (isVisible) => {
  if (!backToTop) return;
  const shouldShow = isVisible && !document.body.classList.contains('nav-open');
  backToTop.classList.toggle('is-visible', shouldShow);
  backToTop.setAttribute('aria-hidden', String(!shouldShow));
  backToTop.inert = !shouldShow;
  if (shouldShow) backToTop.removeAttribute('tabindex');
  else backToTop.setAttribute('tabindex', '-1');
};

const closeMenu = ({ restoreFocus = true } = {}) => {
  if (!menuButton || !navDrawer) return;
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Open navigation menu');
  navDrawer.classList.remove('is-open');
  navDrawer.setAttribute('aria-hidden', 'true');
  navDrawer.inert = true;
  document.body.classList.remove('nav-open');
  setPageInert(false);
  updateScrollUI();

  if (restoreFocus && lastFocusedElement instanceof HTMLElement) {
    lastFocusedElement.focus();
  }
};

const openMenu = () => {
  if (!menuButton || !navDrawer) return;
  lastFocusedElement = document.activeElement;
  menuButton.setAttribute('aria-expanded', 'true');
  menuButton.setAttribute('aria-label', 'Close navigation menu');
  navDrawer.inert = false;
  navDrawer.classList.add('is-open');
  navDrawer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('nav-open');
  setPageInert(true);
  setBackToTopVisibility(false);
  updateDrawerOffset();

  window.setTimeout(() => {
    navDrawer.querySelector('a[href]')?.focus({ preventScroll: true });
  }, 60);
};

if (menuButton && navDrawer) {
  menuButton.addEventListener('click', () => {
    const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
    if (isOpen) closeMenu();
    else openMenu();
  });

  navDrawer.addEventListener('click', (event) => {
    if (event.target.closest('a[href]')) closeMenu({ restoreFocus: false });
  });

  document.addEventListener('click', (event) => {
    if (!navDrawer.classList.contains('is-open')) return;
    if (navDrawer.contains(event.target) || menuButton.contains(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
  }, true);

  document.addEventListener('keydown', (event) => {
    if (!navDrawer.classList.contains('is-open')) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
      return;
    }

    if (event.key !== 'Tab') return;
    const focusable = getFocusableElements(navDrawer);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 1080 && navDrawer.classList.contains('is-open')) {
      closeMenu({ restoreFocus: false });
      return;
    }
    if (navDrawer.classList.contains('is-open')) updateDrawerOffset();
  });
}

const updateScrollUI = () => {
  const scrollableDistance = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollableDistance > 0 ? Math.min(window.scrollY / scrollableDistance, 1) : 0;

  if (scrollProgress) scrollProgress.style.transform = `scaleX(${progress})`;
  setBackToTopVisibility(window.scrollY > 700);
};

window.addEventListener('scroll', updateScrollUI, { passive: true });
window.addEventListener('resize', updateScrollUI);
updateScrollUI();

backToTop?.addEventListener('click', () => {
  const focusTarget = document.querySelector('main h1') || pageMain;
  if (focusTarget instanceof HTMLElement) {
    const hadTabIndex = focusTarget.hasAttribute('tabindex');
    if (!hadTabIndex) focusTarget.setAttribute('tabindex', '-1');
    focusTarget.focus({ preventScroll: true });
    if (!hadTabIndex) {
      focusTarget.addEventListener('blur', () => focusTarget.removeAttribute('tabindex'), { once: true });
    }
  }
  window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
});

const revealElements = document.querySelectorAll('.reveal');
if (reducedMotion.matches || !('IntersectionObserver' in window)) {
  revealElements.forEach((element) => element.classList.add('is-visible'));
} else {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

  revealElements.forEach((element) => revealObserver.observe(element));
}

const serviceFilter = document.querySelector('[data-service-filter]');
const serviceGroups = [...document.querySelectorAll('[data-service-group]')];
const serviceCount = document.querySelector('[data-service-count]');
const noResults = document.querySelector('[data-no-results]');

const normalizeText = (value) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const normalizeSearchToken = (token) => {
  if (token.length > 4 && token.endsWith('ies')) return `${token.slice(0, -3)}y`;
  if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
};

const tokenizeSearchText = (value) => normalizeText(value)
  .split(' ')
  .filter(Boolean)
  .map(normalizeSearchToken);

const filterServices = ({ updateUrl = true } = {}) => {
  if (!serviceFilter) return;
  const queryTokens = tokenizeSearchText(serviceFilter.value);
  let visibleCount = 0;

  serviceGroups.forEach((group) => {
    const renderedSearchText = [...group.querySelectorAll('summary h2, .service-group__content > p:first-child, .service-list li')]
      .map((element) => element.textContent || '')
      .join(' ');
    const searchTokens = tokenizeSearchText(`${group.dataset.search || ''} ${renderedSearchText}`);
    const isVisible = queryTokens.length === 0
      || queryTokens.every((queryToken) => searchTokens.some((searchToken) => searchToken.includes(queryToken)));
    group.hidden = !isVisible;

    if (isVisible) {
      visibleCount += 1;
      if (normalizeText(serviceFilter.value).length >= 3) group.open = true;
    }
  });

  if (serviceCount) {
    const label = visibleCount === 1 ? 'category' : 'categories';
    serviceCount.textContent = `${visibleCount} ${label} shown`;
  }

  if (noResults) noResults.hidden = visibleCount !== 0;

  if (updateUrl) {
    const url = new URL(window.location.href);
    if (serviceFilter.value.trim()) url.searchParams.set('q', serviceFilter.value.trim());
    else url.searchParams.delete('q');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }
};

if (serviceFilter) {
  const initialQuery = new URLSearchParams(window.location.search).get('q');
  if (initialQuery) serviceFilter.value = initialQuery;
  serviceFilter.addEventListener('input', () => filterServices());
  serviceFilter.addEventListener('search', () => filterServices());
  filterServices({ updateUrl: false });
}

const openServiceGroupFromHash = ({ focusSummary = false } = {}) => {
  if (!window.location.hash || !serviceGroups.length) return;

  let targetId = '';
  try {
    targetId = decodeURIComponent(window.location.hash.slice(1));
  } catch {
    return;
  }

  const targetGroup = serviceGroups.find((group) => group.id === targetId);
  if (!targetGroup || targetGroup.hidden) return;
  targetGroup.open = true;

  window.requestAnimationFrame(() => {
    targetGroup.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
    if (focusSummary) targetGroup.querySelector('summary')?.focus({ preventScroll: true });
  });
};

openServiceGroupFromHash();
window.addEventListener('hashchange', () => openServiceGroupFromHash({ focusSummary: true }));

document.querySelectorAll('[data-current-year]').forEach((element) => {
  element.textContent = String(new Date().getFullYear());
});
