import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { brandHueRotation, brandFilter } from '../packages/app/src/ui/site/brand-palette.ts';

const root = 'apps/web/public/images/brand-v2';
const output = `${root}/email`;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 480, height: 160 }, deviceScaleFactor: 1 });
  for (const locale of ['es', 'en', 'pt', 'de', 'fr']) {
    const png = (await readFile(`${root}/logo-${locale}-720.png`)).toString('base64');
    for (const [palette, hue] of Object.entries(brandHueRotation)) {
      await page.setContent(`<html><body style="margin:0"><img src="data:image/png;base64,${png}" width="480" height="160" style="display:block;filter:${brandFilter(hue)}"></body></html>`);
      await page.locator('img').evaluate((image) => image.decode());
      await page.locator('img').screenshot({ path: `${output}/logo-${locale}-${palette}.png`, omitBackground: true });
    }
  }
} finally {
  await browser.close();
}
