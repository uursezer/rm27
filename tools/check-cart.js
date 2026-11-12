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

(async () => {
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
    if(rel.endsWith('/')) rel += 'index.html';
    const file = path.join(ROOT, rel);
    if(!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()){ res.writeHead(404); res.end(); return; }
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
    const sum = q(view === 'pay' ? '[data-paysum]' : view === 'done' ? '[data-donesum]' : '[data-sum]');
    const rows = {};
    qa('.sum__row', sum).forEach(r => {
      const k = r.classList.contains('sum__total') ? 'total' : r.classList.contains('sum__row--deal') ? 'deal'
        : r.classList.contains('sum__row--next') ? 'next' : 'subtotal';
      rows[k] = { label: txt(q('dt', r)), value: txt(q('dd', r)) };
    });
    const names = window.RMCart.names(window.RMCart.load());
    const price = window.RMCart.price(names);
    return {
      view, title: document.title, lang: main.getAttribute('lang'), hash: location.hash,
      h1: qa('#main h1').filter(seen).map(txt),
      eyebrow: txt(q('[data-eyebrow]')),
      ladder: {
        eyebrow: txt(q('[data-l="eyebrow"]')), say: txt(q('[data-l="say"]')), why: txt(q('[data-l="why"]')),
        rungs: qa('[data-rung]').map(r => ({
          is: ['is-done', 'is-current', 'is-later'].filter(c => r.classList.contains(c)).join(' '),
          t: txt(q('[data-rung-t]', r)), n: txt(q('[data-rung-n] [aria-hidden]', r) || q('[data-rung-n]', r)),
          filled: qa('figure.prod', r).length, free: qa('figure.prod.is-free', r).length,
          empty: qa('button.prod--empty', r).length, later: qa('.prod--later', r).length,
          nextfree: qa('.is-nextfree', r).length, ghost: qa('.prod__badge--ghost', r).length,
          names: qa('figure.prod', r).map(f => f.getAttribute('aria-label'))
        })),
        ring: q('#ladder').classList.contains('is-added'),
        pick: seen(q('[data-l="pick"]')) ? {
          label: txt(q('.pick__label')), name: txt(q('.pick__t')), free: q('[data-l="pick"]').classList.contains('is-free'),
          price: txt(q('.pick__price .price')), pill: !!q('.pick__price .prod__badge'),
          go: txt(q('.pick__go')), primary: q('.pick__go').classList.contains('btn--primary'),
          aria: q('.pick__go').getAttribute('aria-label')
        } : null
      },
      lines: qa('[data-lines] > li').map(li => li.classList.contains('line')
        ? { line: li.getAttribute('data-line'), free: li.classList.contains('is-free'), pill: !!q('.prod__badge', li),
            price: txt(q('.price', li)), won: txt(q('.line__won', li)) }
        : li.classList.contains('undo') ? { undo: txt(q('p', li)) } : { cap: txt(li) }),
      linesShown: seen(q('[data-lines-sec]')), linesN: txt(q('[data-lines-n]')),
      more: seen(q('[data-more]')) ? {
        h: txt(q('[data-more-h]')), sub: txt(q('[data-more-sub]')),
        rows: qa('[data-addrows] > li').map(li => ({ name: li.getAttribute('data-offer'), price: txt(q('.price', li)),
          free: !!q('.price b.is-free', li), with: txt(q('.addrow__with', li)), aria: q('[data-add]', li).getAttribute('aria-label') })),
        all: seen(q('[data-more-all]')) ? txt(q('[data-more-all]')) : null
      } : null,
      sum: seen(sum) ? { rows, save: txt(q('.osave', sum)), go: txt(q('.sum__go', sum)), mini: qa('.sum__mini li', sum).length } : null,
      bar: (() => { const b = q('[data-paybar]'); return { hidden: b.hidden, on: b.classList.contains('is-on'),
        total: txt(q('[data-bar-total]')), note: txt(q('[data-bar-note]')), go: txt(q('[data-bar-go]')) }; })(),
      crumbs: qa('[data-crumbs] li').map(li => (li.getAttribute('aria-current') ? '>' : li.classList.contains('is-done') ? '✓' : ' ') +
        txt(q('.crumbs__l', li)) + (q('a', li) ? '*' : '')),
      badge: txt(q('.cart__n')), bagLabel: q('[data-basket]').getAttribute('aria-label'),
      live: txt(q('[data-live]')), cheer: qa('.cheer').length, cheerLead: txt(q('.cheer__lead')),
      undoSolo: seen(q('[data-undo-solo]')) ? txt(q('[data-undo-solo] p')) : null,
      emptyOnly: qa('[data-empty-only]').filter(seen).length,
      focus: (() => { const a = document.activeElement; if(!a || a === document.body) return null;
        return a.getAttribute('data-add') ? 'add:' + a.getAttribute('data-add') : a.hasAttribute('data-undo') ? 'undo'
          : a.getAttribute('data-remove') ? 'remove:' + a.getAttribute('data-remove') : a.id || a.tagName; })(),
      stored: localStorage.getItem('rm-cart'),
      engine: { count: price.count, counted: price.counted, subtotal: price.subtotal, saving: price.saving, total: price.total,
        deal: price.deal ? price.deal.get + '/' + price.deal.pay : null, next: price.next ? price.next.get + ':' + price.next.need : null,
        free: price.lines.filter(l => l.free).map(l => l.name) }
    };
  });
  /* whatever the page prints as money must be what the engine says it is */
  function agrees(r, where){
    const e = r.engine;
    if(!r.sum){ ok(e.count === 0 || r.view === 'done', where + ': a basket with something in it has a summary'); return; }
    ok(r.sum.rows.subtotal && r.sum.rows.subtotal.value === '$' + e.subtotal, where + ': subtotal is the engine’s', [r.sum.rows.subtotal, e.subtotal]);
    ok(r.sum.rows.total && r.sum.rows.total.value === '$' + e.total, where + ': total is the engine’s', [r.sum.rows.total, e.total]);
    ok(e.deal ? (r.sum.rows.deal && r.sum.rows.deal.value === '−$' + e.saving) : !r.sum.rows.deal, where + ': the deal row is the engine’s deal', [r.sum.rows.deal, e.deal, e.saving]);
    if(r.view === 'basket'){
      ok(e.next ? !!r.sum.rows.next : !r.sum.rows.next, where + ': the next-step row is there only while there is a next step', r.sum.rows.next);
      const free = r.lines.filter(l => l.line && l.free).map(l => l.line);
      ok(JSON.stringify(free) === JSON.stringify(e.free), where + ': the lines marked free are the engine’s', [free, e.free]);
      ok(r.badge === String(e.count), where + ': the count in the bar', [r.badge, e.count]);
      ok(r.bar.total.indexOf('$' + e.total) === 0, where + ': the bar under the window carries the total', r.bar.total);
      const filled = r.ladder.rungs[0].filled + r.ladder.rungs[1].filled;
      ok(filled === Math.min(5, e.counted), where + ': the places filled are the packs that count', [filled, e.counted]);
      const ringed = r.ladder.rungs[0].free + r.ladder.rungs[1].free;
      ok(ringed === e.free.length, where + ': as many ringed places as free lines', [ringed, e.free.length]);
    }
  }

  /* ── 1 · one product to six, a press at a time ──────────────────── */
  section('1 · from one product to six');
  {
    const { ctx, page } = await open({ state: S(['Lora Presets']) });
    let r = await read(page);
    ok(r.view === 'basket' && r.title === 'Your basket — Retouch Market', 'opens on the basket', [r.view, r.title]);
    ok(r.h1.length === 1 && r.h1[0] === 'Your basket', 'one heading: Your basket', r.h1);
    ok(r.eyebrow === 'Basket · 1 item', 'the eyebrow counts', r.eyebrow);
    ok(r.ladder.eyebrow === 'Step 1 of 2 · Get 3, Pay 2', 'Get 3, Pay 2 is the first step shown', r.ladder.eyebrow);
    ok(r.ladder.say === 'Add 2 more packs, get 1 of the 3 free.', 'one product: the sentence', r.ladder.say);
    ok(/^That’s \$59 for the two of them\./.test(r.ladder.why), 'and what the two would cost, worked out', r.ladder.why);
    ok(r.ladder.rungs[0].is === 'is-current' && r.ladder.rungs[1].is === 'is-later', 'step one is the one to do, step two is waiting', r.ladder.rungs.map(x => x.is));
    ok(r.ladder.rungs[0].n === '1 / 3' && r.ladder.rungs[1].n === 'Next step', 'their captions', r.ladder.rungs.map(x => x.n));
    ok(r.ladder.rungs[0].filled === 1 && r.ladder.rungs[0].empty === 2 && r.ladder.rungs[1].later === 2, 'one place filled, two to fill, two for later', r.ladder.rungs);
    ok(r.ladder.rungs[0].ghost === 1 && r.ladder.rungs[0].nextfree === 0, 'the third place wears the pill as a promise', r.ladder.rungs[0]);
    ok(r.ladder.pick && r.ladder.pick.name === 'Solis Presets' && r.ladder.pick.label === 'Our pick' && !r.ladder.pick.free && r.ladder.pick.go === 'Add to basket' && !r.ladder.pick.primary,
       'the pick is the next pack on the shelf, at its price', r.ladder.pick);
    ok(r.sum.rows.next.label.indexOf('Get 3, Pay 2 · 2 packs away') === 0, 'the summary keeps a place for the saving', r.sum.rows.next);
    ok(r.sum.save === null, 'nothing is saved yet, and nothing says otherwise', r.sum.save);
    ok(r.cheer === 0 && r.live === '', 'nothing rings and nothing is announced on arrival', [r.cheer, r.live]);
    ok(r.bagLabel === 'Basket, 1 item', 'the basket in the bar says 1 item', r.bagLabel);
    agrees(r, '1 product');

    await page.click('.pick__go'); await page.waitForTimeout(450);
    r = await read(page);
    ok(r.ladder.say === 'Add 1 more pack and it’s free.', 'two: one more and it is free', r.ladder.say);
    ok(r.ladder.pick.label === 'Your free pack' && r.ladder.pick.free && r.ladder.pick.pill && r.ladder.pick.go === 'Add your free pack' && r.ladder.pick.primary,
       'the pick is the free pack, and its button is the accent', r.ladder.pick);
    ok(/free with Get 3, Pay 2$/.test(r.ladder.pick.aria), 'and says so to a screen reader', r.ladder.pick.aria);
    ok(r.ladder.rungs[0].nextfree === 1, 'the third place is free the moment it is filled', r.ladder.rungs[0]);
    ok(r.more.h === 'Pick your free pack', 'the list under the lines changes its heading', r.more.h);
    ok(r.more.rows.filter(x => x.name !== 'Full Plugin Pack').every(x => x.free && x.price === 'Free$59'), 'every $59 pack reads Free', r.more.rows.map(x => x.price));
    const plug = r.more.rows.filter(x => x.name === 'Full Plugin Pack')[0];
    ok(plug && plug.price === '$90$149' && plug.with === 'with Get 3, Pay 2', 'and the plugin pack reads what it would really add: $90', plug);
    ok(r.cheer === 0, 'nothing is celebrated at two', r.cheer);
    ok(r.live === 'Solis Presets added. Total $118. Next step: 1 more pack for Get 3, Pay 2.', 'what is announced', r.live);
    ok(r.focus === 'add:Terra Presets', 'focus is on the next pick', r.focus);
    ok(r.stored === S(['Lora Presets', 'Solis Presets']), 'and it is kept', r.stored);
    agrees(r, '2 products');

    await page.click('.pick__go'); await page.waitForTimeout(300);
    r = await read(page);
    ok(r.cheer === 1 && r.cheerLead === 'You saved', 'three: the step is celebrated, once', [r.cheer, r.cheerLead]);
    await page.waitForTimeout(900);
    ok(await page.evaluate(() => document.querySelector('[data-cheer-n]') && document.querySelector('[data-cheer-n]').textContent) === '59', 'and counts up to what it saved: $59');
    ok(r.ladder.eyebrow === 'Step 2 of 2 · Get 5, Pay 3', 'now the page points at Get 5, Pay 3', r.ladder.eyebrow);
    ok(r.ladder.say === 'Add 2 more packs, get 2 of the 5 free.', 'the sentence', r.ladder.say);
    ok(r.ladder.why === 'Get 3, Pay 2 is yours — Terra Presets is free. The next two are $59 together.', 'and why', r.ladder.why);
    ok(r.ladder.rungs[0].is === 'is-done' && r.ladder.rungs[0].n === 'Unlocked' && r.ladder.rungs[1].is === 'is-current' && r.ladder.rungs[1].n === '3 / 5', 'step one done, step two the one to do', r.ladder.rungs.map(x => [x.is, x.n]));
    ok(r.ladder.rungs[0].free === 1 && r.ladder.rungs[1].empty === 2 && r.ladder.rungs[1].later === 0, 'the third place is ringed; the second step’s places can be filled', r.ladder.rungs);
    ok(r.sum.rows.deal.label === 'Get 3, Pay 2' && r.sum.save === 'You save $59 · 33% off', 'the summary shows the deal and the saving', [r.sum.rows.deal, r.sum.save]);
    ok(r.lines[2].free && r.lines[2].pill && r.lines[2].won === 'with Get 3, Pay 2', 'the third line wears the pill', r.lines[2]);
    ok(r.live === 'Terra Presets added. Get 3, Pay 2 unlocked: Terra Presets is free. You save $59. Total $118. Next step: 2 more packs for Get 5, Pay 3.', 'what is announced', r.live);
    agrees(r, '3 products');
    await page.waitForTimeout(1800);
    ok((await read(page)).cheer === 0, 'the celebration clears itself');

    await page.click('[data-add="Jardin Presets"][data-from="more"]'); await page.waitForTimeout(450);
    r = await read(page);
    ok(r.ladder.say === 'Add 1 more pack and it’s free.' && r.ladder.why === 'Your fifth pack is $0. That’s Get 5, Pay 3.', 'four: one more and it is free', [r.ladder.say, r.ladder.why]);
    ok(r.ladder.pick.free && r.ladder.pick.name === 'Mely Presets', 'the pick is free again', r.ladder.pick);
    ok(r.lines.filter(l => l.free).map(l => l.line).join() === 'Terra Presets', 'the free line is still the third', r.lines);
    ok(r.cheer === 0, 'nothing is celebrated at four', r.cheer);
    agrees(r, '4 products');

    await page.click('.pick__go'); await page.waitForTimeout(300);
    r = await read(page);
    ok(r.cheer === 1, 'five: celebrated', r.cheer);
    ok(r.ladder.eyebrow === 'Both steps done' && r.ladder.say === 'Get 5, Pay 3 is yours — 2 packs on us.', 'both steps done', [r.ladder.eyebrow, r.ladder.say]);
    ok(r.ladder.rungs.every(x => x.is === 'is-done') && r.ladder.ring, 'both steps ticked and the panel wears the ring', [r.ladder.rungs.map(x => x.is), r.ladder.ring]);
    ok(r.ladder.rungs[0].free === 0 && r.ladder.rungs[1].free === 2, 'three paid in the first step, two free in the second', r.ladder.rungs);
    ok(r.ladder.pick === null, 'there is no next pick: there is no next step', r.ladder.pick);
    ok(r.sum.rows.deal.label === 'Get 5, Pay 3' && r.sum.save === 'You save $118 · 40% off', 'one deal, the bigger one', [r.sum.rows.deal, r.sum.save]);
    ok(r.more.h === 'Add another pack' && r.more.rows.every(x => !x.free), 'more packs are at their own price, and say so', [r.more.h, r.more.rows.map(x => x.price)]);
    ok(r.bar.note === 'Get 5, Pay 3 · saved $118', 'the bar under the window says what was saved', r.bar.note);
    agrees(r, '5 products');
    await page.waitForTimeout(2600);

    await page.click('[data-add="Onyx Presets"]'); await page.waitForTimeout(450);
    r = await read(page);
    ok(r.cheer === 0, 'six: nothing new was unlocked, nothing is celebrated', r.cheer);
    ok(/from the sixth on each pack is at its own price\.$/.test(r.ladder.why), 'and the page says why', r.ladder.why);
    ok(r.sum.rows.total.value === '$236', 'six $59 packs come to $236', r.sum.rows.total);
    agrees(r, '6 products');

    /* ── 2 · taking one out, and putting it back ── */
    section('2 · taking a pack out, and the way back');
    const before = r.stored;
    await page.click('[data-remove="Jardin Presets"]'); await page.waitForTimeout(300);
    r = await read(page);
    ok(r.lines[3] && r.lines[3].undo === 'Jardin Presets removed.', 'the way back is where the line was', r.lines.map(l => l.line || l.undo));
    ok(r.focus === 'undo', 'and focus is on it', r.focus);
    ok(r.live === 'Jardin Presets removed. Total $177.', 'what is announced (the deal still stands)', r.live);
    agrees(r, 'after a removal');
    await page.click('[data-undo]'); await page.waitForTimeout(300);
    r = await read(page);
    ok(r.stored === before, 'Undo puts back exactly what was there', r.stored);
    ok(r.focus === 'remove:Jardin Presets', 'focus returns to that line', r.focus);
    ok(r.cheer === 0, 'putting something back is not celebrated', r.cheer);
    agrees(r, 'after undo');
    /* down the ladder: the deal that is lost is named */
    await page.click('[data-remove="Onyx Presets"]'); await page.waitForTimeout(200);
    await page.click('[data-remove="Mely Presets"]'); await page.waitForTimeout(300);
    r = await read(page);
    ok(r.live === 'Mely Presets removed. Get 5, Pay 3 no longer applies; Get 3, Pay 2 does. Total $177.', 'going down a step says which deal is left', r.live);
    ok(!r.ladder.ring && r.ladder.rungs[1].is === 'is-current', 'the ring goes and step two is open again', r.ladder.rungs.map(x => x.is));
    agrees(r, 'back at 4');
    await ctx.close();
  }

  /* ── 3 · mixed prices, the sampler, a bundle from the front page ─── */
  section('3 · the plugin pack, the sampler, and a bundle from the front page');
  {
    let o = await open({ state: S(['Lora Presets', 'Solis Presets']) });
    await o.page.click('[data-add="Full Plugin Pack"]'); await o.page.waitForTimeout(400);
    let r = await read(o.page);
    ok(r.sum.rows.total.value === '$208' && r.engine.free.join() === 'Solis Presets', 'two packs then the plugin pack: $208, and the free one is Solis', [r.sum.rows.total, r.engine.free]);
    ok(r.ladder.rungs[0].names[0] === 'Place 1: Full Plugin Pack', 'the plugin pack takes the first place, as on the front page', r.ladder.rungs[0].names);
    ok(/The free one is always the lowest-priced pack\.$/.test(r.ladder.why), 'and the page says which one comes free', r.ladder.why);
    ok(r.live.indexOf('Full Plugin Pack added. Get 3, Pay 2 unlocked: Solis Presets is free.') === 0, 'the announcement names the line that turned free', r.live);
    agrees(r, 'plugin third');
    await o.ctx.close();

    o = await open({ state: S(['Demo Presets']) });
    r = await read(o.page);
    ok(r.sum.rows.total.value === '$0' && r.ladder.rungs[0].filled === 0, 'the sampler alone: $0, and no place taken', [r.sum.rows.total, r.ladder.rungs[0]]);
    ok(/Demo Presets is free anyway, so it doesn’t count\.$/.test(r.ladder.why), 'and the page says it does not count', r.ladder.why);
    ok(r.lines[0].price === 'Free', 'its line reads Free', r.lines[0]);
    ok(r.more.rows.every(x => x.name !== 'Demo Presets'), 'it is never offered as a pack to add', r.more.rows.map(x => x.name));
    agrees(r, 'sampler alone');
    await o.ctx.close();

    o = await open({ state: S(['Aster LUTs'], { label: 'Bestseller bundle', packs: FIVE }) });
    r = await read(o.page);
    ok(r.lines[0].cap && /^Bestseller bundle\s*· 5 packs/.test(r.lines[0].cap), 'a bundle arrives as its packs, under its name', r.lines[0]);
    ok(r.lines[6] && r.lines[6].cap === 'Added separately', 'and what was added on its own is named', r.lines.map(l => l.cap || l.line));
    ok(r.sum.rows.subtotal.value === '$444' && r.sum.rows.total.value === '$326', 'five and one: $444 less $118', r.sum.rows);
    ok(r.engine.free.join() === 'Terra Presets,Jardin Presets', 'the same two free as the front page ringed', r.engine.free);
    ok(r.cheer === 0, 'it was celebrated where it was bought, not here', r.cheer);
    agrees(r, 'bundle and one');
    const kept = r.stored;
    await o.page.click('[data-remove="Terra Presets"]'); await o.page.waitForTimeout(300);
    r = await read(o.page);
    ok(JSON.parse(r.stored).bundle === null && JSON.parse(r.stored).items.join() === 'Full Plugin Pack,Lora Presets,Solis Presets,Jardin Presets,Aster LUTs',
       'taking one out lets go of the bundle and keeps the rest', r.stored);
    ok(r.lines.some(l => l.undo === 'Terra Presets removed. The bundle is now 4 separate packs — they keep the deal they still earn.'), 'and says so', r.lines.filter(l => l.undo));
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
    ok(r.ladder.say === 'Pick any 3 packs, get 1 of them free.' && r.ladder.why === 'Three packs for $118 instead of $177.', 'the campaign is still there, from the start', r.ladder);
    ok(r.badge === '0' && r.bagLabel === 'Basket, empty', 'the bar says empty', [r.badge, r.bagLabel]);
    await o.page.click('.pick__go'); await o.page.waitForTimeout(400);
    r = await read(o.page);
    ok(r.h1.join() === 'Your basket' && r.linesShown && r.sum && r.lines.length === 1, 'one press and it is a basket', [r.h1, r.lines]);
    await o.page.click('[data-remove]'); await o.page.waitForTimeout(300);
    r = await read(o.page);
    ok(r.undoSolo === 'Lora Presets removed.' && r.h1.join() === 'Your basket is empty.', 'the last line out leaves the way back standing', [r.undoSolo, r.h1]);
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
    ok(r.crumbs.join('|') === '✓Basket*|>Payment| Done', 'the basket is done and is the one step you can go back to', r.crumbs);
    ok(r.sum.mini === 3 && r.sum.rows.total.value === '$118', 'the summary lists the order', r.sum);
    ok(await page.evaluate(() => document.querySelector('[data-pay-go]').textContent) === 'Complete order — $118', 'the button carries the total');
    ok(await page.evaluate(() => !document.querySelector('#payForm input[name="card"], #payForm input[autocomplete^="cc-"]')), 'there is no card field to type into');
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
    ok(e.every(x => x.bad === 'true') && e[0].by === 'payEmailErr payEmailHint', 'and is marked for a screen reader', e);
    ok(r.focus === 'payEmail' && r.live === '3 things need fixing before you can continue.', 'focus goes to the first, and the count is announced', [r.focus, r.live]);
    await page.fill('#payEmail', 'ayse@example'); await page.waitForTimeout(80);
    e = await errs();
    ok(e[0].err === 'That doesn’t look like an email address. Check the @ and the dot.', 'a half-typed address is told what is missing', e[0]);
    await page.fill('#payEmail', 'Ayse+shop@Example.com'); await page.waitForTimeout(80);
    e = await errs();
    ok(e[0].err === '' && e[0].bad === 'false', 'and the message goes the moment it is right (a plus sign is fine)', e[0]);
    await page.fill('#payName', 'Cher'); await page.check('#payAgree'); await page.waitForTimeout(80);
    e = await errs();
    ok(e.every(x => x.err === ''), 'a one-word name is a name', e);
    const stored = await page.evaluate(() => localStorage.getItem('rm-cart'));
    const keysBefore = await page.evaluate(() => Object.keys(localStorage).sort().join());
    await page.click('[data-pay-go]'); await page.waitForTimeout(400);
    r = await read(page);
    ok(r.view === 'done' && r.hash === '#done' && r.h1.join() === 'Order complete — in preview', 'a complete form is Done — in preview', [r.view, r.h1]);
    ok(r.crumbs.join('|') === '✓Basket|✓Payment|>Done', 'all three steps', r.crumbs);
    const p = await page.evaluate(() => document.querySelector('[data-done-p]').textContent);
    ok(p === 'This is a design preview, so no payment was taken and nothing was sent to ayse+shop@example.com. In the live shop your download links arrive by email right after payment.', 'it says, with the address, that nothing was taken and nothing sent', p);
    ok(r.sum.rows.total.label === 'Total — not charged' && r.sum.rows.total.value === '$118', 'the receipt says not charged', r.sum.rows.total);
    ok(r.stored === stored && await page.evaluate(() => Object.keys(localStorage).sort().join()) === keysBefore, 'the basket is as it was, and nothing typed was kept', r.stored);
    ok(r.bar.hidden, 'no bar under the window once it is done', r.bar);
    await page.goBack(); await page.waitForTimeout(300);
    r = await read(page);
    ok(r.view === 'basket', 'Back from Done is the basket, never the finished form', [r.view, r.hash]);
    await o.ctx.close();

    /* the address is text, whatever is in it */
    o = await open({ state: S(['Lora Presets']), hash: 'pay' });
    await o.page.fill('#payEmail', '"><b>x</b>@example.com'); await o.page.fill('#payName', 'A B'); await o.page.check('#payAgree');
    await o.page.click('[data-pay-go]'); await o.page.waitForTimeout(300);
    ok(await o.page.evaluate(() => document.querySelectorAll('[data-done-p] b').length === 1 && document.querySelector('[data-done-p] b').textContent === '"><b>x</b>@example.com'), 'markup typed into the form stays text');
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
    await o.ctx.close();
  }

  /* ── 6 · Turkish ────────────────────────────────────────────────── */
  section('6 · in Turkish');
  {
    let o = await open({ state: S(['Lora Presets', 'Solis Presets']), lang: 'tr' });
    const page = o.page;
    let r = await read(page);
    ok(r.lang === 'tr' && r.title === 'Sepetin — Retouch Market' && r.h1.join() === 'Sepetin', 'the page is in Turkish, and says it is', [r.lang, r.title, r.h1]);
    ok(r.ladder.say === '1 ürün daha ekle, 1 ürün bedava kazan.', 'two products: the owner’s own sentence', r.ladder.say);
    ok(r.ladder.eyebrow === 'Adım 1 / 2 · 3 Al 2 Öde' && r.ladder.pick.label === 'Bedava ürünün' && r.ladder.pick.go === 'Bedava ürününü ekle', 'the step and the pick', r.ladder);
    ok(r.sum.rows.next.label.indexOf('3 Al 2 Öde · 1 ürün kaldı') === 0 && r.sum.go === 'Ödemeye geç', 'the summary', r.sum);
    ok(r.bagLabel === 'Sepet, 2 ürün' && r.crumbs.join('|') === '>Sepet| Ödeme| Tamam', 'the bar and the steps', [r.bagLabel, r.crumbs]);
    await page.click('.pick__go'); await page.waitForTimeout(400);
    r = await read(page);
    ok(r.cheerLead === 'Kazancın', 'the celebration is in Turkish too', r.cheerLead);
    ok(r.live === 'Terra Presets sepete eklendi. 3 Al 2 Öde açıldı: Terra Presets bedava. Kazancın $59. Toplam $118. Sonraki adım: 5 Al 3 Öde için 2 ürün daha.', 'and so is what is announced', r.live);
    ok(r.sum.save === 'Kazancın $59 · %33 indirim', 'the percent sign goes in front', r.sum.save);
    agrees(r, 'Turkish, 3 products');
    /* changing it on the page changes the page, there and then */
    await page.evaluate(() => window.RMLang.set('en')); await page.waitForTimeout(200);
    r = await read(page);
    ok(r.lang === 'en' && r.h1.join() === 'Your basket' && r.ladder.say === 'Add 2 more packs, get 2 of the 5 free.' && r.cheer <= 1, 'the language switch redraws everything', [r.lang, r.h1, r.ladder.say]);
    ok(r.live.indexOf('sepete') > -1 || r.live === '', 'and announces nothing new', r.live);
    await page.evaluate(() => window.RMLang.set('tr'));
    await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(250);
    r = await read(page);
    ok(r.lang === 'tr' && r.h1.join() === 'Sepetin', 'and it is remembered', [r.lang, r.h1]);
    /* the Turkish strings that are not English ones: every key has both */
    const gaps = await page.evaluate(() => {
      const out = []; const seen = new Set();
      document.querySelectorAll('#main [data-s]').forEach(el => seen.add(el.getAttribute('data-s')));
      window.RMLang.set('en'); const en = {}; document.querySelectorAll('#main [data-s]').forEach(el => en[el.getAttribute('data-s')] = el.textContent);
      window.RMLang.set('tr'); document.querySelectorAll('#main [data-s]').forEach(el => {
        const k = el.getAttribute('data-s'); if(el.textContent === en[k] && !/^(card_cvc)$/.test(k) && el.textContent !== 'CVC') out.push(k); });
      return out;
    });
    ok(gaps.length === 0, 'every fixed string on the page has its own Turkish', gaps);
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
    await home.evaluate(() => { [].slice.call(document.querySelectorAll('.card__add')).filter(b => /Onyx Presets/.test(b.getAttribute('aria-label')))[0].click(); });
    await o.page.waitForTimeout(400);
    let r = await read(o.page);
    ok(r.lines.map(l => l.line).join() === 'Lora Presets,Onyx Presets', 'a pack added on the front page arrives on the basket page', r.lines);
    ok(r.cheer === 0 && r.live === '', 'quietly: it was not pressed here', [r.cheer, r.live]);
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
    await o.ctx.close();
  }

  /* ── 8 · the bar under the window ───────────────────────────────── */
  section('8 · the bar under the window');
  {
    let o = await open({ state: S(['Lora Presets']), w: 390, h: 844, touch: true });
    const page = o.page;
    await page.waitForTimeout(400);
    let r = await read(page);
    ok(r.bar.on && !r.bar.hidden && r.bar.go === 'Continue to payment' && r.bar.note === 'Get 3, Pay 2 · 1 / 3', 'on a phone it is there while the real button is below the fold', r.bar);
    await page.evaluate(() => document.querySelector('.sum__go').scrollIntoView({ block: 'center' })); await page.waitForTimeout(500);
    ok(!(await read(page)).bar.on, 'and steps aside when the real button is on the screen');
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(500);
    ok(!(await read(page)).bar.on, 'and never covers the footer');
    await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(500);
    await page.click('[data-bar-go]'); await page.waitForTimeout(400);
    r = await read(page);
    ok(r.view === 'pay', 'its button goes to payment', r.view);
    ok(await page.evaluate(() => !!document.querySelector('details.sum--fold') && !document.querySelector('details.sum--fold').open), 'where the summary is one line until it is asked for');
    await page.focus('#payEmail'); await page.waitForTimeout(350);
    ok(!(await read(page)).bar.on, 'and it is never over a field being typed in');
    await o.ctx.close();

    o = await open({ state: S(['Lora Presets']), w: 1440, h: 900 });
    await o.page.waitForTimeout(400);
    ok(!(await read(o.page)).bar.on, 'on a desk the summary is beside the page, so the bar is not there');
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
    let wide = [], small = [], cut = [], count = 0;
    for(const w of [320, 360, 390, 430, 600, 601, 768, 860, 1000, 1001, 1100, 1200, 1201, 1440, 1920]){
      for(const lang of ['', 'tr']){
        const o = await open({ state: STATES.one, lang, w, h: 900, touch: w < 700 });
        for(const name of Object.keys(STATES)){
          for(const hash of ['', 'pay']){
            if(hash === 'pay' && name === 'empty') continue;
            await o.page.evaluate(([s]) => { if(s) localStorage.setItem('rm-cart', s); else localStorage.removeItem('rm-cart'); }, [STATES[name]]);
            await o.page.goto(BASE + 'cart.html', { waitUntil: 'load' });
            if(hash) await o.page.goto(BASE + 'cart.html#' + hash, { waitUntil: 'load' });
            await o.page.waitForTimeout(60);
            count++;
            const m = await o.page.evaluate(() => {
              const de = document.documentElement, vw = de.clientWidth, out = { over: de.scrollWidth - vw, small: [], cut: [] };
              const seen = el => !el.closest('[hidden]') && el.getClientRects().length > 0;
              /* anything a finger is asked to hit is at least 44px tall, unless it is a link in a sentence */
              if(matchMedia('(pointer:coarse)').matches || vw < 700){
                document.querySelectorAll('#main button, #main a, #main summary, #main input[type="checkbox"]').forEach(el => {
                  if(!seen(el) || el.closest('.sum__nudge, .agree, .prod--later') || el.matches('.agree input')) return;
                  const r = el.getBoundingClientRect();
                  const label = el.closest('label'); const h = label ? label.getBoundingClientRect().height : r.height;
                  if(h < 43.5) out.small.push((el.className || el.tagName) + ' ' + Math.round(h));
                });
              }
              /* nothing that is meant to be read runs out of the window */
              document.querySelectorAll('#main h1, #main h2, #main h3, #main p, #main .btn, #main .rung, #main .line, #main .addrow, #main .sum, #main .pick').forEach(el => {
                if(!seen(el)) return;
                const r = el.getBoundingClientRect();
                if(r.right > vw + 0.5 || r.left < -0.5) out.cut.push((el.className || el.tagName) + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
              });
              return out;
            });
            const at = w + (lang ? ' tr ' : ' en ') + name + (hash ? ' #pay' : '');
            if(m.over > 0) wide.push(at + ' +' + m.over);
            if(m.small.length) small.push(at + ' ' + m.small.slice(0, 3).join(', '));
            if(m.cut.length) cut.push(at + ' ' + m.cut.slice(0, 3).join(', '));
          }
        }
        await o.ctx.close();
      }
    }
    ok(wide.length === 0, 'nothing is wider than the window (' + count + ' pages)', wide.slice(0, 6));
    ok(cut.length === 0, 'nothing that is read runs off the edge', cut.slice(0, 6));
    ok(small.length === 0, 'everything a finger is asked to hit is 44px tall', small.slice(0, 8));
  }

  /* ── 10 · the shape of the page ─────────────────────────────────── */
  section('10 · headings, names, and motion turned down');
  {
    let o = await open({ state: S(['Aster LUTs'], { label: 'Bestseller bundle', packs: FIVE }) });
    for(const hash of ['', 'pay']){
      if(hash) { await o.page.goto(BASE + 'cart.html#' + hash, { waitUntil: 'load' }); await o.page.waitForTimeout(150); }
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
          live: !!document.querySelector('#main [role="status"][aria-live="polite"]'),
          dupIds: (() => { const ids = {}; let d = []; document.querySelectorAll('[id]').forEach(e => { if(ids[e.id]) d.push(e.id); ids[e.id] = 1; }); return d; })()
        };
      });
      const at = hash ? 'payment' : 'basket';
      ok(a.h1 === 1 && a.first === 1 && !a.jump, at + ': one h1, first, and no level skipped', a);
      ok(a.nameless.length === 0, at + ': every button and link has a name', a.nameless);
      ok(a.noalt === 0 && a.unlabelled.length === 0, at + ': every picture has an alt and every field a label', [a.noalt, a.unlabelled]);
      ok(a.landmarks.every(Boolean) && a.live && a.dupIds.length === 0, at + ': header, main, footer, one live region, no id twice', [a.landmarks, a.live, a.dupIds]);
    }
    await o.ctx.close();

    o = await open({ state: S(['Lora Presets', 'Solis Presets']), still: true });
    await o.page.click('.pick__go'); await o.page.waitForTimeout(200);
    const still = await o.page.evaluate(() => ({ cheer: document.querySelectorAll('.cheer').length, sparks: document.querySelectorAll('.cheer__spark').length,
      n: document.querySelector('[data-cheer-n]') ? document.querySelector('[data-cheer-n]').textContent : null }));
    ok(still.cheer === 1 && still.sparks === 0 && still.n === '59', 'with motion turned down the saving is shown, and nothing flies', still);
    agrees(await read(o.page), 'motion down');
    await o.ctx.close();
  }

  /* ── 11 · the same bar and the same footer ──────────────────────── */
  section('11 · the bar and the footer are the front page\u2019s, property for property');
  {
    const snap = sel => {
      const root = document.querySelector(sel);
      if(!root) return null;
      const out = [];
      [root].concat([].slice.call(root.querySelectorAll('*'))).forEach(el => {
        [null, '::before', '::after'].forEach(ps => {
          const cs = getComputedStyle(el, ps);
          if(ps && (cs.content === 'none' || cs.content === 'normal')){ out.push(null); return; }
          const o = {};
          for(let i = 0; i < cs.length; i++) o[cs[i]] = cs.getPropertyValue(cs[i]);
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
    ok(compared > 100000, 'compared ' + compared + ' computed properties');
  }

  section('12 · nothing went wrong');
  ok(errors.length === 0, 'no script errors on either page', errors.slice(0, 5));
  ok(outside.length === 0, 'and nothing was asked of any other site', [...new Set(outside)].slice(0, 5));

  await browser.close();
  server.close();
  console.log('\n' + (bad ? bad + ' of ' + ran + ' checks FAILED' : 'all ' + ran + ' checks pass'));
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
