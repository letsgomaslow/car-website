document.documentElement.classList.remove('no-js');
document.documentElement.classList.add('has-js');

const menuButton = document.querySelector('[data-menu-button]');
const navDrawer = document.querySelector('[data-nav-drawer]');
const pageMain = document.querySelector('main');
const pageFooter = document.querySelector('.site-footer');
const utilityBar = document.querySelector('.utility-bar');
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

const setPageInert = (isInert) => {
  [pageMain, pageFooter, utilityBar].forEach((element) => {
    if (element) element.inert = isInert;
  });
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
    }
  });
}

const updateScrollUI = () => {
  const scrollableDistance = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollableDistance > 0 ? Math.min(window.scrollY / scrollableDistance, 1) : 0;

  if (scrollProgress) scrollProgress.style.transform = `scaleX(${progress})`;
  if (backToTop) backToTop.classList.toggle('is-visible', window.scrollY > 700);
};

window.addEventListener('scroll', updateScrollUI, { passive: true });
window.addEventListener('resize', updateScrollUI);
updateScrollUI();

backToTop?.addEventListener('click', () => {
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

const normalizeText = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const filterServices = ({ updateUrl = true } = {}) => {
  if (!serviceFilter) return;
  const query = normalizeText(serviceFilter.value);
  let visibleCount = 0;

  serviceGroups.forEach((group) => {
    const searchText = normalizeText(group.dataset.search || group.textContent || '');
    const isVisible = !query || searchText.includes(query);
    group.hidden = !isVisible;

    if (isVisible) {
      visibleCount += 1;
      if (query.length >= 3) group.open = true;
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

document.querySelectorAll('[data-current-year]').forEach((element) => {
  element.textContent = String(new Date().getFullYear());
});
