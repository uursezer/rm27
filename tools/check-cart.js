#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════
   The basket page, pressed the way a customer presses it.

   tools/test-cart.js proves the arithmetic. This opens cart.html in a
   real browser and checks that the page says what the arithmetic says —
   every state from an empty basket to a full one and back, in both
   languages, on a phone and on a desk — and that the things around the
   arithmetic work: the way back from a removal, the three steps, the
   form, the bar under the window, the other page.

       node tools/check-cart.js            everything
       node tools/check-cart.js --quick    skip the width sweep

   It serves the repository itself on a local port; nothing is fetched
   from anywhere else, and the run fails if the page tries to.
   Needs: playwright (any recent version with a Chromium).
   ════════════════════════════════════════════════════════════════ */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const QUICK = process.argv.includes('--quick');
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.webp':'image/webp', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.mp4':'video/mp4' };

let ran = 0, bad = 0;
function ok(cond, what, got){
  ran++;
  if(!cond){ bad++; console.log('  ✗ ' + what + (got === undefined ? '' : '   → ' + JSON.stringify(got))); }
}
function section(name){ console.log('\n' + name); }

const S = (items, bundle) => JSON.stringify({ v:1, items: items || [], bundle: bundle || null });
const FIVE = ['Full Plugin Pack', 'Lora Presets', 'Solis Presets', 'Terra Presets', 'Jardin Presets'];

/* Where the site is served, Images/Lora.webp is not images/lora.webp. On a
   disk that does not mind, this server minds for it: every part of the path
   has to be spelled the way the folder spells it. */
const folders = new Map();
function spelled(file){
  let dir = ROOT;
  return path.relative(ROOT, file).split(path.sep).every(part => {
    if(!folders.has(dir)) folders.set(dir, new Set(fs.readdirSync(dir)));
    const ok = folders.get(dir).has(part);
    dir = path.join(dir, part);
    return ok;
  });
}

(async () => {
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
    if(rel.endsWith('/')) rel += 'index.html';
    const file = path.join(ROOT, rel);
    if(!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory() || !spelled(file)){ res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const BASE = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const errors = [], outside = [];

  async function open(opts){
    opts = opts || {};
    const ctx = await browser.newContext({
      viewport: { width: opts.w || 1440, height: opts.h || 900 },
      reducedMotion: opts.still ? 'reduce' : 'no-preference',
      hasTouch: !!opts.touch, isMobile: !!opts.touch
    });
    /* The driver brings a thing into view before it presses it, and this
       site scrolls smoothly: on a busy machine a press can be aimed while the
       page is still gliding, and land beside what it was meant for. So the
       scrolling nobody asked for by name is made instant here. Every scroll
       the page itself asks for says how it wants to go (smooth, or at once),
       and those are left exactly as they are. */
    await ctx.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
      const still = document.createElement('style');
      still.textContent = 'html{scroll-behavior:auto !important}';
      document.head.appendChild(still);
    }));
    /* the basket page must not reach for anything that is not this site.
       (The front page still borrows fifteen photographs from the live shop —
       see SNAPSHOTS.md — so what it asks for is turned away but not counted.) */
    await ctx.route('**/*', route => {
      const req = route.request(), u = req.url();
      if(u.startsWith(BASE) || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
      let from = ''; try { from = req.frame().url(); } catch(e){}
      if(/\/cart\.html/.test(from)) outside.push(u);
      return route.abort();
    });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if(m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
    /* a picture or a script this site was asked for and does not have: the
       page hides a broken picture, and the address of a file is case-
       sensitive where the site is served, so only the answer itself shows it */
    page.on('response', res => { if(res.status() >= 400 && res.url().startsWith(BASE)) errors.push(res.status() + ' ' + res.url().slice(BASE.length)); });
    await page.goto(BASE + 'cart.html', { waitUntil: 'load' });
    await page.evaluate(([state, lang]) => {
      if(state) localStorage.setItem('rm-cart', state); else localStorage.removeItem('rm-cart');
      if(lang) localStorage.setItem('rm-lang', lang); else localStorage.removeItem('rm-lang');
    }, [opts.state || '', opts.lang || '']);
    /* a fresh load with that basket already kept, as a visitor would arrive;
       then, if asked, on to a step by its address */
    await page.reload({ waitUntil: 'load' });
    if(opts.hash) await page.goto(BASE + 'cart.html#' + opts.hash, { waitUntil: 'load' });
    await page.waitForTimeout(250);
    return { ctx, page };
  }

  /* what the page is showing, read back off the page */
  const read = page => page.evaluate(() => {
    const q = (s, r) => (r || document).querySelector(s);
    const qa = (s, r) => [].slice.call((r || document).querySelectorAll(s));
    const txt = el => el ? el.textContent.replace(/\s+/g, ' ').trim() : null;
    const seen = el => !!el && !el.closest('[hidden]') && el.getClientRects().length > 0;
    const main = q('#main'), view = main.getAttribute('data-view');
    const sum = q(view === 'pay' ? '[data-paysum]:not([hidden])' : view === 'done' ? '[data-donesum]' : '[data-sum]');
    const rows = {};
    qa('.sum__row', sum).forEach(r => {
      const k = r.classList.contains('sum__total') ? 'total' : r.classList.contains('sum__row--deal') ? 'deal' : 'subtotal';
      rows[k] = { label: txt(q('dt', r)), value: txt(q('dd', r)) };
    });
    const names = window.RMCart.names(window.RMCart.load());
    const price = window.RMCart.price(names);
    return {
      view, title: document.title, lang: main.getAttribute('lang'), htmlLang: document.documentElement.getAttribute('lang'), hash: location.hash,
      scrollY: Math.round(window.scrollY),
      h1: qa('#main h1').filter(seen).map(txt),
      eyebrow: txt(q('[data-eyebrow]')),
      ladder: {
        eyebrow: txt(q('[data-l="eyebrow"]')), say: txt(q('[data-l="say"]')), why: txt(q('[data-l="why"]')),
        rungs: qa('[data-rung]').map(r => ({
          is: ['is-done', 'is-current', 'is-later'].filter(c => r.classList.contains(c)).join(' '),
          t: txt(q('[data-rung-t]', r)), n: txt(q('[data-rung-n]', r)), vh: txt(q('[data-rung-vh]', r)),
          filled: qa('figure.prod', r).length, free: qa('figure.prod.is-free', r).length,
          button: qa('button.prod--empty', r).length, wait: qa('span.prod--empty:not(.prod--later)', r).length,
          later: qa('.prod--later', r).length,
          nextfree: qa('.is-nextfree', r).length, ghost: qa('.prod__badge--ghost', r).length,
          names: qa('figure.prod .tile__t', r).map(txt),
          place: q('button[data-place]', r) ? q('button[data-place]', r).getAttribute('aria-label') : null
        })),
        best: seen(q('[data-best]')),
        ring: q('#ladder').classList.contains('is-added'),
        pick: seen(q('[data-l="pick"]')) ? {
          label: txt(q('.pick__label')), name: txt(q('.pick__t')), free: q('[data-l="pick"]').classList.contains('is-free'),
          price: txt(q('.pick__price .price')), pill: !!q('.pick__price .prod__badge'),
          go: txt(q('.pick__go')), primary: q('.pick__go').classList.contains('btn--primary'),
          aria: q('.pick__go').getAttribute('aria-label')
        } : null
      },
      lines: qa('[data-lines] > li').map(li => li.classList.contains('line')
        ? { line: li.getAttribute('data-line'), no: txt(q('.prod__no', li)), free: li.classList.contains('is-free'), pill: !!q('.prod__badge', li),
            price: txt(q('.price', li)), won: txt(q('.line__won', li)), kind: txt(q('.line__kind', li)) }
        : li.classList.contains('undo') ? { undo: txt(q('p', li)) } : { cap: txt(li) }),
      linesShown: seen(q('[data-lines-sec]')), linesN: txt(q('[data-lines-n]')),
      more: seen(q('[data-more]')) ? {
        h: txt(q('[data-more-h]')), sub: txt(q('[data-more-sub]')),
        rows: qa('[data-addrows] > li').filter(seen).map(li => ({ name: li.getAttribute('data-offer'), price: txt(q('.price', li)),
          free: !!q('.price b.is-free', li) && li.classList.contains('is-free'), with: txt(q('.addrow__with', li)),
          aria: q('[data-add]', li).getAttribute('aria-label') })),
        all: seen(q('[data-more-all]')) ? txt(q('[data-more-all]')) : null,
        cols: getComputedStyle(q('[data-addrows]')).gridTemplateColumns.split(' ').length
      } : null,
      unfold: seen(q('[data-unfold]')) ? txt(q('[data-unfold]')) : null,
      rules: { button: txt(q('[data-rules]')), open: q('[data-rules]').getAttribute('aria-expanded'),
        shown: seen(q('[data-rules-list]')), list: qa('[data-rules-list] li').map(txt) },
      sum: seen(sum) ? { rows, save: txt(q('.osave', sum)), go: txt(q('.sum__go', sum)), mini: qa('.sum__mini li', sum).length,
        next: txt(q('.sum__next span:not(.nav__gift)', sum)) } : null,
      bar: (() => { const b = q('[data-paybar]'); return { hidden: b.hidden, on: b.classList.contains('is-on'),
        total: txt(q('[data-bar-total]')), note: txt(q('[data-bar-note]')), go: txt(q('.paybar__long')), short: txt(q('.paybar__short')),
        aria: q('[data-bar-go]').getAttribute('aria-label'), label: b.getAttribute('aria-label') }; })(),
      back: seen(q('.pay__back')) ? txt(q('.pay__back')) : null,
      badge: txt(q('.cart__n')), bagLabel: q('[data-basket]').getAttribute('aria-label'),
      live: txt(q('[data-live]')), cheer: qa('.cheer').length, cheerIn: qa('[data-cheer] > .cheer').length, cheerLead: txt(q('.cheer__lead')),
      undoSolo: seen(q('[data-undo-solo]')) ? txt(q('[data-undo-solo] p')) : null,
      emptyOnly: qa('[data-empty-only]').filter(seen).length,
      focus: (() => { const a = document.activeElement; if(!a || a === document.body) return null;
        return a.getAttribute('data-add') ? 'add:' + a.getAttribute('data-add') : a.hasAttribute('data-undo') ? 'undo'
          : a.getAttribute('data-remove') ? 'remove:' + a.getAttribute('data-remove') : a.id || a.tagName; })(),
      stored: localStorage.getItem('rm-cart'),
      engine: { count: price.count, counted: price.counted, subtotal: price.subtotal, saving: price.saving, total: price.total,
        deal: price.deal ? price.deal.get + '/' + price.deal.pay : null, next: price.next ? price.next.get + ':' + price.next.need : null,
        free: price.lines.filter(l => l.free).map(l => l.name),
        /* the receipt's order is the order the deal is applied in */
        order: price.lines.map((l, i) => ({ l, i })).sort((a, b) =>
          ((a.l.place === null ? 1e9 : a.l.place) - (b.l.place === null ? 1e9 : b.l.place)) || (a.i - b.i)).map(x => x.l.name),
        placed: price.lines.filter(l => l.place !== null).length }
    };
  });
  /* The page keeps its three blocks transparent until they are revealed.
     Nothing else here looks at opacity, and a browser will press a button
     nobody can see: so, once, in each place a view is first read — whatever
     is on the screen can be seen. */
  const visible = page => page.waitForFunction(() => [].every.call(document.querySelectorAll('#main [data-reveal]'), e => {
    if(e.closest('[hidden]') || !e.getClientRects().length) return true;
    const r = e.getBoundingClientRect();
    if(r.top > innerHeight * 0.9 || r.bottom < 0) return true;
    for(let n = e, o = 1; n && n.nodeType === 1; n = n.parentElement){ o *= +getComputedStyle(n).opacity; if(o < 0.99) return false; }
    return true;
  }), null, { timeout: 3000 }).then(() => true, () => false);
  /* a step reached is celebrated once the panel is where it can be seen — which
     may be a moment after the press, if the window had to bring it there */
  const cheered = page => page.waitForSelector('[data-cheer] > .cheer', { timeout: 3000 }).then(() => page.waitForTimeout(150), () => {});
  /* whatever the page prints as money must be what the engine says it is */
  function agrees(r, where){
    const e = r.engine;
    if(!r.sum){ ok(e.count === 0 || r.view === 'done', where + ': a basket with something in it has a summary'); return; }
    ok(r.sum.rows.subtotal && r.sum.rows.subtotal.value === '$' + e.subtotal, where + ': subtotal is the engine’s', [r.sum.rows.subtotal, e.subtotal]);
    ok(r.sum.rows.total && r.sum.rows.total.value === '$' + e.total, where + ': total is the engine’s', [r.sum.rows.total, e.total]);
    ok(e.deal ? (r.sum.rows.deal && r.sum.rows.deal.value === '−$' + e.saving) : !r.sum.rows.deal, where + ': the deal row is the engine’s deal', [r.sum.rows.deal, e.deal, e.saving]);
    if(r.view === 'basket'){
      ok((e.next && e.counted >= 1) ? !!r.sum.next : !r.sum.next, where + ': what the next step would come to is said only while there is one, and something to build on', r.sum.next);
      const lines = r.lines.filter(l => l.line);
      ok(JSON.stringify(lines.map(l => l.line)) === JSON.stringify(e.order), where + ': the lines are in the order the deal is applied in', [lines.map(l => l.line), e.order]);
      const nos = lines.map(l => l.no).filter(Boolean), want = [];
      for(let i = 1; i <= e.placed; i++) want.push((i < 10 ? '0' : '') + i);
      ok(JSON.stringify(nos) === JSON.stringify(want), where + ': each numbered 01, 02 … and what has no place has no number', nos);
      const free = lines.filter(l => l.free).map(l => l.line).sort();
      ok(JSON.stringify(free) === JSON.stringify(e.free.slice().sort()), where + ': the lines marked free are the engine’s', [free, e.free]);
      ok(r.badge === String(e.count), where + ': the count in the bar', [r.badge, e.count]);
      ok(r.bar.total.indexOf('$' + e.total) === 0, where + ': the bar under the window carries the total', r.bar.total);
      const filled = r.ladder.rungs[0].filled + r.ladder.rungs[1].filled;
      ok(filled === Math.min(5, e.counted), where + ': the places filled are the packs that count', [filled, e.counted]);
      const ringed = r.ladder.rungs[0].free + r.ladder.rungs[1].free;
      ok(ringed === e.free.length, where + ': as many ringed places as free lines', [ringed, e.free.length]);
      const buttons = r.ladder.rungs[0].button + r.ladder.rungs[1].button;
      ok(buttons === (e.counted < 5 ? 1 : 0), where + ': one place is a button — the next one — and no other', buttons);
    }
  }

  /* ── 1 · one product to six, a press at a time ──────────────────── */
  section('1 · from one product to six');
  {
    const { ctx, page } = await open({ state: S(['Lora Presets']) });
    let r = await read(page);
    ok(r.view === 'basket' && r.title === 'Your basket — Retouch Market', 'opens on the basket', [r.view, r.title]);
    ok(await visible(page), 'and the campaign, the lines and the summary can be seen');
    ok(r.h1.length === 1 && r.h1[0] === 'Your basket', 'one heading: Your basket', r.h1);
    ok(r.eyebrow === 'Basket · 1 item', 'the eyebrow counts', r.eyebrow);
    ok(r.ladder.eyebrow === 'Step 1 of 2 · Get 3, Pay 2', 'Get 3, Pay 2 is the first step shown', r.ladder.eyebrow);
    ok(r.ladder.say === 'Two more and 1 of the 3 is on us.', 'one product: the sentence', r.ladder.say);
    ok(r.ladder.why === 'Two $59 packs together add just $59.', 'and what the two would add, worked out, at the price it is true for', r.ladder.why);
    ok(r.ladder.rungs[0].is === 'is-current' && r.ladder.rungs[1].is === 'is-later', 'step one is the one to do, step two is waiting', r.ladder.rungs.map(x => x.is));
    ok(r.ladder.rungs[0].n === '1 / 3' && r.ladder.rungs[1].n === 'Next', 'their captions', r.ladder.rungs.map(x => x.n));
    ok(r.ladder.rungs[0].vh === 'Step 1: Get 3, Pay 2 — 1 of 3.' && r.ladder.rungs[1].vh === 'Step 2: Get 5, Pay 3 — next step.', 'and the same in a sentence, for a screen reader', r.ladder.rungs.map(x => x.vh));
    ok(r.ladder.rungs[0].filled === 1 && r.ladder.rungs[0].button === 1 && r.ladder.rungs[0].wait === 1 && r.ladder.rungs[1].later === 2, 'one place filled, one to fill now, one waiting, two for later', r.ladder.rungs);
    ok(r.ladder.rungs[0].place === 'Add a pack: choose one for place 2', 'the next place is called what it shows, and says which place it is', r.ladder.rungs[0].place);
    ok(r.ladder.rungs[0].ghost === 1 && r.ladder.rungs[0].nextfree === 0, 'the third place wears the pill as a promise', r.ladder.rungs[0]);
    ok(!r.ladder.best, 'the gold badge waits until the first step is done', r.ladder.best);
    ok(r.ladder.pick && r.ladder.pick.name === 'Solis Presets' && r.ladder.pick.label === 'Our pick' && !r.ladder.pick.free && r.ladder.pick.go === 'Add to cart' && !r.ladder.pick.primary,
       'the pick is the next pack on the shelf, at its price, behind the front page’s own words for the press', r.ladder.pick);
    ok(r.ladder.pick.aria === 'Add to cart: Solis Presets — $59', 'and its button is called what is printed on it, then the rest', r.ladder.pick.aria);
    ok(r.more && r.more.h === 'Or choose another' && r.more.sub === 'Any pack on the shelf counts.', 'the rest of the shelf is under it', r.more);
    ok(r.more.cols === 2 && r.more.rows.map(x => x.name).join() === 'Terra Presets,Jardin Presets,Mely Presets,Onyx Presets' && r.more.all === 'Show all 10 packs', 'four of them in two columns, without the pick, and a way to the rest', [r.more.cols, r.more.rows.map(x => x.name), r.more.all]);
    ok(r.unfold === null, 'nothing is folded away while there is a step to take', r.unfold);
    ok(r.sum.next === 'With two more $59 packs your total is $118 — one of them is free.', 'the summary says what the step would come to', r.sum.next);
    ok(r.sum.save === null, 'nothing is saved yet, and nothing says otherwise', r.sum.save);
    ok(r.cheer === 0 && r.live === '', 'nothing rings and nothing is announced on arrival', [r.cheer, r.live]);
    ok(r.bagLabel === 'Basket, 1 item', 'the basket in the bar says 1 item', r.bagLabel);
    agrees(r, '1 product');

    /* the empty place and the summary's sentence both lead to the pick */
    /* (the offer's answer lasts under a second: it is noted by the page itself
       as it happens, not looked for after a wait a busy machine can outlast) */
    await page.evaluate(() => { const pick = document.querySelector('.pick'); window.__called = [];
      new MutationObserver(() => { if(pick.classList.contains('is-called')) window.__called.push(getComputedStyle(pick).animationName); })
        .observe(pick, { attributes: true, attributeFilter: ['class'] }); });
    await page.click('[data-place]'); await page.waitForTimeout(200);
    ok((await read(page)).focus === 'add:Solis Presets', 'pressing the next place goes to the pack offered for it');
    const led = await page.evaluate(() => ({ called: window.__called.slice(), ring: document.activeElement.matches(':focus-visible'), outline: getComputedStyle(document.activeElement).outlineStyle }));
    ok(led.called.length === 1 && led.called[0] === 'pickCall' && led.ring && led.outline === 'solid', 'and is seen to: the offer answers once, and its button wears the ring though a mouse pressed', led);
    ok(await page.waitForFunction(() => !document.querySelector('.pick').classList.contains('is-called'), null, { timeout: 4000, polling: 100 }).then(() => true, () => false), 'and then the answer is over');
    await page.evaluate(() => document.activeElement.blur());
    await page.click('.sum__next'); await page.waitForTimeout(200);
    ok((await read(page)).focus === 'add:Solis Presets', 'and so does the sentence in the summary');

    await page.click('.pick__go'); await page.waitForTimeout(650);
    r = await read(page);
    ok(r.ladder.say === 'One more and it’s on us.' && r.ladder.why === 'A $59 pack leaves your total at $118. That’s Get 3, Pay 2.', 'two: one more and it is on us', [r.ladder.say, r.ladder.why]);
    ok(r.ladder.pick.label === 'Your free pack' && r.ladder.pick.free && r.ladder.pick.pill && r.ladder.pick.go === 'Add your free pack' && r.ladder.pick.primary,
       'the pick is the free pack, and its button is the accent', r.ladder.pick);
    ok(/free with Get 3, Pay 2$/.test(r.ladder.pick.aria), 'and says so to a screen reader', r.ladder.pick.aria);
    ok(r.ladder.rungs[0].nextfree === 1 && r.ladder.rungs[0].place === 'Choose your free pack for place 3', 'the third place is free the moment it is filled, and says so', r.ladder.rungs[0]);
    ok(r.more.sub === 'Your next $59 pack is free.', 'the shelf says what is true of it — and no more than that', r.more.sub);
    ok(r.more.rows.length === 4 && r.more.rows.every(x => x.free && x.price === 'Free$59' && /free with Get 3, Pay 2$/.test(x.aria)), 'every pack the eye meets first reads Free', r.more.rows);
    ok(r.sum.next === 'Add one more $59 pack and your total stays $118.', 'and the summary: the total stays', r.sum.next);
    ok(r.cheer === 0, 'nothing is celebrated at two', r.cheer);
    ok(r.live === 'Solis Presets added to your basket. Total $118. One more and it’s on us.', 'what is announced: what happened, the total, what to do next', r.live);
    ok(r.focus === 'add:Terra Presets', 'focus is on the next pick', r.focus);
    ok(r.stored === S(['Lora Presets', 'Solis Presets']), 'and it is kept', r.stored);
    agrees(r, '2 products');

    await page.click('.pick__go'); await cheered(page);
    r = await read(page);
    ok(r.cheer === 1 && r.cheerIn === 1 && r.cheerLead === 'You saved', 'three: the step is celebrated, once, over the words and the steps', [r.cheer, r.cheerIn, r.cheerLead]);
    const shown = await page.evaluate(() => { const h = document.querySelector('[data-cheer]').getBoundingClientRect(); return [Math.round(h.top), Math.round(h.bottom), innerHeight]; });
    ok(shown[0] >= 64 && shown[1] <= shown[2], 'with the whole of that half of the panel on the screen', shown);
    const clear = await page.evaluate(() => {
      const c = document.querySelector('.cheer').getBoundingClientRect(), p = document.querySelector('.pick').getBoundingClientRect();
      const l = document.querySelector('#ladder').getBoundingClientRect();
      return { above: c.bottom <= p.top + 0.5, edges: Math.abs(c.left - l.left) < 2 && Math.abs(c.right - l.right) < 2 && Math.abs(c.top - l.top) < 2 };
    });
    ok(clear.above && clear.edges, 'it reaches the panel’s edges and never covers the way to the next pack', clear);
    /* (asked until it is there, not after a fixed wait: a busy machine draws fewer frames) */
    ok(await page.waitForFunction(() => { const n = document.querySelector('[data-cheer-n]'); return !!n && n.textContent === '59'; }, null, { timeout: 2500, polling: 50 }).then(() => true, () => false),
       'and counts up to what it saved: $59', await page.evaluate(() => document.querySelector('[data-cheer-n]') && document.querySelector('[data-cheer-n]').textContent));
    await page.waitForTimeout(300);
    ok(r.ladder.eyebrow === 'Step 2 of 2 · Get 5, Pay 3', 'now the page points at Get 5, Pay 3', r.ladder.eyebrow);
    ok(r.ladder.say === 'Two more and 2 of the 5 are on us.', 'the sentence', r.ladder.say);
    ok(r.ladder.why === 'Get 3, Pay 2 is yours — Terra Presets is free. Two more $59 packs add just $59.', 'and why', r.ladder.why);
    ok(r.ladder.rungs[0].is === 'is-done' && r.ladder.rungs[0].n === 'Done' && r.ladder.rungs[1].is === 'is-current' && r.ladder.rungs[1].n === '3 / 5', 'step one done, step two the one to do', r.ladder.rungs.map(x => [x.is, x.n]));
    ok(r.ladder.rungs[0].vh === 'Step 1: Get 3, Pay 2 — yours, 1 pack free.' && r.ladder.rungs[1].vh === 'Step 2: Get 5, Pay 3 — 3 of 5. Best deal.', 'and in a sentence', r.ladder.rungs.map(x => x.vh));
    ok(r.ladder.best, 'the gold badge arrives with the second step', r.ladder.best);
    ok(r.ladder.rungs[0].free === 1 && r.ladder.rungs[1].button === 1 && r.ladder.rungs[1].wait === 1 && r.ladder.rungs[1].later === 0 && r.ladder.rungs[1].place === 'Add a pack: choose one for place 4',
       'the third place is ringed; the fourth is the one to fill', r.ladder.rungs);
    ok(r.sum.rows.deal.label === 'Get 3, Pay 2' && r.sum.save === 'You save $59 · 33% off', 'the summary shows the deal and the saving', [r.sum.rows.deal, r.sum.save]);
    ok(r.sum.next === 'With two more $59 packs your total is $177 — one of them is free.', 'and what the second step would come to', r.sum.next);
    ok(r.lines[2].free && r.lines[2].pill && r.lines[2].won === 'with Get 3, Pay 2' && r.lines[2].no === '03', 'the third line wears the pill', r.lines[2]);
    const weights = await page.evaluate(() => [].map.call(document.querySelectorAll('#main .prod__badge b, #main .rung__mark b'), b => getComputedStyle(b).fontWeight).filter((w, i, a) => a.indexOf(w) === i));
    ok(weights.join() === '700', 'and the word in it is the front page’s bold, not a fifth weight', weights);
    ok(r.live === 'Terra Presets added to your basket. Get 3, Pay 2 is yours: Terra Presets is free. Total $118.', 'what is announced stops at the total', r.live);
    ok(r.focus === 'ladderSay', 'because the keyboard is on the heading, which says what comes next', r.focus);
    ok(await page.evaluate(() => document.querySelector('[data-lines] .line.is-won') && document.querySelector('[data-lines] .line.is-won').getAttribute('data-line')) === 'Terra Presets', 'and the Free mark arrives on the line that earned it');
    agrees(r, '3 products');
    await page.waitForTimeout(1800);
    ok((await read(page)).cheer === 0, 'the celebration clears itself');

    await page.click('[data-add="Mely Presets"][data-from="more"]'); await page.waitForTimeout(450);
    r = await read(page);
    ok(r.ladder.say === 'One more and it’s on us.' && r.ladder.why === 'A $59 pack leaves your total at $177. That’s Get 5, Pay 3.', 'four: one more and it is on us', [r.ladder.say, r.ladder.why]);
    ok(r.ladder.pick.free && r.ladder.pick.name === 'Jardin Presets', 'the pick is free again', r.ladder.pick);
    ok(r.lines.filter(l => l.free).map(l => l.line).join() === 'Terra Presets', 'the free line is still the third', r.lines);
    ok(r.focus === 'add:Onyx Presets', 'focus is on the row that took the pressed one’s place', r.focus);
    ok(r.live === 'Mely Presets added to your basket. Total $177. One more and it’s on us.', 'what is announced', r.live);
    ok(r.cheer === 0, 'nothing is celebrated at four', r.cheer);
    agrees(r, '4 products');

    await page.click('.pick__go'); await cheered(page);
    r = await read(page);
    ok(r.cheer === 1, 'five: celebrated', r.cheer);
    ok(r.ladder.eyebrow === 'Both steps done' && r.ladder.say === 'Get 5, Pay 3 is yours.' && r.ladder.why === '2 of your 5 are on us — you save $118.', 'both steps done', [r.ladder.eyebrow, r.ladder.say, r.ladder.why]);
    ok(r.ladder.rungs.every(x => x.is === 'is-done') && r.ladder.ring, 'both steps ticked and the panel wears the ring', [r.ladder.rungs.map(x => x.is), r.ladder.ring]);
    ok(r.ladder.rungs[0].vh === 'Step 1: Get 3, Pay 2 — done.' && r.ladder.rungs[1].vh === 'Step 2: Get 5, Pay 3 — yours, 2 packs free. Best deal.', 'the first step is done, the second is the one that applies', r.ladder.rungs.map(x => x.vh));
    ok(r.ladder.rungs[0].free === 0 && r.ladder.rungs[1].free === 2, 'three paid in the first step, two free in the second', r.ladder.rungs);
    ok(r.engine.free.join() === 'Mely Presets,Jardin Presets' && r.lines[3].free && r.lines[4].free && !r.lines[2].free, 'the free mark has moved to the fourth and fifth; the third is paid again', [r.engine.free, r.lines]);
    ok(r.ladder.pick === null, 'there is no next pick: there is no next step', r.ladder.pick);
    ok(r.sum.rows.deal.label === 'Get 5, Pay 3' && r.sum.save === 'You save $118 · 40% off' && r.sum.next === null, 'one deal, the bigger one, and nothing more to point at', [r.sum.rows.deal, r.sum.save, r.sum.next]);
    ok(r.more === null && r.unfold === 'Add another pack', 'the shelf folds away behind one button', [r.more, r.unfold]);
    ok(r.focus === 'ladderSay', 'focus goes to what the campaign now says', r.focus);
    ok(r.bar.note === 'You save $118', 'the bar under the window says what was saved', r.bar.note);
    ok(r.live === 'Jardin Presets added to your basket. Get 5, Pay 3 is yours: Mely Presets and Jardin Presets are free. Total $177.', 'what is announced', r.live);
    ok(await page.evaluate(() => [].map.call(document.querySelectorAll('[data-lines] .line.is-won'), l => l.getAttribute('data-line')).join()) === 'Mely Presets,Jardin Presets', 'the Free mark is seen to arrive on the two it moved to');
    agrees(r, '5 products');
    await page.waitForTimeout(2600);

    await page.click('[data-unfold]'); await page.waitForTimeout(200);
    r = await read(page);
    ok(r.more && r.more.h === 'Add another pack' && r.more.sub === 'One deal per basket — from here each pack is at its own price.' && r.unfold === null && r.focus === 'moreH',
       'opened, the shelf says what a pack costs from here, and focus is on its heading', [r.more, r.unfold, r.focus]);
    ok(r.more.rows.length === 4 && r.more.rows.every(x => !x.free && x.price === '$59$119') && r.more.all === 'Show all 7 packs', 'every pack at its own price', r.more);

    await page.click('[data-add="Onyx Presets"]'); await page.waitForTimeout(450);
    r = await read(page);
    ok(r.cheer === 0, 'six: nothing new was unlocked, nothing is celebrated', r.cheer);
    ok(r.ladder.why === '2 of your packs are on us — you save $118. One deal per basket, so from the sixth on each pack is at its own price.', 'and the page says why', r.ladder.why);
    ok(r.sum.rows.total.value === '$236', 'six $59 packs come to $236', r.sum.rows.total);
    ok(r.lines[5].line === 'Onyx Presets' && r.lines[5].no === '06' && !r.lines[5].free, 'the sixth is line 06, at its own price', r.lines[5]);
    ok(r.live === 'Onyx Presets added to your basket. Total $236.', 'what is announced', r.live);
    ok(r.more !== null, 'once opened, the shelf stays open', r.more);
    agrees(r, '6 products');

    /* ── 2 · taking one out, and putting it back ── */
    section('2 · taking a pack out, and the way back');
    const before = r.stored;
    await page.click('[data-remove="Jardin Presets"]'); await page.waitForTimeout(650);
    r = await read(page);
    ok(r.lines[4] && r.lines[4].undo === 'Jardin Presets removed.', 'the way back is where the line was', r.lines.map(l => l.line || l.undo));
    ok(r.focus === 'undo', 'and focus is on it', r.focus);
    ok(r.live === 'Jardin Presets removed from your basket. Total $177.', 'what is announced (the deal still stands)', r.live);
    agrees(r, 'after a removal');
    await page.click('[data-undo]'); await page.waitForTimeout(300);
    r = await read(page);
    ok(r.stored === before, 'Undo puts back exactly what was there', r.stored);
    ok(r.focus === 'remove:Jardin Presets', 'focus returns to that line', r.focus);
    ok(r.live === 'Jardin Presets is back in your basket. Total $236.', 'and it is said', r.live);
    ok(r.cheer === 0, 'putting something back is not celebrated', r.cheer);
    agrees(r, 'after undo');
    /* down the ladder: the deal that is lost is named, once, where it happened */
    await page.click('[data-remove="Onyx Presets"]'); await page.waitForTimeout(200);
    await page.locator('[data-remove="Mely Presets"]').scrollIntoViewIfNeeded();
    const y0 = await page.evaluate(() => document.querySelector('[data-remove="Mely Presets"]').getBoundingClientRect().top);
    await page.click('[data-remove="Mely Presets"]'); await page.waitForTimeout(300);
    r = await read(page);
    const y1 = await page.evaluate(() => document.querySelector('[data-undo]').getBoundingClientRect().top);
    ok(Math.abs(y1 - y0) < 2, 'the pick and the shelf opened above it, and the way back is still exactly where the press was', [y0, y1]);
    ok(r.live === 'Mely Presets removed from your basket. Get 5, Pay 3 no longer applies; Get 3, Pay 2 does. Total $177. One more and it’s on us.', 'going down a step says which deal is left, and what to do', r.live);
    ok(r.lines.some(l => l.undo === 'Mely Presets removed. Get 5, Pay 3 no longer applies; Get 3, Pay 2 does.'), 'and the way back says it too', r.lines.filter(l => l.undo));
    ok(!r.ladder.ring && r.ladder.rungs[1].is === 'is-current' && r.unfold === null && r.more, 'the ring goes, step two is open again, and so is the shelf', [r.ladder.rungs.map(x => x.is), r.unfold]);
    agrees(r, 'back at 4');
    await page.click('[data-remove="Jardin Presets"]'); await page.waitForTimeout(300);
    r = await read(page);
    ok(r.live === 'Jardin Presets removed from your basket. Total $118. Two more and 2 of the 5 are on us.', 'a removal that loses nothing says so by saying nothing about it', r.live);
    await page.click('[data-remove="Terra Presets"]'); await page.waitForTimeout(300);
    r = await read(page);
    ok(r.live === 'Terra Presets removed from your basket. Get 3, Pay 2 no longer applies. Total $118. One more and it’s on us.', 'and the last deal lost is named', r.live);
    ok(!r.ladder.best && r.ladder.rungs[0].is === 'is-current', 'the badge goes back with it', [r.ladder.best, r.ladder.rungs.map(x => x.is)]);
    agrees(r, 'back at 2');
    await ctx.close();
  }

  /* ── 2b · one press is one press ────────────────────────────────── */
  section('2b · a double click, a double tap, Enter twice');
  {
    const kept = page => page.evaluate(() => JSON.parse(localStorage.getItem('rm-cart') || '{"items":[]}').items.join());
    const centre = async (page, sel) => { const l = page.locator(sel).first(); await l.scrollIntoViewIfNeeded(); await page.waitForTimeout(120);
      const b = await l.boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
    let o = await open({ state: S(['Lora Presets', 'Solis Presets', 'Terra Presets', 'Jardin Presets']) });
    let at = await centre(o.page, '[data-remove="Solis Presets"]');
    await o.page.mouse.click(at[0], at[1], { clickCount: 2 }); await o.page.waitForTimeout(250);
    let r = await read(o.page);
    ok(await kept(o.page) === 'Lora Presets,Terra Presets,Jardin Presets' && r.lines.some(l => l.undo), 'a double click on Remove takes that one line out, and the way back is left standing', [await kept(o.page), r.lines.map(l => l.line || l.undo)]);
    ok(r.live.indexOf('Solis Presets removed from your basket.') === 0, 'and what was said is that it was removed — not that it came back', r.live);
    await o.page.waitForTimeout(600);
    at = await centre(o.page, '[data-undo]');
    await o.page.mouse.click(at[0], at[1], { clickCount: 2 }); await o.page.waitForTimeout(250);
    ok(await kept(o.page) === 'Lora Presets,Solis Presets,Terra Presets,Jardin Presets', 'a double click on Undo puts it back and leaves it there', await kept(o.page));
    await o.page.waitForTimeout(600);
    await o.page.focus('[data-remove="Terra Presets"]');
    await o.page.keyboard.press('Enter'); await o.page.keyboard.press('Enter'); await o.page.waitForTimeout(250);
    ok(await kept(o.page) === 'Lora Presets,Solis Presets,Jardin Presets' && (await read(o.page)).focus === 'undo', 'Enter twice on Remove: one line out, and the keyboard on the way back', await kept(o.page));
    await o.page.waitForTimeout(600);
    await o.page.keyboard.press('Enter'); await o.page.waitForTimeout(250);
    ok(await kept(o.page) === 'Lora Presets,Solis Presets,Terra Presets,Jardin Presets', 'and after a moment Enter on Undo is answered', await kept(o.page));
    /* two different lines, quickly, are two presses */
    await o.page.waitForTimeout(600);
    await o.page.click('[data-remove="Lora Presets"]'); await o.page.waitForTimeout(120);
    await o.page.click('[data-remove="Jardin Presets"]'); await o.page.waitForTimeout(250);
    ok(await kept(o.page) === 'Solis Presets,Terra Presets', 'two different lines, one straight after the other, are both removed', await kept(o.page));
    await o.ctx.close();

    /* from the keyboard the same place is "nothing pressed in between" */
    o = await open({ state: S(['Lora Presets', 'Solis Presets', 'Terra Presets', 'Jardin Presets']) });
    await o.page.focus('[data-remove="Lora Presets"]');
    await o.page.keyboard.press('Enter'); await o.page.keyboard.press('Tab'); await o.page.keyboard.press('Enter'); await o.page.waitForTimeout(250);
    ok(await kept(o.page) === 'Terra Presets,Jardin Presets', 'Enter, Tab, Enter — as fast as a hand can — is two presses, and both are answered', await kept(o.page));
    await o.page.waitForTimeout(600);
    await o.page.focus('[data-remove="Terra Presets"]');
    await o.page.keyboard.down('Enter');
    for(let i = 0; i < 4; i++){ await o.page.waitForTimeout(260); await o.page.keyboard.down('Enter'); }   /* the key repeating, well past the half second */
    await o.page.keyboard.up('Enter'); await o.page.waitForTimeout(250);
    r = await read(o.page);
    ok(await kept(o.page) === 'Jardin Presets' && r.focus === 'undo', 'Enter held down is one press however long it is held: one line out, the way back untouched', [await kept(o.page), r.focus]);
    /* Enter, and then the mouse somewhere else, at once */
    await o.page.waitForTimeout(600);
    await centre(o.page, '[data-remove="Jardin Presets"]');
    await o.page.focus('.pick__go');
    await o.page.keyboard.press('Enter');
    {
      /* where the line is now — the pack that went in moved it — and no waiting */
      const line = o.page.locator('[data-remove="Jardin Presets"]');
      await line.scrollIntoViewIfNeeded();
      const b = await line.boundingBox();
      await o.page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    }
    await o.page.waitForTimeout(250);
    ok(await kept(o.page) === 'Lora Presets', 'Enter on the pick and then the mouse on a line are two presses: one pack in, one line out', await kept(o.page));
    await o.ctx.close();

    /* a press made for somebody by software has no key and no place: on
       the thing the page moved the keyboard to it is the same press, on
       anything else it is a new one */
    o = await open({ state: S([]) });
    await o.page.focus('.pick__go'); await o.page.keyboard.press('Enter'); await o.page.waitForTimeout(120);
    await o.page.evaluate(() => document.querySelector('[data-rules]').click()); await o.page.waitForTimeout(120);
    ok(await o.page.evaluate(() => !document.querySelector('[data-rules-list]').hidden), 'Enter on the pick, then a screen reader pressing “How the deals work” a moment later: the rules open', await kept(o.page));
    await o.page.waitForTimeout(600);
    await o.page.evaluate(() => { document.querySelector('.pick__go').click(); document.querySelector('.pick__go').click(); }); await o.page.waitForTimeout(250);
    ok(await kept(o.page) === 'Lora Presets,Solis Presets', 'and the same software pressing the pick twice in one breath adds one pack', await kept(o.page));
    /* the press that reaches a deal sends the keyboard to the heading, and a
       wider button gives way to a narrower one: still one press */
    await o.page.waitForTimeout(600);
    await o.page.evaluate(() => { document.querySelector('.pick__go').click(); document.querySelector('.pick__go').click(); }); await o.page.waitForTimeout(250);
    ok(await kept(o.page) === 'Lora Presets,Solis Presets,Terra Presets', 'also on the press that reaches a deal', await kept(o.page));
    await o.ctx.close();

    /* the browser's Back button is not a press on the page: what is pressed after it is answered */
    o = await open({ state: S(['Lora Presets', 'Solis Presets', 'Terra Presets']) });
    at = await centre(o.page, '.sum__go');
    await o.page.mouse.click(at[0], at[1]); await o.page.waitForTimeout(700);
    ok((await read(o.page)).view === 'pay', '(on to payment)');
    await o.page.goBack(); await o.page.waitForTimeout(60);
    await o.page.mouse.click(at[0], at[1]); await o.page.waitForTimeout(300);
    ok((await read(o.page)).view === 'pay', 'Back, and then Continue pressed again at once, goes on to payment', (await read(o.page)).view);
    await o.ctx.close();

    o = await open({ state: S(['Lora Presets']) });
    at = await centre(o.page, '.pick__go');
    await o.page.mouse.click(at[0], at[1], { clickCount: 2 }); await o.page.waitForTimeout(300);
    ok(await kept(o.page) === 'Lora Presets,Solis Presets', 'a double click on the pick adds one pack, not the one that took its place as well', await kept(o.page));
    await o.ctx.close();

    /* the second half of a double tap does nothing to the step it arrives on */
    o = await open({ state: S(['Lora Presets', 'Solis Presets', 'Terra Presets']), w: 768, h: 1024, touch: true });
    await o.page.waitForTimeout(400);
    at = await centre(o.page, '[data-bar-go]');
    await o.page.touchscreen.tap(at[0], at[1]); await o.page.touchscreen.tap(at[0], at[1]); await o.page.waitForTimeout(400);
    r = await read(o.page);
    const form = await o.page.evaluate(() => ({ agree: document.getElementById('payAgree').checked, errors: [].filter.call(document.querySelectorAll('.field__err'), e => !e.hidden).length }));
    ok(r.view === 'pay' && !form.agree && form.errors === 0, 'a double tap on Continue arrives at a payment form nobody has touched', [r.view, form]);
    await o.ctx.close();
  }

  /* ── 3 · mixed prices, the sampler, a bundle from the front page ─── */
  section('3 · the plugin pack, the sampler, the rules, and a bundle from the front page');
  {
    let o = await open({ state: S(['Lora Presets', 'Solis Presets']) });
    await o.page.click('[data-more-all]'); await o.page.waitForTimeout(250);
    let r = await read(o.page);
    ok(r.more.rows.length === 9 && r.more.all === null && r.live === '' && r.focus === 'add:Olbia LUTs', 'Show all shows the rest and puts focus on the first of them — that is the news, nothing is said twice', [r.more.rows.length, r.more.all, r.live, r.focus]);
    const plug = r.more.rows[r.more.rows.length - 1];
    ok(plug.name === 'Full Plugin Pack' && plug.price === '$90$149' && plug.with === 'a $59 pack goes free' && !plug.free, 'the one pack with a different story comes last: what it would add, and why', plug);
    ok(plug.aria === 'Add Full Plugin Pack to basket — adds $90 to your total: it is $149 and a $59 pack goes free with Get 3, Pay 2', 'and says so to a screen reader, without calling it a sale', plug.aria);
    ok(r.more.rows.slice(0, -1).every(x => x.free), 'every $59 pack reads Free', r.more.rows.map(x => x.price));
    await o.page.click('[data-add="Full Plugin Pack"]'); await o.page.waitForTimeout(400);
    r = await read(o.page);
    ok(r.sum.rows.total.value === '$208' && r.engine.free.join() === 'Solis Presets', 'two packs then the plugin pack: $208, and the free one is Solis', [r.sum.rows.total, r.engine.free]);
    ok(r.ladder.rungs[0].names.join() === 'Plugin Pack,Lora,Solis' && r.lines[0].line === 'Full Plugin Pack' && r.lines[0].no === '01', 'the plugin pack takes the first place and the first line, as on the front page', [r.ladder.rungs[0].names, r.lines[0]]);
    ok(r.lines[2].line === 'Solis Presets' && r.lines[2].free && r.lines[2].no === '03', 'and the free one is the third place', r.lines[2]);
    ok(r.live === 'Full Plugin Pack added to your basket. Get 3, Pay 2 is yours: Solis Presets is free. Total $208.', 'the announcement names the line that turned free', r.live);
    ok(r.lines[0].price === '$149$299' && r.lines[2].pill, 'and the receipt is what the row said: the plugin pack at its price, a $59 pack free', [r.lines[0], r.lines[2]]);
    agrees(r, 'plugin third');
    await o.ctx.close();

    o = await open({ state: S(['Demo Presets']) });
    r = await read(o.page);
    ok(r.sum.rows.total.value === '$0' && r.ladder.rungs[0].filled === 0, 'the sampler alone: $0, and no place taken', [r.sum.rows.total, r.ladder.rungs[0]]);
    ok(r.ladder.say === 'Pick any 3 and 1 of them is on us.' && r.ladder.why === 'Three $59 packs come to $118 instead of $177.', 'the campaign is where it would be with nothing in the basket', r.ladder);
    ok(r.lines[0].price === 'Free' && r.lines[0].no === '', 'its line reads Free and has no number', r.lines[0]);
    ok(r.more.rows.every(x => x.name !== 'Demo Presets') && r.ladder.pick.name !== 'Demo Presets', 'it is never offered as a pack to add', r.more.rows.map(x => x.name));
    ok(r.bar.note === 'Get 3, Pay 2 · 0 / 3', 'and the bar counts the packs that count', r.bar.note);
    agrees(r, 'sampler alone');
    /* the rules, for anyone who wants them */
    ok(r.rules.button === 'How the deals work' && r.rules.open === 'false' && !r.rules.shown, 'the rules are a line that opens', r.rules);
    await o.page.click('[data-rules]'); await o.page.waitForTimeout(150);
    r = await read(o.page);
    ok(r.rules.open === 'true' && r.rules.shown && r.rules.list.length === 4 && r.rules.list[0] === 'Only paid products count. Demo Presets is free already.'
       && r.rules.list[2] === 'The free ones are the lowest-priced of your packs. Which of your same-priced packs is marked free makes no difference to the total.'
       && r.rules.list[3] === 'Deals don’t stack: a sixth pack is at its own price.', 'four of them, in the engine’s own terms', r.rules);
    await o.page.click('[data-rules]'); await o.page.waitForTimeout(150);
    r = await read(o.page);
    ok(r.rules.open === 'false' && !r.rules.shown, 'and it closes again', r.rules);
    await o.ctx.close();

    o = await open({ state: S(['Aster LUTs'], { label: 'Bestseller bundle', packs: FIVE }) });
    r = await read(o.page);
    ok(r.lines[0].cap && /^Bestseller bundle · 5 packs\s*Take one out and the rest stay\.$/.test(r.lines[0].cap) && r.lines.filter(l => l.cap).length === 1, 'a bundle arrives as its packs, under one line that says so', r.lines.filter(l => l.cap));
    ok(r.lines.filter(l => l.line).map(l => l.line).join() === 'Full Plugin Pack,Lora Presets,Solis Presets,Terra Presets,Jardin Presets,Aster LUTs', 'its packs and the one added on its own are one receipt', r.lines.map(l => l.line));
    ok(r.lines.filter(l => l.line).map(l => / · Bestseller bundle$/.test(l.kind)).join() === 'true,true,true,true,true,false' && r.lines[2].kind === 'Preset pack · Bestseller bundle', 'and each line says whether it came in the bundle', r.lines.map(l => l.kind));
    ok(r.sum.rows.subtotal.value === '$444' && r.sum.rows.total.value === '$326', 'five and one: $444 less $118', r.sum.rows);
    ok(r.engine.free.join() === 'Terra Presets,Jardin Presets', 'the same two free as the front page ringed', r.engine.free);
    ok(r.cheer === 0 && r.ladder.ring && r.unfold === 'Add another pack', 'it was celebrated where it was bought, not here', [r.cheer, r.ladder.ring, r.unfold]);
    agrees(r, 'bundle and one');
    const kept = r.stored;
    await o.page.click('[data-remove="Terra Presets"]'); await o.page.waitForTimeout(650);
    r = await read(o.page);
    ok(JSON.parse(r.stored).bundle === null && JSON.parse(r.stored).items.join() === 'Full Plugin Pack,Lora Presets,Solis Presets,Jardin Presets,Aster LUTs',
       'taking one out lets go of the bundle and keeps the rest', r.stored);
    ok(r.lines.some(l => l.undo === 'Terra Presets removed. The bundle is now 4 separate packs.') && !r.lines.some(l => l.cap), 'and says so, in place of the line that named it', r.lines.filter(l => l.undo || l.cap));
    ok(r.live === 'Terra Presets removed from your basket. The bundle is now 4 separate packs. Total $267.', 'aloud too', r.live);
    ok(r.sum.rows.total.value === '$267', 'the five that are left still earn Get 5, Pay 3', r.sum.rows.total);
    agrees(r, 'bundle dissolved');
    await o.page.click('[data-undo]'); await o.page.waitForTimeout(300);
    r = await read(o.page);
    ok(r.stored === kept, 'Undo gives the bundle back whole', r.stored);
    await o.ctx.close();
  }

  /* ── 4 · nothing in it ──────────────────────────────────────────── */
  section('4 · the empty basket');
  {
    let o = await open({ state: '' });
    let r = await read(o.page);
    ok(r.h1.join() === 'Your basket is empty.' && r.emptyOnly >= 3, 'it says so, and offers the two ways on', [r.h1, r.emptyOnly]);
    ok(!r.linesShown && r.sum === null && r.bar.hidden, 'no lines, no summary, no bar under the window', [r.linesShown, r.sum, r.bar]);
    ok(r.ladder.say === 'Pick any 3 and 1 of them is on us.' && r.ladder.why === 'Three $59 packs come to $118 instead of $177.', 'the campaign is still there, from the start', r.ladder);
    ok(r.ladder.rungs[0].place === 'Add a pack: choose one for place 1' && r.ladder.rungs[0].wait === 2, 'with its first place to fill', r.ladder.rungs[0]);
    ok(r.badge === '0' && r.bagLabel === 'Basket, empty', 'the bar says empty', [r.badge, r.bagLabel]);
    await o.page.click('.pick__go'); await o.page.waitForTimeout(400);
    r = await read(o.page);
    ok(r.h1.join() === 'Your basket' && r.linesShown && r.sum && r.lines.length === 1, 'one press and it is a basket', [r.h1, r.lines]);
    await o.page.click('[data-remove]'); await o.page.waitForTimeout(650);
    r = await read(o.page);
    ok(r.undoSolo === 'Lora Presets removed.' && r.h1.join() === 'Your basket is empty.', 'the last line out leaves the way back standing', [r.undoSolo, r.h1]);
    ok(r.live === 'Lora Presets removed from your basket. Your basket is empty.', 'and it is said', r.live);
    ok(r.stored === null, 'and nothing kept', r.stored);
    await o.page.click('[data-undo]'); await o.page.waitForTimeout(300);
    r = await read(o.page);
    ok(r.lines.length === 1 && r.undoSolo === null, 'Undo brings it back', r.lines);
    await o.ctx.close();
  }

  /* ── 5 · the three steps, and the form ──────────────────────────── */
  section('5 · payment and done');
  {
    let o = await open({ state: S(['Lora Presets', 'Solis Presets', 'Terra Presets']) });
    const page = o.page;
    await page.click('.sum__go'); await page.waitForTimeout(300);
    let r = await read(page);
    ok(r.view === 'pay' && r.hash === '#pay' && r.title === 'Payment — Retouch Market', 'Continue goes to payment', [r.view, r.hash, r.title]);
    ok(r.h1.join() === 'PaymentPreview' && r.focus === 'payH', 'one heading, marked Preview, and focus on it', [r.h1, r.focus]);
    const shape = await page.evaluate(() => {
      const back = document.querySelector('.pay__back'), h1 = document.getElementById('payH'), form = document.getElementById('payForm');
      return { backFirst: !!(back.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING),
        noteFirst: form.firstElementChild.id === 'payNote', note: form.firstElementChild.textContent.replace(/\s+/g, ' ').trim(),
        where: form.querySelector('h2').textContent, fine: form.querySelector('.pay__fine').textContent,
        says: document.querySelector('[data-pay-go]').getAttribute('aria-describedby'),
        agree: form.querySelector('.agree').textContent.replace(/\s+/g, ' ').trim(), agreeLinks: form.querySelectorAll('.agree a').length,
        agreeHint: document.getElementById('payAgreeHint').textContent, agreeBy: document.getElementById('payAgree').getAttribute('aria-describedby'),
        card: form.querySelector('[data-s="card_note"]').textContent };
    });
    ok(r.back === 'Back to basket' && shape.backFirst, 'the way back is above the heading', [r.back, shape.backFirst]);
    ok(shape.noteFirst && shape.note === 'Design preview. No payment is taken, and nothing you type here is stored or sent.', 'the form says it is a preview before it asks for anything', shape);
    ok(shape.where === 'Where should we send it?' && shape.fine === 'Preview only. You won’t be charged.' && shape.says === 'payNote', 'and again under the button that completes it', shape);
    ok(shape.agree === 'I have read and accept the Distance sales contract and the Delivery & returns terms.' && shape.agreeLinks === 0
       && shape.agreeHint === 'These two documents are not published yet — in this preview the tick only shows how the step works.' && shape.agreeBy === 'payAgreeHint',
       'the agreement names two documents without pretending to link to them, and says what the tick is', shape);
    ok(!/secure/i.test(shape.card), 'and nothing is called secure that is not there', shape.card);
    /* links that only change the hash must not change the view */
    await page.evaluate(() => document.querySelector('a.skip').click()); await page.waitForTimeout(150);
    r = await read(page);
    ok(r.view === 'pay' && r.hash === '#pay' && r.focus === 'payH', 'Skip to content goes to this step’s heading, not back to the basket', [r.view, r.hash, r.focus]);
    await page.evaluate(() => document.querySelector('footer a[href="#"]').click()); await page.waitForTimeout(150);
    r = await read(page);
    ok(r.view === 'pay' && r.hash === '#pay', 'a footer link to a page not written yet leaves the step standing', [r.view, r.hash]);
    await page.evaluate(() => { location.hash = '#main'; }); await page.waitForTimeout(150);
    r = await read(page);
    ok(r.view === 'pay' && r.hash === '#pay', 'and so does any hash that is not a route', [r.view, r.hash]);
    /* (a hash typed into the address is a step in the history, as it always is: one Back undoes it) */
    await page.goBack(); await page.waitForTimeout(200);
    r = await read(page);
    ok(r.view === 'pay' && r.hash === '#pay', 'and Back from it is still this step', [r.view, r.hash]);
    ok(r.sum.mini === 3 && r.sum.rows.total.value === '$118', 'the summary lists the order', r.sum);
    ok(r.bar.hidden, 'the bar under the window is the basket’s: this step has one button, at the end of the form', r.bar);
    ok(await page.evaluate(() => document.querySelector('[data-pay-go]').textContent) === 'Complete order — $118', 'the button carries the total');
    ok(await page.evaluate(() => !document.querySelector('#payForm input[name="card"], #payForm input[autocomplete^="cc-"]') && document.querySelectorAll('#payForm input').length === 3), 'there is no card field to type into');
    ok(await page.evaluate(() => !document.getElementById('payForm').hasAttribute('action')), 'and the form goes nowhere');
    await page.goBack(); await page.waitForTimeout(300);
    r = await read(page);
    ok(r.view === 'basket' && r.hash === '', 'Back is the basket', [r.view, r.hash]);
    await page.goForward(); await page.waitForTimeout(300);

    await page.click('[data-pay-go]'); await page.waitForTimeout(200);
    r = await read(page);
    ok(r.view === 'pay', 'an empty form goes nowhere', r.view);
    const errs = () => page.evaluate(() => ['payEmail', 'payName', 'payAgree'].map(id => {
      const el = document.getElementById(id), err = document.getElementById(id + 'Err');
      return { bad: el.getAttribute('aria-invalid'), err: err.hidden ? '' : err.textContent.trim(), by: el.getAttribute('aria-describedby') };
    }));
    let e = await errs();
    ok(e[0].err === 'Enter your email address.' && e[1].err === 'Enter your full name.' && e[2].err === 'Tick the box to accept the contract and the terms.', 'each field says what it needs', e);
    ok(e.every(x => x.bad === 'true') && e[0].by === 'payEmailErr payEmailHint' && e[1].by === 'payNameErr' && e[2].by === 'payAgreeErr payAgreeHint', 'and is marked for a screen reader', e);
    ok(r.focus === 'payEmail' && r.live === '3 things need fixing before you can continue.', 'focus goes to the first, and the count is announced', [r.focus, r.live]);
    await page.fill('#payEmail', 'ayse@example'); await page.waitForTimeout(80);
    e = await errs();
    ok(e[0].err === 'That doesn’t look like an email address. Check the @ and the dot.', 'a half-typed address is told what is missing', e[0]);
    await page.fill('#payEmail', 'Ayse+shop@Example.com'); await page.waitForTimeout(80);
    e = await errs();
    ok(e[0].err === '' && e[0].bad === 'false' && e[0].by === 'payEmailHint', 'and the message goes the moment it is right (a plus sign is fine)', e[0]);
    await page.fill('#payName', 'Q'); await page.waitForTimeout(80);
    e = await errs();
    ok(e[1].err === '', 'one letter is a name: the page does not decide how long a name is', e[1]);
    await page.fill('#payName', 'Zebrowski'); await page.check('#payAgree'); await page.waitForTimeout(80);
    e = await errs();
    ok(e.every(x => x.err === '') && e[1].by === null && e[2].by === 'payAgreeHint', 'a one-word name is a name', e);
    const stored = await page.evaluate(() => localStorage.getItem('rm-cart'));
    const keysBefore = await page.evaluate(() => Object.keys(localStorage).sort().join());
    await page.click('[data-pay-go]'); await page.waitForTimeout(400);
    r = await read(page);
    ok(r.view === 'done' && r.hash === '#done' && r.h1.join() === 'Order complete — in preview' && r.title === 'Order complete (preview) — Retouch Market', 'a complete form is Done — in preview, in the tab’s title too', [r.view, r.h1, r.title]);
    await page.evaluate(() => { document.querySelector('a.skip').click(); document.querySelector('footer a[href="#"]').click(); }); await page.waitForTimeout(150);
    ok((await read(page)).view === 'done', 'and the two kinds of link that only touch the hash leave it standing');
    const p = await page.evaluate(() => document.querySelector('[data-view-name="done"] .lede').textContent);
    ok(p === 'No payment was taken, and nothing you typed was stored or sent. In the live shop your downloads are ready right after payment.', 'it says that nothing was taken and nothing kept', p);
    ok(r.sum.rows.total.label === 'Total — not charged' && r.sum.rows.total.value === '$118' && r.sum.mini === 3, 'the receipt says not charged', r.sum);
    ok(r.stored === stored && await page.evaluate(() => Object.keys(localStorage).sort().join()) === keysBefore, 'the basket is as it was, and nothing typed was kept', r.stored);
    const gone = await page.evaluate(() => ({ email: document.getElementById('payEmail').value, name: document.getElementById('payName').value,
      agree: document.getElementById('payAgree').checked, session: sessionStorage.length, search: location.search,
      inPage: /ayse\+shop|Zebrowski/i.test(document.documentElement.innerHTML) }));
    ok(gone.email === '' && gone.name === '' && !gone.agree && gone.session === 0 && gone.search === '' && !gone.inPage, 'the form is emptied, and what was typed is nowhere on the page or in its address', gone);
    ok(r.bar.hidden, 'no bar under the window once it is done', r.bar);
    await page.goBack(); await page.waitForTimeout(300);
    r = await read(page);
    ok(r.view === 'basket', 'Back from Done is the basket, never the finished form', [r.view, r.hash]);
    await o.ctx.close();

    /* Back from payment is the basket where it was left, not its top */
    o = await open({ state: S(['Lora Presets', 'Solis Presets', 'Terra Presets']), w: 1440, h: 700 });
    await o.page.evaluate(() => window.scrollTo({ top: 420, behavior: 'instant' })); await o.page.waitForTimeout(150);
    await o.page.locator('.sum__go').scrollIntoViewIfNeeded(); await o.page.waitForTimeout(150);
    const left = (await read(o.page)).scrollY;
    await o.page.click('.sum__go'); await o.page.waitForTimeout(300);
    r = await read(o.page);
    ok(left > 100 && r.view === 'pay' && r.scrollY === 0, 'a step forward starts at its top', [left, r.view, r.scrollY]);
    await o.page.goBack(); await o.page.waitForTimeout(400);
    r = await read(o.page);
    ok(r.view === 'basket' && Math.abs(r.scrollY - left) < 3, 'and the way back returns to where the basket was left', [r.view, r.scrollY, left]);
    ok(await o.page.evaluate(() => document.activeElement.classList.contains('sum__go')), 'with the keyboard on the button that was pressed to leave it, not on a heading off the screen',
       await o.page.evaluate(() => document.activeElement.outerHTML.slice(0, 80)));
    await o.ctx.close();

    /* whatever is typed stays text, and stays in the field */
    o = await open({ state: S(['Lora Presets']), hash: 'pay' });
    await o.page.fill('#payEmail', '"><b>x</b>@example.com'); await o.page.fill('#payName', '<img src=x onerror=alert(1)>'); await o.page.check('#payAgree');
    await o.page.click('[data-pay-go]'); await o.page.waitForTimeout(300);
    ok(await o.page.evaluate(() => document.getElementById('main').getAttribute('data-view') === 'done'
      && ![].some.call(document.querySelectorAll('#main b'), b => b.textContent === 'x') && !document.querySelector('#main img[src="x"]')), 'markup typed into the form never becomes markup');
    await o.ctx.close();

    /* routes that must not open */
    o = await open({ state: '', hash: 'pay' });
    r = await read(o.page);
    ok(r.view === 'basket' && r.hash === '', 'payment with nothing to pay for is the basket', [r.view, r.hash]);
    await o.ctx.close();
    o = await open({ state: S(['Lora Presets']), hash: 'done' });
    r = await read(o.page);
    ok(r.view === 'basket' && r.hash === '', 'Done without an order is the basket', [r.view, r.hash]);
    await o.ctx.close();
    o = await open({ state: S(['Demo Presets']), hash: 'pay' });
    ok(await o.page.evaluate(() => document.querySelector('[data-paybox]').hidden && document.querySelector('[data-pay-go]').textContent === 'Complete order — Free'), 'a basket that costs nothing asks for no card');
    ok(await o.page.evaluate(() => !!document.querySelector('[data-paysum] .sum__mini .choice__shot--mark svg')), 'and what has no box wears the shop’s mark in the summary, as on its line');
    await o.ctx.close();

    /* Done says the basket is as it was left only while it is */
    o = await open({ state: S(['Lora Presets', 'Solis Presets', 'Terra Presets']), hash: 'pay' });
    await o.page.fill('#payEmail', 'a@b.co'); await o.page.fill('#payName', 'A B'); await o.page.check('#payAgree');
    await o.page.click('[data-pay-go]'); await o.page.waitForTimeout(400);
    const still = () => o.page.evaluate(() => { const el = document.querySelector('.done__still'); return !el.hidden && el.getClientRects().length > 0; });
    ok(await still(), 'straight after the order: "Your basket is still as you left it."');
    await o.page.click('[data-view-name="done"] [data-go="basket"]'); await o.page.waitForTimeout(700);
    await o.page.click('[data-remove="Solis Presets"]'); await o.page.waitForTimeout(300);
    await o.page.goBack(); await o.page.waitForTimeout(400);
    r = await read(o.page);
    ok(r.view === 'done' && !(await still()) && r.sum.mini === 3, 'after the basket has been changed the receipt still shows what was ordered, and no longer says that', [r.view, await still(), r.sum && r.sum.mini]);
    await o.ctx.close();
    /* the one echo of the campaign on the payment step, and only when it is true */
    o = await open({ state: S(['Lora Presets', 'Solis Presets']), hash: 'pay' });
    ok(await o.page.evaluate(() => { const n = document.querySelector('.sum__nudge'); return !!n && n.textContent.replace(/\s+/g, ' ').trim(); }) === 'One more $59 pack would be free. Back to basket', 'two packs: the payment step says one more would be free — at the price it is true for');
    await o.ctx.close();
    o = await open({ state: S(['Lora Presets']), hash: 'pay' });
    ok(await o.page.evaluate(() => !document.querySelector('.sum__nudge')), 'one pack: it says nothing');
    await o.ctx.close();
  }

  /* ── 6 · Turkish ────────────────────────────────────────────────── */
  section('6 · in Turkish');
  {
    let o = await open({ state: S(['Lora Presets', 'Solis Presets']), lang: 'tr' });
    const page = o.page;
    let r = await read(page);
    ok(r.lang === 'tr' && r.htmlLang === 'tr' && r.title === 'Sepetim — Retouch Market' && r.h1.join() === 'Sepetim', 'the page is in Turkish, and the document says it is', [r.lang, r.htmlLang, r.title, r.h1]);
    ok(await visible(page), 'and can be seen');
    ok(await o.page.evaluate(() => ['#nav', 'footer.footer', 'a.skip', '#toTop'].map(s => document.querySelector(s).getAttribute('lang')).join()) === 'en,en,en,en', 'while what stays English says so for itself');
    ok(r.ladder.say === '1 ürün daha ekle, 1 ürün bedava kazan.', 'two products: the owner’s own sentence', r.ladder.say);
    ok(r.ladder.why === '$59’lık bir ürün toplamını değiştirmez: yine $118. 3 Al 2 Öde tam da bu.', 'and why', r.ladder.why);
    ok(r.ladder.eyebrow === 'Adım 1/2 · 3 Al 2 Öde' && r.ladder.pick.label === 'Bedava ürünün' && r.ladder.pick.go === 'Bedava ürününü ekle', 'the step — of two — and the pick', r.ladder);
    ok(r.ladder.rungs[0].vh === '1. adım: 3 Al 2 Öde — 3 üründen 2 tanesi sepette.' && r.ladder.rungs[1].vh === '2. adım: 5 Al 3 Öde — sonraki adım.' && r.ladder.rungs[1].n === 'Sırada'
       && r.ladder.rungs[0].place === '3. yer için bedava ürününü seç', 'the steps, in words that are not read out as a fraction, and the next place', r.ladder.rungs);
    ok(r.more.h === 'Ya da başka birini seç' && r.more.sub === 'Sıradaki $59’lık ürünün bedava.' && r.more.all === 'Tüm ürünleri göster (9)' && r.more.rows[0].price === 'Bedava$59',
       'the shelf', r.more);
    ok(r.sum.next === '$59’lık 1 ürün daha eklersen toplamın yine $118.' && r.sum.go === 'Ödemeye geç', 'the summary', r.sum);
    ok(r.rules.button === 'Kampanyalar nasıl işliyor?' && r.rules.list[0] === 'Kampanyaya yalnızca ücretli ürünler dahil. Demo Presets zaten ücretsiz.'
       && r.rules.list[1] === 'Her sepette tek kampanya geçerli: hak kazandığın en avantajlısı.' && r.rules.list[3] === 'Kampanyalar birleştirilemez: altıncı ürün kendi fiyatındadır.', 'the rules, as a shop in Türkiye writes them', r.rules);
    ok(r.bagLabel === 'Sepet, 2 ürün' && r.bar.label === 'Toplam ve ödeme' && r.bar.go === 'Ödemeye geç' && r.bar.short === 'Ödemeye geç' && r.bar.aria === 'Ödemeye geç', 'the bar in the header and the bar under the window, whose button is called what it shows at every width', [r.bagLabel, r.bar]);
    ok(r.ladder.pick.aria === 'Bedava ürününü ekle: Terra Presets — 3 Al 2 Öde ile bedava', 'the pick’s button is called what is printed on it', r.ladder.pick.aria);
    await page.click('.pick__go'); await page.waitForTimeout(400);
    r = await read(page);
    ok(r.cheerLead === 'Kazancın', 'the celebration is in Turkish too', r.cheerLead);
    ok(r.live === 'Terra Presets sepete eklendi. 3 Al 2 Öde uygulandı: Terra Presets bedava. Toplam $118.', 'and so is what is announced', r.live);
    ok(r.sum.save === 'Kazancın $59 · %33 indirim', 'the percent sign goes in front', r.sum.save);
    ok(r.sum.next === '$59’lık 2 ürün daha eklersen toplamın $177 olur — 1’i bedava.', 'what the second step would come to', r.sum.next);
    ok(r.ladder.rungs[0].vh === '1. adım: 3 Al 2 Öde — kazandın, 1 ürün bedava.' && r.ladder.rungs[1].vh === '2. adım: 5 Al 3 Öde — 5 üründen 3 tanesi sepette. En iyi fırsat.' && r.ladder.rungs[0].n === 'Tamam', 'the steps, one done', r.ladder.rungs.map(x => x.vh));
    ok(r.ladder.say === '2 ürün daha ekle, 5 üründen 2’si bizden.' && r.ladder.why === '3 Al 2 Öde fırsatını yakaladın — Terra Presets bedava. $59’lık iki ürün daha toplamına yalnızca $59 ekler.', 'the next step, and why', [r.ladder.say, r.ladder.why]);
    agrees(r, 'Turkish, 3 products');
    await page.waitForTimeout(2500);
    await page.click('[data-remove="Terra Presets"]'); await page.waitForTimeout(650);
    r = await read(page);
    ok(r.live === 'Terra Presets sepetten çıkarıldı. 3 Al 2 Öde artık geçerli değil. Toplam $118. 1 ürün daha ekle, 1 ürün bedava kazan.', 'a deal lost is said plainly', r.live);
    ok(r.lines.some(l => l.undo === 'Terra Presets sepetten çıkarıldı. 3 Al 2 Öde artık geçerli değil.'), 'in the way back too', r.lines.filter(l => l.undo));
    await page.click('[data-undo]'); await page.waitForTimeout(300);
    r = await read(page);
    ok(r.live === 'Terra Presets sepete geri eklendi. Toplam $118.', 'and so is the way back', r.live);
    /* changing it on the page changes the page, there and then */
    await page.evaluate(() => window.RMLang.set('en')); await page.waitForTimeout(200);
    r = await read(page);
    ok(r.lang === 'en' && r.htmlLang === 'en' && r.h1.join() === 'Your basket' && r.ladder.say === 'Two more and 2 of the 5 are on us.' && r.cheer === 0, 'the language switch redraws everything, and celebrates nothing', [r.lang, r.htmlLang, r.h1, r.ladder.say, r.cheer]);
    ok(r.live.indexOf('sepete') > -1 || r.live === '', 'and announces nothing new', r.live);
    await page.evaluate(() => window.RMLang.set('tr'));
    await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(250);
    r = await read(page);
    ok(r.lang === 'tr' && r.h1.join() === 'Sepetim', 'and it is remembered', [r.lang, r.h1]);
    /* the Turkish strings that are not English ones: every key has both */
    const gaps = await page.evaluate(() => {
      const out = [];
      window.RMLang.set('en'); const en = {}; document.querySelectorAll('#main [data-s]').forEach(el => en[el.getAttribute('data-s')] = el.textContent);
      window.RMLang.set('tr'); document.querySelectorAll('#main [data-s]').forEach(el => {
        const k = el.getAttribute('data-s'); if(!el.textContent || el.textContent === 'undefined' || el.textContent === en[k]) out.push(k); });
      return out;
    });
    ok(gaps.length === 0, 'every fixed string on the page has its own Turkish', gaps);
    await o.ctx.close();

    o = await open({ state: S(['Lora Presets', 'Solis Presets', 'Terra Presets', 'Jardin Presets']), lang: 'tr' });
    r = await read(o.page);
    ok(r.ladder.eyebrow === 'Adım 2/2 · 5 Al 3 Öde' && r.ladder.say === '1 ürün daha ekle, 1 ürün daha bedava kazan.' && r.ladder.why === '$59’lık bir ürün toplamını değiştirmez: yine $177. 5 Al 3 Öde tam da bu.', 'four products: one more, one more free', r.ladder);
    await o.page.click('.pick__go'); await o.page.waitForTimeout(400);
    r = await read(o.page);
    ok(r.ladder.eyebrow === 'İki adım da tamam' && r.ladder.say === '5 Al 3 Öde fırsatını yakaladın.' && r.ladder.why === '5 ürününün 2’si bizden — kazancın $118.' && r.unfold === 'Bir ürün daha ekle' && r.bar.note === 'Kazancın $118',
       'five: both steps done', [r.ladder, r.unfold, r.bar.note]);
    ok(r.live === 'Mely Presets sepete eklendi. 5 Al 3 Öde uygulandı: Jardin Presets ve Mely Presets bedava. Toplam $177.', 'and what is announced', r.live);
    await o.ctx.close();

    /* one product is a "paket"; several bought together are a "set" */
    o = await open({ state: S([], { label: 'Bestseller bundle', packs: FIVE }), lang: 'tr' });
    r = await read(o.page);
    ok(/^Çok satanlar seti · 5 ürün\s*Birini çıkarırsan diğerleri kalır\.$/.test(r.lines[0].cap) && r.lines[2].kind === 'Preset paketi · Çok satanlar seti', 'a bundle from the front page is a set of packs', [r.lines[0], r.lines[2]]);
    await o.page.click('[data-remove="Terra Presets"]'); await o.page.waitForTimeout(300);
    r = await read(o.page);
    ok(r.live === 'Terra Presets sepetten çıkarıldı. Set artık 4 ayrı ürün. 5 Al 3 Öde artık geçerli değil; 3 Al 2 Öde geçerli. Toplam $267. 1 ürün daha ekle, 1 ürün daha bedava kazan.', 'taking one out: the set is let go of, the deal that went is named, and the total has not moved', r.live);
    await o.ctx.close();

    /* a message already under a field changes language with the rest */
    o = await open({ state: S(['Lora Presets']), lang: 'tr', hash: 'pay' });
    await o.page.click('[data-pay-go]'); await o.page.waitForTimeout(200);
    const trErr = await o.page.evaluate(() => document.getElementById('payEmailErr').textContent.trim());
    await o.page.evaluate(() => window.RMLang.set('en')); await o.page.waitForTimeout(200);
    const enErr = await o.page.evaluate(() => document.getElementById('payEmailErr').textContent.trim());
    ok(trErr === 'E-posta adresini yaz.' && enErr === 'Enter your email address.', 'an error showing under a field follows the language', [trErr, enErr]);
    await o.ctx.close();
  }

  /* ── 7 · the two pages share one basket ─────────────────────────── */
  section('7 · the front page and the basket page');
  {
    const o = await open({ state: S(['Lora Presets']) });
    const home = await o.ctx.newPage();
    home.on('pageerror', e => errors.push('index: ' + String(e)));
    await home.goto(BASE + 'index.html', { waitUntil: 'load' }); await home.waitForTimeout(600);
    ok(await home.evaluate(() => document.querySelector('.cart__n').textContent) === '1', 'the front page opens with the same one product in its bar');
    ok(await home.evaluate(() => document.querySelector('[data-basket]').getAttribute('href')) === 'cart.html', 'and its basket goes to the basket page');
    {
      const old = await o.ctx.newPage();
      await old.goto(BASE + 'index.html', { waitUntil: 'load' });
      await old.evaluate(() => localStorage.setItem('rm-cart', JSON.stringify({ v: 1, items: ['A pack no longer on sale'], bundle: null })));
      await old.reload({ waitUntil: 'load' }); await old.waitForTimeout(500);
      const bar = await old.evaluate(() => [document.querySelector('.cart__n').textContent, document.querySelector('[data-basket]').getAttribute('aria-label')]);
      ok(bar.join('|') === '0|Basket, empty', 'a name the catalogue no longer has is not counted in the front page’s bar', bar);
      await old.evaluate(() => localStorage.setItem('rm-cart', JSON.stringify({ v: 1, items: ['Lora Presets'], bundle: null })));
      await old.close();
      await home.reload({ waitUntil: 'load' }); await home.waitForTimeout(600);
    }
    await o.page.focus('[data-remove="Lora Presets"]');
    await home.evaluate(() => { [].slice.call(document.querySelectorAll('.card__add')).filter(b => /Onyx Presets/.test(b.getAttribute('aria-label')))[0].click(); });
    await o.page.waitForTimeout(400);
    let r = await read(o.page);
    ok(r.lines.map(l => l.line).join() === 'Lora Presets,Onyx Presets', 'a pack added on the front page arrives on the basket page', r.lines);
    ok(r.cheer === 0 && r.live === '', 'quietly: it was not pressed here', [r.cheer, r.live]);
    ok(r.focus === 'remove:Lora Presets', 'and the keyboard is still where it was, though the list was redrawn', r.focus);
    agrees(r, 'after the front page added one');
    await o.page.click('[data-remove="Onyx Presets"]'); await home.waitForTimeout(400);
    ok(await home.evaluate(() => { const b = [].slice.call(document.querySelectorAll('.card__add')).filter(x => /Onyx Presets/.test(x.getAttribute('aria-label')))[0]; return b.getAttribute('aria-pressed') + '|' + b.textContent.trim(); }) === 'false|Add to cart',
       'and one taken out here is offered again there');
    /* the front page's own bundle, priced here to the dollar */
    await home.evaluate(() => { const go = document.querySelector('[data-go]'); go.scrollIntoView(); go.click(); });
    await o.page.waitForTimeout(500);
    r = await read(o.page);
    const label = await home.evaluate(() => document.querySelector('[data-save]').textContent.replace(/\s+/g, ' ').trim());
    ok(r.sum.rows.total.value === '$267' && r.sum.rows.subtotal.value === '$385' && /You save \$118/.test(label), 'the front page’s Get 5, Pay 3 bundle is $267 of $385 on both pages', [r.sum.rows, label]);
    ok(r.lines[0].cap && r.engine.free.join() === 'Terra Presets,Jardin Presets', 'the same two packs free', r.engine.free);
    ok(r.ladder.rungs[0].names.join() === 'Plugin Pack,Lora,Solis' && r.ladder.rungs[1].names.join() === 'Terra,Jardin' && r.ladder.rungs[1].free === 2, 'in the same five places, the last two ringed', r.ladder.rungs);
    await home.evaluate(() => window.RMLang.set('tr')); await o.page.waitForTimeout(400);
    r = await read(o.page);
    ok(r.lang === 'tr' && r.h1.join() === 'Sepetim' && r.cheer === 0, 'the language chosen on the front page is followed here, quietly', [r.lang, r.h1, r.cheer]);
    await o.ctx.close();

    /* the product panel on the front page keeps the same basket, and follows it while it is open */
    const q = await open({ state: '' });
    const shop = q.page;
    await shop.goto(BASE + 'index.html', { waitUntil: 'load' }); await shop.waitForTimeout(900);
    const card = shop.locator('#presetGrid .card', { hasText: 'Lora Presets' }).first();
    await card.scrollIntoViewIfNeeded(); await shop.waitForTimeout(300);
    await card.locator('.card__t').first().click(); await shop.waitForTimeout(900);
    const face = () => shop.evaluate(() => { const b = document.getElementById('rmp-add'); const t = el => el ? el.textContent.replace(/\s+/g, ' ').trim() : null;
      return b ? { words: t(b), pressed: b.getAttribute('aria-pressed'), off: b.getAttribute('aria-disabled'), live: t(document.getElementById('rmp-live')), badge: t(document.querySelector('.cart__n')) } : null; });
    let f = await face();
    ok(f && f.words === 'Sepete ekle' && f.pressed === 'false' && f.badge === '0', 'the product panel opens on a pack that is not in the basket', f);
    const elsewhere = await q.ctx.newPage();
    await elsewhere.goto(BASE + 'cart.html', { waitUntil: 'load' });
    await elsewhere.evaluate(state => localStorage.setItem('rm-cart', state), S([], { label: 'Bestseller bundle', packs: ['Lora Presets', 'Solis Presets', 'Terra Presets'] }));
    await shop.waitForTimeout(600);
    f = await face();
    ok(f.words === 'SetindeÖnce seti çıkar' && f.pressed === 'true' && f.off === 'true' && f.badge === '3', 'a bundle holding that pack arrives from another tab: the open panel says so by itself', f);
    /* (a real press at the button's place: the test driver will not press what says it is disabled, and a customer can) */
    await shop.bringToFront();
    { const at = await shop.locator('#rmp-add').boundingBox(); await shop.mouse.click(at.x + at.width / 2, at.y + at.height / 2); }
    await shop.waitForTimeout(300);
    f = await face();
    ok(f.live === 'Lora Presets sepetindeki sette. Çıkarmak için önce seti çıkar.' && f.badge === '3', 'and a press on it is explained — not swallowed, and not an error', f);
    await elsewhere.evaluate(state => localStorage.setItem('rm-cart', state), S([]));
    await shop.waitForTimeout(600);
    f = await face();
    ok(f.words === 'Sepete ekle' && f.off === null && f.badge === '0', 'the bundle is taken away elsewhere, and the button is a button again', f);
    await shop.click('#rmp-add'); await shop.waitForTimeout(300);
    f = await face();
    ok(f.pressed === 'true' && f.badge === '1' && await shop.evaluate(() => JSON.parse(localStorage.getItem('rm-cart')).items.join()) === 'Lora Presets', 'which puts the pack in the basket both pages read', f);
    await q.ctx.close();
  }

  /* ── 8 · the bar under the window ───────────────────────────────── */
  section('8 · the bar under the window');
  {
    let o = await open({ state: S(['Lora Presets']), w: 390, h: 844, touch: true });
    const page = o.page;
    await page.waitForTimeout(400);
    let r = await read(page);
    ok(r.bar.on && !r.bar.hidden && r.bar.go === 'Continue to payment' && r.bar.note === 'Get 3, Pay 2 · 1 / 3', 'on a phone it is there while the real button is below the fold', r.bar);
    ok(await visible(page), 'and what is on the phone’s first screen can be seen');
    ok(r.bar.aria === 'Continue to payment' && r.bar.label === 'Total and checkout', 'its button and the bar itself have names', r.bar);
    const words = () => page.evaluate(() => [getComputedStyle(document.querySelector('.paybar__long')).display, getComputedStyle(document.querySelector('.paybar__short')).display]);
    let d = await words();
    ok(d[0] !== 'none' && d[1] === 'none', 'at 390 the button says it in full', d);
    await page.evaluate(() => document.querySelector('.sum__go').scrollIntoView({ block: 'center' })); await page.waitForTimeout(500);
    ok(!(await read(page)).bar.on, 'and steps aside when the real button is on the screen');
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(500);
    ok(!(await read(page)).bar.on, 'and never covers the footer');
    await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(500);
    await page.click('[data-bar-go]'); await page.waitForTimeout(400);
    r = await read(page);
    ok(r.view === 'pay', 'its button goes to payment', r.view);
    ok(await page.evaluate(() => !!document.querySelector('details.sum--fold') && !document.querySelector('details.sum--fold').open), 'where the summary is one line until it is asked for');
    ok(r.bar.hidden && !r.bar.on, 'and where there is no bar: the form ends in its own button', r.bar);
    await o.ctx.close();

    o = await open({ state: S(['Lora Presets']), w: 360, h: 760, touch: true });
    await o.page.waitForTimeout(400);
    d = await o.page.evaluate(() => [getComputedStyle(document.querySelector('.paybar__long')).display, getComputedStyle(document.querySelector('.paybar__short')).display,
      document.querySelector('.paybar__short').textContent, document.querySelector('[data-bar-go]').getAttribute('aria-label')]);
    ok(d[0] === 'none' && d[1] !== 'none' && d[2] === 'Continue' && d[3] === 'Continue to payment', 'on the narrowest phones the button shows one word and keeps its name', d);
    await o.ctx.close();

    o = await open({ state: S(['Lora Presets']), w: 1440, h: 900 });
    await o.page.waitForTimeout(400);
    ok(!(await read(o.page)).bar.on, 'on a desk the summary is beside the page, so the bar is not there');
    await o.ctx.close();

    o = await open({ state: S(['Lora Presets']), w: 844, h: 390, touch: true });
    await o.page.waitForTimeout(400);
    ok(!(await read(o.page)).bar.on, 'nor on a phone held sideways: the header and a bar would leave a slit between them');
    await o.ctx.close();

    /* a step reached from far down the shelf: the reward is brought to where it can be seen */
    o = await open({ state: S(['Lora Presets', 'Solis Presets']), w: 390, h: 664, touch: true });
    await o.page.click('[data-more-all]'); await o.page.waitForTimeout(200);
    await o.page.locator('[data-add="Aster LUTs"]').scrollIntoViewIfNeeded(); await o.page.waitForTimeout(300);
    const away = await o.page.evaluate(() => document.querySelector('[data-cheer]').getBoundingClientRect().bottom);
    await o.page.click('[data-add="Aster LUTs"]'); await o.page.waitForTimeout(1900);
    const seen = await o.page.evaluate(() => { const h = document.querySelector('[data-cheer]').getBoundingClientRect();
      return { cheer: document.querySelectorAll('[data-cheer] > .cheer').length, top: Math.round(h.top), bottom: Math.round(h.bottom), vh: window.innerHeight,
        n: document.querySelector('[data-cheer-n]') ? document.querySelector('[data-cheer-n]').textContent : null }; });
    ok(away < 64 && seen.cheer === 1 && seen.top >= 64 && seen.bottom <= seen.vh && seen.n === '59', 'the top of the panel was off the screen; it is brought back, and then the step is celebrated', [away, seen]);
    await o.ctx.close();
  }

  /* ── 9 · widths ─────────────────────────────────────────────────── */
  if(!QUICK){
    section('9 · every width, every state, both languages');
    const STATES = {
      'empty': '', 'one': S(['Lora Presets']), 'two+plugin': S(['Full Plugin Pack', 'Lora Presets']),
      'four': S(['Lora Presets', 'Solis Presets', 'Terra Presets', 'Jardin Presets']),
      'bundle+1': S(['Aster LUTs'], { label: 'Bestseller bundle', packs: FIVE }),
      'nine': S(['Lora Presets', 'Demo Presets', 'Solis Presets', 'Full Plugin Pack', 'Terra Presets', 'Jardin Presets', 'Mely Presets', 'Olbia LUTs', 'Doré Presets'])
    };
    let wide = [], small = [], cut = [], names = [], count = 0;
    for(const w of [320, 360, 390, 430, 600, 601, 768, 860, 1000, 1001, 1100, 1200, 1201, 1440, 1920]){
      for(const lang of ['', 'tr']){
        const o = await open({ state: STATES.one, lang, w, h: 900, touch: w < 700 });
        for(const name of Object.keys(STATES)){
          for(const hash of ['', 'pay']){
            if(hash === 'pay' && name === 'empty') continue;
            await o.page.evaluate(([s]) => { if(s) localStorage.setItem('rm-cart', s); else localStorage.removeItem('rm-cart'); }, [STATES[name]]);
            await o.page.goto(BASE + 'cart.html', { waitUntil: 'load' });
            if(hash) await o.page.goto(BASE + 'cart.html#' + hash, { waitUntil: 'load' });
            /* everything that opens is opened: the rest of the shelf, the rules — and, on the payment step, the summary */
            else await o.page.evaluate(() => { ['[data-unfold]', '[data-more-all]', '[data-rules]'].forEach(s => {
              const b = document.querySelector(s); if(b && !b.hidden) b.click(); }); });
            if(hash) await o.page.evaluate(() => { const d = document.querySelector('details.sum--fold'); if(d) d.open = true; });
            await o.page.waitForTimeout(60);
            count++;
            const m = await o.page.evaluate(() => {
              const de = document.documentElement, vw = de.clientWidth, out = { over: de.scrollWidth - vw, small: [], cut: [], short: [] };
              const seen = el => !el.closest('[hidden]') && el.getClientRects().length > 0;
              /* anything a finger is asked to hit is at least 44px tall, unless it is a link in a sentence */
              if(matchMedia('(pointer:coarse)').matches || vw < 700){
                document.querySelectorAll('#main button, #main a, #main summary, #main input[type="checkbox"]').forEach(el => {
                  if(!seen(el) || el.closest('.sum__nudge, .agree') || el.matches('.agree input')) return;
                  const r = el.getBoundingClientRect();
                  const label = el.closest('label'); const h = label ? label.getBoundingClientRect().height : r.height;
                  if(h < 43.5) out.small.push((el.className || el.tagName) + ' ' + Math.round(h));
                });
              }
              /* nothing that is meant to be read runs out of the window */
              document.querySelectorAll('#main h1, #main h2, #main h3, #main p, #main .btn, #main .rung, #main .line, #main .addrow, #main .sum, #main .sum__next, #main .pick, #main .rules, #main .shelf__foot > *, #main .osbest').forEach(el => {
                if(!seen(el)) return;
                const r = el.getBoundingClientRect();
                if(r.right > vw + 0.5 || r.left < -0.5) out.cut.push((el.className || el.tagName) + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
              });
              /* a product's name is never cut short with three dots, and neither is what a pack would add */
              document.querySelectorAll('#main .addrow__t, #main .pick__t, #main .line__t, #main .addrow__with, #main .sum__mini li > b, #main .tile__t').forEach(el => {
                if(seen(el) && el.scrollWidth > el.clientWidth + 1) out.short.push((el.className || el.tagName) + ' “' + el.textContent + '” ' + el.clientWidth + '<' + el.scrollWidth);
              });
              /* and nothing in the campaign hangs out of its panel, which would clip it */
              const lad = document.querySelector('#ladder');
              if(seen(lad)){
                const L = lad.getBoundingClientRect();
                lad.querySelectorAll('.osbest, .prod__badge, .rung, .pick, .addrow, .rules, .btn').forEach(el => {
                  if(!seen(el)) return;
                  const r = el.getBoundingClientRect();
                  if(r.right > L.right + 0.5 || r.left < L.left - 0.5 || r.top < L.top - 0.5) out.cut.push('clipped ' + (el.className || el.tagName) + ' ' + Math.round(r.left - L.left) + '..' + Math.round(r.right - L.left) + ' of ' + Math.round(L.width));
                });
              }
              return out;
            });
            const at = w + (lang ? ' tr ' : ' en ') + name + (hash ? ' #pay' : '');
            if(m.over > 0) wide.push(at + ' +' + m.over);
            if(m.small.length) small.push(at + ' ' + m.small.slice(0, 3).join(', '));
            if(m.cut.length) cut.push(at + ' ' + m.cut.slice(0, 3).join(', '));
            if(m.short.length) names.push(at + ' ' + m.short.slice(0, 3).join(', '));
          }
        }
        await o.ctx.close();
      }
    }
    ok(wide.length === 0, 'nothing is wider than the window (' + count + ' pages)', wide.slice(0, 6));
    ok(cut.length === 0, 'nothing that is read runs off the edge or out of the panel', cut.slice(0, 6));
    ok(small.length === 0, 'everything a finger is asked to hit is 44px tall', small.slice(0, 8));
    ok(names.length === 0, 'no product’s name and no place’s caption is cut short, at any width, in either language', names.slice(0, 8));
  }

  /* ── 10 · the shape of the page ─────────────────────────────────── */
  section('10 · headings, names, and motion turned down');
  {
    let o = await open({ state: S(['Aster LUTs'], { label: 'Bestseller bundle', packs: FIVE }) });
    for(const hash of ['', 'pay']){
      if(hash) { await o.page.goto(BASE + 'cart.html#' + hash, { waitUntil: 'load' }); await o.page.waitForTimeout(150); }
      else { await o.page.click('[data-unfold]'); await o.page.click('[data-rules]'); await o.page.waitForTimeout(150); }
      const a = await o.page.evaluate(() => {
        const seen = el => !el.closest('[hidden]') && el.getClientRects().length > 0;
        const all = s => [].slice.call(document.querySelectorAll(s)).filter(seen);
        const name = el => (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim();
        const levels = all('#main h1, #main h2, #main h3').map(h => +h.tagName[1]);
        let jump = false; levels.forEach((l, i) => { if(i && l - levels[i - 1] > 1) jump = true; });
        return {
          h1: all('#main h1').length, jump, first: levels[0],
          nameless: all('#main button, #main a').filter(el => !name(el)).map(el => el.outerHTML.slice(0, 80)),
          noalt: all('#main img').filter(i => !i.hasAttribute('alt')).length,
          unlabelled: all('#main input').filter(i => !document.querySelector('label[for="' + i.id + '"]') && !i.closest('label')).map(i => i.id),
          landmarks: [!!document.querySelector('header'), !!document.querySelector('main'), !!document.querySelector('footer')],
          live: document.querySelectorAll('#main [role="status"][aria-live="polite"]').length === 1,
          dupIds: (() => { const ids = {}; let d = []; document.querySelectorAll('[id]').forEach(e => { if(ids[e.id]) d.push(e.id); ids[e.id] = 1; }); return d; })(),
          /* an aria-labelledby or aria-controls that points at nothing is worse than none */
          dangling: all('#main [aria-labelledby], #main [aria-controls], #main [aria-describedby]').filter(el =>
            ['aria-labelledby', 'aria-controls', 'aria-describedby'].some(a => (el.getAttribute(a) || '').split(/\s+/).filter(Boolean).some(id => !document.getElementById(id))))
            .map(el => el.outerHTML.slice(0, 80))
        };
      });
      const at = hash ? 'payment' : 'basket';
      ok(a.h1 === 1 && a.first === 1 && !a.jump, at + ': one h1, first, and no level skipped', a);
      ok(a.nameless.length === 0, at + ': every button and link has a name', a.nameless);
      ok(a.noalt === 0 && a.unlabelled.length === 0, at + ': every picture has an alt and every field a label', [a.noalt, a.unlabelled]);
      ok(a.landmarks.every(Boolean) && a.live && a.dupIds.length === 0 && a.dangling.length === 0, at + ': header, main, footer, one live region, no id twice, no name pointing at nothing', [a.landmarks, a.live, a.dupIds, a.dangling]);
    }
    await o.ctx.close();

    /* the places are a picture: a screen reader gets each step's sentence, and the one place that is a button */
    o = await open({ state: S(['Lora Presets', 'Solis Presets']) });
    const pic = await o.page.evaluate(() => ({
      open: [].slice.call(document.querySelectorAll('#ladder .prod')).filter(el => el.getAttribute('aria-hidden') !== 'true').map(el => el.tagName + (el.hasAttribute('data-place') ? '[place]' : '')),
      heads: [].slice.call(document.querySelectorAll('#ladder .rung__head')).every(el => el.getAttribute('aria-hidden') === 'true'),
      says: [].slice.call(document.querySelectorAll('#ladder [data-rung-vh]')).map(el => el.textContent)
    }));
    ok(pic.open.join() === 'BUTTON[place]' && pic.heads && pic.says.every(Boolean), 'every place but the next is hidden from a screen reader, and each step speaks for its own', pic);
    await o.ctx.close();

    o = await open({ state: S(['Lora Presets', 'Solis Presets']), still: true });
    await o.page.click('.pick__go'); await o.page.waitForTimeout(200);
    const still = await o.page.evaluate(() => ({ cheer: document.querySelectorAll('.cheer').length, sparks: document.querySelectorAll('.cheer__spark').length,
      n: document.querySelector('[data-cheer-n]') ? document.querySelector('[data-cheer-n]').textContent : null }));
    ok(still.cheer === 1 && still.sparks === 0 && still.n === '59', 'with motion turned down the saving is shown, and nothing flies', still);
    agrees(await read(o.page), 'motion down');
    await o.ctx.close();
  }

  /* ── 10b · a phone, a keyboard, a screen reader ──────────────────── */
  section('10b · a phone, a keyboard, a screen reader');
  {
    /* the "+" place, when the pack offered for it is behind the bar under the window */
    let o = await open({ state: S(['Lora Presets']), w: 390, h: 720, touch: true });
    await o.page.waitForTimeout(500);
    const under = () => o.page.evaluate(() => { const bar = document.querySelector('[data-paybar]'), go = document.querySelector('.pick__go').getBoundingClientRect();
      return { on: bar.classList.contains('is-on'), over: Math.round(go.bottom - bar.getBoundingClientRect().top) }; });
    const was = await under();
    await o.page.tap('[data-place]'); await o.page.waitForTimeout(900);
    const now = await under();
    ok(was.on && was.over > 0 && now.over <= 0, 'on a phone the pack offered was partly behind the bar; pressing the place brings it clear of the bar', [was, now]);
    await o.ctx.close();

    /* payment: what the keyboard reaches next is what the eye reaches next */
    const order = async (w, h) => {
      const q = await open({ state: S(['Lora Presets', 'Solis Presets', 'Terra Presets']), w, h, hash: 'pay' });
      const got = await q.page.evaluate(() => {
        const host = document.querySelector('[data-paysum]:not([hidden])'), form = document.getElementById('payForm');
        const a = host.getBoundingClientRect(), b = form.getBoundingClientRect();
        return { hosts: document.querySelectorAll('[data-paysum]').length, shown: document.querySelectorAll('[data-paysum]:not([hidden])').length,
          empty: [].every.call(document.querySelectorAll('[data-paysum][hidden]'), x => x.innerHTML === ''),
          before: !!(host.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING), above: a.bottom <= b.top + 1, beside: a.left >= b.right - 1 };
      });
      await q.page.focus('.pay__back');
      const tabs = [];
      for(let i = 0; i < 3; i++){ await q.page.keyboard.press('Tab'); tabs.push(await q.page.evaluate(() => { const a = document.activeElement;
        return a.id || (a.tagName === 'SUMMARY' ? 'summary' : a.getAttribute('data-go') ? 'go:' + a.getAttribute('data-go') : a.tagName); })); }
      await q.ctx.close();
      return { got, tabs };
    };
    let v = await order(390, 844);
    ok(v.got.hosts === 2 && v.got.shown === 1 && v.got.empty && v.got.before && v.got.above && v.tabs.join() === 'summary,payEmail,payName',
       'on a phone the summary is above the form on the screen and before it for the keyboard: Back, summary, email, name', v);
    v = await order(1440, 900);
    ok(v.got.shown === 1 && v.got.empty && !v.got.before && v.got.beside && v.tabs.join() === 'payEmail,payName,payAgree',
       'on a desk it is beside the form and after it: Back, email, name, the box', v);

    /* a failed attempt: the field it leaves the keyboard on is seen to have it */
    o = await open({ state: S(['Lora Presets']), hash: 'pay' });
    const box = () => o.page.evaluate(() => document.getElementById('payAgree').getAttribute('aria-invalid'));
    ok(await box() === 'false', 'nothing is called invalid before anything has been pressed — the box that must be ticked included', await box());
    await o.page.click('[data-pay-go]'); await o.page.waitForTimeout(200);
    const ring = await o.page.evaluate(() => { const el = document.activeElement, cs = getComputedStyle(el);
      return { on: el.id, invalid: el.getAttribute('aria-invalid'), outline: cs.outlineStyle + ' ' + cs.outlineWidth, agree: document.getElementById('payAgree').getAttribute('aria-invalid') }; });
    ok(ring.on === 'payEmail' && ring.invalid === 'true' && ring.outline === 'solid 2px' && ring.agree === 'true', 'after a failed attempt the field in error that has the keyboard wears a ring as well as its red edge', ring);
    await o.page.check('#payAgree'); await o.page.waitForTimeout(100);
    ok(await box() === 'false', 'and the box is no longer invalid the moment it is ticked', await box());
    await o.ctx.close();

    /* what was last said does not outlive the view it was about */
    o = await open({ state: S(['Lora Presets', 'Solis Presets', 'Terra Presets']) });
    await o.page.click('[data-remove="Terra Presets"]'); await o.page.waitForTimeout(700);
    ok((await read(o.page)).live !== '', '(a removal is announced)');
    await o.page.click('.sum__go'); await o.page.waitForTimeout(300);
    ok((await read(o.page)).live === '', 'on the payment step the announcement about the basket is gone', (await read(o.page)).live);
    await o.page.click('[data-pay-go]'); await o.page.waitForTimeout(200);
    ok((await read(o.page)).live === '2 things need fixing before you can continue.' || /need fixing|needs fixing/.test((await read(o.page)).live), '(a failed attempt is announced)', (await read(o.page)).live);
    await o.page.fill('#payEmail', 'a@b.co'); await o.page.fill('#payName', 'A B'); await o.page.check('#payAgree');
    await o.page.click('[data-pay-go]'); await o.page.waitForTimeout(400);
    let r = await read(o.page);
    ok(r.view === 'done' && r.live === '', 'and Done does not end with “… need fixing before you can continue.”', [r.view, r.live]);
    await o.ctx.close();

    /* the bar reads its two prices as a sentence */
    o = await open({ state: S(['Lora Presets', 'Solis Presets', 'Terra Presets']), w: 390, h: 844, touch: true });
    const pair = () => o.page.evaluate(() => ({ read: document.querySelector('[data-bar-read]').textContent, hid: document.querySelector('[data-bar-total]').getAttribute('aria-hidden'),
      shown: document.querySelector('[data-bar-total]').textContent }));
    let b = await pair();
    ok(b.read === '$118, was $177' && b.hid === 'true' && b.shown === '$118$177', 'the bar’s two prices are read as “$118, was $177”, like every other pair on the page', b);
    await o.ctx.close();
    o = await open({ state: S(['Lora Presets']), w: 390, h: 844, touch: true, lang: 'tr' });
    b = await pair();
    ok(b.read === '$59', 'and one price is one price', b);
    r = await read(o.page);
    ok(r.more.sub === 'Listedeki her ürün kampanyaya dahil.' && r.ladder.rungs[0].place === 'Ürün ekle: 2. yer için seç' && r.ladder.pick.aria === 'Sepete ekle: Solis Presets — $59',
       'in Turkish: the shelf’s line says what is true of the list, and the place and the pick are called what they show', [r.more.sub, r.ladder.rungs[0].place, r.ladder.pick.aria]);
    await o.ctx.close();
    o = await open({ state: S(['Lora Presets', 'Solis Presets']), hash: 'pay', lang: 'tr' });
    ok(await o.page.evaluate(() => document.querySelector('.sum__nudge').textContent.replace(/\s+/g, ' ').trim()) === '$59’lık bir ürün daha eklersen bedava. Sepete dön', 'and the payment step’s one sentence about money names its price');
    await o.ctx.close();

    /* small text that has to be read, and the ring on the dark panel */
    o = await open({ state: S(['Lora Presets', 'Solis Presets', 'Terra Presets']), w: 390, h: 844, touch: true });
    const ink = await o.page.evaluate(() => {
      const as = (v, host) => { const i = document.createElement('i'); i.style.color = v; (host || document.body).appendChild(i); const c = getComputedStyle(i).color; i.remove(); return c; };
      const won = document.querySelector('.line__won'), was = document.querySelector('.paybar__sum b s');
      document.querySelector('[data-place]').focus({ focusVisible: true });
      const place = document.querySelector('[data-place]'), ladder = document.getElementById('ladder');
      return { won: getComputedStyle(won).color === as('var(--accent-700)'), was: getComputedStyle(was).color === as('var(--fg-body)'),
        ring: getComputedStyle(place).outlineColor === as('var(--accent-fg)', ladder), notLight: as('var(--accent-fg)', ladder) !== as('var(--accent)') };
    });
    ok(ink.won && ink.was, 'the caption under a free line’s pill and the struck price in the bar are a shade darker than the accent', ink);
    ok(ink.ring && ink.notLight, 'and on the dark panel the keyboard’s ring is the accent that is read on dark', ink);
    await o.ctx.close();

    /* a phone on its side: the open menu can be scrolled to its end */
    for(const [w, h, side] of [[844, 390, true], [390, 844, false]]){
      o = await open({ state: S(['Lora Presets']), w, h, touch: true });
      await o.page.click('#navToggle'); await o.page.waitForTimeout(250);
      const menu = await o.page.evaluate(() => { const p = document.getElementById('navPanel'), cs = getComputedStyle(p);
        return { flow: cs.overflowY, tall: p.scrollHeight > p.clientHeight + 1, foot: Math.round(p.getBoundingClientRect().bottom), vh: innerHeight }; });
      if(side){
        ok(menu.flow === 'auto' && menu.tall && menu.foot <= menu.vh, 'held sideways, the open menu ends inside the window and scrolls', menu);
        await o.page.locator('#navPanel .langpick__btn').scrollIntoViewIfNeeded(); await o.page.waitForTimeout(150);
        await o.page.click('#navPanel .langpick__btn'); await o.page.waitForTimeout(150);
        const picker = await o.page.evaluate(() => { const m = document.querySelector('#navPanel .langpick__menu'), r = m.getBoundingClientRect();
          return { open: !m.hidden, top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight }; });
        ok(picker.open && picker.top >= 64 && picker.bottom <= picker.vh, 'and its language list, the last thing in it, can be reached and opens inside the window', picker);
      } else {
        ok(menu.flow === 'visible' && !menu.tall, 'upright, nothing about the menu has changed', menu);
      }
      await o.ctx.close();
    }

    /* the language list says which is chosen, and gives the keyboard back */
    o = await open({ state: S(['Lora Presets']) });
    const langs = () => o.page.evaluate(() => [].map.call(document.querySelectorAll('footer .langpick__menu button'), x => x.getAttribute('data-lang') + ':' + x.getAttribute('aria-checked')).join());
    ok(await langs() === 'tr:false,en:true', 'the language list says which one is chosen', await langs());
    await o.page.click('footer .langpick__btn'); await o.page.waitForTimeout(100);
    await o.page.focus('footer .langpick__menu button[data-lang="tr"]');
    await o.page.keyboard.press('Escape'); await o.page.waitForTimeout(100);
    ok(await o.page.evaluate(() => document.activeElement.classList.contains('langpick__btn') && document.querySelector('footer .langpick__menu').hidden), 'Escape closes it and puts the keyboard back on its button',
       await o.page.evaluate(() => document.activeElement.outerHTML.slice(0, 80)));
    await o.page.click('footer .langpick__btn'); await o.page.click('footer .langpick__menu button[data-lang="tr"]'); await o.page.waitForTimeout(200);
    ok(await langs() === 'tr:true,en:false', 'and follows the choice', await langs());
    await o.ctx.close();

    /* a link is still a link: with Ctrl, Cmd or Shift held, the press is the
       browser's to answer — a new tab, a new window — and the page neither
       stops it nor changes its own step. (Asked of the page directly: whether
       a tab then opens is the browser's business, and it was looked at by
       hand.) */
    o = await open({ state: S(['Lora Presets', 'Solis Presets', 'Terra Presets']) });
    const pressWith = (sel, keys) => o.page.evaluate(([sel, keys]) => {
      const a = document.querySelector(sel), box = a.getBoundingClientRect();
      const e = new MouseEvent('click', Object.assign({ bubbles: true, cancelable: true, detail: 1, clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 }, keys));
      /* heard last, after the page has had its say: what the page did with
         the press is noted, and then the press is stopped here — a click made
         by a script would otherwise follow the link in this tab */
      let stopped = null;
      const last = ev => { stopped = ev.defaultPrevented; ev.preventDefault(); };
      document.addEventListener('click', last);
      a.dispatchEvent(e);
      document.removeEventListener('click', last);
      return { stopped, view: document.getElementById('main').getAttribute('data-view'), hash: location.hash };
    }, [sel, keys]);
    let c = await pressWith('.sum__go', { ctrlKey: true });
    ok(!c.stopped && c.view === 'basket' && c.hash === '', 'Ctrl-click on Continue is left to the browser, and this tab stays on the basket', c);
    c = await pressWith('.sum__go', { metaKey: true });
    ok(!c.stopped && c.view === 'basket', 'Cmd-click too', c);
    c = await pressWith('.sum__go', { shiftKey: true });
    ok(!c.stopped && c.view === 'basket', 'and Shift-click', c);
    c = await pressWith('.sum__go', {});
    ok(c.stopped && c.view === 'pay' && c.hash === '#pay', 'a plain click is the page’s: on to payment, in this tab', c);
    await o.page.waitForTimeout(700);
    c = await pressWith('[data-basket]', { ctrlKey: true });
    ok(!c.stopped && c.view === 'pay', 'the same for the basket in the bar: Ctrl-click is left to the browser, and this tab stays on the payment step', c);
    c = await pressWith('[data-basket]', {});
    ok(c.stopped && c.view === 'basket', 'and a plain click on it is the way back to the basket', c);
    await o.ctx.close();
  }

  /* ── 10c · the price list does not arrive ────────────────────────── */
  section('10c · rm-cart.js missing, or an older copy of it');
  {
    const visit = async (file, how, lang) => {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      const thrown = [];
      page.on('pageerror', e => thrown.push(String(e)));
      await page.goto(BASE + file, { waitUntil: 'load' });
      await page.evaluate(([state, l]) => { localStorage.setItem('rm-cart', state); if(l) localStorage.setItem('rm-lang', l); }, [S(['Lora Presets', 'Solis Presets']), lang || '']);
      await page.route('**/rm-cart.js', route => how === 'missing' ? route.fulfill({ status: 404, body: '' })
        : route.fulfill({ status: 200, contentType: 'text/javascript', body: 'window.RMCart = { KEY: "rm-cart", read: function(){ return {items: [], bundle: null}; } };' }));
      await page.reload({ waitUntil: 'load' });
      await page.waitForTimeout(300);
      return { ctx, page, thrown };
    };
    for(const how of ['missing', 'stale']){
      let q = await visit('cart.html', how);
      let got = await q.page.evaluate(() => { const seen = el => !!el && !el.closest('[hidden]') && el.getClientRects().length > 0;
        return { h1: document.querySelector('[data-h]').textContent, say: document.querySelector('[data-s="empty_p"]').textContent, sayShown: seen(document.querySelector('[data-s="empty_p"]')),
          grid: seen(document.querySelector('[data-grid]')), button: seen(document.querySelector('.bagempty__go button')) ? document.querySelector('.bagempty__go button').textContent : null,
          count: document.querySelector('.cart__n').textContent, bar: document.querySelector('[data-paybar]').hidden }; });
      ok(got.h1 === 'We couldn’t load your basket.' && got.sayShown && got.say === 'What you added is still kept. Reload the page to try again.' && !got.grid && got.button === 'Reload the page' && got.bar && q.thrown.length === 0,
         how + ': the basket page says so and offers a reload, instead of a frame with nothing in it', [got, q.thrown]);
      await q.page.unroute('**/rm-cart.js');
      await Promise.all([q.page.waitForNavigation({ waitUntil: 'load' }), q.page.click('.bagempty__go button')]); await q.page.waitForTimeout(300);
      ok(await q.page.evaluate(() => document.querySelectorAll('[data-lines] .line').length) === 2, how + ': and the reload brings the basket back, both packs in it');
      await q.ctx.close();
      q = await visit('index.html', how);
      const front = await q.page.evaluate(() => ({ basket: typeof window.RMBasket, count: document.querySelector('.cart__n').textContent }));
      ok(q.thrown.length === 0 && front.basket === 'object', how + ': the front page does not stop half way down its script', [q.thrown.slice(0, 2), front]);
      await q.ctx.close();
    }
    const q = await visit('cart.html', 'missing', 'tr');
    ok(await q.page.evaluate(() => document.querySelector('[data-h]').textContent + ' | ' + document.querySelector('[data-s="empty_p"]').textContent + ' | ' + document.querySelector('.bagempty__go button').textContent + ' | ' + document.getElementById('main').getAttribute('lang'))
       === 'Sepetin yüklenemedi. | Eklediklerin duruyor. Sayfayı yenileyip tekrar dene. | Sayfayı yenile | tr', 'and in Turkish when that is the language chosen');
    await q.ctx.close();
  }

  /* ── 11 · the same bar and the same footer ──────────────────────── */
  section('11 · the bar and the footer are the front page’s, property for property');
  {
    /* Every computed property of every element, and where every element is.
       A margin is read as it is computed (auto stays auto), not as the browser
       resolves it: Chromium reports an auto margin's used value as 0px or as
       the real figure from one load to the next for the very same layout —
       so that figure is not compared, and the box it produces is. */
    const snap = sel => {
      const root = document.querySelector(sel);
      if(!root) return null;
      const out = [], at = root.getBoundingClientRect(), n = v => Math.round(v * 2) / 2;
      [root].concat([].slice.call(root.querySelectorAll('*'))).forEach(el => {
        [null, '::before', '::after'].forEach(ps => {
          const cs = getComputedStyle(el, ps);
          if(ps && (cs.content === 'none' || cs.content === 'normal')){ out.push(null); return; }
          const o = {}, typed = !ps && el.computedStyleMap ? el.computedStyleMap() : null;
          for(let i = 0; i < cs.length; i++){
            let v = cs.getPropertyValue(cs[i]);
            if(typed && /^margin-/.test(cs[i])){ try { v = String(typed.get(cs[i])); } catch(e){} }
            o[cs[i]] = v;
          }
          /* (what is not drawn has no box to be anywhere) */
          if(!ps){ const r = el.getBoundingClientRect(); o['(box)'] = el.getClientRects().length ? [n(r.left - at.left), n(r.top - at.top), n(r.width), n(r.height)].join(' ') : 'none'; }
          out.push({ tag: el.tagName + '.' + String(el.className && el.className.baseVal === undefined ? el.className : '').split(' ').join('.') + (ps || ''), o });
        });
      });
      return out;
    };
    let compared = 0;
    for(const w of [1440, 390]){
      const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, reducedMotion: 'reduce' });
      await ctx.route('**/*', route => route.request().url().startsWith(BASE) ? route.continue() : route.abort());
      const A = await ctx.newPage(), B = await ctx.newPage();
      await A.goto(BASE + 'index.html', { waitUntil: 'load' });
      await B.goto(BASE + 'cart.html', { waitUntil: 'load' });
      /* both in the light, both scrolled: the front page under its installing
         section, where its own bar is the plain one */
      await A.evaluate(() => { const s = document.querySelector('#install'); window.scrollTo(0, s.getBoundingClientRect().top + window.scrollY + 40); });
      await B.evaluate(() => { document.getElementById('main').style.minHeight = '3000px'; window.scrollTo(0, 400); });
      await A.waitForTimeout(500); await B.waitForTimeout(300);
      for(const [name, sel, foot] of [['the bar', '#nav', false], ['the footer', 'footer.footer', true]]){
        if(foot){
          await A.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
          await B.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
          await A.waitForTimeout(400); await B.waitForTimeout(400);
        }
        const a = await A.evaluate(snap, sel), b = await B.evaluate(snap, sel);
        const diff = [];
        if(!a || !b || a.length !== b.length) diff.push('different markup: ' + (a && a.length) + ' / ' + (b && b.length));
        else for(let i = 0; i < a.length; i++){
          if(!a[i] || !b[i]){ if(a[i] !== b[i]) diff.push('pseudo-element'); continue; }
          for(const k in a[i].o){
            compared++;
            if(a[i].o[k] !== b[i].o[k] && !/^(perspective-origin|transform-origin)$/.test(k)) diff.push(a[i].tag.slice(0, 40) + ' ' + k);
          }
        }
        ok(diff.length === 0, name + ' at ' + w + 'px: every computed property the same on both pages', diff.slice(0, 5));
      }
      await ctx.close();
    }
    ok(compared > 100000, 'compared ' + compared + ' computed properties and boxes');
  }

  section('12 · nothing went wrong');
  ok(errors.length === 0, 'no script errors on either page', errors.slice(0, 5));
  ok(outside.length === 0, 'and nothing was asked of any other site', [...new Set(outside)].slice(0, 5));

  await browser.close();
  server.close();
  console.log('\n' + (bad ? bad + ' of ' + ran + ' checks FAILED' : 'all ' + ran + ' checks pass'));
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
