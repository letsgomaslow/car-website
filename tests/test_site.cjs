const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const sharp = require('sharp');

const baseUrl = process.env.SITE_BASE_URL || 'http://127.0.0.1:4173';
const localizationOnly = process.env.LOCALIZATION_ONLY === '1';
const browserExecutable = process.env.PLAYWRIGHT_BROWSER_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const projectRoot = path.resolve(__dirname, '..');
const inventory = JSON.parse(fs.readFileSync(path.join(projectRoot, 'data', 'services.json'), 'utf8'));
const localeRegistry = JSON.parse(fs.readFileSync(path.join(projectRoot, 'data', 'locales.json'), 'utf8'));
const guideContent = JSON.parse(fs.readFileSync(path.join(projectRoot, 'data', 'service-guides.json'), 'utf8'));
const guideById = new Map(guideContent.guides.map((guide) => [guide.id, guide]));
const guideImageDirectory = path.join(projectRoot, 'site', 'assets', 'images', 'guides');
const guideImageWidths = [768, 1280];
const maxGuideImageBytes = { 768: 180 * 1024, 1280: 450 * 1024 };
const screenshotDirectory = path.join(projectRoot, 'tests', 'screenshots');

const pages = [
  { route: '/', name: 'home' },
  { route: '/services/', name: 'services' },
  { route: '/tpms-programming/', name: 'tpms' },
  { route: '/about/', name: 'about' },
  { route: '/contact/', name: 'contact' },
  { route: '/privacy/', name: 'privacy' },
  { route: '/404.html', name: '404' },
];

const coreLocalePairs = [
  { en: '/', es: '/es/', name: 'home' },
  { en: '/services/', es: '/es/servicios/', name: 'services' },
  { en: '/tpms-programming/', es: '/es/servicios/programacion-tpms/', name: 'tpms' },
  { en: '/about/', es: '/es/nosotros/', name: 'about' },
  { en: '/contact/', es: '/es/contacto/', name: 'contact' },
  { en: '/privacy/', es: '/es/privacidad/', name: 'privacy' },
  { en: '/404.html', es: '/es/404.html', name: '404' },
];

const guideLocalePairs = [
  { en: '/services/maintenance-oil/', es: '/es/servicios/mantenimiento-aceite/', name: 'maintenance-oil' },
  { en: '/services/brakes/', es: '/es/servicios/frenos/', name: 'brakes' },
  { en: '/services/tires-wheels/', es: '/es/servicios/llantas-rines/', name: 'tires-wheels' },
  { en: '/services/engine-diagnostics/', es: '/es/servicios/diagnostico-motor/', name: 'engine-diagnostics' },
  { en: '/services/battery-electrical/', es: '/es/servicios/bateria-sistema-electrico/', name: 'battery-electrical' },
  { en: '/services/heating-air-conditioning/', es: '/es/servicios/calefaccion-aire-acondicionado/', name: 'heating-air-conditioning' },
  { en: '/services/cooling-overheating/', es: '/es/servicios/enfriamiento-sobrecalentamiento/', name: 'cooling-overheating' },
  { en: '/services/steering-suspension/', es: '/es/servicios/direccion-suspension/', name: 'steering-suspension' },
  { en: '/services/belts-hoses/', es: '/es/servicios/bandas-mangueras/', name: 'belts-hoses' },
  { en: '/services/transmission-drivetrain/', es: '/es/servicios/transmision-tren-motriz/', name: 'transmission-drivetrain' },
  { en: '/services/exhaust-emissions/', es: '/es/servicios/escape-emisiones/', name: 'exhaust-emissions' },
];

const obviousPromisePatterns = [
  /\bguaranteed?\b/i,
  /\bsame[- ]day (?:service|repair|turnaround)\b/i,
  /\bwhile[- ]you[- ]wait\b/i,
  /\b(?:lowest|best) price\b/i,
  /\bwe (?:will|can) (?:fix|repair|diagnose) (?:any|every|your)\b/i,
  /\b(?:fixed|repaired) in (?:minutes|hours|one day)\b/i,
];

const viewports = [
  { name: 'phone-320', width: 320, height: 720 },
  { name: 'phone-360', width: 360, height: 800 },
  { name: 'phone-390', width: 390, height: 844 },
  { name: 'phone-430', width: 430, height: 900 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'tablet-1024', width: 1024, height: 900 },
  { name: 'desktop-1440', width: 1440, height: 900 },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function normalize(value) {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function localeForRoute(pair, route) {
  if (route === pair.en) return { code: 'en-US', shortCode: 'EN', counterpart: pair.es };
  return { code: 'es-US', shortCode: 'ES', counterpart: pair.en };
}

function selectorOpenState(element) {
  const details = element.matches('details') ? element : element.closest('details');
  if (details) return details.open;
  return element.getAttribute('aria-expanded') === 'true';
}

function relativeLuminance(hexColor) {
  const channels = [1, 3, 5].map((index) => Number.parseInt(hexColor.slice(index, index + 2), 16) / 255);
  const linear = channels.map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(first, second) {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseCssColor(value) {
  const channels = (value.match(/[\d.]+/g) || []).map(Number);
  assert(channels.length >= 3, `could not parse CSS color: ${value}`);
  return { rgb: channels.slice(0, 3), alpha: channels[3] ?? 1 };
}

function relativeLuminanceRgb(rgb) {
  const linear = rgb.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatioRgb(first, second) {
  const [lighter, darker] = [relativeLuminanceRgb(first), relativeLuminanceRgb(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

function compositeColor(foreground, background) {
  return foreground.rgb.map((channel, index) => channel * foreground.alpha + background.rgb[index] * (1 - foreground.alpha));
}

function verifyContrastTokens() {
  const css = fs.readFileSync(path.join(projectRoot, 'site', 'assets', 'css', 'site.css'), 'utf8');
  const tokens = Object.fromEntries([...css.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})/gi)].map((match) => [match[1], match[2]]));
  const requiredPairs = [
    ['paper', 'ink'],
    ['steel', 'ink'],
    ['ink', 'orange'],
    ['ink', 'acid'],
    ['steel-dark', 'paper'],
    ['orange-dark', 'paper'],
  ];

  requiredPairs.forEach(([foreground, background]) => {
    const ratio = contrastRatio(tokens[foreground], tokens[background]);
    assert(ratio >= 4.5, `contrast token pair ${foreground}/${background} is ${ratio.toFixed(2)}:1`);
  });
}

function verifyDeploymentConfig() {
  const vercelConfig = JSON.parse(fs.readFileSync(path.join(projectRoot, 'vercel.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, 'site', 'site.webmanifest'), 'utf8'));
  assert(vercelConfig.outputDirectory === 'site', 'Vercel outputDirectory must be site');
  assert(vercelConfig.cleanUrls === true, 'Vercel cleanUrls must be enabled');
  assert(vercelConfig.trailingSlash === false, 'Vercel trailingSlash must be disabled');
  assert(manifest.start_url === '/', 'web manifest start_url must be root');
  assert(
    JSON.stringify(manifest.icons.map((icon) => [icon.src, icon.sizes])) === JSON.stringify([
      ['/assets/icons/favicon-192.png', '192x192'],
      ['/assets/icons/favicon-512.png', '512x512'],
    ]),
    'web manifest icon set is incomplete or incorrectly sized',
  );
}

async function verifyBrandAssets() {
  const logoPath = path.join(projectRoot, 'site', 'assets', 'images', 'central-auto-repair-logo-transparent.png');
  const darkLogoPath = path.join(projectRoot, 'site', 'assets', 'images', 'central-auto-repair-logo-dark.png');
  const darkLogoResponsivePaths = [128, 256].map((size) => ({
    size,
    file: path.join(projectRoot, 'site', 'assets', 'images', `central-auto-repair-logo-dark-${size}.png`),
  }));
  const sourcePath = path.join(projectRoot, 'site', 'assets', 'images', 'central-auto-repair-logo.jpg');
  const [logoMetadata, darkLogoMetadata, sourceMetadata, logoStats, darkLogoStats, logoPixels, darkLogoPixels, sourcePixels] = await Promise.all([
    sharp(logoPath).metadata(),
    sharp(darkLogoPath).metadata(),
    sharp(sourcePath).metadata(),
    sharp(logoPath).stats(),
    sharp(darkLogoPath).stats(),
    sharp(logoPath).raw().toBuffer({ resolveWithObject: true }),
    sharp(darkLogoPath).raw().toBuffer({ resolveWithObject: true }),
    sharp(sourcePath).raw().toBuffer({ resolveWithObject: true }),
  ]);
  assert(sourceMetadata.width === 1024 && sourceMetadata.height === 1024, 'official Instagram logo source must remain 1024x1024');
  assert(logoMetadata.width === sourceMetadata.width && logoMetadata.height === sourceMetadata.height, 'transparent logo dimensions must match the official source');
  assert(logoMetadata.hasAlpha && logoMetadata.channels === 4, 'transparent logo must contain a real alpha channel');
  assert(logoStats.channels[3].min === 0 && logoStats.channels[3].max === 255, 'logo alpha channel must contain transparent and opaque pixels');
  assert(darkLogoMetadata.width === logoMetadata.width && darkLogoMetadata.height === logoMetadata.height, 'dark logo variant dimensions must match the transparent master');
  assert(darkLogoMetadata.hasAlpha && darkLogoMetadata.channels === 4, 'dark logo variant must retain a real alpha channel');
  assert(darkLogoStats.channels[3].min === 0 && darkLogoStats.channels[3].max === 255, 'dark logo alpha channel must contain transparent and opaque pixels');
  let changedColorPixels = 0;
  for (let pixel = 0; pixel < sourceMetadata.width * sourceMetadata.height; pixel += 1) {
    for (let channel = 0; channel < 3; channel += 1) {
      assert(
        logoPixels.data[pixel * 4 + channel] === sourcePixels.data[pixel * 3 + channel],
        `transparent logo changed source RGB geometry at pixel ${pixel}, channel ${channel}`,
      );
    }
    assert(darkLogoPixels.data[pixel * 4 + 3] === logoPixels.data[pixel * 4 + 3], `dark logo changed alpha geometry at pixel ${pixel}`);
    if (
      darkLogoPixels.data[pixel * 4] !== logoPixels.data[pixel * 4]
      || darkLogoPixels.data[pixel * 4 + 1] !== logoPixels.data[pixel * 4 + 1]
      || darkLogoPixels.data[pixel * 4 + 2] !== logoPixels.data[pixel * 4 + 2]
    ) changedColorPixels += 1;
  }
  assert(changedColorPixels > 70000 && changedColorPixels < 80000, `dark logo recolored an unexpected number of pixels (${changedColorPixels})`);

  const samplePixel = (pixels, x, y) => {
    const offset = (y * darkLogoMetadata.width + x) * 4;
    return [...pixels.data.slice(offset, offset + 4)];
  };
  for (const [label, x, y] of [['gear', 512, 190], ['skyline', 510, 300], ['AUTO REPAIR panel', 512, 835]]) {
    const [red, green, blue, alpha] = samplePixel(darkLogoPixels, x, y);
    assert(red >= 245 && green >= 245 && blue >= 245 && alpha === 255, `${label} did not switch to white`);
  }
  assert(
    JSON.stringify(samplePixel(darkLogoPixels, 180, 690)) === JSON.stringify(samplePixel(logoPixels, 180, 690)),
    'CENTRAL plaque changed outside the requested dark-mode regions',
  );
  assert(
    JSON.stringify(samplePixel(darkLogoPixels, 512, 800)) === JSON.stringify(samplePixel(logoPixels, 512, 800)),
    'AUTO REPAIR red lettering changed in the dark-mode variant',
  );

  for (const { size, file } of darkLogoResponsivePaths) {
    const [metadata, stats] = await Promise.all([sharp(file).metadata(), sharp(file).stats()]);
    assert(metadata.width === size && metadata.height === size, `responsive dark logo ${size}px has incorrect dimensions`);
    assert(metadata.hasAlpha && metadata.channels === 4, `responsive dark logo ${size}px must retain transparency`);
    assert(stats.channels[3].min === 0 && stats.channels[3].max === 255, `responsive dark logo ${size}px must contain transparent and opaque pixels`);
  }

  for (const [file, size] of [
    ['favicon-32.png', 32],
    ['apple-touch-icon-180.png', 180],
    ['favicon-192.png', 192],
    ['favicon-512.png', 512],
  ]) {
    const iconPath = path.join(projectRoot, 'site', 'assets', 'icons', file);
    const [metadata, stats] = await Promise.all([sharp(iconPath).metadata(), sharp(iconPath).stats()]);
    assert(metadata.width === size && metadata.height === size, `${file} has incorrect dimensions`);
    assert(metadata.hasAlpha && metadata.channels === 4, `${file} must retain transparency`);
    assert(stats.channels[3].min === 0 && stats.channels[3].max === 255, `${file} must contain transparent and opaque pixels`);
  }

  const css = fs.readFileSync(path.join(projectRoot, 'site', 'assets', 'css', 'site.css'), 'utf8');
  assert(css.includes('--display: "Saira Condensed"'), 'display typography must use Saira Condensed');
  assert(css.includes('central-auto-repair-logo-dark.png'), 'site CSS must reference the dark-surface logo variant');
  assert(css.includes('central-auto-repair-logo-dark-128.png') && css.includes('central-auto-repair-logo-dark-256.png'), 'site CSS must reference responsive dark logo variants');
  assert(!css.includes('Barlow Semi Condensed'), 'retired display font remains in site CSS');
}

async function verifyGuideImageAssets() {
  assert(guideContent.guides.length === 11, `guide image contract expected 11 guides, found ${guideContent.guides.length}`);
  assert(
    guideContent.guides.every((guide) => guide.image === true),
    `every service guide must opt into editorial artwork; missing: ${guideContent.guides.filter((guide) => guide.image !== true).map((guide) => guide.id).join(', ')}`,
  );

  const guideCss = fs.readFileSync(path.join(projectRoot, 'site', 'assets', 'css', 'service-guides.css'), 'utf8');
  assert(!guideCss.includes('.guide-visual--diagram'), 'retired CSS diagram placeholder remains in service-guides.css');
  assert(!guideCss.includes('.guide-diagram__sigil'), 'retired CSS diagram sigil remains in service-guides.css');

  for (const guide of guideContent.guides) {
    const englishAlt = guide.copy?.en?.visualAlt?.trim();
    const spanishAlt = guide.copy?.es?.visualAlt?.trim();
    assert(englishAlt && englishAlt.length >= 24, `${guide.id}: English narrative image alt text is missing or unhelpful`);
    assert(spanishAlt && spanishAlt.length >= 24, `${guide.id}: Spanish narrative image alt text is missing or unhelpful`);
    assert(normalize(englishAlt) !== normalize(spanishAlt), `${guide.id}: image alt text is not localized by locale`);

    for (const width of guideImageWidths) {
      const imagePath = path.join(guideImageDirectory, `${guide.id}-editorial-${width}.webp`);
      assert(fs.existsSync(imagePath), `${guide.id}: missing ${width}px editorial image asset`);
      const [metadata, fileStats] = await Promise.all([sharp(imagePath).metadata(), fs.promises.stat(imagePath)]);
      assert(metadata.format === 'webp', `${guide.id} ${width}px: image must be WebP, found ${metadata.format}`);
      assert(metadata.width === width, `${guide.id} ${width}px: expected ${width}px width, found ${metadata.width}`);
      assert(metadata.height === width * 5 / 8, `${guide.id} ${width}px: expected an 8:5 crop, found ${metadata.width}x${metadata.height}`);
      assert(
        fileStats.size <= maxGuideImageBytes[width],
        `${guide.id} ${width}px: ${Math.ceil(fileStats.size / 1024)} KB exceeds the ${maxGuideImageBytes[width] / 1024} KB performance ceiling`,
      );
    }
  }
}

async function verifyDocument(page, entry, viewport) {
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  const response = await page.goto(`${baseUrl}${entry.route}`, { waitUntil: 'networkidle', timeout: 60000 });
  assert(response && response.ok(), `${entry.name} @ ${viewport.name}: expected successful HTTP response`);
  assert(await page.locator('main').count() === 1, `${entry.name}: expected one main landmark`);
  assert(await page.locator('h1').count() === 1, `${entry.name}: expected one h1`);
  assert((await page.title()).trim().length > 0, `${entry.name}: missing document title`);
  assert(await page.locator('link[rel="icon"][href="/assets/icons/favicon-32.png"][sizes="32x32"]').count() === 1, `${entry.name}: missing production favicon link`);
  assert(await page.locator('link[rel="apple-touch-icon"][href="/assets/icons/apple-touch-icon-180.png"][sizes="180x180"]').count() === 1, `${entry.name}: missing Apple touch icon link`);
  await page.evaluate(() => document.fonts.ready);

  const brandStyle = await page.locator('.brand__mark').first().evaluate((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return { backgroundImage: style.backgroundImage, width: rect.width, height: rect.height };
  });
  assert(
    brandStyle.backgroundImage.includes('central-auto-repair-logo-dark-128.png')
      && brandStyle.backgroundImage.includes('central-auto-repair-logo-dark-256.png'),
    `${entry.name}: responsive dark-surface logos are not applied to the brand mark`,
  );
  assert(brandStyle.width >= 48 && brandStyle.height >= 48, `${entry.name}: logo is too small for the verified responsive treatment`);

  const headingStyle = await page.locator('h1').evaluate((element) => {
    const style = getComputedStyle(element);
    return { fontFamily: style.fontFamily, letterSpacing: style.letterSpacing };
  });
  assert(headingStyle.fontFamily.includes('Saira Condensed'), `${entry.name}: h1 is not using the selected display typeface`);
  const numericTracking = Number.parseFloat(headingStyle.letterSpacing);
  assert(headingStyle.letterSpacing === 'normal' || (Number.isFinite(numericTracking) && numericTracking >= 0), `${entry.name}: h1 tracking is negative or unresolved (${headingStyle.letterSpacing})`);

  const dimensions = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  const overflowElements = dimensions.scrollWidth > dimensions.innerWidth + 1
    ? await page.locator('html, body, body *').evaluateAll((elements) => elements
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { selector: `${element.tagName.toLowerCase()}.${element.className || ''}`, left: rect.left, right: rect.right, width: rect.width, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth };
      })
      .filter((item) => item.right > window.innerWidth + 1 || item.left < -1 || item.scrollWidth > item.clientWidth + 1)
      .slice(0, 12))
    : [];
  assert(
    dimensions.scrollWidth <= dimensions.innerWidth + 1,
    `${entry.name} @ ${viewport.name}: horizontal overflow ${dimensions.scrollWidth}px > ${dimensions.innerWidth}px; offenders: ${JSON.stringify(overflowElements)}`,
  );

  const headingLevels = await page.locator('h1, h2, h3, h4, h5, h6').evaluateAll((headings) =>
    headings.map((heading) => Number(heading.tagName.slice(1))),
  );
  for (let index = 1; index < headingLevels.length; index += 1) {
    assert(
      headingLevels[index] <= headingLevels[index - 1] + 1,
      `${entry.name}: heading level skips from h${headingLevels[index - 1]} to h${headingLevels[index]}`,
    );
  }

  const imagesWithoutAlt = await page.locator('img:not([alt])').count();
  assert(imagesWithoutAlt === 0, `${entry.name}: ${imagesWithoutAlt} image(s) missing alt attributes`);

  const bodyText = normalize(await page.locator('body').innerText());
  for (const excludedTerm of ['wheel alignment', 'four-wheel alignment', 'two-wheel alignment', 'auto glass', 'glass replacement', 'weathertech']) {
    assert(!bodyText.includes(excludedTerm), `${entry.name}: excluded service appears in public copy: ${excludedTerm}`);
  }

  assert(bodyText.includes('732-822-4534'), `${entry.name}: approved phone number is missing`);
  assert(await page.locator('a[href="tel:+17328224534"]').count() > 0, `${entry.name}: telephone link is missing`);

  const targetSelector = viewport.width <= 600
    ? 'button:visible, .button:visible, .header-cta:visible, .mobile-actions a:visible, .footer-column a:visible, .site-footer__legal a:visible'
    : 'button:visible, .button:visible, .header-cta:visible, .mobile-actions a:visible';
  const targetFailures = await page.locator(targetSelector).evaluateAll((elements) =>
    elements
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { label: element.getAttribute('aria-label') || element.textContent.trim(), width: rect.width, height: rect.height };
      })
      .filter((item) => item.width < 44 || item.height < 44),
  );
  assert(targetFailures.length === 0, `${entry.name}: undersized control targets: ${JSON.stringify(targetFailures)}`);

  assert(consoleErrors.length === 0, `${entry.name}: console errors: ${consoleErrors.join(' | ')}`);
  assert(pageErrors.length === 0, `${entry.name}: page errors: ${pageErrors.join(' | ')}`);
}

async function verifyMobileNavigation(page, viewport) {
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  const menuButton = page.locator('[data-menu-button]');
  const backToTop = page.locator('[data-back-to-top]');
  assert(await menuButton.isVisible(), `home @ ${viewport.name}: menu button is not visible`);
  const initialBackToTop = await backToTop.evaluate((element) => ({
    ariaHidden: element.getAttribute('aria-hidden'),
    inert: element.inert,
    tabIndex: element.tabIndex,
    visibility: getComputedStyle(element).visibility,
  }));
  assert(
    initialBackToTop.ariaHidden === 'true' && initialBackToTop.inert && initialBackToTop.tabIndex === -1 && initialBackToTop.visibility === 'hidden',
    `hidden Back to Top remained available: ${JSON.stringify(initialBackToTop)}`,
  );

  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForFunction(() => document.querySelector('[data-back-to-top]')?.classList.contains('is-visible'));
  await menuButton.click();
  assert(await menuButton.getAttribute('aria-expanded') === 'true', 'mobile menu did not expose expanded state');
  assert(await page.locator('[data-nav-drawer]').getAttribute('aria-hidden') === 'false', 'mobile drawer remained aria-hidden');
  await page.waitForFunction(() => document.activeElement?.getAttribute('href') === '/services/');
  const isolationState = await page.evaluate(() => {
    const drawer = document.querySelector('[data-nav-drawer]');
    const header = document.querySelector('.site-header');
    const actions = document.querySelector('.mobile-actions');
    const topButton = document.querySelector('[data-back-to-top]');
    return {
      bodyOpen: document.body.classList.contains('nav-open'),
      mainInert: document.querySelector('main')?.inert,
      footerInert: document.querySelector('.site-footer')?.inert,
      brandInert: document.querySelector('.site-header .brand')?.inert,
      actionsInert: actions?.inert,
      actionsVisibility: actions ? getComputedStyle(actions).visibility : null,
      backInert: topButton?.inert,
      backAriaHidden: topButton?.getAttribute('aria-hidden'),
      drawerTop: drawer?.getBoundingClientRect().top,
      headerBottom: header?.getBoundingClientRect().bottom,
    };
  });
  assert(
    isolationState.bodyOpen && isolationState.mainInert && isolationState.footerInert
      && isolationState.brandInert && isolationState.actionsInert && isolationState.backInert
      && isolationState.backAriaHidden === 'true',
    `mobile modal did not isolate background controls: ${JSON.stringify(isolationState)}`,
  );
  if (viewport.width <= 600) {
    assert(isolationState.actionsVisibility === 'hidden', `mobile action rail remained visible over modal: ${JSON.stringify(isolationState)}`);
  }
  assert(
    Math.abs(isolationState.drawerTop - isolationState.headerBottom) <= 1,
    `mobile drawer offset missed sticky header: ${JSON.stringify(isolationState)}`,
  );
  const focusedState = await page.evaluate(() => ({
    href: document.activeElement?.getAttribute('href'),
    tag: document.activeElement?.tagName,
    className: document.activeElement?.className,
    firstLinkRects: document.querySelector('[data-nav-drawer] a')?.getClientRects().length,
    drawerInert: document.querySelector('[data-nav-drawer]')?.inert,
  }));
  assert(focusedState.href === '/services/', `mobile menu did not focus first link: ${JSON.stringify(focusedState)}`);
  await page.keyboard.press('Escape');
  assert(await menuButton.getAttribute('aria-expanded') === 'false', 'Escape did not close mobile menu');
  assert(await menuButton.evaluate((element) => element === document.activeElement), 'menu focus was not restored after Escape');
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForFunction(() => document.querySelector('[data-back-to-top]')?.getAttribute('aria-hidden') === 'false');
  assert(!(await page.locator('main').evaluate((element) => element.inert)), 'page remained inert after the mobile menu closed');
  await backToTop.click();
  await page.waitForFunction(() => window.scrollY === 0 && document.querySelector('[data-back-to-top]')?.getAttribute('aria-hidden') === 'true');
  const backToTopResult = await page.evaluate(() => ({
    activeTag: document.activeElement?.tagName,
    activeText: document.activeElement?.textContent?.trim(),
    ariaHidden: document.querySelector('[data-back-to-top]')?.getAttribute('aria-hidden'),
    tabIndex: document.querySelector('[data-back-to-top]')?.tabIndex,
  }));
  assert(
    backToTopResult.activeTag === 'H1' && backToTopResult.ariaHidden === 'true' && backToTopResult.tabIndex === -1,
    `Back to Top did not restore meaningful focus: ${JSON.stringify(backToTopResult)}`,
  );
}

async function verifyServiceInventory(page) {
  await page.goto(`${baseUrl}/services/`, { waitUntil: 'networkidle' });
  const groupCount = await page.locator('[data-service-group]').count();
  assert(groupCount === inventory.categories.length, `service category count ${groupCount} did not match ${inventory.categories.length}`);

  const expectedItems = inventory.categories.flatMap((category) => category.items).map(normalize).sort();
  const renderedItems = (await page.locator('.service-list li').evaluateAll((items) => items.map((item) => item.textContent || ''))).map(normalize).sort();
  assert(renderedItems.length === inventory.publishedItemCount, `rendered ${renderedItems.length} service items, expected ${inventory.publishedItemCount}`);
  assert(JSON.stringify(renderedItems) === JSON.stringify(expectedItems), 'rendered service inventory does not exactly match data/services.json');

  const filter = page.locator('[data-service-filter]');
  await filter.fill('battery');
  assert(await page.locator('[data-service-group]:visible').count() === 1, 'battery search should return one service category');
  assert((await page.locator('[data-service-count]').innerText()).includes('1 category'), 'service result count did not update');

  await filter.fill('brakes');
  assert(await page.locator('[data-service-group]:visible').count() === 1, 'plural brakes search should return one service category');
  assert(await page.locator('#brakes').getAttribute('open') !== null, 'plural brakes search should open the matching category');

  await filter.fill('Brake Rotor Replacement');
  assert(await page.locator('[data-service-group]:visible').count() === 1, 'exact service-name search should return one service category');
  assert(await page.locator('#brakes').getAttribute('open') !== null, 'exact brake service search should open the matching category');

  await filter.fill('30,000 Mile Service');
  assert(await page.locator('[data-service-group]:visible').count() === 1, 'mileage service search should return one service category');
  assert(await page.locator('#maintenance').getAttribute('open') !== null, 'mileage service search should open maintenance');

  await filter.fill('alternator replacement');
  assert(await page.locator('[data-service-group]:visible').count() === 1, 'component service search should return one service category');
  assert(await page.locator('#battery').getAttribute('open') !== null, 'alternator search should open starting and charging');

  await filter.fill('');
  assert(await page.locator('[data-service-group]:visible').count() === inventory.categories.length, 'clearing search did not restore all categories');

  await page.goto(`${baseUrl}/services/#brakes`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => {
    const target = document.querySelector('#brakes');
    if (!target?.open) return false;
    const rect = target.getBoundingClientRect();
    return rect.top >= 0 && rect.top < window.innerHeight;
  });
  const initialHashTarget = await page.locator('#brakes').evaluate((element) => ({
    open: element.open,
    top: element.getBoundingClientRect().top,
    viewportHeight: window.innerHeight,
  }));
  assert(
    initialHashTarget.open && initialHashTarget.top >= 0 && initialHashTarget.top < initialHashTarget.viewportHeight,
    `initial service hash target was not opened and revealed: ${JSON.stringify(initialHashTarget)}`,
  );

  await page.evaluate(() => { window.location.hash = '#tires'; });
  await page.waitForFunction(() => document.querySelector('#tires')?.open && document.activeElement === document.querySelector('#tires summary'));
}

async function verifyCustomerJourneyStructure(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();

  for (const route of ['/', '/es/']) {
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
    const symptomLinks = await page.locator('.symptom-entry .service-preview-card').evaluateAll((links) => links.map((link) => link.getAttribute('href')));
    assert(symptomLinks.length === 6, `${route}: homepage should show six symptom starting points`);
    assert(symptomLinks.every((href) => href && href.startsWith('/') && !href.includes('#')), `${route}: every homepage symptom should lead to a dedicated guide`);
    assert(await page.locator('.service-link-list a').count() === 8, `${route}: homepage should use eight compact service-area links`);
  }

  for (const route of ['/services/', '/es/servicios/']) {
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
    const structure = await page.evaluate(() => {
      const catalog = document.querySelector('#all-services');
      const guides = document.querySelector('#service-guides');
      return {
        firstSectionId: document.querySelector('main > section')?.id,
        catalogTop: catalog?.getBoundingClientRect().top + window.scrollY,
        finderTop: document.querySelector('[data-service-filter]')?.getBoundingClientRect().top + window.scrollY,
        guidesTop: guides?.getBoundingClientRect().top + window.scrollY,
      };
    });
    assert(structure.firstSectionId === 'all-services', `${route}: searchable service catalog should be the first section after the hero`);
    assert(structure.catalogTop < structure.guidesTop && structure.finderTop < structure.guidesTop, `${route}: service search should appear before the guide directory`);
    assert(await page.locator('.symptom-shortcuts a').count() === 6, `${route}: services page should show six compact symptom shortcuts`);
    assert(await page.locator('#service-guides .service-link-list a').count() === 12, `${route}: services page should show twelve compact service-area links`);
    assert(await page.locator('[data-service-group] .text-link').count() === 17, `${route}: every service category should provide an explicit next step`);
  }

  for (const route of ['/services/brakes/', '/es/servicios/frenos/']) {
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
    const order = await page.evaluate(() => {
      const sections = [...document.querySelectorAll('main > section')];
      const indexOf = (selector) => sections.findIndex((section) => section.matches(selector));
      return {
        services: indexOf('.guide-services'),
        prepare: indexOf('.guide-prepare'),
        cues: indexOf('[aria-labelledby="cues-title"]'),
        system: indexOf('.guide-system'),
        faq: indexOf('[aria-labelledby="faq-title"]'),
      };
    });
    assert(
      order.services < order.prepare && order.prepare < order.cues && order.cues < order.system && order.system < order.faq,
      `${route}: guide should prioritize published services and safety before education (${JSON.stringify(order)})`,
    );
    assert((await page.locator('.guide-hero .button--outline').getAttribute('href')).endsWith('#all-services'), `${route}: guide should return to the searchable catalog`);
  }

  await context.close();
}

async function verifyRepeatedCardAlignment(browser) {
  const assertAligned = (values, label) => {
    const spread = Math.max(...values) - Math.min(...values);
    assert(spread <= 1, `${label} differed by ${spread}px: ${JSON.stringify(values)}`);
  };

  for (const viewport of [{ width: 320, height: 720 }, { width: 840, height: 900 }, { width: 1081, height: 900 }, { width: 1440, height: 900 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    const page = await context.newPage();

    for (const route of ['/', '/es/']) {
      await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
      const metrics = await page.locator('.symptom-entry .service-preview-card').evaluateAll((cards) => cards.map((card) => {
        const cardRect = card.getBoundingClientRect();
        const titleRect = card.querySelector('h3').getBoundingClientRect();
        const paragraphRect = card.querySelector('p').getBoundingClientRect();
        const actionRect = card.querySelector('.service-preview-card__action').getBoundingClientRect();
        return {
          height: Math.round(cardRect.height),
          titleTop: Math.round(titleRect.top - cardRect.top),
          paragraphTop: Math.round(paragraphRect.top - cardRect.top),
          actionTop: Math.round(actionRect.top - cardRect.top),
        };
      }));
      assertAligned(metrics.map((metric) => metric.height), `${route} symptom-card heights at ${viewport.width}px`);
      assertAligned(metrics.map((metric) => metric.titleTop), `${route} symptom-card title lanes at ${viewport.width}px`);
      assertAligned(metrics.map((metric) => metric.paragraphTop), `${route} symptom-card description lanes at ${viewport.width}px`);
      assertAligned(metrics.map((metric) => metric.actionTop), `${route} symptom-card action lanes at ${viewport.width}px`);
    }

    await context.close();
  }

  const context = await browser.newContext({ viewport: { width: 1024, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/es/servicios/frenos/`, { waitUntil: 'networkidle' });
  const relatedMetrics = await page.locator('.guide-related .service-preview-card').evaluateAll((cards) => cards.map((card) => {
    const cardRect = card.getBoundingClientRect();
    return {
      titleTop: Math.round(card.querySelector('h3').getBoundingClientRect().top - cardRect.top),
      paragraphTop: Math.round(card.querySelector('p').getBoundingClientRect().top - cardRect.top),
    };
  }));
  assertAligned(relatedMetrics.map((metric) => metric.titleTop), 'Spanish related-guide title lanes');
  assertAligned(relatedMetrics.map((metric) => metric.paragraphTop), 'Spanish related-guide action lanes');

  await page.goto(`${baseUrl}/es/servicios/bateria-sistema-electrico/`, { waitUntil: 'networkidle' });
  const cueParagraphTops = await page.locator('.guide-cue').evaluateAll((cards) => cards.map((card) => {
    const cardRect = card.getBoundingClientRect();
    return Math.round(card.querySelector('p').getBoundingClientRect().top - cardRect.top);
  }));
  assertAligned(cueParagraphTops, 'Spanish guide-cue description lanes');
  await context.close();

  const narrowContext = await browser.newContext({ viewport: { width: 560, height: 800 }, reducedMotion: 'reduce' });
  const narrowPage = await narrowContext.newPage();
  await narrowPage.goto(`${baseUrl}/services/brakes/`, { waitUntil: 'networkidle' });
  const cueColumnCount = await narrowPage.locator('.guide-cues').evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(' ').length);
  assert(cueColumnCount === 1, `guide cues should use one column at 560px, found ${cueColumnCount}`);
  await narrowContext.close();
}

async function verifyInteractionAccessibility(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();

  await page.goto(`${baseUrl}/contact/`, { waitUntil: 'networkidle' });
  const darkProcessColors = await page.locator('.section--raised .process-step').first().evaluate((element) => {
    const section = element.closest('.section--raised');
    return {
      background: getComputedStyle(section).backgroundColor,
      paragraph: getComputedStyle(element.querySelector('p')).color,
      number: getComputedStyle(element.querySelector('.process-step__number')).color,
      border: getComputedStyle(element).borderTopColor,
    };
  });
  const processBackground = parseCssColor(darkProcessColors.background);
  const processParagraph = parseCssColor(darkProcessColors.paragraph);
  const processNumber = parseCssColor(darkProcessColors.number);
  const processBorder = parseCssColor(darkProcessColors.border);
  assert(
    contrastRatioRgb(processParagraph.rgb, processBackground.rgb) >= 4.5,
    `dark process paragraph contrast failed: ${JSON.stringify(darkProcessColors)}`,
  );
  assert(
    contrastRatioRgb(processNumber.rgb, processBackground.rgb) >= 4.5,
    `dark process number contrast failed: ${JSON.stringify(darkProcessColors)}`,
  );
  assert(
    contrastRatioRgb(compositeColor(processBorder, processBackground), processBackground.rgb) >= 3,
    `dark process border contrast failed: ${JSON.stringify(darkProcessColors)}`,
  );

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  const previewCard = page.locator('.service-preview-card').first();
  await previewCard.hover();
  const cardHoverColors = await previewCard.evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    index: getComputedStyle(element.querySelector('.service-preview-card__index')).color,
    body: getComputedStyle(element.querySelector('p')).color,
  }));
  const cardBackground = parseCssColor(cardHoverColors.background);
  assert(contrastRatioRgb(parseCssColor(cardHoverColors.index).rgb, cardBackground.rgb) >= 4.5, `card hover index contrast failed: ${JSON.stringify(cardHoverColors)}`);
  assert(contrastRatioRgb(parseCssColor(cardHoverColors.body).rgb, cardBackground.rgb) >= 4.5, `card hover body contrast failed: ${JSON.stringify(cardHoverColors)}`);

  const outlineButton = page.locator('.hero__actions .button--outline').first();
  await outlineButton.hover();
  const buttonHoverColors = await outlineButton.evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    color: getComputedStyle(element).color,
  }));
  assert(
    contrastRatioRgb(parseCssColor(buttonHoverColors.color).rgb, parseCssColor(buttonHoverColors.background).rgb) >= 4.5,
    `outline button hover contrast failed: ${JSON.stringify(buttonHoverColors)}`,
  );

  await context.close();
}

async function verifyLowHeightHero(browser) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  const ctaRects = await page.locator('.hero__actions .button').evaluateAll((buttons) => buttons.map((button) => {
    const rect = button.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, viewportHeight: window.innerHeight };
  }));
  assert(
    ctaRects.length >= 2 && ctaRects.every((rect) => rect.top >= 0 && rect.bottom <= rect.viewportHeight),
    `low-height desktop hero CTAs were clipped: ${JSON.stringify(ctaRects)}`,
  );
  await context.close();
}

async function verifyLocalizedChrome(page, localeCode, label) {
  assert(await page.locator('html').getAttribute('lang') === localeCode, `${label}: html lang must be ${localeCode}`);

  const navigationText = normalize(await page.locator('.desktop-nav').textContent());
  const footer = page.locator('.site-footer');
  const footerText = await footer.count() ? normalize(await footer.textContent()) : '';
  const chromeText = normalize(await page.locator('header, footer, .mobile-actions, main .button, [data-back-to-top]').allTextContents().then((items) => items.join(' ')));
  const chromeLabels = normalize(await page.locator('header [aria-label], footer [aria-label], .mobile-actions[aria-label], main .button[aria-label], [data-back-to-top][aria-label]').evaluateAll((elements) => elements
    .map((element) => element.getAttribute('aria-label'))
    .filter(Boolean)
    .join(' ')));

  if (localeCode === 'es-US') {
    for (const expected of ['servicios', 'nosotros', 'contacto']) {
      assert(navigationText.includes(expected), `${label}: Spanish primary navigation is missing “${expected}”`);
    }
    if (await footer.count()) assert(footerText.includes('privacidad'), `${label}: Spanish footer is missing “Privacidad”`);
    for (const forbidden of [
      /\bservices\b/i,
      /\babout\b/i,
      /\bcontact\b/i,
      /\bprivacy\b/i,
      /\bcall the shop\b/i,
      /\bget directions\b/i,
      /\ball rights reserved\b/i,
      /\bback to top\b/i,
      /\breturn home\b/i,
      /\bask about\b/i,
      /\bopen navigation menu\b/i,
      /\bsite navigation\b/i,
      /\bprimary navigation\b/i,
      /\bfooter navigation\b/i,
      /\bchoose a language\b/i,
      /\blanguage: spanish\b/i,
      /\bcentral auto repair home\b/i,
      /\bcall central auto repair\b/i,
      /\bquick actions\b/i,
    ]) {
      assert(!forbidden.test(`${chromeText} ${chromeLabels}`), `${label}: English chrome/CTA phrase remains (${forbidden})`);
    }
  } else {
    for (const expected of ['services', 'about', 'contact']) {
      assert(navigationText.includes(expected), `${label}: English primary navigation is missing “${expected}”`);
    }
    if (await footer.count()) assert(footerText.includes('privacy'), `${label}: English footer is missing “Privacy”`);
  }
}

async function verifyLocaleMapping(page, pair, route, label) {
  const locale = localeForRoute(pair, route);
  const alternates = await page.locator('head link[rel~="alternate"][hreflang]').evaluateAll((links) => links.map((link) => ({
    hreflang: link.getAttribute('hreflang'),
    href: link.getAttribute('href'),
  })));
  const expectedAlternates = [
    ['en-US', pair.en],
    ['es-US', pair.es],
    ['x-default', pair.en],
  ];
  for (const [hreflang, href] of expectedAlternates) {
    assert(
      alternates.some((alternate) => alternate.hreflang === hreflang && alternate.href === href),
      `${label}: missing relative ${hreflang} alternate ${href}; found ${JSON.stringify(alternates)}`,
    );
  }
  assert(alternates.every((alternate) => alternate.href?.startsWith('/') && !alternate.href.startsWith('//')), `${label}: alternate links must use root-relative paths`);

  const selector = page.locator('[data-locale-selector]');
  const toggle = selector.locator('[data-locale-toggle]');
  const menu = selector.locator('[data-locale-menu]');
  assert(await selector.count() === 1, `${label}: expected one compact language selector`);
  assert(await toggle.count() === 1, `${label}: locale selector is missing its toggle`);
  assert(await menu.count() === 1, `${label}: locale selector is missing its menu`);
  assert((await toggle.textContent()).toUpperCase().includes(locale.shortCode), `${label}: locale toggle does not show ${locale.shortCode}`);

  for (const [hreflang, href] of [['en-US', pair.en], ['es-US', pair.es]]) {
    assert(
      await menu.locator(`a[hreflang="${hreflang}"][href="${href}"]`).count() === 1,
      `${label}: selector does not map ${hreflang} to the equivalent route ${href}`,
    );
  }
  assert(
    await menu.locator('a[hreflang]').count() === localeRegistry.locales.length,
    `${label}: selector choices do not match the locale registry`,
  );
}

async function verifyLocaleSelectorInteraction(page, pair, route, label) {
  const locale = localeForRoute(pair, route);
  const selector = page.locator('[data-locale-selector]');
  const toggle = selector.locator('[data-locale-toggle]');
  const menu = selector.locator('[data-locale-menu]');
  const toggleBox = await toggle.boundingBox();
  assert(toggleBox && toggleBox.width >= 44 && toggleBox.height >= 44, `${label}: locale target is smaller than 44px (${JSON.stringify(toggleBox)})`);
  const semantics = await toggle.evaluate((element) => ({
    tagName: element.tagName,
    ariaLabel: element.getAttribute('aria-label'),
    ariaHaspopup: element.getAttribute('aria-haspopup'),
  }));
  assert(
    semantics.tagName === 'SUMMARY' || semantics.ariaHaspopup === 'menu',
    `${label}: locale control must use native details/summary or expose aria-haspopup=menu`,
  );
  assert(semantics.ariaLabel && normalize(semantics.ariaLabel).includes(locale.code.split('-')[0]), `${label}: locale toggle label does not identify the current language`);

  await toggle.focus();
  await page.keyboard.press('Enter');
  assert(await toggle.evaluate(selectorOpenState), `${label}: Enter did not open the language menu`);
  assert(await menu.isVisible(), `${label}: opened language menu is not visible`);
  assert(await menu.locator('a[hreflang]').count() >= 2, `${label}: opened language menu has fewer than two locale choices`);

  await page.keyboard.press('Escape');
  assert(!(await toggle.evaluate(selectorOpenState)), `${label}: Escape did not close the language menu`);
  assert(await toggle.evaluate((element) => element === document.activeElement), `${label}: Escape did not restore focus to the language toggle`);

  await page.keyboard.press('Enter');
  assert(await toggle.evaluate(selectorOpenState), `${label}: language menu did not reopen`);
  await page.locator('main h1').click({ position: { x: 4, y: 4 } });
  assert(!(await toggle.evaluate(selectorOpenState)), `${label}: outside click did not close the language menu`);
}

async function verifyTpmsNavigationPlacement(page) {
  for (const { route, tpmsRoute, label } of [
    { route: '/services/', tpmsRoute: '/tpms-programming/', label: 'English services' },
    { route: '/es/servicios/', tpmsRoute: '/es/servicios/programacion-tpms/', label: 'Spanish services' },
  ]) {
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
    await verifyTpmsAbsentFromPrimary(page, tpmsRoute, label);
    assert(await page.locator(`main a[href="${tpmsRoute}"]`).count() > 0, `${label}: TPMS is not reachable from contextual service content`);
  }
}

async function verifyTpmsAbsentFromPrimary(page, tpmsRoute, label) {
  assert(await page.locator(`.desktop-nav a[href="${tpmsRoute}"]`).count() === 0, `${label}: TPMS remains in desktop primary navigation`);
  assert(await page.locator(`[data-nav-drawer] a[href="${tpmsRoute}"]`).count() === 0, `${label}: TPMS remains in mobile primary navigation`);
}

async function verifyLocalizedCore(browser) {
  const registryKeys = { home: 'home', services: 'services', tpms: 'tpms', about: 'about', contact: 'contact', privacy: 'privacy', 404: 'notFound' };
  for (const pair of coreLocalePairs) {
    const registered = localeRegistry.routes[registryKeys[pair.name]];
    assert(registered?.['en-US'] === pair.en && registered?.['es-US'] === pair.es, `${pair.name}: data/locales.json does not match the core route contract`);
  }
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  for (const pair of coreLocalePairs) {
    for (const route of [pair.en, pair.es]) {
      const locale = localeForRoute(pair, route);
      const label = `${pair.name} ${locale.code}`;
      const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
      assert(response && response.ok(), `${label}: expected successful HTTP response`);
      assert(new URL(page.url()).pathname === route, `${label}: locale route unexpectedly redirected to ${new URL(page.url()).pathname}`);
      await verifyLocalizedChrome(page, locale.code, label);
      await verifyLocaleMapping(page, pair, route, label);
      await verifyTpmsAbsentFromPrimary(page, locale.code === 'es-US' ? coreLocalePairs[2].es : coreLocalePairs[2].en, label);
      await verifyLocaleSelectorInteraction(page, pair, route, label);
    }
  }
  await verifyTpmsNavigationPlacement(page);
  await context.close();
}

async function verifyInternalLinksOnPage(page, route, checkedRoutes) {
  const internalLinks = await page.locator('a[href^="/"]').evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute('href')))]);
  for (const href of internalLinks) {
    const pathOnly = href.split('#')[0] || route;
    if (checkedRoutes.has(pathOnly)) continue;
    checkedRoutes.add(pathOnly);
    const response = await page.request.get(`${baseUrl}${pathOnly}`);
    assert(response.ok(), `${route}: internal link ${href} returned ${response.status()}`);
  }
}

async function verifyGuidePages(browser) {
  assert(guideLocalePairs.length * 2 === 22, 'guide route contract must contain exactly 22 localized pages');
  assert(guideContent.guides.length === 11, `service guide data must contain 11 guides, found ${guideContent.guides.length}`);
  assert(
    JSON.stringify(guideContent.guides.map((guide) => guide.id).sort()) === JSON.stringify(guideLocalePairs.map((pair) => pair.name).sort()),
    'service guide data IDs do not match the 22-route contract',
  );
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const checkedRoutes = new Set();

  for (const pair of guideLocalePairs) {
    for (const route of [pair.en, pair.es]) {
      const locale = localeForRoute(pair, route);
      const label = `${pair.name} ${locale.code}`;
      const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
      assert(response && response.ok(), `${label}: expected successful HTTP response`);
      assert(new URL(page.url()).pathname === route, `${label}: guide route unexpectedly redirected to ${new URL(page.url()).pathname}`);
      assert(await page.locator('main').count() === 1, `${label}: expected one main landmark`);
      assert(await page.locator('h1').count() === 1, `${label}: expected one h1`);
      assert((await page.title()).trim().length >= 18, `${label}: document title is not descriptive`);
      const description = (await page.locator('meta[name="description"]').getAttribute('content')) || '';
      assert(description.trim().length >= 70, `${label}: meta description is missing or too short (${description.trim().length} characters)`);

      const guide = guideById.get(pair.name);
      const copyKey = locale.code === 'en-US' ? 'en' : 'es';
      const expectedSmallSrc = `/assets/images/guides/${pair.name}-editorial-768.webp`;
      const expectedLargeSrc = `/assets/images/guides/${pair.name}-editorial-1280.webp`;
      const visual = page.locator('.guide-system .guide-visual--image');
      assert(await visual.count() === 1, `${label}: expected exactly one narrative system visual`);
      assert(await page.locator('.guide-system .guide-visual--diagram').count() === 0, `${label}: retired CSS diagram placeholder remains in the guide`);
      assert(await visual.locator('picture').count() === 1, `${label}: narrative visual must contain exactly one picture element`);
      assert(await visual.locator('picture > source').count() === 1, `${label}: narrative picture must contain exactly one responsive source`);
      assert(await visual.locator('picture > img').count() === 1, `${label}: narrative picture must contain exactly one img fallback`);
      const pictureContract = await visual.locator('picture').evaluate((picture) => {
        const source = picture.querySelector(':scope > source');
        const image = picture.querySelector(':scope > img');
        return {
          sourceMedia: source?.getAttribute('media'),
          sourceSrcset: source?.getAttribute('srcset'),
          imageSrc: image?.getAttribute('src'),
          width: image?.getAttribute('width'),
          height: image?.getAttribute('height'),
          loading: image?.getAttribute('loading'),
          decoding: image?.getAttribute('decoding'),
          alt: image?.getAttribute('alt'),
        };
      });
      assert(pictureContract.sourceMedia === '(min-width: 769px)', `${label}: responsive image breakpoint changed (${pictureContract.sourceMedia})`);
      assert(pictureContract.sourceSrcset === expectedLargeSrc, `${label}: large source must be ${expectedLargeSrc}`);
      assert(pictureContract.imageSrc === expectedSmallSrc, `${label}: fallback image must be ${expectedSmallSrc}`);
      assert(pictureContract.width === '768' && pictureContract.height === '480', `${label}: image is missing the 768x480 intrinsic dimensions`);
      assert(pictureContract.loading === 'lazy', `${label}: below-the-fold guide image must use lazy loading`);
      assert(pictureContract.decoding === 'async', `${label}: guide image must use async decoding`);
      assert(pictureContract.alt === guide.copy[copyKey].visualAlt, `${label}: narrative image alt text does not match localized guide copy`);

      const mainText = await page.locator('main').innerText();
      for (const pattern of obviousPromisePatterns) {
        assert(!pattern.test(mainText), `${label}: guide contains an unsupported promise phrase (${pattern})`);
      }

      await verifyLocalizedChrome(page, locale.code, label);
      await verifyLocaleMapping(page, pair, route, label);
      await verifyTpmsAbsentFromPrimary(page, locale.code === 'es-US' ? coreLocalePairs[2].es : coreLocalePairs[2].en, label);
      await verifyInternalLinksOnPage(page, route, checkedRoutes);
    }
  }

  await context.close();
}

async function verifyGuideImageRendering(browser) {
  const renderViewports = [
    { name: 'phone-320', width: 320, height: 720 },
    { name: 'tablet-768', width: 768, height: 1024 },
    { name: 'desktop-1440', width: 1440, height: 900 },
  ];

  for (const viewport of renderViewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();

    for (const pair of guideLocalePairs) {
      for (const route of [pair.en, pair.es]) {
        const locale = localeForRoute(pair, route);
        const label = `${pair.name} ${locale.code} @ ${viewport.name}`;
        const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
        assert(response && response.ok(), `${label}: expected successful HTTP response`);
        const image = page.locator('.guide-system .guide-visual--image picture > img');
        assert(await image.count() === 1, `${label}: expected one narrative image`);
        await image.scrollIntoViewIfNeeded();
        await image.evaluate((element) => {
          if (element.complete) {
            if (element.naturalWidth > 0) return;
            throw new Error(`Image failed to load: ${element.currentSrc || element.src}`);
          }
          return new Promise((resolve, reject) => {
            element.addEventListener('load', resolve, { once: true });
            element.addEventListener('error', () => reject(new Error(`Image failed to load: ${element.currentSrc || element.src}`)), { once: true });
          });
        });
        const render = await image.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const visualRect = element.closest('.guide-visual')?.getBoundingClientRect();
          return {
            complete: element.complete,
            naturalWidth: element.naturalWidth,
            naturalHeight: element.naturalHeight,
            currentSrc: new URL(element.currentSrc).pathname,
            width: rect.width,
            height: rect.height,
            left: rect.left,
            right: rect.right,
            visualLeft: visualRect?.left,
            visualRight: visualRect?.right,
            viewportWidth: window.innerWidth,
            objectFit: getComputedStyle(element).objectFit,
          };
        });
        const expectedSourceWidth = viewport.width >= 769 ? 1280 : 768;
        assert(render.complete && render.naturalWidth > 0 && render.naturalHeight > 0, `${label}: narrative image did not load (${JSON.stringify(render)})`);
        assert(render.currentSrc === `/assets/images/guides/${pair.name}-editorial-${expectedSourceWidth}.webp`, `${label}: browser selected the wrong responsive source (${render.currentSrc})`);
        assert(Math.abs(render.naturalWidth / render.naturalHeight - 8 / 5) <= 0.001, `${label}: intrinsic image ratio is distorted (${render.naturalWidth}x${render.naturalHeight})`);
        assert(Math.abs(render.width / render.height - 8 / 5) <= 0.01, `${label}: rendered image ratio is distorted (${render.width}x${render.height})`);
        assert(render.objectFit === 'cover', `${label}: image must retain the intended cover treatment`);
        assert(render.left >= -1 && render.right <= render.viewportWidth + 1, `${label}: image overflows the viewport (${JSON.stringify(render)})`);
        assert(render.visualLeft >= -1 && render.visualRight <= render.viewportWidth + 1, `${label}: image frame overflows the viewport (${JSON.stringify(render)})`);
      }
    }

    await context.close();
  }
}

async function verifyGuideAccessibility(browser) {
  const sampleRoutes = [
    '/services/brakes/',
    '/es/servicios/diagnostico-motor/',
    '/services/cooling-overheating/',
  ];
  const sampleViewports = [
    { name: 'phone-320', width: 320, height: 720 },
    { name: 'tablet-768', width: 768, height: 1024 },
    { name: 'desktop-1440', width: 1440, height: 900 },
  ];

  for (const viewport of sampleViewports) {
    for (const route of sampleRoutes) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
      assert(response && response.ok(), `${route} @ ${viewport.name}: expected successful HTTP response`);

      const dimensions = await page.evaluate(() => ({
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      assert(
        dimensions.scrollWidth <= dimensions.innerWidth + 1,
        `${route} @ ${viewport.name}: horizontal overflow ${dimensions.scrollWidth}px > ${dimensions.innerWidth}px`,
      );

      const targetFailures = await page.locator('.button:visible, .header-cta:visible, [data-locale-toggle]:visible, [data-menu-button]:visible, .mobile-actions a:visible, .faq-list summary:visible').evaluateAll((elements) => elements
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return { label: element.getAttribute('aria-label') || element.textContent.trim(), width: rect.width, height: rect.height };
        })
        .filter((item) => item.width < 44 || item.height < 44));
      assert(targetFailures.length === 0, `${route} @ ${viewport.name}: undersized controls ${JSON.stringify(targetFailures)}`);

      const controlColors = await page.locator('.button:visible, .header-cta:visible, [data-locale-toggle]:visible').evaluateAll((elements) => elements.map((element) => {
        const parseColor = (value) => {
          const values = (value.match(/[\d.]+/g) || []).map(Number);
          return { rgb: values.slice(0, 3), alpha: values[3] ?? 1 };
        };
        let ancestor = element;
        let background = null;
        while (ancestor && !background) {
          const candidate = parseColor(getComputedStyle(ancestor).backgroundColor);
          if (candidate.rgb.length === 3 && candidate.alpha >= 0.95) background = candidate.rgb;
          ancestor = ancestor.parentElement;
        }
        return {
          label: element.getAttribute('aria-label') || element.textContent.trim(),
          foreground: parseColor(getComputedStyle(element).color).rgb,
          background,
        };
      }).filter((item) => item.background));
      assert(controlColors.length > 0, `${route} @ ${viewport.name}: no opaque control colors were available for contrast testing`);
      for (const colors of controlColors) {
        assert(
          contrastRatioRgb(colors.foreground, colors.background) >= 4.5,
          `${route} @ ${viewport.name}: control contrast failed for ${colors.label}: ${JSON.stringify(colors)}`,
        );
      }

      await page.evaluate(() => document.activeElement?.blur());
      let verifiedFocusCount = 0;
      for (let index = 0; index < 10; index += 1) {
        await page.keyboard.press('Tab');
        const focusState = await page.evaluate(() => {
          const element = document.activeElement;
          if (!element || element === document.body) return null;
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return {
            tagName: element.tagName,
            label: element.getAttribute('aria-label') || element.textContent?.trim(),
            width: rect.width,
            height: rect.height,
            outlineStyle: style.outlineStyle,
            outlineWidth: Number.parseFloat(style.outlineWidth),
            boxShadow: style.boxShadow,
          };
        });
        if (!focusState) continue;
        verifiedFocusCount += 1;
        assert(focusState.width > 0 && focusState.height > 0, `${route} @ ${viewport.name}: focus reached a hidden control ${JSON.stringify(focusState)}`);
        assert(
          (focusState.outlineStyle !== 'none' && focusState.outlineWidth >= 2) || focusState.boxShadow !== 'none',
          `${route} @ ${viewport.name}: focused control lacks a visible indicator ${JSON.stringify(focusState)}`,
        );
      }
      assert(verifiedFocusCount >= 6, `${route} @ ${viewport.name}: too few keyboard focus stops were verified (${verifiedFocusCount})`);
      await context.close();
    }
  }
}

async function verifyNoScriptLocaleSelector(browser) {
  for (const { route, counterpart, expectedLang } of [
    { route: '/services/', counterpart: '/es/servicios/', expectedLang: 'es-US' },
    { route: '/es/servicios/', counterpart: '/services/', expectedLang: 'en-US' },
  ]) {
    const context = await browser.newContext({ viewport: { width: 360, height: 800 }, javaScriptEnabled: false });
    const page = await context.newPage();
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'load' });
    assert(response && response.ok(), `${route}: no-script localized page failed to load`);
    const selector = page.locator('[data-locale-selector]');
    const toggle = selector.locator('[data-locale-toggle]');
    const menu = selector.locator('[data-locale-menu]');
    const fallbackLink = page.locator(`[data-locale-fallback] a[href="${counterpart}"]`);
    let counterpartLink;
    if (await fallbackLink.count() && await fallbackLink.isVisible()) {
      counterpartLink = fallbackLink;
    } else {
      assert(await toggle.isVisible(), `${route}: no-script locale toggle is not visible`);
      await toggle.click();
      assert(await menu.isVisible(), `${route}: native no-script locale menu did not open and no explicit fallback was provided`);
      counterpartLink = menu.locator(`a[href="${counterpart}"]`);
    }
    assert(await counterpartLink.isVisible(), `${route}: equivalent locale route is not available without JavaScript`);
    await counterpartLink.click();
    await page.waitForLoadState('load');
    assert(new URL(page.url()).pathname === counterpart, `${route}: no-script locale choice navigated to ${new URL(page.url()).pathname}`);
    assert(await page.locator('html').getAttribute('lang') === expectedLang, `${route}: no-script locale destination has wrong lang`);
    await context.close();
  }
}

async function verifyNoScriptFallback(browser) {
  const context = await browser.newContext({ viewport: { width: 360, height: 800 }, javaScriptEnabled: false });
  const page = await context.newPage();
  const response = await page.goto(`${baseUrl}/services/`, { waitUntil: 'load' });
  assert(response && response.ok(), 'no-script services page failed to load');
  assert(await page.locator('.desktop-nav').isVisible(), 'no-script mobile navigation fallback is not visible');
  assert(await page.locator('.service-list li').count() === inventory.publishedItemCount, 'service catalog is not server-rendered without JavaScript');
  await context.close();
}

async function verifyInternalRoutes(page) {
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  const routes = await page.locator('a[href^="/"]').evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute('href')))]);
  for (const route of routes) {
    const response = await page.request.get(`${baseUrl}${route}`);
    assert(response.ok(), `internal route failed: ${route} returned ${response.status()}`);
  }
}

async function run() {
  fs.mkdirSync(screenshotDirectory, { recursive: true });
  verifyDeploymentConfig();
  process.stdout.write('PASS Vercel and manifest configuration\n');
  verifyContrastTokens();
  process.stdout.write('PASS core color contrast tokens\n');
  await verifyBrandAssets();
  process.stdout.write('PASS official logo alpha and typography lock\n');
  await verifyGuideImageAssets();
  process.stdout.write('PASS 11 responsive guide image asset pairs and performance ceilings\n');
  const browser = await chromium.launch({ headless: true, executablePath: browserExecutable });

  try {
    if (localizationOnly) {
      await verifyLocalizedCore(browser);
      process.stdout.write('PASS scalable locale selector, core route parity, and TPMS navigation placement\n');
      await verifyCustomerJourneyStructure(browser);
      process.stdout.write('PASS bilingual customer-journey hierarchy and service-directory paths\n');
      await verifyRepeatedCardAlignment(browser);
      process.stdout.write('PASS repeated-card height and content-lane alignment\n');
      await verifyGuidePages(browser);
      process.stdout.write('PASS 22 localized service guides, metadata, claims, visuals, and internal links\n');
      await verifyGuideImageRendering(browser);
      process.stdout.write('PASS all 22 guide images load without distortion or overflow at 320/768/1440\n');
      await verifyGuideAccessibility(browser);
      process.stdout.write('PASS responsive guide overflow, target size, contrast, and keyboard focus\n');
      await verifyNoScriptLocaleSelector(browser);
      process.stdout.write('PASS no-script locale route selection\n');
      return;
    }

    for (const viewport of viewports) {
      for (const entry of pages) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          reducedMotion: 'reduce',
        });
        const page = await context.newPage();
        await verifyDocument(page, entry, viewport);

        if ((viewport.name === 'phone-390' || viewport.name === 'desktop-1440') && ['home', 'services', 'tpms', 'about', 'contact'].includes(entry.name)) {
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.screenshot({
            path: path.join(screenshotDirectory, `${entry.name}-${viewport.name}.png`),
            fullPage: viewport.name === 'phone-390',
          });
        }

        await context.close();
        process.stdout.write(`PASS ${entry.name} @ ${viewport.name}\n`);
      }

      if (viewport.width <= 1024) {
        const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, reducedMotion: 'reduce' });
        const page = await context.newPage();
        await verifyMobileNavigation(page, viewport);
        await context.close();
        process.stdout.write(`PASS mobile navigation @ ${viewport.name}\n`);
      }
    }

    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await verifyServiceInventory(page);
    await verifyInternalRoutes(page);
    await context.close();
    process.stdout.write('PASS exact service inventory and search\n');
    process.stdout.write('PASS internal routes\n');

    await verifyCustomerJourneyStructure(browser);
    process.stdout.write('PASS bilingual customer-journey hierarchy and service-directory paths\n');

    await verifyRepeatedCardAlignment(browser);
    process.stdout.write('PASS repeated-card height and content-lane alignment\n');

    await verifyInteractionAccessibility(browser);
    process.stdout.write('PASS interaction contrast and dark-section accessibility\n');
    await verifyLowHeightHero(browser);
    process.stdout.write('PASS low-height desktop hero CTA visibility\n');

    await verifyLocalizedCore(browser);
    process.stdout.write('PASS scalable locale selector, core route parity, and TPMS navigation placement\n');
    await verifyGuidePages(browser);
    process.stdout.write('PASS 22 localized service guides, metadata, claims, visuals, and internal links\n');
    await verifyGuideImageRendering(browser);
    process.stdout.write('PASS all 22 guide images load without distortion or overflow at 320/768/1440\n');
    await verifyGuideAccessibility(browser);
    process.stdout.write('PASS responsive guide overflow, target size, contrast, and keyboard focus\n');

    await verifyNoScriptFallback(browser);
    process.stdout.write('PASS no-script fallback\n');
    await verifyNoScriptLocaleSelector(browser);
    process.stdout.write('PASS no-script locale route selection\n');
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
