const { chromium } = require('playwright');

const targetUrl = process.argv[2];
const browserPath = process.env.PLAYWRIGHT_BROWSER_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

if (!targetUrl) {
  console.error('Usage: node research/google-maps-services.cjs <google-maps-url>');
  process.exit(2);
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: browserPath });
  const context = await browser.newContext({
    locale: 'en-US',
    viewport: { width: 1440, height: 1100 },
  });
  const page = await context.newPage();

  try {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    console.log(`TITLE: ${await page.title()}`);
    console.log('VISIBLE TEXT BEFORE INTERACTION');
    console.log((await page.locator('body').innerText()).slice(0, 30000));

    const serviceControls = page.getByText(/^Services$/i);
    const serviceControlCount = await serviceControls.count();
    console.log(`SERVICE CONTROLS: ${serviceControlCount}`);

    for (let index = 0; index < serviceControlCount; index += 1) {
      const control = serviceControls.nth(index);
      if (await control.isVisible()) {
        await control.click();
        await page.waitForTimeout(4000);
        break;
      }
    }

    console.log('VISIBLE TEXT AFTER SERVICES INTERACTION');
    console.log((await page.locator('body').innerText()).slice(0, 50000));
    await page.screenshot({ path: '/tmp/google-maps-services.png', fullPage: true });
  } finally {
    await context.close();
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
