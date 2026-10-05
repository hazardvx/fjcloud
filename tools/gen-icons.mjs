import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const toFileUrl = (p) => 'file:///' + path.join(root, p).split(path.sep).join('/');

const jobs = [
  { src: 'icons/icon-plain.svg', size: 192, out: 'icons/icon-192.png' },
  { src: 'icons/icon-plain.svg', size: 180, out: 'icons/apple-touch-icon.png' },
  { src: 'icons/icon-plain.svg', size: 512, out: 'icons/icon-512.png' },
  { src: 'icons/icon-maskable.svg', size: 512, out: 'icons/icon-maskable-512.png' }
];

const browser = await chromium.launch();
for (const job of jobs) {
  const page = await browser.newPage({ viewport: { width: job.size, height: job.size } });
  await page.goto(toFileUrl(job.src));
  await page.screenshot({ path: path.join(root, job.out) });
  await page.close();
  console.log('ok', job.out);
}

if (process.env.OG_URL) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto(process.env.OG_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(root, 'icons/og.png') });
  await page.close();
  console.log('ok icons/og.png');
}

await browser.close();
