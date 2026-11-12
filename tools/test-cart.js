#!/usr/bin/env node
/* The basket's arithmetic, checked against something too simple to be wrong.

     node tools/test-cart.js

   rm-cart.js prices a basket with a rule that is quick: sort once, take a
   slice. This file prices the same baskets the slow way — every deal the
   basket has reached, tried on every group of that many things in it — and
   the two have to agree on every basket it can think of. Then the things a
   customer would notice: nothing is ever paid for twice, putting something
   in never makes the total go down, and the front page's bundle and the
   basket page give the same price for the same packs. */
'use strict';
var path = require('path');
var C = require(path.join(__dirname, '..', 'rm-cart.js'));

var bad = 0, ran = 0;
function ok(cond, what){
  ran++;
  if(!cond){ bad++; console.log('  ✗  ' + what); }
}
function section(t){ console.log('\n' + t); }

/* ── the slow way ─────────────────────────────────────────────────── */
function groups(n, k){            /* every way of choosing k of n, as index lists */
  var out = [];
  (function go(start, pick){
    if(pick.length === k){ out.push(pick.slice()); return; }
    for(var i = start; i < n; i++){ pick.push(i); go(i + 1, pick); pick.pop(); }
  })(0, []);
  return out;
}
function slow(prices){
  var paid = prices.filter(function(p){ return p > 0; });
  var best = 0;
  C.DEALS.forEach(function(d){
    if(paid.length < d.get) return;
    groups(paid.length, d.get).forEach(function(g){
      var vals = g.map(function(i){ return paid[i]; }).sort(function(a, b){ return a - b; });
      var off = 0;
      for(var i = 0; i < d.get - d.pay; i++) off += vals[i];   /* the cheapest of the group */
      if(off > best) best = off;
    });
  });
  return best;
}
function lines(prices){ return prices.map(function(p){ return {price:p}; }); }

/* a small repeatable generator, so a failure can be found again */
var seed = 20260816;
function rnd(){ seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
function pick(a){ return a[Math.floor(rnd() * a.length)]; }

/* ── 1 · the quick rule against the slow one ──────────────────────── */
section('1 · against every group of every reached deal');
(function(){
  var pools = [[59], [59, 149], [0, 59, 149], [10, 59, 100, 149, 299], [1, 2, 3, 5, 8, 13, 21]];
  var worst = 0;
  for(var t = 0; t < 6000; t++){
    var pool = pick(pools), n = Math.floor(rnd() * 11), prices = [];
    for(var i = 0; i < n; i++) prices.push(pick(pool));
    var r = C.rate(lines(prices)), ref = slow(prices);
    if(r.saving !== ref){ worst++; if(worst < 4) console.log('     basket', JSON.stringify(prices), 'quick', r.saving, 'slow', ref); }
  }
  ok(worst === 0, 'the saving is the best any grouping could give, in 6,000 random baskets (' + worst + ' wrong)');
  console.log('  ✓  6,000 random baskets, prices from five different pools');
})();

/* ── 2 · what the result is made of ───────────────────────────────── */
section('2 · the parts add up, whatever the prices');
(function(){
  var wrong = {sum:0, free:0, gift:0, deal:0, steps:0, next:0};
  for(var t = 0; t < 4000; t++){
    var n = Math.floor(rnd() * 13), prices = [];
    for(var i = 0; i < n; i++) prices.push(pick([0, 10, 59, 59, 100, 149, 299]));
    var r = C.rate(lines(prices));
    var sub = prices.reduce(function(a, b){ return a + b; }, 0);
    var freeSum = 0, freeN = 0;
    r.lines.forEach(function(l){ if(l.free){ freeSum += l.price; freeN++; if(l.price === 0) wrong.gift++; } });
    if(r.subtotal !== sub || r.total !== sub - r.saving || r.saving !== freeSum) wrong.sum++;
    var paid = prices.filter(function(p){ return p > 0; }).length;
    /* as many free as the deal applied gives away — never one more */
    if(freeN !== (r.deal ? r.deal.get - r.deal.pay : 0)) wrong.free++;
    /* a deal exactly when three are reached, and never one the count has not reached */
    if((r.deal === null) !== (paid < 3) || (r.deal && r.deal.get > paid)) wrong.deal++;
    var applied = r.steps.filter(function(s){ return s.applied; });
    if(r.steps.length !== 2 || r.steps[0].need !== Math.max(0, 3 - paid) || r.steps[1].need !== Math.max(0, 5 - paid) ||
       r.steps[0].reached !== (paid >= 3) || r.steps[1].reached !== (paid >= 5) ||
       applied.length !== (paid >= 3 ? 1 : 0) || (applied[0] && (!applied[0].reached || applied[0].get !== r.deal.get))) wrong.steps++;
    var nx = paid < 3 ? 3 : paid < 5 ? 5 : 0;
    if((r.next ? r.next.get : 0) !== nx) wrong.next++;
  }
  ok(wrong.sum === 0, 'total = subtotal − saving, and the saving is exactly the free lines (' + wrong.sum + ')');
  ok(wrong.free === 0, 'as many lines are free as the applied deal gives away, never more (' + wrong.free + ')');
  ok(wrong.gift === 0, 'something that already costs nothing is never one of the free places (' + wrong.gift + ')');
  ok(wrong.deal === 0, 'there is a deal exactly from three up, and never one the count has not reached (' + wrong.deal + ')');
  ok(wrong.steps === 0, 'both steps say how many more they need, and the applied one is one that was reached (' + wrong.steps + ')');
  ok(wrong.next === 0, 'the next step is the first one not reached, and there is none after five (' + wrong.next + ')');
  console.log('  ✓  4,000 baskets of up to twelve, seven different prices');
})();

/* ── 2b · every basket this shop can actually sell ────────────────────
   The rule above takes whichever reached deal saves most, which with
   invented prices can be the smaller one (three at $149 and two at $59:
   one $149 free beats two $59s). The page's steps only make sense if that
   never happens here — if reaching the second step always means the second
   deal is the one applied. Thirteen things make 8,192 baskets, so rather
   than argue it, every one of them is priced, forwards and backwards. */
section('2b · all 8,192 baskets of the real catalogue, in both orders');
(function(){
  var all = C.CATALOGUE.map(function(p){ return p.name; }), N = all.length;
  var wrong = {tier:0, free:0, total:0, plugin:0, sampler:0}, seen = 0;
  for(var mask = 0; mask < (1 << N); mask++){
    var names = [];
    for(var i = 0; i < N; i++) if(mask & (1 << i)) names.push(all[i]);
    [names, names.slice().reverse()].forEach(function(list){
      seen++;
      var r = C.price(list);
      var paid = list.filter(function(n){ return C.find(n).price > 0; }).length;
      var sum = list.reduce(function(a, n){ return a + C.find(n).price; }, 0);
      var tier = paid >= 5 ? 5 : paid >= 3 ? 3 : 0, off = paid >= 5 ? 118 : paid >= 3 ? 59 : 0;
      if((r.deal ? r.deal.get : 0) !== tier) wrong.tier++;
      if(r.lines.filter(function(l){ return l.free; }).length !== (paid >= 5 ? 2 : paid >= 3 ? 1 : 0)) wrong.free++;
      if(r.total !== sum - off || r.saving !== off) wrong.total++;
      r.lines.forEach(function(l){
        if(l.free && l.name === 'Full Plugin Pack') wrong.plugin++;
        if(l.free && l.name === 'Demo Presets') wrong.sampler++;
      });
    });
  }
  ok(seen === 16384, 'every basket, both ways round (' + seen + ')');
  ok(wrong.tier === 0, 'the deal applied is always the highest step reached (' + wrong.tier + ')');
  ok(wrong.free === 0, 'none free under three, one from three, two from five (' + wrong.free + ')');
  ok(wrong.total === 0, 'and what comes off is $59 from three and $118 from five, exactly (' + wrong.total + ')');
  ok(wrong.plugin === 0, 'the plugin pack is never the free one (' + wrong.plugin + ')');
  ok(wrong.sampler === 0, 'and the sampler never takes a free place (' + wrong.sampler + ')');
  console.log('  ✓  16,384 baskets');
})();

/* ── 3 · what a customer would notice ─────────────────────────────── */
section('3 · one more never costs less than nothing, or more than its price');
(function(){
  var down = 0, over = 0;
  for(var t = 0; t < 4000; t++){
    var n = Math.floor(rnd() * 10), prices = [];
    for(var i = 0; i < n; i++) prices.push(pick([10, 59, 100, 149, 299]));
    var x = pick([10, 59, 100, 149, 299]);
    var a = C.rate(lines(prices)).total, b = C.rate(lines(prices.concat([x]))).total;
    if(b - a < 0) down++;
    if(b - a > x) over++;
  }
  ok(down === 0, 'adding something never lowers the total (' + down + ')');
  ok(over === 0, 'and never adds more than its own price (' + over + ')');
  console.log('  ✓  4,000 additions');
})();

/* ── 4 · the real catalogue, pack by pack ─────────────────────────── */
section('4 · the shop’s own packs');
(function(){
  var P = C.CATALOGUE.filter(function(p){ return p.price > 0 && p.kind !== 'plugins'; }).map(function(p){ return p.name; });
  var FULL = 'Full Plugin Pack', DEMO = 'Demo Presets';
  ok(C.CATALOGUE.length === 13, 'thirteen things in the catalogue (' + C.CATALOGUE.length + ')');
  ok(P.length === 11 && !!C.find(FULL) && !!C.find(DEMO), 'eleven packs, the plugin pack and the sampler');
  ok(C.find('toString') === null && C.find('constructor') === null, 'a name that is only an object’s own plumbing is not a product');

  var t = function(n){ return C.price(P.slice(0, n)); };
  ok(t(0).total === 0 && t(0).deal === null && t(0).next.get === 3 && t(0).next.need === 3, 'empty: nothing to pay, three to go');
  ok(t(1).total === 59 && t(1).next.need === 2, 'one pack: $59, two to go');
  ok(t(2).total === 118 && t(2).next.need === 1, 'two packs: $118, one to go');
  ok(t(3).total === 118 && t(3).saving === 59 && t(3).deal.get === 3 && t(3).next.get === 5 && t(3).next.need === 2,
     'three packs: still $118 — the third is free — and two to go to the next deal');
  ok(t(4).total === 177 && t(4).saving === 59 && t(4).next.need === 1, 'four packs: $177, one to go');
  ok(t(5).total === 177 && t(5).saving === 118 && t(5).deal.get === 5 && t(5).next === null,
     'five packs: still $177 — the fifth is free too — and nothing left to reach');
  ok(t(6).total === 236 && t(6).saving === 118 && t(6).deal.get === 5, 'six packs: one deal, once — the sixth is $59');
  ok(t(11).total === 9 * 59 && t(11).saving === 118, 'all eleven: two free, nine paid');

  /* which ones are free: the ones added last */
  var five = t(5).lines.map(function(l){ return l.free; });
  ok(JSON.stringify(five) === '[false,false,false,true,true]', 'of five the same price, the last two in are the free ones');
  var three = t(3).lines.map(function(l){ return l.free; });
  ok(JSON.stringify(three) === '[false,false,true]', 'of three, the last one in');

  /* the plugin pack is never the free one while there is a cheaper pack */
  var withFull = C.price([P[0], FULL, P[1]]);
  ok(withFull.total === 149 + 59 && withFull.lines[1].free === false && withFull.lines[2].free === true,
     'with the plugin pack in the middle: it is paid for, the later $59 is free');
  var fullFive = C.price([FULL].concat(P.slice(0, 4)));
  ok(fullFive.total === 149 + 59 + 59 && fullFive.saving === 118, 'plugin pack + four: $267, $118 off');

  /* the sampler is outside all of it */
  var demoThree = C.price([P[0], P[1], DEMO]);
  ok(demoThree.deal === null && demoThree.counted === 2 && demoThree.count === 3 && demoThree.total === 118 && demoThree.next.need === 1,
     'two packs and the sampler: the sampler is in the basket but does not count — still one to go');
  var demoFour = C.price([DEMO, P[0], P[1], P[2]]);
  ok(demoFour.deal.get === 3 && demoFour.lines[0].free === false && demoFour.lines[0].gift === true && demoFour.lines[3].free === true,
     'three packs and the sampler: the deal’s free place goes to a pack, not to the thing that was free anyway');

  /* an unknown name is reported, not priced */
  var odd = C.price([P[0], 'No Such Pack']);
  ok(odd.count === 1 && odd.unknown.length === 1 && odd.total === 59, 'a name the catalogue does not know is left out and named');
})();

/* ── 5 · what one more would do ───────────────────────────────────── */
section('5 · the price of the next one');
(function(){
  var P = C.CATALOGUE.filter(function(p){ return p.price === 59; }).map(function(p){ return p.name; });
  var a2 = C.adding(P.slice(0, 2), P[2]);
  ok(a2.cost === 0 && a2.opens && a2.opens.get === 3, 'the third pack costs nothing and opens Get 3, Pay 2');
  var a3 = C.adding(P.slice(0, 3), P[3]);
  ok(a3.cost === 59 && a3.opens === null, 'the fourth costs its price and opens nothing');
  var a4 = C.adding(P.slice(0, 4), P[4]);
  ok(a4.cost === 0 && a4.opens && a4.opens.get === 5, 'the fifth costs nothing and opens Get 5, Pay 3');
  var a5 = C.adding(P.slice(0, 5), P[5]);
  ok(a5.cost === 59 && a5.opens === null, 'the sixth is a pack at its own price');
  var full2 = C.adding(P.slice(0, 2), 'Full Plugin Pack');
  ok(full2.cost === 90 && full2.opens.get === 3, 'the plugin pack as the third adds $90, not $149: a $59 pack goes free because of it');
  ok(C.adding(P.slice(0, 2), P[0]) === null, 'something already in the basket cannot be added again');
  ok(C.adding(P.slice(0, 2), 'No Such Pack') === null, 'nor can something that is not for sale');
  var demo = C.adding(P.slice(0, 2), 'Demo Presets');
  ok(demo.cost === 0 && demo.opens === null, 'the sampler adds nothing and opens nothing');
})();

/* ── 6 · the front page's bundle and the basket give the same price ── */
section('6 · the same price as the bundle on the front page');
(function(){
  /* the front page's rule, copied out of index.html's offer script:
     the cheapest (get − pay) of the chosen are free; of equals, the later place */
  function frontPage(prices, d){
    var free = {};
    prices.map(function(v, i){ return {i:i, v:v}; })
      .sort(function(a, b){ return (a.v - b.v) || (b.i - a.i); })
      .slice(0, d.get - d.pay).forEach(function(o){ free[o.i] = true; });
    return free;
  }
  /* any three or five of the twelve the bundle can hold, in any order */
  var sold = C.CATALOGUE.filter(function(p){ return p.price > 0; }).map(function(p){ return p.name; });
  var differ = 0, priceGap = 0;
  C.DEALS.forEach(function(d){
    for(var t = 0; t < 2500; t++){
      var pool = sold.slice(), chosen = [];
      while(chosen.length < d.get) chosen.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
      var prices = chosen.map(function(n){ return C.find(n).price; });
      var f = frontPage(prices, d), r = C.price(chosen), bill = 0;
      for(var k = 0; k < prices.length; k++){
        if(!f[k]) bill += prices[k];
        if(!!f[k] !== r.lines[k].free){ differ++; break; }
      }
      if(bill !== r.total) priceGap++;
    }
  });
  ok(differ === 0, 'for a bundle of exactly three or five, the same packs are free on both pages (' + differ + ' differ)');
  ok(priceGap === 0, 'and the bundle’s button and the basket’s total say the same number (' + priceGap + ' differ)');
  console.log('  ✓  5,000 bundles drawn from the twelve packs');
})();

/* ── 7 · keeping it ───────────────────────────────────────────────── */
section('7 · the basket as it is kept');
(function(){
  var s = C.blank();
  s = C.add(s, 'Lora Presets'); s = C.add(s, 'Solis Presets'); s = C.add(s, 'Lora Presets');
  ok(JSON.stringify(s.items) === '["Lora Presets","Solis Presets"]', 'in the order added, and never twice');
  s = C.remove(s, 'Lora Presets');
  ok(JSON.stringify(s.items) === '["Solis Presets"]', 'out again');

  var b = {items:['Aster LUTs'], bundle:{label:'Bestseller bundle', packs:['Full Plugin Pack','Lora Presets','Solis Presets']}};
  ok(JSON.stringify(C.names(b)) === '["Full Plugin Pack","Lora Presets","Solis Presets","Aster LUTs"]', 'a bundle is listed as its packs, ahead of what was added on its own');
  ok(C.has(b, 'Lora Presets') && C.has(b, 'Aster LUTs') && !C.has(b, 'Nord Presets'), 'has() sees both kinds');
  ok(C.add(b, 'Lora Presets').items.length === 1, 'a pack the bundle holds is not added beside it');
  var freed = C.remove(b, 'Lora Presets');
  ok(freed.bundle === null && JSON.stringify(freed.items) === '["Full Plugin Pack","Solis Presets","Aster LUTs"]',
     'taking one pack out of a bundle lets go of the bundle and keeps the rest, in place');
  ok(b.bundle !== null && b.items.length === 1, 'and the state it was given is left as it was');

  /* whatever is in storage, reading it never throws and never trusts it */
  var junk = [null, 7, 'x', [], {items:'no'}, {items:[1, null, {}, 'Lora Presets', 'Lora Presets', '']},
              {bundle:{packs:'no'}}, {bundle:{label:9, packs:['A', 'A', 4]}, items:['A', 'B']}];
  var threw = 0, out = junk.map(function(j){ try { return C.clean(j); } catch(e){ threw++; return null; } });
  ok(threw === 0, 'nothing in storage can make it throw');
  ok(JSON.stringify(out[5].items) === '["Lora Presets"]', 'only strings, only once');
  ok(out[7].bundle.label === 'Bundle' && JSON.stringify(out[7].bundle.packs) === '["A"]' && JSON.stringify(out[7].items) === '["B"]',
     'a pack is in the bundle or beside it, never both');

  /* a pretend localStorage, to see what is written */
  var mem = {}, fake = { getItem:function(k){ return mem.hasOwnProperty(k) ? mem[k] : null; },
                         setItem:function(k, v){ mem[k] = String(v); }, removeItem:function(k){ delete mem[k]; } };
  globalThis.localStorage = fake;
  C.write({items:['Lora Presets'], bundle:null});
  ok(JSON.parse(mem[C.KEY]).items[0] === 'Lora Presets' && JSON.parse(mem[C.KEY]).v === 1, 'written under one key, with a version');
  ok(JSON.stringify(C.read()) === '{"items":["Lora Presets"],"bundle":null}', 'and read back the same');
  C.write(C.blank());
  ok(!mem.hasOwnProperty(C.KEY), 'an empty basket leaves nothing behind');
  mem[C.KEY] = '{not json';
  ok(JSON.stringify(C.read()) === '{"items":[],"bundle":null}', 'a damaged entry reads as an empty basket');
  delete globalThis.localStorage;
  ok(JSON.stringify(C.read()) === '{"items":[],"bundle":null}', 'and so does no storage at all');
})();

console.log('\n' + (bad ? bad + ' of ' + ran + ' checks FAILED' : 'all ' + ran + ' checks pass'));
process.exit(bad ? 1 : 0);
