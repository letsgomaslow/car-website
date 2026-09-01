#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SITE = path.join(ROOT, 'site');
const guideData = readJson(path.join(ROOT, 'data', 'service-guides.json'));
const serviceData = readJson(path.join(ROOT, 'data', 'services.json'));

const fallbackRegistry = {
  defaultLocale: 'en-US',
  locales: [
    { id: 'en-US', code: 'EN', label: 'English', selfLabel: 'English' },
    { id: 'es-US', code: 'ES', label: 'Spanish', selfLabel: 'Español' },
  ],
  routes: {
    home: { 'en-US': '/', 'es-US': '/es/' },
    services: { 'en-US': '/services/', 'es-US': '/es/servicios/' },
    about: { 'en-US': '/about/', 'es-US': '/es/nosotros/' },
    contact: { 'en-US': '/contact/', 'es-US': '/es/contacto/' },
    privacy: { 'en-US': '/privacy/', 'es-US': '/es/privacidad/' },
    tpms: { 'en-US': '/tpms-programming/', 'es-US': '/es/servicios/programacion-tpms/' },
  },
};

const registryPath = path.join(ROOT, 'data', 'locales.json');
const registry = fs.existsSync(registryPath) ? mergeRegistry(readJson(registryPath)) : fallbackRegistry;

const localizedUi = {
  en: {
    localeId: 'en-US',
    skip: 'Skip to main content',
    state: 'New Jersey',
    hours: 'Mon–Sat 9 AM–7 PM · Sunday closed',
    brandHome: 'Central Auto Repair home',
    primaryNav: 'Primary navigation',
    services: 'Services',
    about: 'About',
    contact: 'Contact',
    chooseLanguage: 'Choose a language',
    languageLabel: 'Language: English',
    callShop: 'Call the shop',
    openMenu: 'Open navigation menu',
    siteNav: 'Site navigation',
    drawerLine: 'Start with what changed.',
    callNumber: 'Call 732-822-4534',
    directions: 'Get directions',
    home: 'Home',
    serviceGuides: 'Service guides',
    cuesEyebrow: 'What the driver notices',
    cuesTitle: 'See, hear, smell, or feel something different?',
    cuesIntro: 'These details help identify a useful starting point. They are not a diagnosis, and the same symptom can come from more than one condition.',
    systemEyebrow: 'Plain-language system view',
    servicesEyebrow: 'Published service catalog',
    servicesTitle: 'Services related to this guide.',
    sourceNote: 'Service names come from Central’s current published catalog. Call to confirm that a specific service fits the vehicle and current need.',
    readyEyebrow: 'Before you call',
    readyTitle: 'Have these details ready.',
    safetyEyebrow: 'Safety first',
    faqEyebrow: 'Common questions',
    faqTitle: 'A clearer starting point.',
    relatedEyebrow: 'Keep exploring',
    relatedTitle: 'Related service guides.',
    readGuide: 'Read the guide',
    hoursDirections: 'Hours & directions',
    footerIntro: 'A father-and-son auto repair shop in Edison.',
    footerNav: 'Footer navigation',
    navigate: 'Navigate',
    tireLight: 'Tire Light / TPMS',
    visit: 'Visit',
    mapsDirections: 'Google Maps directions',
    footerContact: 'Contact',
    sunday: 'Sunday: Closed',
    rights: 'All rights reserved.',
    privacy: 'Privacy',
    mobileActions: 'Mobile quick actions',
    callNow: 'Call now',
    backTop: 'Back to top',
  },
  es: {
    localeId: 'es-US',
    skip: 'Saltar al contenido principal',
    state: 'Nueva Jersey',
    hours: 'Lun.–sáb. 9 AM–7 PM · Domingo cerrado',
    brandHome: 'Inicio de Central Auto Repair',
    primaryNav: 'Navegación principal',
    services: 'Servicios',
    about: 'Nosotros',
    contact: 'Contacto',
    chooseLanguage: 'Elegir un idioma',
    languageLabel: 'Idioma: Español',
    callShop: 'Llamar al taller',
    openMenu: 'Abrir menú de navegación',
    siteNav: 'Navegación del sitio',
    drawerLine: 'Comience con lo que cambió.',
    callNumber: 'Llame al 732-822-4534',
    directions: 'Cómo llegar',
    home: 'Inicio',
    serviceGuides: 'Guías de servicio',
    cuesEyebrow: 'Lo que nota al manejar',
    cuesTitle: '¿Ve, oye, huele o siente algo diferente?',
    cuesIntro: 'Estos detalles ayudan a identificar un punto de partida. No son un diagnóstico y un mismo síntoma puede tener más de una causa.',
    systemEyebrow: 'El sistema en palabras sencillas',
    servicesEyebrow: 'Catálogo de servicios publicado',
    servicesTitle: 'Servicios relacionados con esta guía.',
    sourceNote: 'Los nombres se basan en el catálogo publicado actual de Central. Llame para confirmar que el servicio corresponda al vehículo y la necesidad.',
    readyEyebrow: 'Antes de llamar',
    readyTitle: 'Tenga estos datos listos.',
    safetyEyebrow: 'La seguridad primero',
    faqEyebrow: 'Preguntas comunes',
    faqTitle: 'Un punto de partida más claro.',
    relatedEyebrow: 'Siga explorando',
    relatedTitle: 'Guías relacionadas.',
    readGuide: 'Leer la guía',
    hoursDirections: 'Horario y cómo llegar',
    footerIntro: 'Un taller de reparación de autos de padre e hijo en Edison.',
    footerNav: 'Navegación del pie de página',
    navigate: 'Navegar',
    tireLight: 'Luz de llantas / TPMS',
    visit: 'Visitar',
    mapsDirections: 'Indicaciones en Google Maps',
    footerContact: 'Contacto',
    sunday: 'Domingo: Cerrado',
    rights: 'Todos los derechos reservados.',
    privacy: 'Privacidad',
    mobileActions: 'Acciones rápidas para móvil',
    callNow: 'Llamar ahora',
    backTop: 'Volver arriba',
  },
};

const categoryTranslations = {
  'Preventive Maintenance': 'Mantenimiento preventivo',
  'Lube, Oil & Filter Change': 'Lubricación, aceite y filtro',
  'Brake Repair': 'Reparación de frenos',
  'Tire Services': 'Servicios de llantas',
  'Wheel Services': 'Servicios de rines',
  'Engine Diagnostics and Performance': 'Diagnóstico y rendimiento del motor',
  'Electrical & Electronic Systems': 'Sistemas eléctricos y electrónicos',
  'Starting, Charging & Batteries': 'Arranque, carga y baterías',
  'Climate Control Systems': 'Sistemas de climatización',
  'Cooling System Repair': 'Reparación del sistema de enfriamiento',
  'Steering and Suspension System': 'Sistema de dirección y suspensión',
  'Belts & Hoses': 'Bandas y mangueras',
  'Axle, CV Joint & Driveshaft Repair': 'Ejes, juntas CV y eje de transmisión',
  'Transmission Repair': 'Reparación de transmisión',
  'Exhaust System Repair': 'Reparación del sistema de escape',
};

const serviceTranslations = {
  'Wiper Blades Replacement': 'Reemplazo de limpiaparabrisas',
  'Air Filter Replacement': 'Reemplazo del filtro de aire',
  'Winterization Checkup': 'Revisión de preparación para invierno',
  'Spring Checkup': 'Revisión de primavera',
  'Oil and Filter Change': 'Cambio de aceite y filtro',
  'Fuel Injection': 'Servicio de inyección de combustible',
  'Lube and Oil Change': 'Lubricación y cambio de aceite',
  'Brake Inspection': 'Inspección de frenos',
  'Brake Rotor Replacement': 'Reemplazo de rotores de freno',
  'Front Disc Brake Repair': 'Reparación de frenos de disco delanteros',
  'Parking Brake Adjustment': 'Ajuste del freno de estacionamiento',
  'Rear Disc Brake Repair': 'Reparación de frenos de disco traseros',
  'Rear Drum Brake Repair': 'Reparación de frenos de tambor traseros',
  'Computerized Wheel Balancing': 'Balanceo computarizado de ruedas',
  'Tire Purchase & Tire Installation': 'Compra e instalación de llantas',
  'Tire Rotation': 'Rotación de llantas',
  'Wheel Purchase & Wheel Installation': 'Compra e instalación de rines',
  'Engine Diagnostics': 'Diagnóstico del motor',
  'Engine Tune-Up': 'Afinación del motor',
  'Dashboard Warning Diagnostic': 'Diagnóstico de alertas del tablero',
  'Headlight Bulb Replacement': 'Reemplazo de bombilla de faro',
  'Interior & Exterior Lighting Repair': 'Reparación de iluminación interior y exterior',
  'Power Locks Repair': 'Reparación de seguros eléctricos',
  'Power Window Repair': 'Reparación de ventanas eléctricas',
  'Alternator Replacement': 'Reemplazo del alternador',
  'Battery Replacement': 'Reemplazo de la batería',
  'Starter Replacement': 'Reemplazo del motor de arranque',
  'Starting & Charging System Check': 'Revisión del sistema de arranque y carga',
  'Air Conditioning System Diagnostic': 'Diagnóstico del sistema de aire acondicionado',
  'Air Conditioning System Service': 'Servicio del sistema de aire acondicionado',
  'Heating System Diagnostic': 'Diagnóstico del sistema de calefacción',
  'Heating System Service': 'Servicio del sistema de calefacción',
  'Cooling System Flush and Fill': 'Lavado y llenado del sistema de enfriamiento',
  'Cooling System Pressure Test': 'Prueba de presión del sistema de enfriamiento',
  'Replace Radiator': 'Reemplazo del radiador',
  'Ball Joint Replacement': 'Reemplazo de rótulas',
  'Inner Tie Rod & Outer Tie Rod Replacement': 'Reemplazo de terminales interiores y exteriores',
  'Shocks Replacement': 'Reemplazo de amortiguadores',
  'Struts Replacement': 'Reemplazo de puntales',
  'Suspension Inspection': 'Inspección de la suspensión',
  'Sway Bar Link Replacement': 'Reemplazo de enlaces de la barra estabilizadora',
  'Heater Hose Replacement': 'Reemplazo de manguera de calefacción',
  'Radiator Hose Replacement': 'Reemplazo de manguera del radiador',
  'Serpentine Belt Replacement': 'Reemplazo de banda serpentina',
  'Timing Belt Replacement': 'Reemplazo de banda de tiempo',
  'CV Axle Inspection': 'Inspección del eje CV',
  'CV Axle Replacement': 'Reemplazo del eje CV',
  'CV Boot Replacement': 'Reemplazo de bota CV',
  'CV Joint Replacement': 'Reemplazo de junta CV',
  'U-Joint Replacement': 'Reemplazo de junta universal',
  'Yoke Replacement': 'Reemplazo de yugo',
  'Automatic Transmission Repair': 'Reparación de transmisión automática',
  'Clutch Adjustment and Inspection': 'Ajuste e inspección del embrague',
  'Clutch Replacement': 'Reemplazo del embrague',
  'Manual Transmission Repair': 'Reparación de transmisión manual',
  'Transmission Replacement': 'Reemplazo de transmisión',
  'Catalytic Converter Replacement': 'Reemplazo del convertidor catalítico',
  'Center Exhaust Section Replacement': 'Reemplazo de la sección central del escape',
  'Downpipe Replacement': 'Reemplazo del tubo de bajada',
  'Exhaust Inspection': 'Inspección del sistema de escape',
  'Manifold Replacement': 'Reemplazo del múltiple de escape',
  'Muffler Replacement': 'Reemplazo del silenciador',
};

const categoriesByName = new Map(serviceData.categories.map((category) => [category.name, category]));

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function mergeRegistry(custom) {
  return {
    ...fallbackRegistry,
    ...custom,
    locales: Array.isArray(custom.locales) && custom.locales.length ? custom.locales : fallbackRegistry.locales,
    routes: { ...fallbackRegistry.routes, ...(custom.routes || {}) },
  };
}

function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function localeKey(localeId) {
  return localeId.toLowerCase().split('-')[0];
}

function coreRoute(name, localeId) {
  return registry.routes?.[name]?.[localeId] || fallbackRegistry.routes[name]?.[localeId] || '/';
}

function guideRoute(guide, key) {
  const slug = guide.copy[key].slug;
  return key === 'en' ? `/services/${slug}/` : `/${key}/servicios/${slug}/`;
}

function translateService(service) {
  const mileage = service.match(/^([\d,]+) Mile Service$/);
  if (mileage) return `Servicio de ${mileage[1]} millas`;
  if (!serviceTranslations[service]) throw new Error(`Missing Spanish service translation: ${service}`);
  return serviceTranslations[service];
}

function getServiceGroups(guide, key) {
  return guide.categories.map((categoryName) => {
    const category = categoriesByName.get(categoryName);
    if (!category) throw new Error(`Guide ${guide.id} references missing service category: ${categoryName}`);
    return {
      title: key === 'en' ? category.name : categoryTranslations[category.name],
      items: key === 'en' ? category.items : category.items.map(translateService),
    };
  });
}

function renderLocaleSelector(guide, key, ui) {
  const currentLocaleId = ui.localeId;
  const options = registry.locales.filter((locale) => guide.copy[localeKey(locale.id)]);
  return `<div class="locale-selector" data-locale-selector>
        <button class="locale-selector__button" type="button" aria-label="${esc(ui.languageLabel)}" aria-controls="language-menu" aria-haspopup="menu" aria-expanded="false" data-locale-toggle><span class="locale-selector__globe" aria-hidden="true"></span><span>${esc(options.find((locale) => locale.id === currentLocaleId)?.code || key.toUpperCase())}</span><span class="locale-selector__chevron" aria-hidden="true"></span></button>
        <ul class="locale-selector__menu" id="language-menu" aria-label="${esc(ui.chooseLanguage)}" data-locale-menu hidden>${options.map((locale) => {
          const optionKey = localeKey(locale.id);
          const current = locale.id === currentLocaleId ? ' aria-current="true"' : '';
          return `<li><a class="locale-selector__option" href="${guideRoute(guide, optionKey)}" lang="${esc(locale.id)}" hreflang="${esc(locale.id)}"${current}><span class="locale-selector__name">${esc(locale.selfLabel || locale.label)}</span><span class="locale-selector__code">${esc(locale.code)}</span></a></li>`;
        }).join('')}</ul>
      </div>`;
}

function renderHeader(guide, key, ui) {
  const id = ui.localeId;
  return `<div class="utility-bar"><div class="shell"><p>82 Lincoln Highway · Edison, ${esc(ui.state)}</p><p>${esc(ui.hours)} · <a href="tel:+17328224534">732-822-4534</a></p></div></div>
  <header class="site-header"><div class="site-header__inner shell">
    <a class="brand" href="${coreRoute('home', id)}" aria-label="${esc(ui.brandHome)}"><span class="brand__mark" aria-hidden="true">CA</span><span class="brand__name">Central Auto Repair<small>Edison · ${esc(ui.state)}</small></span></a>
    <nav class="desktop-nav" aria-label="${esc(ui.primaryNav)}"><ul><li><a href="${coreRoute('services', id)}" aria-current="page">${esc(ui.services)}</a></li><li><a href="${coreRoute('about', id)}">${esc(ui.about)}</a></li><li><a href="${coreRoute('contact', id)}">${esc(ui.contact)}</a></li></ul></nav>
    ${renderLocaleSelector(guide, key, ui)}
    <a class="header-cta" href="tel:+17328224534">${esc(ui.callShop)}</a>
    <button class="menu-button" type="button" aria-label="${esc(ui.openMenu)}" aria-controls="mobile-navigation" aria-expanded="false" data-menu-button><span class="menu-button__lines" aria-hidden="true"></span></button>
  </div></header>
  <div class="nav-drawer" id="mobile-navigation" role="dialog" aria-modal="true" aria-label="${esc(ui.siteNav)}" aria-hidden="true" data-nav-drawer><div class="nav-drawer__inner"><ul class="nav-drawer__links"><li><a href="${coreRoute('services', id)}" aria-current="page"><span class="nav-drawer__index">01</span><span>${esc(ui.services)}</span></a></li><li><a href="${coreRoute('about', id)}"><span class="nav-drawer__index">02</span><span>${esc(ui.about)}</span></a></li><li><a href="${coreRoute('contact', id)}"><span class="nav-drawer__index">03</span><span>${esc(ui.contact)}</span></a></li></ul><div class="nav-drawer__aside"><p>${esc(ui.drawerLine)}</p><div class="nav-drawer__contact"><a href="tel:+17328224534">${esc(ui.callNumber)}</a><a href="https://www.google.com/maps/search/?api=1&amp;query=Central+Auto+Repair+82+Lincoln+Hwy+Edison+NJ+08820">${esc(ui.directions)}</a><span>82 Lincoln Highway, Edison, NJ 08820</span></div></div></div></div>`;
}

function renderVisual(guide, copy) {
  return `<figure class="guide-visual guide-visual--image"><picture><source media="(min-width: 769px)" type="image/webp" srcset="/assets/images/guides/${guide.id}-editorial-1280.webp"><img src="/assets/images/guides/${guide.id}-editorial-768.webp" width="768" height="480" loading="lazy" decoding="async" alt="${esc(copy.visualAlt)}"></picture></figure>`;
}

function renderFooter(key, ui) {
  const id = ui.localeId;
  return `<footer class="site-footer"><div class="site-footer__main shell"><div class="footer-intro"><a class="brand" href="${coreRoute('home', id)}" aria-label="${esc(ui.brandHome)}"><span class="brand__mark" aria-hidden="true">CA</span><span class="brand__name">Central Auto Repair<small>Edison · ${esc(ui.state)}</small></span></a><p>${esc(ui.footerIntro)}</p></div><nav class="footer-column" aria-label="${esc(ui.footerNav)}"><h2>${esc(ui.navigate)}</h2><ul><li><a href="${coreRoute('services', id)}">${esc(ui.services)}</a></li><li><a href="${coreRoute('tpms', id)}">${esc(ui.tireLight)}</a></li><li><a href="${coreRoute('about', id)}">${esc(ui.about)}</a></li><li><a href="${coreRoute('contact', id)}">${esc(ui.contact)}</a></li></ul></nav><div class="footer-column"><h2>${esc(ui.visit)}</h2><address>82 Lincoln Highway<br>Edison, NJ 08820</address><ul><li><a href="https://www.google.com/maps/search/?api=1&amp;query=Central+Auto+Repair+82+Lincoln+Hwy+Edison+NJ+08820">${esc(ui.mapsDirections)}</a></li></ul></div><div class="footer-column"><h2>${esc(ui.footerContact)}</h2><ul><li><a href="tel:+17328224534">732-822-4534</a></li><li>${key === 'en' ? 'Mon–Sat: 9 AM–7 PM' : 'Lun.–sáb.: 9 AM–7 PM'}</li><li>${esc(ui.sunday)}</li></ul></div></div><div class="site-footer__legal shell"><span>© <span data-current-year></span> Central Auto Repair. ${esc(ui.rights)}</span><span><a href="${coreRoute('privacy', id)}">${esc(ui.privacy)}</a></span></div></footer>
  <nav class="mobile-actions" aria-label="${esc(ui.mobileActions)}"><a href="tel:+17328224534">${esc(ui.callNow)}</a><a href="https://www.google.com/maps/search/?api=1&amp;query=Central+Auto+Repair+82+Lincoln+Hwy+Edison+NJ+08820">${esc(ui.directions)}</a></nav><button class="back-to-top" type="button" aria-label="${esc(ui.backTop)}" data-back-to-top>↑</button>`;
}

function renderGuide(guide, key) {
  const copy = guide.copy[key];
  const ui = localizedUi[key];
  const id = ui.localeId;
  const route = guideRoute(guide, key);
  const availableLocales = registry.locales.filter((locale) => guide.copy[localeKey(locale.id)]);
  const alternates = availableLocales.map((locale) => `<link rel="alternate" hreflang="${esc(locale.id)}" href="${guideRoute(guide, localeKey(locale.id))}">`).join('\n  ');
  const englishRoute = guideRoute(guide, 'en');
  const serviceGroups = getServiceGroups(guide, key);
  const related = guide.related.map((relatedId) => guideData.guides.find((item) => item.id === relatedId)).filter(Boolean);
  const faqSchema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: id,
    mainEntity: copy.faqs.map((faq) => ({ '@type': 'Question', name: faq.q, acceptedAnswer: { '@type': 'Answer', text: faq.a } })),
  }).replaceAll('<', '\\u003c');

  return `<!doctype html>
<html lang="${id}" class="no-js">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#0d1110">
  <meta name="description" content="${esc(copy.description)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Central Auto Repair">
  <meta property="og:title" content="${esc(copy.seoTitle)}">
  <meta property="og:description" content="${esc(copy.description)}">
  <meta name="twitter:card" content="summary">
  <title>${esc(copy.seoTitle)}</title>
  ${alternates}
  <link rel="alternate" hreflang="x-default" href="${englishRoute}">
  <link rel="icon" href="/assets/icons/favicon-32.png" type="image/png" sizes="32x32">
  <link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon-180.png" sizes="180x180">
  <link rel="manifest" href="/site.webmanifest">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Saira+Condensed:wght@600;700;800;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/css/site.css">
  <link rel="stylesheet" href="/assets/css/locale.css">
  <link rel="stylesheet" href="/assets/css/service-guides.css">
  <script src="/assets/js/site.js" defer></script>
  <script src="/assets/js/locale.js" defer></script>
  <script type="application/ld+json">${faqSchema}</script>
</head>
<body class="guide-page guide-page--${guide.id}">
  <a class="skip-link" href="#main">${esc(ui.skip)}</a>
  <div class="scroll-progress" aria-hidden="true"><span data-scroll-progress></span></div>
  ${renderHeader(guide, key, ui)}
  <main id="main">
    <header class="page-hero guide-hero"><div class="shell"><nav aria-label="${key === 'en' ? 'Breadcrumb' : 'Ruta de navegación'}"><ol class="breadcrumb"><li><a href="${coreRoute('home', id)}">${esc(ui.home)}</a></li><li><a href="${coreRoute('services', id)}">${esc(ui.services)}</a></li><li aria-current="page">${esc(copy.title)}</li></ol></nav><p class="eyebrow">${esc(copy.eyebrow)}</p><h1>${esc(copy.headline)}</h1><p class="page-hero__lead">${esc(copy.lead)}</p><div class="page-hero__actions"><a class="button button--orange" href="tel:+17328224534">${esc(copy.ctaLabel)}</a><a class="button button--outline" href="${coreRoute('services', id)}">${esc(ui.serviceGuides)}</a></div></div></header>

    <section class="section section--paper" aria-labelledby="cues-title"><div class="shell"><div class="section-heading"><div><p class="eyebrow">${esc(ui.cuesEyebrow)}</p><h2 id="cues-title">${esc(ui.cuesTitle)}</h2></div><p>${esc(ui.cuesIntro)}</p></div><div class="guide-cues">${copy.cues.map((cue) => `<article class="guide-cue"><span>${esc(cue.label)}</span><h3>${esc(cue.title)}</h3><p>${esc(cue.text)}</p></article>`).join('')}</div></div></section>

    <section class="section section--raised guide-system" aria-labelledby="system-title"><div class="shell guide-system__grid"><div class="guide-system__copy"><p class="eyebrow">${esc(ui.systemEyebrow)}</p><h2 id="system-title">${esc(copy.systemTitle)}</h2>${copy.systemParagraphs.map((paragraph) => `<p>${esc(paragraph)}</p>`).join('')}</div>${renderVisual(guide, copy)}</div></section>

    <section class="section section--paper guide-services" aria-labelledby="services-title"><div class="shell"><div class="section-heading"><div><p class="eyebrow">${esc(ui.servicesEyebrow)}</p><h2 id="services-title">${esc(ui.servicesTitle)}</h2></div><p>${esc(copy.servicesIntro)}</p></div><div class="guide-service-groups">${serviceGroups.map((group) => `<section class="guide-service-group"><h3>${esc(group.title)}</h3><ul>${group.items.map((item) => `<li>${esc(item)}</li>`).join('')}</ul></section>`).join('')}</div><p class="guide-source-note">${esc(ui.sourceNote)}</p></div></section>

    <section class="section section--raised guide-prepare" aria-labelledby="ready-title"><div class="shell guide-prepare__grid"><div><p class="eyebrow">${esc(ui.readyEyebrow)}</p><h2 id="ready-title">${esc(ui.readyTitle)}</h2><p>${esc(copy.readyIntro)}</p><ol class="guide-ready-list">${copy.ready.map((item, index) => `<li><span>0${index + 1}</span><p>${esc(item)}</p></li>`).join('')}</ol></div><aside class="guide-safety"><p class="eyebrow">${esc(ui.safetyEyebrow)}</p><h2>${esc(copy.safetyTitle)}</h2><p>${esc(copy.safety)}</p></aside></div></section>

    <section class="section section--paper" aria-labelledby="faq-title"><div class="shell"><div class="section-heading"><div><p class="eyebrow">${esc(ui.faqEyebrow)}</p><h2 id="faq-title">${esc(ui.faqTitle)}</h2></div></div><div class="faq-list">${copy.faqs.map((faq) => `<details><summary>${esc(faq.q)}</summary><p>${esc(faq.a)}</p></details>`).join('')}</div></div></section>

    <section class="section section--raised" aria-labelledby="related-title"><div class="shell"><div class="section-heading"><div><p class="eyebrow">${esc(ui.relatedEyebrow)}</p><h2 id="related-title">${esc(ui.relatedTitle)}</h2></div></div><div class="guide-related">${related.map((item, index) => `<a class="service-preview-card" href="${guideRoute(item, key)}"><span class="service-preview-card__index">0${index + 1}</span><span class="service-preview-card__arrow" aria-hidden="true">↗</span><div><h3>${esc(item.copy[key].title)}</h3><p>${esc(ui.readGuide)}</p></div></a>`).join('')}</div></div></section>

    <section class="section section--raised"><div class="shell cta-band"><div><p class="eyebrow">${esc(copy.eyebrow)}</p><h2>${esc(copy.ctaTitle)}</h2><p>${esc(copy.ctaText)}</p></div><div class="cta-band__actions"><a class="button button--orange" href="tel:+17328224534">${esc(copy.ctaLabel)}</a><a class="button button--outline" href="${coreRoute('contact', id)}">${esc(ui.hoursDirections)}</a></div></div></section>
  </main>
  ${renderFooter(key, ui)}
</body>
</html>
`;
}

function validateData() {
  if (guideData.guides.length !== 11) throw new Error(`Expected 11 service guides, found ${guideData.guides.length}`);
  if (guideData.guides.some((guide) => guide.id.includes('inspection') || guide.categories.includes('Vehicle Inspection'))) {
    throw new Error('Inspection guide must remain unpublished until capabilities are verified.');
  }
  const ids = new Set();
  const slugs = new Set();
  const imageNames = new Set();
  for (const guide of guideData.guides) {
    if (ids.has(guide.id)) throw new Error(`Duplicate guide id: ${guide.id}`);
    ids.add(guide.id);
    if (guide.image !== true) throw new Error(`${guide.id} must have an editorial guide image`);
    const imageName = `${guide.id}-editorial`;
    if (imageNames.has(imageName)) throw new Error(`Duplicate guide image name: ${imageName}`);
    imageNames.add(imageName);
    for (const key of ['en', 'es']) {
      const copy = guide.copy[key];
      if (!copy) throw new Error(`${guide.id} is missing ${key} copy`);
      if (slugs.has(`${key}:${copy.slug}`)) throw new Error(`Duplicate ${key} slug: ${copy.slug}`);
      slugs.add(`${key}:${copy.slug}`);
      if (copy.cues.length !== 4 || copy.ready.length !== 4 || copy.faqs.length !== 3) {
        throw new Error(`${guide.id}/${key} must have 4 cues, 4 ready items, and 3 FAQs`);
      }
      if (typeof copy.visualAlt !== 'string' || copy.visualAlt.trim().length < 40 || copy.visualAlt.trim().split(/\s+/).length < 8) {
        throw new Error(`${guide.id}/${key} must have meaningful localized visualAlt text`);
      }
    }
    if (guide.copy.en.visualAlt.trim() === guide.copy.es.visualAlt.trim()) {
      throw new Error(`${guide.id} must localize visualAlt text for English and Spanish`);
    }
    getServiceGroups(guide, 'en');
    getServiceGroups(guide, 'es');
  }
}

function outputPath(guide, key) {
  return path.join(SITE, ...(key === 'en' ? ['services', guide.copy[key].slug] : ['es', 'servicios', guide.copy[key].slug]), 'index.html');
}

function generate() {
  validateData();
  for (const guide of guideData.guides) {
    for (const key of ['en', 'es']) {
      const filePath = outputPath(guide, key);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, renderGuide(guide, key), 'utf8');
    }
  }
}

function validateGenerated() {
  const errors = [];
  const expected = guideData.guides.length * 2;
  const expectedAssets = new Set();
  let checked = 0;
  for (const guide of guideData.guides) {
    for (const width of ['768', '1280']) {
      const imagePath = path.join(SITE, 'assets', 'images', 'guides', `${guide.id}-editorial-${width}.webp`);
      const relativeImagePath = path.relative(ROOT, imagePath);
      if (expectedAssets.has(imagePath)) errors.push(`Duplicate expected image asset: ${relativeImagePath}`);
      expectedAssets.add(imagePath);
      if (!fs.existsSync(imagePath)) {
        errors.push(`Missing ${relativeImagePath}`);
      } else {
        const imageStats = fs.statSync(imagePath);
        if (!imageStats.isFile() || imageStats.size === 0) errors.push(`${relativeImagePath} is not a non-empty image file`);
      }
    }
    for (const key of ['en', 'es']) {
      const filePath = outputPath(guide, key);
      if (!fs.existsSync(filePath)) {
        errors.push(`Missing ${path.relative(ROOT, filePath)}`);
        continue;
      }
      checked += 1;
      const html = fs.readFileSync(filePath, 'utf8');
      const h1Count = (html.match(/<h1\b/g) || []).length;
      if (h1Count !== 1) errors.push(`${path.relative(ROOT, filePath)} has ${h1Count} h1 elements`);
      if (!html.includes(`<html lang="${localizedUi[key].localeId}"`)) errors.push(`${path.relative(ROOT, filePath)} has incorrect lang`);
      for (const locale of registry.locales.filter((item) => guide.copy[localeKey(item.id)])) {
        if (!html.includes(`hreflang="${locale.id}"`)) errors.push(`${path.relative(ROOT, filePath)} missing hreflang ${locale.id}`);
      }
      if (!html.includes('hreflang="x-default"')) errors.push(`${path.relative(ROOT, filePath)} missing x-default`);
      if (!html.includes('data-locale-selector') || !html.includes('data-locale-toggle') || !html.includes('data-locale-menu')) errors.push(`${path.relative(ROOT, filePath)} missing locale selector hooks`);
      if (/\{\{[^}]+\}\}|\bundefined\b|\bnull\b/.test(html)) errors.push(`${path.relative(ROOT, filePath)} has an unresolved token`);
      const relativePagePath = path.relative(ROOT, filePath);
      const visualMatches = html.match(/<figure class="guide-visual guide-visual--image">[\s\S]*?<\/figure>/g) || [];
      if (visualMatches.length !== 1) {
        errors.push(`${relativePagePath} must have exactly one editorial guide visual, found ${visualMatches.length}`);
      } else {
        const visualHtml = visualMatches[0];
        const pictureCount = (visualHtml.match(/<picture\b/g) || []).length;
        const sourceCount = (visualHtml.match(/<source\b/g) || []).length;
        const imageCount = (visualHtml.match(/<img\b/g) || []).length;
        if (pictureCount !== 1 || sourceCount !== 1 || imageCount !== 1) {
          errors.push(`${relativePagePath} guide visual must have one picture, one source, and one image`);
        }
        const sourceContract = `<source media="(min-width: 769px)" type="image/webp" srcset="/assets/images/guides/${guide.id}-editorial-1280.webp">`;
        const imageContract = `<img src="/assets/images/guides/${guide.id}-editorial-768.webp" width="768" height="480" loading="lazy" decoding="async" alt="${esc(guide.copy[key].visualAlt)}">`;
        if (!visualHtml.includes(sourceContract)) errors.push(`${relativePagePath} has an invalid 1280px responsive source`);
        if (!visualHtml.includes(imageContract)) errors.push(`${relativePagePath} has an invalid 768px image or localized alt text`);
      }
      if (html.includes('guide-visual--diagram')) errors.push(`${relativePagePath} still contains the retired text-only visual`);
    }
  }
  if (expectedAssets.size !== guideData.guides.length * 2) errors.push(`Expected ${guideData.guides.length * 2} unique responsive image assets, found ${expectedAssets.size}`);
  if (checked !== expected) errors.push(`Expected ${expected} pages, checked ${checked}`);
  if (errors.length) throw new Error(`Generated guide validation failed:\n- ${errors.join('\n- ')}`);
  return checked;
}

validateData();
if (!process.argv.includes('--check')) generate();
const checked = validateGenerated();
console.log(`${process.argv.includes('--check') ? 'Validated' : 'Generated and validated'} ${checked} localized service guide pages.`);
