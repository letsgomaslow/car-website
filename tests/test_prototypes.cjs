const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const baseUrl = process.env.PROTOTYPE_BASE_URL || 'http://127.0.0.1:4173';
const browserExecutable = process.env.PLAYWRIGHT_BROWSER_PATH;
const projectRoot = path.resolve(__dirname, '..');
const screenshotDirectory = path.join(projectRoot, 'prototypes', 'screenshots');

const pages = [
  { slug: 'index.html', name: 'gallery' },
  { slug: 'concept-1-bayline.html', name: 'bayline' },
  { slug: 'concept-2-signal.html', name: 'signal' },
  { slug: 'concept-3-local-mile.html', name: 'local-mile' },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function verifyPage(page, entry, viewportName) {
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  const response = await page.goto(`${baseUrl}/${entry.slug}`, { waitUntil: 'networkidle' });
  assert(response && response.ok(), `${entry.slug}: expected a successful HTTP response`);
  assert(await page.locator('main').count() === 1, `${entry.slug}: expected one main landmark`);
  assert(await page.locator('h1').count() === 1, `${entry.slug}: expected one h1`);

  const title = await page.title();
  assert(title.trim().length > 0, `${entry.slug}: document title is missing`);

  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  assert(
    dimensions.scrollWidth <= dimensions.innerWidth + 1,
    `${entry.slug}: horizontal overflow (${dimensions.scrollWidth}px > ${dimensions.innerWidth}px)`,
  );

  const headingLevels = await page.locator('h1, h2, h3, h4, h5, h6').evaluateAll((headings) =>
    headings.map((heading) => Number(heading.tagName.slice(1))),
  );
  for (let index = 1; index < headingLevels.length; index += 1) {
    assert(
      headingLevels[index] <= headingLevels[index - 1] + 1,
      `${entry.slug}: heading level skips from h${headingLevels[index - 1]} to h${headingLevels[index]}`,
    );
  }

  const bodyText = (await page.locator('body').innerText()).toLowerCase();
  for (const excludedService of ['wheel alignment', 'auto glass', 'weathertech']) {
    assert(!bodyText.includes(excludedService), `${entry.slug}: excluded service appears in visible copy: ${excludedService}`);
  }

  if (entry.name !== 'gallery') {
    assert(bodyText.includes('tpms'), `${entry.slug}: TPMS is not represented`);
    assert(await page.locator('a[href="tel:+17328224534"]').count() > 0, `${entry.slug}: phone CTA is missing`);
  }

  if (viewportName === 'mobile' && entry.name !== 'gallery') {
    const menuButton = page.locator('.menu-button');
    assert(await menuButton.isVisible(), `${entry.slug}: mobile menu button is not visible`);
    await menuButton.click();
    assert(await menuButton.getAttribute('aria-expanded') === 'true', `${entry.slug}: menu did not expose expanded state`);
    await page.keyboard.press('Escape');
    assert(await menuButton.getAttribute('aria-expanded') === 'false', `${entry.slug}: Escape did not close the menu`);
  }

  if (entry.name === 'signal' && viewportName === 'desktop') {
    const brakeButton = page.locator('.symptom-button').nth(1);
    await brakeButton.click();
    assert(await brakeButton.getAttribute('aria-pressed') === 'true', 'Signal concept: symptom state did not update');
    assert((await page.locator('#result-title').innerText()) === 'Brake inspection', 'Signal concept: result content did not update');
  }

  if (entry.name === 'local-mile' && viewportName === 'desktop') {
    await page.locator('#name').fill('Prototype Tester');
    await page.locator('#phone').fill('732-555-0100');
    await page.locator('#service-request button[type="submit"]').click();
    await page.locator('#form-status').filter({ hasText: 'Prototype only' }).waitFor();
  }

  assert(consoleErrors.length === 0, `${entry.slug}: console errors: ${consoleErrors.join(' | ')}`);
  assert(pageErrors.length === 0, `${entry.slug}: page errors: ${pageErrors.join(' | ')}`);
}

async function run() {
  fs.mkdirSync(screenshotDirectory, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    ...(browserExecutable ? { executablePath: browserExecutable } : {}),
  });

  try {
    for (const viewport of [
      { name: 'mobile', width: 390, height: 844 },
      { name: 'desktop', width: 1440, height: 900 },
    ]) {
      for (const entry of pages) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          reducedMotion: 'reduce',
        });
        const page = await context.newPage();
        await verifyPage(page, entry, viewport.name);

        if (entry.name !== 'gallery') {
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.screenshot({
            path: path.join(screenshotDirectory, `${entry.name}-${viewport.name}.png`),
            fullPage: viewport.name === 'mobile',
          });
        }

        await context.close();
        process.stdout.write(`PASS ${entry.name} @ ${viewport.name}\n`);
      }
    }
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
