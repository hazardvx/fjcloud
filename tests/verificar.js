const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:3000';
const results = [];

function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail || '' });
}

(async () => {
  const browser = await chromium.launch();
  const consoleErrors = [];
  const pageErrors = [];

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => pageErrors.push(e.message));

  const resp = await page.goto(BASE, { waitUntil: 'networkidle' });
  check('HTTP 200 al cargar la página', resp && resp.status() === 200, 'status=' + (resp && resp.status()));
  await page.waitForTimeout(500);

  const headers = resp.headers();
  check('Header CSP presente', !!headers['content-security-policy']);
  check('CSP prohíbe framing (frame-ancestors)', (headers['content-security-policy'] || '').includes("frame-ancestors 'none'"));
  check('Header X-Frame-Options DENY', headers['x-frame-options'] === 'DENY');
  check('Header nosniff', headers['x-content-type-options'] === 'nosniff');
  check('index sin caché (no-cache)', (headers['cache-control'] || '').includes('no-cache'));

  const meta = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    title: document.title,
    desc: (document.querySelector('meta[name="description"]') || {}).content || '',
    viewport: (document.querySelector('meta[name="viewport"]') || {}).content || '',
    ogImg: (document.querySelector('meta[property="og:image"]') || {}).content || '',
    manifest: !!document.querySelector('link[rel="manifest"]'),
    favicon: !!document.querySelector('link[rel="icon"]'),
    apple: !!document.querySelector('link[rel="apple-touch-icon"]'),
    h1s: [...document.querySelectorAll('h1')].map((h) => h.innerText.trim().replace(/\s+/g, ' ')),
    h2Count: document.querySelectorAll('h2').length,
    dupIds: (() => {
      const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
      return ids.filter((id, i) => ids.indexOf(id) !== i);
    })(),
    anchors: [...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute('href')),
    brokenAnchors: [...document.querySelectorAll('a[href^="#"]')]
      .map((a) => a.getAttribute('href'))
      .filter((h) => h.length > 1 && !document.getElementById(h.slice(1))),
    svgNoAria: [...document.querySelectorAll('svg')]
      .filter((s) => !s.closest('[aria-hidden="true"]') && s.getAttribute('aria-hidden') !== 'true' && !s.closest('.sprite') && !s.classList.contains('sprite'))
      .map((s) => (s.parentElement && s.parentElement.className) || s.parentElement.tagName),
    emptyNames: [...document.querySelectorAll('a, button')]
      .filter((el) => !(el.innerText || '').trim() && !el.getAttribute('aria-label') && !el.getAttribute('title'))
      .length,
    headings: [...document.querySelectorAll('h1,h2,h3')].map((h) => +h.tagName[1]),
    anchorsTotal: [...document.querySelectorAll('a[href^="#"]')].length
  }));

  check('html lang = es', meta.lang === 'es', 'lang=' + meta.lang);
  check('title contiene FJcloud', /FJcloud/.test(meta.title), meta.title);
  check('meta description presente', meta.desc.length > 40, meta.desc.slice(0, 60));
  check('viewport meta presente', /width=device-width/.test(meta.viewport));
  check('og:image referenciado', !!meta.ogImg);
  check('manifest enlazado', meta.manifest);
  check('favicon enlazado', meta.favicon);
  check('apple-touch-icon enlazado', meta.apple);
  check('exactamente un h1', meta.h1s.length === 1, JSON.stringify(meta.h1s));
  check('h1 contiene "Creamos Sistemas Web"', /Creamos Sistemas Web/.test(meta.h1s[0] || ''));
  check('varios h2 de sección', meta.h2Count >= 2, 'h2=' + meta.h2Count);
  check('sin ids duplicados', meta.dupIds.length === 0, meta.dupIds.join(','));
  check('anchors internos resuelven (sin # roto)', meta.brokenAnchors.length === 0, meta.brokenAnchors.join(','));
  check('svgs decorativos con aria-hidden', meta.svgNoAria.length === 0, meta.svgNoAria.join(','));
  check('enlaces/botones con nombre accesible', meta.emptyNames === 0, 'vacíos=' + meta.emptyNames);

  let prev = 0;
  let orderOk = true;
  for (const lvl of meta.headings) {
    if (lvl > prev + 1) orderOk = false;
    prev = lvl;
  }
  check('orden de encabezados sin saltos', orderOk);

  const structure = await page.evaluate(() => ({
    checks: document.querySelectorAll('.checks li').length,
    heroBtns: document.querySelectorAll('.hero-cta .btn').length,
    heroBtnWa: !!document.querySelector('.hero-cta .btn .wa-ico'),
    stats: document.querySelectorAll('.stat').length,
    heroSvc: [...document.querySelectorAll('.hero .checks li')].map((l) => l.id),
    sectors: document.querySelectorAll('.sector').length,
    ctaBtns: document.querySelectorAll('.cta-btns .btn').length,
    ctaNote: (document.querySelector('.cta-note') || {}).textContent || '',
    ctaFeats: document.querySelectorAll('.cta-feat').length,
    mailto: (document.querySelector('a[href^="mailto:"]') || {}).href || '',
    footerYear: (document.getElementById('year') || {}).textContent || '',
    footLinks: document.querySelectorAll('.f-col a').length,
    statTexts: [...document.querySelectorAll('.stat-value')].map((s) => s.textContent.trim())
  }));

  check('hero: 4 puntos de lista', structure.checks === 4, 'checks=' + structure.checks);
  check('hero: 1 botón CTA', structure.heroBtns === 1, 'btns=' + structure.heroBtns);
  check('hero: botón CTA con ícono de WhatsApp', structure.heroBtnWa);
  check('barra de stats con 3 items', structure.stats === 3, 'stats=' + structure.stats);
  check('hero: lista de 4 servicios con ids',
    structure.heroSvc.length === 4 && structure.heroSvc.join(',') === 'desarrollo,sistemas,vps,soporte',
    structure.heroSvc.join(','));
  check('sectores: 8 opciones', structure.sectors === 8, 'sectors=' + structure.sectors);
  check('CTA: 1 botón WhatsApp', structure.ctaBtns === 1, 'ctaBtns=' + structure.ctaBtns);
  check('CTA: nota de cotización', /cotización para la creación/i.test(structure.ctaNote), structure.ctaNote);
  check('CTA: 4 rasgos destacados', structure.ctaFeats === 4, 'feats=' + structure.ctaFeats);
  check('mailto de contacto presente', /mailto:contacto@/.test(structure.mailto), structure.mailto);
  check('footer con enlaces de contacto', structure.footLinks >= 3, 'foot=' + structure.footLinks);
  check('año dinámico en footer', /^20\d\d$/.test(structure.footerYear), structure.footerYear);

  await page.waitForTimeout(900);
  const entrance = await page.evaluate(() => {
    const sels = ['.hero-copy>h1', '.hero-sub', '.hero-cta', '.stage-logo', '.monitor', '.laptop', '.phone', '.script-note'];
    return sels.map((s) => {
      const el = document.querySelector(s);
      return el ? getComputedStyle(el).opacity : 'missing';
    });
  });
  check('entradas del hero asentadas (opacity 1)', entrance.length === 8 && entrance.every((o) => o === '1'), entrance.join(','));

  const cssText = await page.evaluate(() => [...document.querySelectorAll('style')].map((s) => s.textContent).join('\n'));
  check('botones con press feedback (.btn:active)', /\.btn:active\s*\{[^}]*scale\(\.97\)/.test(cssText));
  check('hero con entrada escalonada (@keyframes rise)', /@keyframes rise/.test(cssText) && /hero-copy>h1[^{]*\{[^}]*animation:rise/.test(cssText));
  check('escena con entrada por piezas (stageIn + noteIn)', /@keyframes stageIn/.test(cssText) && /@keyframes noteIn/.test(cssText));
  check('nube flotante (@keyframes bob)', /@keyframes bob/.test(cssText));

  const mainJsTxt = await page.evaluate(() => fetch('js/main.js').then((r) => r.text()).catch(() => ''));
  check('main.js servido con número nuevo (50769527810)',
    /50769527810/.test(mainJsTxt) && !/50767008446/.test(mainJsTxt),
    mainJsTxt.slice(0, 60));

  const openWa = async (sel) => {
    const opens = await (async () => {
      await page.evaluate(() => {
        if (window.__waStub) return;
        window.__waStub = true;
        window.__waOpens = [];
        window.open = function (u) { window.__waOpens.push(String(u)); return null; };
      });
      await page.click(sel);
      await page.waitForTimeout(300);
      return page.evaluate(() => window.__waOpens);
    })();
    return opens[opens.length - 1] || 'no-open';
  };
  const isFjWa = (u) =>
    u.startsWith('https://wa.me/50769527810') ||
    /api\.whatsapp\.com\/send\/\?phone=50769527810\b/.test(u);
  const heroWa = await openWa('.hero-cta .btn');
  check('botón hero abre wa.me/50769527810', isFjWa(heroWa), heroWa);
  const ctaWa = await openWa('.cta-btns .btn');
  check('botón CTA abre wa.me/50769527810', isFjWa(ctaWa), ctaWa);

  await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
  await page.evaluate(() => { window.scrollTo(0, document.getElementById('sectores').offsetTop - 200); });
  await page.waitForTimeout(1200);
  const revealed = await page.evaluate(() => {
    const els = [...document.querySelectorAll('#sectores .reveal')];
    return { total: els.length, inn: els.filter((e) => e.classList.contains('in')).length };
  });
  check('reveal al hacer scroll en sectores', revealed.total === revealed.inn && revealed.total > 0, revealed.inn + '/' + revealed.total);

  await page.evaluate(() => { window.scrollTo(0, 0); });
  await page.waitForTimeout(400);
  const overflow = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth
  }));
  check('sin scroll horizontal en desktop', overflow.sw <= overflow.cw + 1, overflow.sw + ' vs ' + overflow.cw);

  const fontsOk = await page.evaluate(async () => {
    await document.fonts.ready;
    return {
      poppins: document.fonts.check('700 20px Poppins'),
      inter: document.fonts.check('400 16px Inter'),
      caveat: document.fonts.check('700 30px Caveat')
    };
  });
  check('fuente Poppins cargada', fontsOk.poppins);
  check('fuente Inter cargada', fontsOk.inter);
  check('fuente Caveat cargada', fontsOk.caveat);

  const swInfo = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return { reg: false };
    const reg = await navigator.serviceWorker.getRegistration();
    return { reg: !!reg, active: !!(reg && reg.active) };
  });
  check('service worker registrado', swInfo.reg, JSON.stringify(swInfo));

  const anchorsOk = await page.evaluate(() => {
    const ids = ['inicio', 'vps', 'desarrollo', 'sistemas', 'soporte', 'sectores', 'contacto'];
    return ids.every((id) => !!document.getElementById(id));
  });
  check('destinos de navegación existentes', anchorsOk);

  const ctxRM = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const pageRM = await ctxRM.newPage();
  await pageRM.goto(BASE, { waitUntil: 'networkidle' });
  await pageRM.waitForTimeout(400);
  const rm = await pageRM.evaluate(() => ({
    all: document.querySelectorAll('.reveal').length,
    inn: document.querySelectorAll('.reveal.in').length,
    stats: [...document.querySelectorAll('.stat-value[data-count]')].map((s) => s.textContent.trim()),
    heroOp: getComputedStyle(document.querySelector('.hero-copy>h1')).opacity,
    stageOps: ['.stage-logo', '.monitor', '.script-note'].map((s) => getComputedStyle(document.querySelector(s)).opacity),
    noteT: getComputedStyle(document.querySelector('.script-note')).transform
  }));
  check('prefers-reduced-motion: todo visible sin animar', rm.all === rm.inn && rm.all > 0, rm.inn + '/' + rm.all);
  check('contadores con valor final (99.9%)',
    rm.stats.length === 1 && rm.stats[0] === '99.9%',
    rm.stats.join(','));
  check('RM: hero y escena visibles al instante',
    rm.heroOp === '1' && rm.stageOps.every((o) => o === '1'),
    rm.heroOp + ' | ' + rm.stageOps.join(','));
  check('RM: nota conserva su rotación', !!rm.noteT && rm.noteT !== 'none', rm.noteT);
  await ctxRM.close();

  const ctxM = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pageM = await ctxM.newPage();
  await pageM.goto(BASE, { waitUntil: 'networkidle' });
  await pageM.waitForTimeout(400);

  const mOverflow = await pageM.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth
  }));
  check('sin scroll horizontal en móvil 390px', mOverflow.sw <= mOverflow.cw + 1, mOverflow.sw + ' vs ' + mOverflow.cw);

  const noMenu = await pageM.evaluate(() => ({
    burger: !!document.getElementById('burger'),
    nav: !!document.querySelector('.nav'),
    panel: !!document.getElementById('navPanel')
  }));
  check('móvil sin menú (sin burger ni panel)', !noMenu.burger && !noMenu.nav && !noMenu.panel, JSON.stringify(noMenu));

  const stageScaled = await pageM.evaluate(() => {
    const wrap = document.querySelector('.stage-wrap');
    return wrap ? Math.round(wrap.getBoundingClientRect().height) : 0;
  });
  check('escena del hero escalada en móvil (no desborda)', stageScaled > 150 && stageScaled < 500, 'h=' + stageScaled);
  await ctxM.close();

  const skip = await (async () => {
    const data = await page.evaluate(() => {
      const a = document.querySelector('.skip-link');
      if (!a) return null;
      const target = document.getElementById(a.getAttribute('href').slice(1));
      a.focus();
      return { exists: !!target, focused: document.activeElement === a };
    });
    if (!data) return { ok: false };
    await page.waitForTimeout(400);
    const top = await page.evaluate(() => document.querySelector('.skip-link').getBoundingClientRect().top);
    return { ok: data.exists, focused: data.focused, top };
  })();
  check('skip-link visible al enfocarse', skip.ok && skip.focused && skip.top >= 0, JSON.stringify(skip));

  const goodErrors = consoleErrors.filter((e) => !/favicon|og\.png/i.test(e));
  check('sin errores de consola', goodErrors.length === 0, goodErrors.join(' | ').slice(0, 200));
  check('sin errores de página (pageerror)', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 200));

  await ctx.close();
  await browser.close();

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  for (const r of results) {
    console.log((r.ok ? '  ok  ' : ' FAIL ') + r.name + (r.ok || !r.detail ? '' : '  → ' + r.detail));
  }
  console.log('\n' + passed + '/' + results.length + ' checks OK');
  if (failed.length) {
    console.log('FALLAN:');
    failed.forEach((f) => console.log('  - ' + f.name + (f.detail ? ' → ' + f.detail : '')));
    process.exit(1);
  }
})().catch((e) => {
  console.error('ERROR SUITE:', e);
  process.exit(1);
});
