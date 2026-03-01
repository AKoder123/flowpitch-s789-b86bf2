(() => {
  const qs = sel => document.querySelector(sel);
  const qsa = sel => Array.from(document.querySelectorAll(sel));
  const deckEl = qs('#deck');
  const sideDotsEl = qs('#sideDots');
  const progressEl = qs('#topProgressBar');
  const prevBtn = qs('#prevBtn');
  const nextBtn = qs('#nextBtn');
  const exportBtn = qs('#exportPdfBtn');
  const brandTitle = qs('#brandTitle');
  const navEl = qs('#topNav');

  let slides = [];
  let currentIndex = 0;
  let io; // IntersectionObserver
  let wheelLock = false;

  // Ensure elements exist before using
  function safeSetVar(name, value){ document.documentElement.style.setProperty(name, value); }

  function computeTopOffset(){
    if(!navEl) return;
    const rect = navEl.getBoundingClientRect();
    const offset = Math.ceil(rect.height + 8); // small gap under nav
    safeSetVar('--topOffset', offset + 'px');
  }

  function applyCompactMode(){
    const h = window.innerHeight;
    const compact = h < 660 || (window.matchMedia && window.matchMedia('(max-height: 720px) and (orientation: landscape)').matches);
    document.body.classList.toggle('compact', !!compact);
  }

  function buildSlides(data){
    if(!deckEl) return;
    deckEl.innerHTML = '';
    slides = [];

    data.slides.forEach((s, idx) => {
      const slide = document.createElement('section');
      slide.className = `slide type-${s.type || 'content'}`;
      slide.id = `slide-${idx}`;
      slide.dataset.index = String(idx);
      slide.style.setProperty('--textScale', '1');

      const inner = document.createElement('div');
      inner.className = 'slideInner';
      inner.setAttribute('data-animate', '');

      // Content builder helpers
      const h = (lvl, txt, useGrad=false) => {
        const el = document.createElement('h'+lvl);
        if(useGrad) el.classList.add('grad');
        el.textContent = txt || '';
        el.setAttribute('data-animate','');
        return el;
      };
      const p = (txt) => { const el = document.createElement('p'); el.textContent = txt || ''; el.setAttribute('data-animate',''); return el; };
      const ul = (items=[]) => {
        const list = document.createElement('ul');
        const area = document.createElement('div');
        area.className = 'scrollArea';
        items.forEach((it, i) => {
          const li = document.createElement('li');
          li.textContent = it;
          li.setAttribute('data-animate','');
          li.style.setProperty('--stagger', `${(i+2)*60}ms`);
          list.appendChild(li);
        });
        area.appendChild(list);
        return area;
      };

      const grid = document.createElement('div');
      grid.className = 'slideGrid';

      // Build by type
      if(s.type === 'title'){
        inner.appendChild(h(1, s.headline || '', true));
        if(s.subheadline) inner.appendChild(p(s.subheadline));
      } else if(s.type === 'section'){
        inner.appendChild(h(1, s.headline || '', true));
        if(s.subheadline) inner.appendChild(p(s.subheadline));
      } else if(s.type === 'beforeAfter'){
        // Two columns: left/right
        const leftCol = document.createElement('div');
        const rightCol = document.createElement('div');
        leftCol.className = 'col left'; rightCol.className = 'col right';
        if(s.headline) inner.appendChild(h(2, s.headline));
        if(s.left){
          const card = document.createElement('div'); card.className = 'card'; card.setAttribute('data-animate','');
          if(s.left.title) { const t = document.createElement('div'); t.className='cardTitle'; t.textContent = s.left.title; card.appendChild(t); }
          if(s.left.bullets) card.appendChild(ul(s.left.bullets));
          leftCol.appendChild(card);
        }
        if(s.right){
          const card = document.createElement('div'); card.className = 'card'; card.setAttribute('data-animate','');
          if(s.right.title) { const t = document.createElement('div'); t.className='cardTitle'; t.textContent = s.right.title; card.appendChild(t); }
          if(s.right.bullets) card.appendChild(ul(s.right.bullets));
          rightCol.appendChild(card);
        }
        grid.appendChild(leftCol); grid.appendChild(rightCol);
        inner.appendChild(grid);
        if(s.note) inner.appendChild(p(s.note)).classList.add('metaNote');
      } else if(s.type === 'closing'){
        inner.appendChild(h(2, s.headline || ''));
        if(s.bullets && s.bullets.length){ inner.appendChild(ul(s.bullets)); }
      } else { // content
        if(s.headline) inner.appendChild(h(2, s.headline));

        const leftWrap = document.createElement('div');
        const rightWrap = document.createElement('div');
        leftWrap.className = 'mainPanel'; rightWrap.className = 'sidePanel';

        if(s.bullets && s.bullets.length){
          // Put bullets in left panel
          leftWrap.appendChild(ul(s.bullets));
        }

        let hasSide = false;
        if(s.left){
          const card = document.createElement('div'); card.className = 'card'; card.setAttribute('data-animate','');
          if(s.left.title){ const t = document.createElement('div'); t.className='cardTitle'; t.textContent = s.left.title; card.appendChild(t); }
          if(s.left.bullets) card.appendChild(ul(s.left.bullets));
          rightWrap.appendChild(card); hasSide = true;
        }
        if(s.right){
          const card = document.createElement('div'); card.className = 'card'; card.setAttribute('data-animate','');
          if(s.right.title){ const t = document.createElement('div'); t.className='cardTitle'; t.textContent = s.right.title; card.appendChild(t); }
          if(s.right.bullets) card.appendChild(ul(s.right.bullets));
          rightWrap.appendChild(card); hasSide = true;
        }

        if(leftWrap.childNodes.length && hasSide){
          grid.appendChild(leftWrap);
          grid.appendChild(rightWrap);
          inner.appendChild(grid);
        } else if(leftWrap.childNodes.length){
          inner.appendChild(leftWrap);
        } else if(hasSide){
          inner.appendChild(rightWrap);
        }

        if(s.note){ const note = document.createElement('div'); note.className='metaNote'; note.textContent = s.note; note.setAttribute('data-animate',''); inner.appendChild(note); }
      }

      slide.appendChild(inner);
      deckEl.appendChild(slide);
      slides.push(slide);

      // Stagger order assignment
      const animEls = slide.querySelectorAll('[data-animate]');
      animEls.forEach((el, i) => el.style.setProperty('--stagger', `${i*60}ms`));
    });
  }

  function generateDots(){
    if(!sideDotsEl) return;
    sideDotsEl.innerHTML = '';
    slides.forEach((_, i) => {
      const b = document.createElement('button');
      b.className = 'dotBtn';
      b.type = 'button';
      b.setAttribute('aria-label', `Go to slide ${i+1}`);
      if(i === currentIndex) b.setAttribute('aria-current','true');
      b.addEventListener('click', () => setActiveSlide(i, true));
      sideDotsEl.appendChild(b);
    });
  }

  function updateProgress(){
    if(!progressEl) return;
    const total = slides.length || 1;
    const pct = (currentIndex / (total - 1)) * 100;
    progressEl.style.width = `${Math.max(0, Math.min(100, isFinite(pct)? pct : 0))}%`;
    // dots
    if(sideDotsEl){
      const buttons = sideDotsEl.querySelectorAll('.dotBtn');
      buttons.forEach((btn, i) => {
        if(i === currentIndex) btn.setAttribute('aria-current','true');
        else btn.removeAttribute('aria-current');
      });
    }
  }

  function setActiveSlide(index, smooth=true){
    index = Math.max(0, Math.min(slides.length-1, index));
    currentIndex = index;
    const el = slides[index];
    if(!el) return;
    el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
    updateProgress();
  }

  function observeSlides(){
    if(io) io.disconnect();
    if(!deckEl) return;
    io = new IntersectionObserver((entries) => {
      // pick the one with largest intersection ratio near center
      const visible = entries
        .filter(e => e.isIntersecting)
        .sort((a,b) => b.intersectionRatio - a.intersectionRatio);
      if(visible[0]){
        const idx = Number(visible[0].target.dataset.index || 0);
        slides.forEach(s => s.classList.remove('is-active'));
        visible[0].target.classList.add('is-active');
        currentIndex = idx;
        updateProgress();
        // Fit type when slide becomes active
        fitTypographyFor(visible[0].target);
      }
    }, { root: deckEl, threshold: [0.5, 0.75, 0.98] });

    slides.forEach(s => io.observe(s));
    // Mark first active immediately
    if(slides[0]) slides[0].classList.add('is-active');
  }

  function nextSlide(){ setActiveSlide(currentIndex + 1); }
  function prevSlide(){ setActiveSlide(currentIndex - 1); }

  function onKey(e){
    if(!slides.length) return;
    const tag = (e.target && e.target.tagName || '').toLowerCase();
    if(tag === 'input' || tag === 'textarea' || tag === 'select' || e.altKey || e.ctrlKey || e.metaKey) return;
    if(e.code === 'Space'){ e.preventDefault(); if(e.shiftKey) prevSlide(); else nextSlide(); }
    else if(e.key === 'ArrowRight' || e.key === 'PageDown'){ e.preventDefault(); nextSlide(); }
    else if(e.key === 'ArrowLeft' || e.key === 'PageUp'){ e.preventDefault(); prevSlide(); }
    else if(e.key === 'ArrowDown'){ e.preventDefault(); nextSlide(); }
    else if(e.key === 'ArrowUp'){ e.preventDefault(); prevSlide(); }
  }

  function canScrollWithin(el, delta){
    if(!el) return false;
    const scrollables = el.querySelectorAll('.scrollArea, [data-scrollable]');
    for(const sc of scrollables){
      const st = sc.scrollTop;
      const ch = sc.clientHeight;
      const sh = sc.scrollHeight;
      if(delta > 0 && st + ch < sh - 1) return true; // can scroll down
      if(delta < 0 && st > 0) return true; // can scroll up
    }
    return false;
  }

  function onWheel(e){
    if(!slides.length || !deckEl) return;
    // Let trackpad gentle moves accumulate; lock to avoid over-stepping
    if(wheelLock) return;
    const active = slides[currentIndex];
    // If inner scrollable can consume this event, allow default
    if(canScrollWithin(active, e.deltaY)) return;
    // else navigate
    e.preventDefault();
    wheelLock = true;
    if(e.deltaY > 0) nextSlide(); else prevSlide();
    setTimeout(() => wheelLock = false, 520);
  }

  function fitTypographyAll(){ slides.forEach(s => fitTypographyFor(s)); }

  function fitTypographyFor(slide){
    if(!slide) return;
    const inner = slide.querySelector('.slideInner');
    if(!inner) return;
    // Determine min/max scale per environment
    const isMobile = window.innerWidth < 640;
    const minScale = isMobile ? 0.90 : 0.86; // keep legible (>= ~14-16px)
    const maxScale = 1.08;
    let scale = 1.0;

    // Measure overflows against slide viewport area, not full deck
    const containerH = slide.clientHeight - 8; // small breathing room
    // We'll iterate to fit
    function contentHeight(){ return inner.scrollHeight; }

    // If overflowing, shrink
    let guard = 0;
    while(contentHeight() > containerH && scale > minScale && guard < 30){
      scale -= 0.02; guard++;
      inner.style.setProperty('--textScale', scale.toFixed(3));
    }
    // If plenty of space, grow slightly (but not beyond maxScale)
    guard = 0;
    while(contentHeight() < containerH * 0.82 && scale < maxScale && guard < 20){
      scale += 0.015; guard++;
      inner.style.setProperty('--textScale', scale.toFixed(3));
    }
  }

  function updateTitle(meta){
    const t = (meta && meta.title) ? meta.title : 'FlowPitch';
    if(brandTitle) brandTitle.textContent = t;
    try{ document.title = t + ' • FlowPitch'; }catch(_){ /* no-op */ }
  }

  function bindNav(){
    if(prevBtn) prevBtn.addEventListener('click', prevSlide);
    if(nextBtn) nextBtn.addEventListener('click', nextSlide);
    document.addEventListener('keydown', onKey, { passive:false });
    if(deckEl) deckEl.addEventListener('wheel', onWheel, { passive:false });
    window.addEventListener('resize', () => { computeTopOffset(); applyCompactMode(); fitTypographyAll(); });
    window.addEventListener('orientationchange', () => { setTimeout(() => { computeTopOffset(); applyCompactMode(); fitTypographyAll(); }, 120); });
  }

  async function loadContent(){
    const url = './content.json?ts=' + Date.now();
    const res = await fetch(url, { cache: 'no-store' });
    if(!res.ok) throw new Error('Failed to load content.json');
    return res.json();
  }

  async function init(){
    computeTopOffset();
    applyCompactMode();
    bindNav();

    try{
      const data = await loadContent();
      updateTitle(data.meta);
      buildSlides(data);
      generateDots();
      observeSlides();
      setActiveSlide(0, false);
      // Fit after fonts ready
      if(document.fonts && document.fonts.ready){ try{ await document.fonts.ready; }catch(_){} }
      fitTypographyAll();
      setupPdfExport();
    }catch(err){
      console.error(err);
      if(brandTitle) brandTitle.textContent = 'Failed to load deck';
    }
  }

  // PDF Export Implementation
  function loadScript(src){
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.async = true; s.onload = () => resolve(); s.onerror = () => reject(new Error('Failed to load '+src));
      document.head.appendChild(s);
    });
  }

  function cloneBackgroundLayers(into){
    const layers = qsa('.bgLayer');
    layers.forEach(l => into.appendChild(l.cloneNode(true)));
  }

  async function setupPdfExport(){
    if(!exportBtn) return;
    exportBtn.addEventListener('click', async () => {
      try{
        exportBtn.disabled = true; const prevLabel = exportBtn.textContent; exportBtn.textContent = 'Exporting…';
        document.body.classList.add('exportingPdf');

        // Ensure all slides marked active (for visibility) during export
        slides.forEach(s => s.classList.add('is-active'));

        // On-demand libs
        if(!(window.html2canvas)) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
        if(!(window.jspdf && window.jspdf.jsPDF)) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');

        // Wait fonts
        if(document.fonts && document.fonts.ready){ try{ await document.fonts.ready; }catch(_){} }

        const stage = qs('#pdfStage');
        if(!stage) throw new Error('PDF stage missing');

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'px', format: [1920, 1080] });
        const scale = Math.max(2, (window.devicePixelRatio || 1));

        for(let i=0; i<slides.length; i++){
          stage.innerHTML = '';
          cloneBackgroundLayers(stage);
          const clone = slides[i].cloneNode(true);
          clone.classList.add('is-active');
          stage.appendChild(clone);

          // html2canvas capture
          const canvas = await window.html2canvas(stage, {
            backgroundColor: '#050611',
            scale,
            logging: false,
            useCORS: true
          });
          const imgData = canvas.toDataURL('image/png');

          if(i>0) doc.addPage([1920,1080], 'landscape');
          doc.addImage({ imageData: imgData, x:0, y:0, width:1920, height:1080 });
        }

        doc.save('FlowPitch.pdf');

        // Cleanup
        document.body.classList.remove('exportingPdf');
        exportBtn.disabled = false; exportBtn.textContent = prevLabel;
        // restore only current slide as active using observer will update soon
        slides.forEach((s, idx) => s.classList.toggle('is-active', idx === currentIndex));
      }catch(err){
        console.error(err);
        alert('PDF export failed. Please allow cdnjs.cloudflare.com or self-host html2canvas and jsPDF.');
        document.body.classList.remove('exportingPdf');
        if(exportBtn){ exportBtn.disabled = false; exportBtn.textContent = 'Export PDF'; }
      }
    });
  }

  // Start
  window.addEventListener('load', init);
})();
