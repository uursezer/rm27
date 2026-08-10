/*! RM PDP Lightbox — Retouch Market ürün detay galerisi
 *  Tek dosya, bağımlılıksız. Tüm sınıf ve id'ler `rmp-` ön ekiyle
 *  ad alanına alındı: host'un .btn/.nav/.price/.rate/.rail/.wrap
 *  sınıflarıyla çakışmaz, host'un stillerini de etkilemez.
 *
 *  Kullanım:
 *    RMPdp.open(URUNLER, 0)                 // doğrudan aç
 *    RMPdp.attach('.card', el => +el.dataset.i)   // tıklamayı bağla
 *    RMPdp.close() / RMPdp.isOpen()
 *
 *  Ürün nesnesi:
 *    { name, by, av, rating, reviews, price, old, presets,
 *      badges:[['BESTSELLER','']],            // ikon adı otomatik eşlenir
 *      about:'<p>…</p>',
 *      apps:['Lightroom Classic','Camera Raw'],   // opsiyonel
 *      media:[ {type:'photo', src, alt}
 *            | {type:'ba', before, after, alt}
 *            | {type:'youtube', id, poster}
 *            | {type:'instagram', url, poster} ] }
 */

(function(){
'use strict';

/* Sahne çiplerinin ikonları — emoji değil, sistemin kendi çizgi ikonları:
   hepsi 24'lük ızgarada, currentColor konturlu, aynı kalınlıkta. */
function _ci(d){ return '<svg class="rmp-chip__ic" viewBox="0 0 24 24" aria-hidden="true">'+d+'</svg>'; }
var IK = {
  /* fotoğraf */
  foto: _ci('<rect x="3" y="5" width="18" height="14" rx="2.5"/>'+
            '<circle cx="8.6" cy="10.2" r="1.35"/><path d="M20.6 15.6 16 11l-5.6 5.6"/>'),
  /* yukarı-aşağı */
  dikey:_ci('<path d="M12 4v16"/><path d="M8.4 7.6 12 4l3.6 3.6"/><path d="M8.4 16.4 12 20l3.6-3.6"/>'),
  /* sağa-sola */
  yatay:_ci('<path d="M4 12h16"/><path d="M7.6 8.4 4 12l3.6 3.6"/><path d="M16.4 8.4 20 12l-3.6 3.6"/>'),
};

/* Lightbox işaretlemesi buradan kurulur: host'a HTML yapıştırtmıyoruz. */
var _kok = document.createElement('div');
_kok.innerHTML = '<div class="rmp-pdp" id="rmp-pdp" role="dialog" aria-modal="true" aria-label="Ürün detayı">'+
'  <div class="rmp-pdp__scrim" data-close></div>'+
'  <div class="rmp-wrap">'+
'  <div class="rmp-railcol">'+
'  <div class="rmp-railwrap" id="rmp-railwrap">'+
'    <div class="rmp-rail" id="rmp-rail" role="group" aria-label="Görseller"></div>'+
'  </div>'+
'  </div>'+
'  <div class="rmp-col">'+
'    <div class="rmp-stage"><div class="rmp-track" id="rmp-track"></div>'+
/* Sahnenin altındaki üç çip: solda kaçıncı görselde olduğun, ortada ve
   sağda ne yapabileceğin. Alt bilgi şeridi kalktı; bu üçü artık içeriğin
   ÜSTÜNDE durur ve panel o şeridin yerini alarak büyür. Tıklamayı
   yutmazlar — fotoğrafa basıp yakınlaşmak hâlâ mümkün. */
'      <div class="rmp-hud" aria-hidden="true">'+
'        <span class="rmp-chip rmp-chip--count">'+IK.foto+'<b id="rmp-count"></b></span>'+
'        <span class="rmp-chip">'+IK.dikey+'<span>Fotoğrafı değiştir</span></span>'+
'        <span class="rmp-chip">'+IK.yatay+'<span>Paketi değiştir</span></span>'+
'      </div>'+
'    </div>'+
'  </div>'+
'  <div class="rmp-infocol">'+
'    <aside class="rmp-info">'+
'      <div class="rmp-info__scroll" id="rmp-info"></div>'+
'      <div class="rmp-buy" id="rmp-buy"></div>'+
'    </aside>'+
'  </div>'+
'  </div>'+
'<button class="rmp-nav rmp-prev" id="rmp-prev"><span class="rmp-nav__ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 L8 12 L15 19"/></svg></span><span class="rmp-lbl">'+
'  <span class="rmp-t"><em>Önceki paket</em><span id="rmp-prevName"></span></span></span></button>'+
'<button class="rmp-nav rmp-next" id="rmp-next"><span class="rmp-lbl">'+
'  <span class="rmp-t"><em>Sonraki paket</em><span id="rmp-nextName"></span></span></span><span class="rmp-nav__ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5 L16 12 L9 19"/></svg></span></button>'+
'<button class="rmp-close" id="rmp-close" aria-label="Kapat">'+
'  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>'+
'</button>'+
'<p class="rmp-sr" id="rmp-live" aria-live="polite"></p>'+
'</div>';
while(_kok.firstChild) document.body.appendChild(_kok.firstChild);


var TYPE={photo:'Fotoğraf',ba:'Karşılaştırma',youtube:'Video',instagram:'Reels'};
/* Küçük resim etiketi: simge yerine kısa metin — tek bakışta okunur.
   Video türleri en-boy oranıyla anılır, kullanıcı ne göreceğini bilir. */
var ETIKET={photo:'IMG', ba:'B/A', youtube:'16:9', instagram:'9:16'};
/* Rozet ikonları — kaynak sitedeki chip'lerle aynı semboller, emoji olarak.
   Ürün verisine değil buraya yazılır: aynı etiket her yerde aynı ikonu alır. */
var ROZET_IK={
  'BESTSELLER':'🏆', 'POPÜLER':'🔥', 'EDİTÖRÜN SEÇİMİ':'💎', 'YENİ':'🎉'
};

/* Bir paketin İKİ adı var: ne olduğu (PRESETS / LUTs) ve ne diye anıldığı
   (Solis). Veri ikisini ayrı taşırsa (p.kind / p.short) o kullanılır; yoksa
   addaki son kelimeden okunur — "Solis Presets" → PRESETS + "Solis". */
function paketTuru(p){
  if(p.kind) return p.kind;
  var m=String(p.name||'').match(/(LUTs?|Presets?)\s*$/i);
  if(!m) return '';
  return /lut/i.test(m[1]) ? 'LUT PACK' : 'PRESET PACK';
}
function paketAdi(p){
  if(p.short) return p.short;
  var k=String(p.name||'').replace(/\s*(LUTs?|Presets?)\s*$/i,'').trim();
  return k || p.name || '';
}

/* Künye çipi ikonları — emoji değil, sistemin kendi çizgi ikonları:
   hepsi 24'lük ızgarada, currentColor konturlu, aynı kalınlıkta. */
function ikon(d){
  return '<svg class="rmp-ci" viewBox="0 0 24 24" aria-hidden="true">'+d+'</svg>';
}
var IK={
  /* katman yığını — preset sayısı */
  preset:ikon('<path d="M12 3 3 7.5l9 4.5 9-4.5L12 3Z"/><path d="M3 12.5 12 17l9-4.5"/>'+
              '<path d="M3 17.5 12 22l9-4.5"/>'),
  /* sonsuzluk — ömür boyu */
  omur:ikon('<path d="M8.5 12c0 1.9-1.5 3.4-3.2 3.4S2 13.9 2 12s1.5-3.4 3.3-3.4c1.4 0 2.4.9 3.2 1.9'+
            'l2.9 3c.8 1 1.8 1.9 3.2 1.9C18.5 15.4 20 13.9 20 12s-1.5-3.4-3.4-3.4c-1.4 0-2.4.9-3.2 1.9'+
            'l-2.9 3c-.8 1-1.8 1.9-3.2 1.9"/>'),
  /* ekran — masaüstü uygulaması */
  uygulama:ikon('<rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8.5 21h7"/><path d="M12 17v4"/>'),
  /* indirme oku */
  indir:ikon('<path d="M12 3v13"/><path d="M7 12l5 5 5-5"/><path d="M5 20h14"/>'),
  /* şimşek */
  simsek:ikon('<path d="M13 2 5 13h6l-1 9 8-11h-6l1-9Z"/>')
};

var PRODUCTS=[];


var rail=document.getElementById('rmp-rail'), railwrap=document.getElementById('rmp-railwrap'),
    track=document.getElementById('rmp-track'),
    countEl=document.getElementById('rmp-count'),
    info=document.getElementById('rmp-info'), buy=document.getElementById('rmp-buy'),
    prevB=document.getElementById('rmp-prev'), nextB=document.getElementById('rmp-next'),
    closeB=document.getElementById('rmp-close'), live=document.getElementById('rmp-live');

var pi=0, mi=0, zoom=1, panX=0, panY=0, zf=null;
var drag=null, start=null, pts=new Map(), pinch=null, spyRAF=null;
var MAXZ=5.3, CLICKZ=1.5;   /* bir tik %50 yaklasir; ikinci tik fit'e doner */
var coarse=matchMedia('(pointer:coarse)').matches;

/* ═══ render ═══ */
function render(){
  var p=PRODUCTS[pi];
  killVideos();                       /* ürün değişince ses arkada kalmasın */
  buildTrack(p); buildRail(p); buildInfo(p); buildBuy(p);

  prevB.disabled=(pi===0); nextB.disabled=(pi===PRODUCTS.length-1);
  fillNav('prev', pi>0?PRODUCTS[pi-1]:null);
  fillNav('next', pi<PRODUCTS.length-1?PRODUCTS[pi+1]:null);
  setCount(); railShadow();
  live.textContent=p.name+', '+p.media.length+' görsel';
}
function goProduct(d){ goProductTo(pi+d); }
/* Doğrudan bir pakete git — oklar da, üst bardaki seçici de buradan geçer. */
var swapT1=null, swapT2=null;
function goProductTo(n){
  if(n<0||n>=PRODUCTS.length||n===pi) return;
  /* Gidilen yön: ileri giderken içerik sola çıkar ve sağdan gelir. */
  pdp.style.setProperty('--rmp-dir', n>pi ? 1 : -1);
  clearTimeout(swapT1); clearTimeout(swapT2);
  pdp.classList.remove('rmp-swapped');
  document.body.classList.add('rmp-swapping');
  swapT1=setTimeout(function(){
    pi=n; mi=0; resetZoom(); render(); track.scrollTop=0; sizeRail();
    document.body.classList.remove('rmp-swapping');
    /* Çıkış sınıfı kalkarken giriş animasyonu aynı karede başlamalı,
       yoksa arada tek kare tam opak bir sıçrama görünüyor. */
    pdp.classList.add('rmp-swapped');
    swapT2=setTimeout(function(){ pdp.classList.remove('rmp-swapped'); },340);
  },110);
}
/* Ok etiketi yalnızca adı taşır: mini ürün kutusu görseli kaldırıldı,
   hangi pakete gidileceğini adı zaten söylüyordu. */
function fillNav(which, p){
  document.getElementById('rmp-'+which+'Name').textContent = p ? p.name : '';
}

/* ── sayaç ──
   İçeriğin üstünde belirip solan ipucu balonları kaldırıldı: aynı bilgi
   zaten sütun altındaki sabit bilgi çubuğunda duruyor. */
function setCount(){ countEl.textContent=(mi+1)+' / '+PRODUCTS[pi].media.length; }
function sizeRail(){ railShadow(); }
function railShadow(){
  var over=rail.scrollHeight>rail.clientHeight+1;
  var atEnd = rail.scrollTop >= rail.scrollHeight-rail.clientHeight-2;
  rail.classList.toggle('rmp-at-end', !over || atEnd);
  /* sürüklenecek bir şey varsa imleç öyle desin */
  rail.classList.toggle('rmp-can-drag', over);
}

/* ── ŞERİDİ TUTUP SÜRÜKLEME ──────────────────────────────────────
   Tekerlek ve şerit çubuğu vardı; fareyle basılı tutup dikeyde çekmek
   yoktu. Yalnızca FARE için: dokunmatikte şerit zaten kendi kendine
   kayıyor, oraya karışmak onu bozardı. Üç kural:
   1) 3px'ten kısa hareket sürükleme sayılmaz — tek tıklama tıklamadır,
   2) sürükledikten sonraki tıklama yutulur, yoksa parmağını kaldırdığın
      karenin üstüne atlıyordu,
   3) sürüklerken otomatik ortalama susar (railEl). */
(function(){
  var sur=null, yut=false;
  rail.addEventListener('pointerdown',function(e){
    if(e.pointerType!=='mouse' || e.button!==0) return;
    if(rail.scrollHeight<=rail.clientHeight+1) return;
    sur={y:e.clientY, top:rail.scrollTop, id:e.pointerId, tasindi:false};
  });
  rail.addEventListener('pointermove',function(e){
    if(!sur || e.pointerId!==sur.id) return;
    var d=e.clientY-sur.y;
    if(!sur.tasindi){
      if(Math.abs(d)<=3) return;
      sur.tasindi=true;
      rail.classList.add('rmp-is-dragging');
      try{ rail.setPointerCapture(e.pointerId); }catch(_){}
    }
    rail.scrollTop=sur.top-d;
    railEl=Date.now();
    railShadow();
    e.preventDefault();
  });
  function birak(e){
    if(!sur || (e && e.pointerId!==sur.id)) return;
    var t=sur.tasindi; sur=null;
    rail.classList.remove('rmp-is-dragging');
    if(t) yut=true;
  }
  rail.addEventListener('pointerup',birak);
  rail.addEventListener('pointercancel',birak);
  rail.addEventListener('click',function(e){
    if(!yut) return;
    yut=false; e.stopPropagation(); e.preventDefault();
  },true);
})();
/* Mobilde sabit satın alma çubuğunun gerçek yüksekliğini yayınla:
   oklar ve sayfa dolgusu buna göre yerleşsin. */
function syncBuyH(){
  var h=buy.getBoundingClientRect().height;
  if(h) pdp.style.setProperty('--buyH', Math.round(h)+'px');
}
new ResizeObserver(syncBuyH).observe(buy);
addEventListener('resize',syncBuyH);

rail.addEventListener('scroll',railShadow,{passive:true});
addEventListener('resize',sizeRail);
new ResizeObserver(sizeRail).observe(railwrap);

/* ── medya: her öğe sahnenin tam yüksekliği ── */
function buildTrack(p){
  track.innerHTML='';
  p.media.forEach(function(it,i){
    var cell=document.createElement('div'); cell.className='rmp-cell'; cell.dataset.i=i;
    cell.appendChild(buildFrame(it,i));
    track.appendChild(cell);
  });
  track.scrollTop=0;
  track.removeEventListener('scroll',onScroll);
  track.addEventListener('scroll',onScroll,{passive:true});
}
function wireYT(f,it){
  var pst=f.querySelector('.rmp-vid__poster'); if(!pst) return;
  pst.addEventListener('click',function(){
    f.querySelector('.rmp-vid__poster').remove();
    var fr=document.createElement('iframe');
    fr.src='https://www.youtube-nocookie.com/embed/'+it.id+'?autoplay=1&rel=0';
    fr.title='Video'; fr.allow='autoplay;encrypted-media;picture-in-picture'; fr.allowFullscreen=true;
    f.appendChild(fr); f.dataset.playing='1';
  });
}
function buildFrame(it,i){
  var f=document.createElement('div');
  f.className='rmp-frame rmp-is-loading'+(it.type==='ba'?' rmp-ba':'')+
    ((it.type==='youtube'||it.type==='instagram')?' rmp-vid':'');
  if(it.type==='photo'||it.type==='ba') f.classList.add('rmp-can-zoom');
  f.dataset.i=i;
  var src=it.type==='photo'?it.src:it.type==='ba'?it.before:it.poster;
  var img=new Image();
  img.className='rmp-base'; img.alt=it.alt||''; img.decoding='async'; img.draggable=false;
  img.addEventListener('load',function(){f.classList.remove('rmp-is-loading');},{once:true});
  img.addEventListener('error',function(){
    f.classList.remove('rmp-is-loading');
    f.insertAdjacentHTML('beforeend','<span class="rmp-errbox">Görsel yüklenemedi</span>');},{once:true});
  img.src=src; f.appendChild(img);
  f.insertAdjacentHTML('beforeend','<span class="rmp-spin"></span>');

  if(it.type==='ba'){
    f.style.setProperty('--pos','50%');
    var af=document.createElement('span'); af.className='rmp-ba__after';
    var ai=new Image(); ai.alt=''; ai.decoding='async'; ai.draggable=false; ai.src=it.after;
    af.appendChild(ai); f.appendChild(af);
    f.insertAdjacentHTML('beforeend','<span class="rmp-ba__div"></span>'+
      '<button class="rmp-ba__knob" aria-label="Karşılaştırma çizgisi"></button>'+
      '<span class="rmp-ba__tag rmp-b">ÖNCE</span><span class="rmp-ba__tag rmp-a">SONRA</span>');
  }
  if(it.type==='youtube'){
    f.insertAdjacentHTML('beforeend','<button class="rmp-vid__poster" aria-label="Videoyu oynat"><span class="rmp-vid__play"></span></button>');
    wireYT(f,it);
  }
  if(it.type==='instagram'){
    /* Kare zaten baştan sona bağlantı; altına bir de gradyanlı düğme koymak
       aynı şeyi ikinci kez söylemek ve fotoğrafın önünü kapatmaktı. */
    f.insertAdjacentHTML('beforeend','<a class="rmp-vid__poster" href="'+it.url+'" target="_blank" rel="noopener" aria-label="Instagram\'da aç"><span class="rmp-vid__play"></span></a>');
  }
  return f;
}

/* ── şerit ── */
function buildRail(p){
  rail.innerHTML='';
  p.media.forEach(function(it,i){
    var s=it.thumb||(it.type==='photo'?it.src:it.type==='ba'?it.after:it.poster);
    var b=document.createElement('button'); b.dataset.i=i;
    b.setAttribute('aria-label',(i+1)+'. görsel, '+TYPE[it.type]);
    b.innerHTML='<img src="'+s+'" alt="">'+
      '<span class="rmp-bdg">'+(ETIKET[it.type]||'IMG')+'</span>';
    rail.appendChild(b);
  });
  markRail();
}
/* ══════════ MEDYAYA GİT — tek giriş noktası ══════════
   Şerit tıklaması, klavye ve oklar hep buradan geçer. İki kural:
   1) hedef ANINDA aktif olur (sayaç ve şerit animasyonu beklemez),
   2) casus (updateActive) susar — yoksa animasyonun ortasındaki ara
      kareyi aktif sanıp şeridi ileri geri oynatıyordu.

   SNAP YOK. Tarayıcının `scroll-snap-type:mandatory`'si her karede
   frene basıyordu: bir birim tekerlek bile bir kareyi zorla yerine
   çekiyor, kaydırma "ittirmeli" hissettiriyordu. İçerik sütunu artık
   bir sayfa gibi serbest kayar; parmağını çektiğinde en yakın kareye
   kendi eğrimizle yumuşakça oturur (yerlestir). */
var navBusy=false, navTok=0;
/* Elle yapılan her hareket programatik olanı devirir: kullanıcı hep kazanır. */
function navIptal(){
  navTok++; navBusy=false;
  if(track.__rmpRAF){ cancelAnimationFrame(track.__rmpRAF); track.__rmpRAF=0; }
}
function goToMedia(i,ani){
  var son=PRODUCTS[pi].media.length-1;
  i=Math.max(0,Math.min(son,i));
  var c=track.querySelector('.rmp-cell[data-i="'+i+'"]'); if(!c) return;
  /* offsetTop tam sayıya yuvarlanıyor; hücre yükseklikleri kesirli
     olduğu için 1px artık kalıyordu ve snap geri açılınca kare
     yerine oturmaya çalışıp "takılma" hissi veriyordu. Kesin ölçüm: */
  var hedef=track.scrollTop+(c.getBoundingClientRect().top-track.getBoundingClientRect().top);
  if(i!==mi){ mi=i; sonrasi(); }
  if(Math.abs(track.scrollTop-hedef)<1) return;
  var tok=++navTok; navBusy=true;
  /* 3 kareden uzak hedefte önce hedefin bir kare berisine ışınlanıp
     oradan akıcı kayarız: 20 kare boyu animasyon beklenmez ama geçiş
     yine sürekli hissedilir (iOS'un uzun listelerde yaptığı numara). */
  var h=track.clientHeight||1;
  if(ani!==false && Math.abs(hedef-track.scrollTop)/h > 3)
    track.scrollTop = hedef + (hedef>track.scrollTop ? -h : h);
  /* KENDİ ANİMASYONUMUZ. behavior:'smooth' tarayıcının seçtiği süreyi
     kullanıyor — burada yarım saniyeye yakın, bir kare ilerlemek için
     beklenmeyecek kadar uzun. Süreyi kendimiz veriyoruz: 190ms, sondan
     yumuşayan bir eğriyle. */
  kaydir(hedef, ani===false?0:190, function(){ bitir(tok); }, function(){ return tok===navTok; });
}
/* ── OTURMA ─────────────────────────────────────────────────────
   Serbest kaydırmanın bedeli yarım kalmış bir karedir. Elin durunca
   (140ms sessizlik) en yakın kareye 260ms'lik yumuşak bir eğriyle
   oturur. Zorlamaz: hareket ederken hiçbir şeye karışmaz, sadece
   sonunda toparlar. */
var settleT=null, hamleBas=null;
function yerlestir(){
  if(!isOpen || zoom>1 || navBusy) return;
  var h=track.clientHeight; if(!h) return;
  /* NİYETE GÖRE OTURMA. Sadece "en yakına" gitmek, kare bir sahne boyu
     olduğu için küçük hareketleri geri yaylandırıyordu: bir tık çeviriyor,
     içerik kıpırdıyor, sonra geldiği yere dönüyor — lastik gibi. Karar
     HAMLENİN TAMAMINA bakılarak verilir: bir karenin beşte birinden fazla
     yol aldıysan gittiğin yöndeki kareye geçersin, altındaysa bulunduğun
     kare yerine oturur. Böylece hareket serbest, iniş kararlı olur. */
  var bas = hamleBas===null ? track.scrollTop : hamleBas;
  var basI = Math.round(bas/h), d = track.scrollTop - bas;
  /* EŞİK. Bir fare çentiği bir karenin ancak sekizde biri kadar yol alır;
     beşte birlik eşik onu geri yaylandırıyor ve "birkaç kere çevirmek"
     gerekiyordu. Eşik %8'e indi: tek bir çentik bile karar sayılır, ama
     parmakla yapılan kazara bir dokunuş (genelde bundan da kısa) yerinde
     kalır. Uzun bir hamle kaç kare yol aldıysa o kadar gider. */
  var i = Math.abs(d) > h*0.08
        ? basI + (d>0?1:-1) * Math.max(1, Math.round(Math.abs(d)/h))
        : Math.round(track.scrollTop/h);
  hamleBas=null;
  i=Math.max(0,Math.min(PRODUCTS[pi].media.length-1,i));
  var c=track.querySelector('.rmp-cell[data-i="'+i+'"]'); if(!c) return;
  var hedef=track.scrollTop+(c.getBoundingClientRect().top-track.getBoundingClientRect().top);
  if(Math.abs(hedef-track.scrollTop)<0.5) return;
  var tok=++navTok; navBusy=true;
  if(i!==mi){ mi=i; sonrasi(); }
  kaydir(hedef, 260, function(){ bitir(tok); }, function(){ return tok===navTok; });
}
/* ── TEK KAYDIRMA MOTORU ────────────────────────────────────────
   behavior:'smooth' süreyi tarayıcıya bırakıyor — burada yarım saniyeye
   yakın ve her yerde farklı. Süre ve eğri bizde: sondan yumuşayan bir
   kübik. Hem içerik sütunu hem küçük resim şeridi aynı motoru kullanır,
   böylece panelin her yeri aynı hızda hareket eder. Her öğe kendi
   karesini taşır: ikisi birbirini iptal etmez. */
function akit(el, alan, hedef, sure, bitince, gecerliMi){
  if(el.__rmpRAF){ cancelAnimationFrame(el.__rmpRAF); el.__rmpRAF=0; }
  var bas=el[alan], fark=hedef-bas, t0=null;
  if(!sure || Math.abs(fark)<1){ el[alan]=hedef; if(bitince) bitince(); return; }
  el.__rmpRAF=requestAnimationFrame(function adim(t){
    if(gecerliMi && !gecerliMi()){ el.__rmpRAF=0; return; }   /* yeni hedef devraldı */
    if(t0===null) t0=t;
    var k=Math.min(1,(t-t0)/sure);
    el[alan] = bas + fark * (1-Math.pow(1-k,3));
    if(k<1) el.__rmpRAF=requestAnimationFrame(adim);
    else { el.__rmpRAF=0; if(bitince) bitince(); }
  });
}
function kaydir(hedef, sure, bitince, gecerliMi){
  akit(track,'scrollTop',hedef,sure,bitince,gecerliMi);
}
function bitir(tok){
  if(tok!==navTok) return;
  /* artığı ölçerek sıfırla: hedef ile gerçek konum arasında kalan
     kesir, snap geri açıldığında tarayıcıyı yeniden oynatıyordu */
  var c=track.querySelector('.rmp-cell[data-i="'+mi+'"]');
  if(c) track.scrollTop+=c.getBoundingClientRect().top-track.getBoundingClientRect().top;
  navBusy=false;
}
function sonrasi(){ setCount(); markRail(); unmountAway(); }

/* Kullanıcı şeridi elle gezerken otomatik ortalama devreye girmemeli. */
var railEl=0;
['wheel','pointerdown','touchstart'].forEach(function(ev){
  rail.addEventListener(ev,function(){
    railEl=Date.now();
    /* şerit kendi kendine kayıyorsa elin altında durur */
    if(rail.__rmpRAF){ cancelAnimationFrame(rail.__rmpRAF); rail.__rmpRAF=0; }
  },{passive:true});
});
function markRail(){
  Array.prototype.forEach.call(rail.children,function(b,i){b.setAttribute('aria-current',i===mi);});
  var a=rail.children[mi]; if(!a) return;
  if(Date.now()-railEl<1200) return;              /* elini çekmesini bekle */
  var yatay=rail.scrollWidth>rail.clientWidth+1,
      dikey=rail.scrollHeight>rail.clientHeight+1;
  if(!yatay&&!dikey) return;
  var rr=rail.getBoundingClientRect(), br=a.getBoundingClientRect();
  /* İLERİ BAKIŞ PAYI.
     Salt "en yakına kaydır" kareyi şeridin tam kenarına yaslıyordu: seçili
     karenin arkasında ne olduğu görünmüyor, liste bitmiş gibi duruyordu.
     Shopify/Amazon davranışı: seçili kare kenara değil, kenardan yaklaşık
     bir buçuk kare içeride durur — devamı hep göz ucuyla görülür.
     (Ortalamak da yapılmaz; kullanıcı listede yerini kaybeder.) */
  var oku=function(x){ return parseFloat(x)||0; };
  var stil=getComputedStyle(rail);
  if(dikey){
    var bir=br.height+oku(stil.rowGap), bak=bir*1.2;
    var ust=br.top-rr.top, alt=rr.bottom-br.bottom;
    if(ust>=bak && alt>=bak) return;          /* iki yanda da bağlam var */
    railTo(rail.scrollTop + (ust<bak ? ust-bak : bak-alt), false);
  }else{
    var birX=br.width+oku(stil.columnGap), bakX=birX*1.2;
    var sol=br.left-rr.left, sag=rr.right-br.right;
    if(sol>=bakX && sag>=bakX) return;
    railTo(rail.scrollLeft + (sol<bakX ? sol-bakX : bakX-sag), true);
  }
}
function railTo(v,yatay){
  var max=yatay?rail.scrollWidth-rail.clientWidth:rail.scrollHeight-rail.clientHeight;
  v=Math.max(0,Math.min(max,v));
  akit(rail, yatay?'scrollLeft':'scrollTop', v, 260);
}
rail.addEventListener('click',function(e){
  var b=e.target.closest('button'); if(!b) return;
  /* Tıklama açık bir SEÇİMDİR, gezinme değil: "kullanıcı şeridi elle
     geziyor" koruması burada susturulur. Yoksa yarım görünen bir kareye
     tıklandığında klavyenin yaptığı otomatik kaydırma yapılmıyordu.
     Ortalama davranışı kalktığı için bu artık kareyi fırlatmaz —
     yalnızca tam görünür olacak kadar kaydırır. */
  railEl=0;
  goToMedia(+b.dataset.i);
});

/* ── aktif görsel: snap sonrası hangi hücre görünüyorsa ── */
function updateActive(){
  spyRAF=null;
  if(navBusy) return;                  /* programatik kaydırma sürüyor */
  var h=track.clientHeight; if(!h) return;
  var i=Math.round(track.scrollTop/h);
  i=Math.max(0,Math.min(PRODUCTS[pi].media.length-1,i));
  if(i!==mi){ mi=i; sonrasi(); }
}
/* Görünürden çıkan videoyu söker: arkada ses çalmaz ve poster
   geri gelince tekerlekle kaydırma yine mümkün olur. */
function unmountAway(){
  track.querySelectorAll('.rmp-frame.rmp-vid[data-playing]').forEach(function(f){
    if(+f.dataset.i===mi) return;
    restorePoster(f);
  });
}
function killVideos(){ track.querySelectorAll('iframe').forEach(function(x){x.remove();}); }
function restorePoster(f){
  var it=PRODUCTS[pi].media[+f.dataset.i]; if(!it) return;
  var fr=f.querySelector('iframe'); if(fr) fr.remove();
  delete f.dataset.playing;
  f.insertAdjacentHTML('beforeend','<button class="rmp-vid__poster" aria-label="Videoyu oynat"><span class="rmp-vid__play"></span></button>');
  wireYT(f,it);
}
function onScroll(){
  if(!spyRAF) spyRAF=requestAnimationFrame(updateActive);
  clearTimeout(settleT);
  if(navBusy){ hamleBas=null; return; }  /* kendi animasyonumuz hedefte bitecek */
  settleT=setTimeout(yerlestir,140);
}
/* Hamlenin başladığı yer, kaydırma OLMADAN önce işaretlenir: tekerlek ve
   dokunuş olayları kaydırmadan önce gelir, `scroll` ise sonra. */
function hamleBasla(){ if(hamleBas===null && !navBusy) hamleBas=track.scrollTop; }
track.addEventListener('touchstart',hamleBasla,{passive:true});

/* ── sağ panel ── */
function buildInfo(p){
  info.innerHTML=
   /* Ürün kutusu görseli kaldırıldı: aynı paketin görselleri zaten
      solda tam boy duruyordu. Kazanılan genişlik başlığa gidiyor. */
   /* SABİT bölüm: başlık ve künye her zaman görünür kalır. */
   '<div class="rmp-info__top">'+
     '<div class="rmp-head">'+
       /* 1) ÜST SATIR: solda ne olduğu, sağda rozetleri. İkisi bir satırı
             paylaşır ve satırın iki ucuna yaslanır — başlık böylece kendi
             satırına, tam boyuna kavuşur. */
       '<div class="rmp-kindrow">'+
         '<p class="rmp-kind">'+(paketTuru(p)||'')+'</p>'+
         (p.badges.length?'<div class="rmp-badges">'+p.badges.map(function(b){
            var ik=ROZET_IK[b[0]];
            return '<span class="rmp-badge '+b[1]+'">'+
                   (ik?'<i class="rmp-bi" aria-hidden="true">'+ik+'</i>':'')+b[0]+'</span>';
          }).join('')+'</div>':'')+
       '</div>'+
       /* 2) AD, tek başına ve tam boyunda. Başlığın kendisi menü tetikleyicisi
             — adına tıklanıp başka bir preset/LUT'a tek hamlede geçilir. Ad
             yalnızca ad: "Presets"/"LUTs" üstteki satırda zaten söylendi. */
       '<h1 class="rmp-pick" id="rmp-pick">'+
         '<button class="rmp-pick__btn" id="rmp-pickBtn" type="button" aria-haspopup="listbox"'+
         ' aria-expanded="false" aria-controls="pickMenu">'+
           '<span id="rmp-pickName">'+paketAdi(p)+'</span>'+
           '<svg class="rmp-pick__ch" viewBox="0 0 24 24" aria-hidden="true">'+
           '<path d="m6 9 6 6 6-6"/></svg>'+
         '</button>'+
         '<div class="rmp-pick__menu" id="rmp-pickMenu" role="listbox" aria-label="Paket seç" hidden></div>'+
       '</h1>'+
       /* 3) kim yaptı */
       '<div class="rmp-by"><span class="rmp-av">'+p.av+'</span> '+p.by+'</div>'+
     '</div>'+
   /* Akordiyon yok: açıklama açıkta, altında dört künye çipi.
      Ömür boyu lisans buraya taşındı — üstteki rozet satırında da
      dursaydı aynı panelde iki kez söylenmiş olurdu. */
   /* Künye her pakette aynı dört alanı taşır — değişken bir liste değil,
      sabit bir tablo. O yüzden çip yığını değil, dörde bölünmüş bir kutu.
      Açıklamadan ÖNCE gelir: önce ne aldığın, sonra nasıl bir ton. */
   '<ul class="rmp-facts">'+
     '<li>'+IK.preset   +'<span><b>'+p.presets+'</b> preset</span></li>'+
     '<li>'+IK.omur     +'<span>Ömür boyu lisans</span></li>'+
     '<li>'+IK.uygulama +'<span>Lightroom Classic</span></li>'+
     '<li>'+IK.uygulama +'<span>Camera Raw</span></li>'+
     '<li>'+IK.indir    +'<span>Instant Download</span></li>'+
     '<li>'+IK.simsek   +'<span>1 click install</span></li>'+
   '</ul>'+
   '</div>'+
   /* KAYAN bölüm: metin uzasa bile yalnızca burası kayar. */
   '<div class="rmp-about" id="rmp-about">'+p.about+'</div>';
  info.scrollTop=0;
  /* Bir kare BEKLE: innerHTML'in hemen ardından esnek yükseklikler daha
     hesaplanmamış oluyor, clientHeight içerik boyuna eşit görünüyor ve
     "taşmıyor" sanılıyordu. */
  requestAnimationFrame(aboutGolge);
}
/* Açıklama taşmıyorsa ya da sonuna gelindiyse alt solma kalkar. */
function aboutGolge(){
  var a=info.querySelector('#rmp-about'); if(!a) return;
  var tasar=a.scrollHeight>a.clientHeight+1;
  a.classList.toggle('rmp-no-scroll', !tasar);
  a.classList.toggle('rmp-at-end', tasar && a.scrollTop>=a.scrollHeight-a.clientHeight-2);
}
info.addEventListener('scroll',aboutGolge,{passive:true,capture:true});
addEventListener('resize',aboutGolge);
/* panel yeniden boyutlanınca ve yazı tipi geç yüklenince kendini düzeltir */
new ResizeObserver(aboutGolge).observe(info);
if(document.fonts&&document.fonts.ready) document.fonts.ready.then(aboutGolge);
function buildBuy(p){
  buy.innerHTML=
   /* Kaynak karttaki düzen: solda puan, sağda fiyat, altında tam
      genişlikte aksiyon. Puan buraya taşındı — başlıkta da dursaydı
      aynı panelde iki kez söylenirdi. */
   '<div class="rmp-buyrow">'+
     '<span class="rmp-rate"><span class="rmp-st">★</span> '+p.rating.toFixed(1)+
       ' <em>('+p.reviews.toLocaleString('tr-TR')+')</em></span>'+
     '<span class="rmp-price"><b>$'+p.price+'</b><s>$'+p.old+'</s></span>'+
   '</div>'+
   '<button class="rmp-btn" id="rmp-add"></button>';
  var btn=buy.querySelector('#rmp-add');
  /* Durum ÜRÜNE bağlı: paket değişince buton o paketin durumunu gösterir,
     eskiden hep sıfırlanıyordu. Aynı butona tekrar basmak sepetten çıkarır. */
  ciz(btn, !!SEPET[p.name]);
  btn.addEventListener('click',function(){
    var vardi=!!SEPET[p.name];
    if(vardi) delete SEPET[p.name]; else SEPET[p.name]=true;
    ciz(btn, !vardi);
    live.textContent = p.name + (vardi ? ' sepetten çıkarıldı' : ' sepete eklendi');
  });
  syncBuyH();
}
/* ── üst bardaki paket seçici ──
   Referanstaki mantık: görüntülenen paketin adı tıklanır, açılan listeden
   başka bir preset/LUT'a tek hamlede geçilir. */
/* Başlık her paket değişiminde yeniden çizildiği için düğüm referansları
   ÖNBELLEĞE ALINMAZ — her seferinde canlı sorgulanır. */
function pickEl(){ return document.getElementById('rmp-pick'); }
function pickBtnEl(){ return document.getElementById('rmp-pickBtn'); }
function pickMenuEl(){ return document.getElementById('rmp-pickMenu'); }

function pickKur(){
  var pickMenu=pickMenuEl(); if(!pickMenu) return;
  pickMenu.innerHTML=PRODUCTS.map(function(p,i){
    return '<button type="button" role="option" data-i="'+i+'"'+
           ' aria-selected="'+(i===pi)+'">'+
           '<svg class="rmp-pick__tik" viewBox="0 0 24 24" aria-hidden="true">'+
           '<path d="m5 12.5 4.5 4.5L19 7.5"/></svg>'+p.name+'</button>';
  }).join('');
}
function pickAc(ac){
  var pick=pickEl(), pickBtn=pickBtnEl(), pickMenu=pickMenuEl();
  if(!pick) return;
  pick.classList.toggle('rmp-open',ac);
  pickBtn.setAttribute('aria-expanded',ac?'true':'false');
  pickMenu.hidden=!ac;
  if(ac){ pickKur(); var s=pickMenu.querySelector('[aria-selected="true"]'); if(s) s.focus(); }
}
function pickAcikMi(){ var p=pickEl(); return !!p && p.classList.contains('rmp-open'); }

/* Dinleyiciler DELEGASYONLA: düğümler yeniden kurulsa da çalışır. */
info.addEventListener('click',function(e){
  if(e.target.closest('#rmp-pickBtn')){ e.stopPropagation(); pickAc(!pickAcikMi()); return; }
  var b=e.target.closest('#rmp-pickMenu button[data-i]'); if(!b) return;
  var i=+b.dataset.i; pickAc(false); pickBtnEl().focus();
  if(i!==pi) goProductTo(i);
});
/* menü içinde yukarı/aşağı gezinme — liste kutusu davranışı */
info.addEventListener('keydown',function(e){
  var pickMenu=pickMenuEl();
  if(!pickMenu||pickMenu.hidden||!pickMenu.contains(e.target)) return;
  var ogeler=[].slice.call(pickMenu.querySelectorAll('button'));
  var k=ogeler.indexOf(document.activeElement);
  if(e.key==='ArrowDown'){ e.preventDefault(); e.stopPropagation();
    ogeler[Math.min(ogeler.length-1,k+1)].focus(); }
  else if(e.key==='ArrowUp'){ e.preventDefault(); e.stopPropagation();
    ogeler[Math.max(0,k-1)].focus(); }
  else if(e.key==='Home'){ e.preventDefault(); ogeler[0].focus(); }
  else if(e.key==='End'){ e.preventDefault(); ogeler[ogeler.length-1].focus(); }
});
/* MENÜ AÇIKKEN DIŞARIYA TIKLAMAK YALNIZCA MENÜYÜ KAPATIR.
   Kapanıyordu, ama tıklama altındaki şeye de gidiyordu: fotoğrafa basınca
   menü kapanıp aynı anda yakınlaşıyor, karartmaya basınca lightbox'ın
   tamamı kapanıyordu. Menü açıkken ilk tıklama bir KAPATMA hamlesidir ve
   başka hiçbir şeye dokunmaz — ikinci tıklama normal işini görür.
   Yakalama (capture) evresinde dinlenir: hedefin kendi dinleyicileri daha
   çalışmadan durdurulur. Fotoğrafın yakınlaşması pointerup'a bağlı olduğu
   için işaretçi olayları da aynı şekilde yutulur. */
function disariMi(t){ var p=pickEl(); return pickAcikMi() && p && !p.contains(t); }
var pickYut=false;                     /* bu hamlenin tamamı yutulacak mı */
document.addEventListener('pointerdown',function(e){
  pickYut = disariMi(e.target);
  if(!pickYut) return;
  pickAc(false);
  e.stopPropagation();
},true);
document.addEventListener('pointerup',function(e){ if(pickYut) e.stopPropagation(); },true);
document.addEventListener('pointercancel',function(){ pickYut=false; },true);
document.addEventListener('click',function(e){
  if(!pickYut) return;
  pickYut=false; e.stopPropagation(); e.preventDefault();
},true);

/* Sepetteki paketler — ürün adına göre; oturum boyunca korunur. */
var SEPET={};
/* Butonun üç yüzü: ekle · eklendi (imleç üstünde "Çıkar") */
function ciz(btn, icinde){
  btn.classList.toggle('rmp-done', icinde);
  btn.setAttribute('aria-pressed', icinde?'true':'false');
  btn.innerHTML = icinde
    ? '<svg class="rmp-tik rmp-tik--in" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>'+
      '<svg class="rmp-tik rmp-tik--out" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>'+
      '<span class="lb rmp-lb--in">Sepete eklendi</span>'+
      '<span class="lb rmp-lb--out">Sepetten çıkar</span>'
    : '<span class="rmp-bag"></span> Sepete ekle';
}

/* ═══ zoom ═══ */
function applyZoom(){
  if(!zf) return;
  zf.style.transform= zoom>1?'translate3d('+panX+'px,'+panY+'px,0) scale('+zoom+')':'';
  zf.style.setProperty('--iz',String(1/zoom));
  zf.classList.toggle('rmp-is-zoomed',zoom>1);
  zf.style.transition= drag==='pan'?'none':'transform .26s cubic-bezier(.22,.61,.36,1)';
  track.classList.toggle('rmp-locked',zoom>1);
}
function clampPan(){
  if(!zf||zoom<=1){panX=panY=0;return;}
  var vw=track.clientWidth, vh=track.clientHeight;
  var ox=Math.max(0,(zf.offsetWidth*zoom-vw)/2), oy=Math.max(0,(zf.offsetHeight*zoom-vh)/2);
  panX=Math.max(-ox,Math.min(ox,panX)); panY=Math.max(-oy,Math.min(oy,panY));
}
function setZoom(z,cx,cy,f){
  if(f) zf=f; if(!zf) return;
  var o=zoom; z=Math.max(1,Math.min(MAXZ,z)); if(z===o) return;
  if(z===1) panX=panY=0;
  else if(cx!=null){
    var r=zf.getBoundingClientRect(), dx=cx-(r.left+r.width/2), dy=cy-(r.top+r.height/2), k=z/o;
    panX=(panX-dx)*k+dx; panY=(panY-dy)*k+dy;
  }
  zoom=z; clampPan(); applyZoom(); if(z===1) zf=null;
}
function resetZoom(){
  zoom=1;panX=panY=0;
  track.querySelectorAll('.rmp-frame').forEach(function(f){
    f.style.transform=''; f.style.removeProperty('--iz'); f.classList.remove('rmp-is-zoomed','is-panning');});
  track.classList.remove('rmp-locked'); zf=null;
}

/* ═══ before/after ═══ */
function setBA(f,p){ f.style.setProperty('--pos',Math.max(0,Math.min(100,p))+'%'); }
function baPct(f,x){ var r=f.getBoundingClientRect(); return (x-r.left)/r.width*100; }

track.addEventListener('pointermove',function(e){
  if(coarse||e.buttons!==0) return;
  /* Follows the pointer whether or not the frame is zoomed. The percentage
     is taken from the frame's rectangle AFTER the transform, and the divider
     is inside the same transform — so the two scale together and the sum
     comes out right at any zoom. Stopping it while zoomed only froze the
     comparison. What must not move it is a drag, and the line above already
     returns while a button is down. */
  var f=e.target.closest('.rmp-frame.rmp-ba'); if(!f) return;
  setBA(f,baPct(f,e.clientX));
});
track.addEventListener('pointerdown',function(e){
  if(e.target.closest('.rmp-vid__poster')) return;
  pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pts.size===2){ var a=[]; pts.forEach(function(v){a.push(v);});
    pinch={d:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),z:zoom}; drag='pinch'; return; }
  var f=e.target.closest('.rmp-frame');
  start={x:e.clientX,y:e.clientY,moved:false,f:f};
  if(!f){ drag=null; return; }
  try{ track.setPointerCapture(e.pointerId); }catch(err){}
  if(e.target.closest('.rmp-ba__knob')){ drag='ba'; return; }
  if(zoom>1&&f===zf){ drag='pan'; f.classList.add('rmp-is-panning'); return; }
  drag='tap';
},{passive:true});
track.addEventListener('pointermove',function(e){
  if(!pts.has(e.pointerId)) return;
  pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(drag==='pinch'&&pinch&&pts.size===2){
    var a=[]; pts.forEach(function(v){a.push(v);});
    setZoom(pinch.z*(Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)/pinch.d),
      (a[0].x+a[1].x)/2,(a[0].y+a[1].y)/2,start&&start.f); return;
  }
  if(!start) return;
  var dx=e.clientX-start.x, dy=e.clientY-start.y;
  if(Math.abs(dx)>10||Math.abs(dy)>10) start.moved=true;
  if(drag==='ba'&&start.f){ setBA(start.f,baPct(start.f,e.clientX)); return; }
  if(drag==='pan'){ panX+=e.clientX-(start.lx||start.x); panY+=e.clientY-(start.ly||start.y);
    start.lx=e.clientX; start.ly=e.clientY; clampPan(); applyZoom(); }
},{passive:true});
function endPtr(e){
  pts.delete(e.pointerId);
  if(drag==='pinch'){ if(pts.size<2){drag=null;pinch=null; if(zoom<=1.03) setZoom(1);} return; }
  if(drag==='pan'&&start&&start.f){ start.f.classList.remove('rmp-is-panning'); if(!start.moved) setZoom(1); }
  if(drag==='tap'&&start&&!start.moved&&start.f){
    var it=PRODUCTS[pi].media[+start.f.dataset.i];
    if(it&&(it.type==='photo'||it.type==='ba')){
      if(zoom>1) setZoom(1); else setZoom(CLICKZ,e.clientX,e.clientY,start.f);
    }
  }
  drag=null; start=null;
}
track.addEventListener('pointerup',endPtr,{passive:true});
track.addEventListener('pointercancel',function(e){pts.delete(e.pointerId);
  if(start&&start.f) start.f.classList.remove('rmp-is-panning'); drag=null;start=null;},{passive:true});
track.addEventListener('wheel',function(e){
  if(zoom<=1){
    if(tekerlekTik(e, tekerlekNorm(e))) return;      /* fare: bir tık bir kare */
    navIptal(); hamleBasla(); return;                /* parmak: tarayıcı kaydırır */
  }
  e.preventDefault();
  if(e.ctrlKey){ setZoom(zoom*(e.deltaY<0?1.12:.89),e.clientX,e.clientY); return; }
  panX-=e.deltaX; panY-=e.deltaY; clampPan(); applyZoom();
},{passive:false});

/* ═══ klavye ═══ */
document.addEventListener('keydown',function(e){
  var k=document.activeElement&&document.activeElement.classList.contains('rmp-ba__knob');
  if(!isOpen) return;
  /* Escape sırası: açık menü > yakınlaştırma > lightbox. Menü açıkken
     doğrudan lightbox'ın kapanması kullanıcıyı şaşırtıyordu. */
  if(e.key==='Escape'){ e.preventDefault();
    if(pickAcikMi()){ pickAc(false); pickBtnEl().focus(); }
    else if(zoom>1) setZoom(1); else closePDP(); return; }
  /* menü açıkken ok tuşları listede gezinir, medyayı/paketi değiştirmez */
  if(pickAcikMi()) return;
  if(k&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){
    var f=document.activeElement.closest('.rmp-frame');
    var c=parseFloat(f.style.getPropertyValue('--pos'))||50;
    setBA(f,c+(e.key==='ArrowRight'?4:-4)); e.preventDefault(); return;
  }
  /* Bilgi panelinde gezinirken ok tuslari urunu DEGISTIRMEZ */
  var inInfo = document.activeElement && document.activeElement.closest &&
               document.activeElement.closest('.rmp-info');
  if(!inInfo && e.key==='ArrowRight'){e.preventDefault();goProduct(1);}
  if(!inInfo && e.key==='ArrowLeft'){e.preventDefault();goProduct(-1);}
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){
    if(zoom>1) return;
    e.preventDefault();
    goToMedia(mi+(e.key==='ArrowDown'?1:-1));
  }
});
prevB.onclick=function(){goProduct(-1);}; nextB.onclick=function(){goProduct(1);};

/* ═══ lightbox aç / kapat ═══ */
var pdp=document.getElementById('rmp-pdp'), lastTrigger=null, scrollY=0, isOpen=false;
pdp.addEventListener('wheel',tekerlek,{passive:false});
/* ═══ tekerlek: şeridin dışında da içerik değiştirir ═══
   Fare imleci nerede olursa olsun (küçük resim sütunu hariç) tekerlek
   içerikte ileri/geri gider. Üç istisna var, üçü de kullanıcıyı korur:
   1) küçük resim sütunu kendi listesini kaydırır,
   2) içerik alanı zaten kendi snap kaydırmasıyla gider,
   3) hâlâ kaydıracak yeri kalan bir panel (uzun açıklama) önce kendini
      kaydırır; sonuna geldiğinde tekerlek yine içeriği değiştirir.
   Yakınlaşmışken hiçbir şey değişmez: o zaman tekerlek gezinmektir. */
function kaydirabilir(el,dy){
  while(el && el!==pdp && el.nodeType===1){
    var oy=getComputedStyle(el).overflowY;
    if((oy==='auto'||oy==='scroll') && el.scrollHeight>el.clientHeight+1){
      if(dy<0 ? el.scrollTop>1 : el.scrollTop < el.scrollHeight-el.clientHeight-1) return true;
    }
    el=el.parentNode;
  }
  return false;
}
/* ── FARE ÇENTİĞİ Mİ, PARMAK MI? ────────────────────────────────
   İkisi aynı olayla gelir ama aynı şeyi istemez. Touchpad yüzlerce
   küçük değeri saniyeler içinde yollar: orada istenen serbest kayma.
   Farenin tekerleği ise seyrek, büyük ve hep aynı boyda tıklar atar:
   orada istenen BİR TIK, BİR KARE — birkaç kere çevirmek zorunda
   kalmak eziyet. Ayırt etmenin iki işareti var:
     · deltaMode satır ise (0 değilse) o kesin faredir,
     · yoğun bir akışın içindeysek (arka arkaya <50ms) parmaktır,
       değilse ve adım büyükse (≥60) faredir. */
var wSon=0, wTik=0, wGirdi=null;
function tekerlekFare(e){
  if(e.deltaMode!==0){ wGirdi='fare'; return true; }
  var d=Math.abs(e.deltaY), now=Date.now(), ara=now-wSon; wSon=now;
  /* KARAR YAPIŞKANDIR. Her olayı tek başına yargılamak, tekerleği hızlı
     çevirenin çentiklerini "akış" sanıp serbest kaydırmaya düşürüyordu —
     ve bir kareyi geçmek için tekerleği defalarca çevirmek gerekiyordu.
     Cihaz oturumda bir kere tanınır, sonra kararı korunur:
       · 40'tan küçük bir adım yalnızca parmakta olur,
       · seyrek (>30ms) ve 40'tan büyük bir adım yalnızca farede.
     Aradaki her şey son karara bırakılır. */
  if(d<40) wGirdi='parmak';
  else if(ara>30) wGirdi='fare';
  return wGirdi==='fare';
}
function tekerlekNorm(e){
  var dy=e.deltaY;
  if(e.deltaMode===1) dy*=16; else if(e.deltaMode===2) dy*=(track.clientHeight||600);
  return dy;
}
/* Fare çentiği: tek tık, tek kare. true dönerse olay tüketilmiştir. */
function tekerlekTik(e, dy){
  if(!tekerlekFare(e)) return false;
  e.preventDefault();
  var now=Date.now();
  /* Bazı sistemler tek çentik için iki olay yollar; yalnızca o ikizi
     yutacak kadar dar bir aralık. Daha genişi, tekerleği hızlı çevireni
     cezalandırıyordu. */
  if(now-wTik<25) return true;
  wTik=now; navIptal();
  goToMedia(mi + (dy>0?1:-1));
  return true;
}
function tekerlek(e){
  if(!isOpen || zoom>1) return;
  var t=e.target, kok=t&&t.closest?t:null;
  if(kok && (kok.closest('.rmp-railcol') || kok.closest('.rmp-track'))) return;
  var dy=tekerlekNorm(e);
  if(!dy) return;
  if(kok && kaydirabilir(kok,dy)) return;
  e.preventDefault();
  if(tekerlekTik(e,dy)) return;
  /* BİRE BİR. Bir sayfayı nasıl kaydırıyorsan içeriği de öyle: parmağın
     verdiği kadar, ne eksik ne fazla. Durduğunda `yerlestir` toparlar. */
  navIptal(); hamleBasla();
  track.scrollTop += dy;
}
function bgNodes(){
  return Array.prototype.filter.call(document.body.children,function(n){
    return n!==pdp && n.tagName!=='SCRIPT' && n.tagName!=='STYLE';});
}
function openPDP(i, from){
  pi=i; mi=0; lastTrigger=from||null; resetZoom(); render();
  track.scrollTop=0;
  pdp.classList.add('rmp-open');
  scrollY=window.scrollY;
  document.body.style.position='fixed'; document.body.style.top=(-scrollY)+'px';
  document.body.style.left='0'; document.body.style.right='0';
  document.body.classList.add('rmp-locked');
  bgNodes().forEach(function(n){ n.setAttribute('aria-hidden','true'); n.inert=true; });
  requestAnimationFrame(function(){ pdp.classList.add('rmp-vis'); sizeRail(); });
  isOpen=true; closeB.focus();
  try{ history.pushState({pdp:1},''); pushed=true; }catch(e){}
}
var pushed=false;
function closePDP(fromPop){
  if(!isOpen) return; isOpen=false;
  killVideos();
  pdp.classList.remove('rmp-vis');
  setTimeout(function(){
    pdp.classList.remove('rmp-open');
    document.body.classList.remove('rmp-locked');
    ['position','top','left','right'].forEach(function(k){document.body.style[k]='';});
    window.scrollTo(0,scrollY);
    bgNodes().forEach(function(n){ n.removeAttribute('aria-hidden'); n.inert=false; });
    if(lastTrigger) lastTrigger.focus();
  },200);
  if(pushed&&!fromPop){ pushed=false; try{history.back();}catch(e){} } else pushed=false;
}
addEventListener('popstate',function(){ if(isOpen) closePDP(true); });

/* kapatma noktaları: çarpı · boşluk · Esc · tarayıcı geri */
closeB.onclick=function(){ closePDP(); };
pdp.addEventListener('click',function(e){
  if(e.target.hasAttribute('data-close')) closePDP();
});

/* ══════════ dışa açık API ══════════ */
function acVeri(urunler, i, tetikleyen){
  if(!urunler || !urunler.length) throw new Error('RMPdp.open: ürün listesi boş');
  PRODUCTS = urunler;
  openPDP(Math.max(0, Math.min(urunler.length-1, i|0)), tetikleyen || null);
}
var API = {
  open:  function(urunler, i, tetikleyen){ acVeri(urunler, i, tetikleyen); },
  close: function(){ closePDP(); },
  isOpen:function(){ return isOpen; },
  /* Bir liste görünümündeki tıklamaları bağlar. indeksAl(el) -> sayı */
  attach:function(secici, indeksAl, urunler){
    document.addEventListener('click', function(e){
      var el = e.target.closest ? e.target.closest(secici) : null;
      if(!el) return;
      e.preventDefault();
      var liste = urunler || API.data;
      if(!liste) throw new Error('RMPdp.attach: ürün listesi verilmedi (RMPdp.data ya da 3. argüman)');
      acVeri(liste, indeksAl ? indeksAl(el) : 0, el);
    });
  },
  data: null           /* attach için varsayılan liste */
};
/* Kuyruğa alınmış çağrılar: host betiği bu dosyadan ÖNCE çalışmış olabilir. */
var kuyruk = (window.RMPdp && window.RMPdp._q) || [];
window.RMPdp = API;
kuyruk.forEach(function(c){ try{ API[c[0]].apply(API, c[1]); }catch(e){ console.error(e); } });
})();
