/* ════════════════════════════════════════════════════════════════
   RM CART — the basket the two pages share

   The front page fills the basket and the basket page prices it, so the
   three things they have to agree on live here and nowhere else: what is
   on sale, what a basket is worth, and where it is kept between pages.

   · WHAT IS ON SALE is the same twelve packs the bundle on the front page
     is built from, plus the free sampler. The names are the keys: the
     front page's basket has always been keyed by name, and so is this.

   · WHAT A BASKET IS WORTH is the bundle's own two deals — Get 3, Pay 2
     and Get 5, Pay 3 — applied to whatever is in the basket, without
     anybody having to build a bundle first. One deal a basket, the best
     one it has reached. See rate() for exactly what "best" means.

   · WHERE IT IS KEPT is localStorage, under one key, as the names in the
     order they were added. A page that cannot reach localStorage still
     works; it just forgets when you leave it.

   Nothing in here touches the document. It can be loaded by either page,
   or by node for the tests.
   ════════════════════════════════════════════════════════════════ */
(function(root){
  "use strict";

  var KEY = 'rm-cart', VERSION = 1;

  /* the two deals, in the order a growing basket reaches them */
  var DEALS = [{get:3, pay:2}, {get:5, pay:3}];

  /* PREVIEW DATA, the same as the front page's: names, makers, prices and
     box art are read off index.html (the PACKS list in the offer script and
     the shelf above it). `kind` is the one field added here — the basket
     says what a line is, not only what it is called. */
  var CATALOGUE = [
    {name:'Full Plugin Pack', kind:'plugins', by:'Retouch Market', ini:'RM', price:149, was:299,
     img:'images/boxes/full-plugin-pack.webp',
     imgs:['images/box-lightroom-ai-color.png','images/box-retouchx.png','images/box-us-photoshop-plugin.png']},
    {name:'Lora Presets',   kind:'presets', by:'Uğur Sezer',     ini:'UŞ', price:59, was:119, img:'images/boxes/lora.webp'},
    {name:'Solis Presets',  kind:'presets', by:'Uğur Sezer',     ini:'UŞ', price:59, was:119, img:'images/boxes/solis.webp'},
    {name:'Terra Presets',  kind:'presets', by:'Uğur Sezer',     ini:'UŞ', price:59, was:119, img:'images/boxes/terra.webp'},
    {name:'Jardin Presets', kind:'presets', by:'Uğur Demir',     ini:'UD', price:59, was:119, img:'images/boxes/jardin.webp'},
    {name:'Mely Presets',   kind:'presets', by:'Melih Süren',    ini:'MS', price:59, was:119, img:'images/boxes/mely.webp'},
    {name:'Onyx Presets',   kind:'presets', by:'Adam Tahirov',   ini:'AT', price:59, was:119, img:'images/boxes/onyx.webp'},
    {name:'Doré Presets',   kind:'presets', by:'Mücahit Güney',  ini:'MG', price:59, was:119, img:'images/boxes/dore.webp'},
    {name:'Olbia LUTs',     kind:'luts',    by:'Umut Kaçar',     ini:'UK', price:59, was:119, img:'images/boxes/olbia.webp'},
    {name:'Vela Presets',   kind:'presets', by:'Uğur Sezer',     ini:'UŞ', price:59, was:119, img:'images/boxes/vela.webp'},
    {name:'Nord Presets',   kind:'presets', by:'Melih Süren',    ini:'MS', price:59, was:119, img:'images/boxes/nord.webp'},
    {name:'Aster LUTs',     kind:'luts',    by:'Adam Tahirov',   ini:'AT', price:59, was:119, img:'images/boxes/aster.webp'},
    /* the sampler costs nothing, so it is never part of a deal: it neither
       fills a place on the way to one nor takes one of the free places */
    {name:'Demo Presets',   kind:'presets', by:'Retouch Market', ini:'RM', price:0,  was:null, img:null}
  ];

  var BY_NAME = {};
  CATALOGUE.forEach(function(p, i){ p.order = i; BY_NAME[p.name] = p; });
  function find(name){ return BY_NAME.hasOwnProperty(name) ? BY_NAME[name] : null; }

  /* ── what a basket is worth ───────────────────────────────────────
     `lines` is the basket in the order it was filled: [{price}, …].

     Only what costs money counts towards a deal. Of the deals the basket
     has reached, each is tried on the most expensive `get` things in it —
     the dearest `pay` of those are paid for and the rest of them are free
     — and the one that takes the most off is the one applied. Trying it on
     the dearest things is what makes it the best the customer could have
     done by hand: on the front page they choose which packs go in the
     bundle, so nothing here should come out worse than choosing well.

     Where two things cost the same, the one added later is the free one,
     so the ones you put in first are the ones you keep paying for. That is
     the front page's rule too, and for a basket of exactly three or five
     the two give the same answer, pack for pack.

     One deal, once. A sixth pack is a pack at its own price. */
  function rate(lines){
    var counted = [], subtotal = 0;
    lines.forEach(function(l, i){
      l.free = false;
      subtotal += l.price;
      if(l.price > 0) counted.push({i:i, price:l.price});
    });
    /* dearest first; among equals, the earlier one first — which leaves the
       later ones at the cheap end, where the free places are */
    var ranked = counted.slice().sort(function(a, b){ return (b.price - a.price) || (a.i - b.i); });

    var best = null;
    DEALS.forEach(function(d){
      if(ranked.length < d.get) return;
      var gifts = ranked.slice(d.pay, d.get), off = 0;
      gifts.forEach(function(g){ off += g.price; });
      /* a bigger deal wins a draw: it is the one the page has been pointing at */
      if(!best || off >= best.saving) best = {deal:d, gifts:gifts, saving:off};
    });
    if(best) best.gifts.forEach(function(g){ lines[g.i].free = true; });

    var n = counted.length;
    var steps = DEALS.map(function(d){
      return { get:d.get, pay:d.pay, free:d.get - d.pay,
               need: Math.max(0, d.get - n),
               reached: n >= d.get,
               applied: !!best && best.deal === d };
    });
    var next = null;
    steps.forEach(function(s){ if(!next && !s.reached) next = s; });

    return {
      lines: lines,
      count: lines.length,
      counted: n,                         /* how many of them a deal can see */
      subtotal: subtotal,
      saving: best ? best.saving : 0,
      total: subtotal - (best ? best.saving : 0),
      deal: best ? {get:best.deal.get, pay:best.deal.pay} : null,
      steps: steps,
      next: next
    };
  }

  /* the same, for a list of names: anything the catalogue does not know is
     left out and reported, rather than priced at a guess */
  function price(names){
    var lines = [], unknown = [];
    (names || []).forEach(function(name){
      var p = find(name);
      if(!p){ unknown.push(name); return; }
      lines.push({name:p.name, item:p, price:p.price, was:p.was, gift:p.price === 0, free:false});
    });
    var out = rate(lines);
    out.unknown = unknown;
    return out;
  }

  /* what putting one more thing in would do: what it adds to the total —
     which is not its price once a deal is in reach — and whether it is the
     one that opens the next deal */
  function adding(names, name){
    var p = find(name);
    if(!p || (names || []).indexOf(name) > -1) return null;
    var now = price(names), then = price(names.concat([name]));
    var opens = then.deal && (!now.deal || then.deal.get !== now.deal.get) ? then.deal : null;
    return { name:name, price:p.price, cost: then.total - now.total, opens: opens, then: then };
  }

  /* ── where it is kept ─────────────────────────────────────────────
     { items: names added one by one, in order,
       bundle: null | { label, packs } }   — the front page's bundle is a
     line of its own there, holding its packs; they are not also in items.

     Read is forgiving: anything that is not what it should be is dropped
     rather than trusted, and nothing is ever in the basket twice. */
  function blank(){ return {items:[], bundle:null}; }
  function clean(raw){
    var out = blank(), seen = {};
    if(!raw || typeof raw !== 'object') return out;
    var b = raw.bundle;
    if(b && typeof b === 'object' && Array.isArray(b.packs)){
      var packs = [];
      b.packs.forEach(function(n){
        if(typeof n === 'string' && n && !seen[n]){ seen[n] = true; packs.push(n); }
      });
      if(packs.length) out.bundle = {label: typeof b.label === 'string' && b.label ? b.label : 'Bundle', packs:packs};
    }
    if(Array.isArray(raw.items)){
      raw.items.forEach(function(n){
        if(typeof n === 'string' && n && !seen[n]){ seen[n] = true; out.items.push(n); }
      });
    }
    return out;
  }
  function store(){
    try { return root.localStorage || null; } catch(e){ return null; }
  }
  function read(){
    var s = store();
    if(!s) return blank();
    try { return clean(JSON.parse(s.getItem(KEY) || 'null')); } catch(e){ return blank(); }
  }
  function write(state){
    var s = store(), c = clean(state);
    if(!s) return c;
    try {
      if(!c.items.length && !c.bundle) s.removeItem(KEY);
      else s.setItem(KEY, JSON.stringify({v:VERSION, items:c.items, bundle:c.bundle}));
    } catch(e){}
    return c;
  }

  /* everything in the basket as one list, in the order it is shown: what the
     bundle holds, then what was added on its own */
  function names(state){
    var c = clean(state);
    return (c.bundle ? c.bundle.packs : []).concat(c.items);
  }
  function has(state, name){ return names(state).indexOf(name) > -1; }

  /* The basket page lists a bundle as the packs it holds, and any of them
     can be taken out there. Taking one out is not a refusal, as it is on the
     front page — it lets go of the bundle and keeps the rest of its packs as
     ordinary lines. Nothing is lost by it: the deal belongs to the basket,
     not to the bundle, so whatever the remaining packs still earn they keep. */
  function add(state, name){
    var c = clean(state);
    if(typeof name !== 'string' || !name || has(c, name)) return c;
    c.items.push(name);
    return c;
  }
  function remove(state, name){
    var c = clean(state);
    if(c.bundle && c.bundle.packs.indexOf(name) > -1){
      c.items = c.bundle.packs.filter(function(n){ return n !== name; }).concat(c.items);
      c.bundle = null;
      return c;
    }
    c.items = c.items.filter(function(n){ return n !== name; });
    return c;
  }

  /* the other page, or another tab, changed it */
  function watch(fn){
    if(!root.addEventListener) return;
    root.addEventListener('storage', function(e){
      if(e.key === KEY || e.key === null) fn(read());
    });
  }

  var api = {
    KEY: KEY, DEALS: DEALS, CATALOGUE: CATALOGUE,
    find: find, rate: rate, price: price, adding: adding,
    blank: blank, clean: clean, read: read, write: write,
    names: names, has: has, add: add, remove: remove, watch: watch
  };
  root.RMCart = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
