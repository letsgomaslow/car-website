const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const sharp = require('sharp');

const baseUrl = process.env.SITE_BASE_URL || 'http://127.0.0.1:4173';
const browserExecutable = process.env.PLAYWRIGHT_BROWSER_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const projectRoot = path.resolve(__dirname, '..');
const inventory = JSON.parse(fs.readFileSync(path.join(projectRoot, 'data', 'services.json'), 'utf8'));
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

function relativeLuminance(hexColor) {
  const channels = [1, 3, 5].map((index) => Number.parseInt(hexColor.slice(index, index + 2), 16) / 255);
  const linear = channels.map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(first, second) {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
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
  assert(!css.includes('Barlow Semi Condensed'), 'retired display font remains in site CSS');
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
  assert(brandStyle.backgroundImage.includes('central-auto-repair-logo-dark.png'), `${entry.name}: dark-surface logo is not applied to the brand mark`);
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

  const targetFailures = await page.locator('button:visible, .button:visible, .header-cta:visible, .mobile-actions a:visible').evaluateAll((elements) =>
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
  assert(await menuButton.isVisible(), `home @ ${viewport.name}: menu button is not visible`);
  await menuButton.click();
  assert(await menuButton.getAttribute('aria-expanded') === 'true', 'mobile menu did not expose expanded state');
  assert(await page.locator('[data-nav-drawer]').getAttribute('aria-hidden') === 'false', 'mobile drawer remained aria-hidden');
  await page.waitForFunction(() => document.activeElement?.getAttribute('href') === '/services/');
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
  await filter.fill('');
  assert(await page.locator('[data-service-group]:visible').count() === inventory.categories.length, 'clearing search did not restore all categories');
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
  const browser = await chromium.launch({ headless: true, executablePath: browserExecutable });

  try {
    for (const viewport of viewports) {
      for (const entry of pages) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          reducedMotion: 'reduce',
        });
        const page = await context.newPage();
        await verifyDocument(page, entry, viewport);

        if ((viewport.name === 'phone-390' || viewport.name === 'desktop-1440') && ['home', 'services', 'tpms', 'contact'].includes(entry.name)) {
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

    await verifyNoScriptFallback(browser);
    process.stdout.write('PASS no-script fallback\n');
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
