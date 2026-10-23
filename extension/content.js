(() => {
  if (globalThis.__lumaLoaded) return;
  globalThis.__lumaLoaded = true;
  let enabled = true, selection = null, ticket = 0, mode = 'hidden', timer;
  let panelSize = null, resizing = null, saveSizeTimer, sizeChanged = false, resizedThisOpen = false;
  const host = document.createElement('luma-translate');
  host.style.cssText = 'all:initial!important;position:fixed!important;left:0!important;top:0!important;z-index:2147483647!important;width:0!important;height:0!important;';
  const root = host.attachShadow({mode:'closed'});
  const css = document.createElement('link');
  css.rel = 'stylesheet'; css.href = chrome.runtime.getURL('content.css'); root.append(css);
  const bubble = document.createElement('button');
  bubble.className = 'bubble'; bubble.textContent = 'A↔'; bubble.title = 'Traduire avec Luma · Alt+T';
  bubble.setAttribute('aria-label','Traduire la sélection'); bubble.hidden = true;
  const panel = document.createElement('section');
  panel.className = 'panel'; panel.hidden = true; panel.setAttribute('role','dialog'); panel.setAttribute('aria-label','Traduction Luma');
  // Balisage statique seulement. Tout texte provenant du site ou du réseau utilise textContent.
  panel.innerHTML = '<header><strong>Luma <span>TRADUCTION</span></strong><button class="close" aria-label="Fermer">×</button></header><div class="languages"></div><div class="result" dir="auto" role="status" aria-live="polite"></div><footer><small>Texte envoyé à Google</small><button class="copy">Copier</button><button class="retry" hidden>Réessayer</button></footer><button class="resize-handle" aria-label="Redimensionner la fenêtre de traduction" title="Glisser pour redimensionner · Flèches au clavier · Double-clic pour réinitialiser"></button>';
  root.append(bubble,panel);
  document.documentElement.append(host);
  const output = panel.querySelector('.result'), copy = panel.querySelector('.copy'), retry = panel.querySelector('.retry');
  let translated = '', previousFocus;
  const resizeHandle = panel.querySelector('.resize-handle');
  const clamp = (value,min,max) => Math.max(min,Math.min(value,max));
  function fitSize(size) {
    const maxWidth = Math.max(1,innerWidth-16), maxHeight = Math.max(1,innerHeight-16);
    return {width:clamp(size.width,Math.min(260,maxWidth),maxWidth),
      height:clamp(size.height,Math.min(190,maxHeight),maxHeight)};
  }
  function applySize(size) {
    if (!size) {
      panel.classList.remove('sized'); panel.style.width = ''; panel.style.height = ''; return;
    }
    const fit = fitSize(size);
    panel.classList.add('sized'); panel.style.width = fit.width+'px'; panel.style.height = fit.height+'px';
  }
  function saveSize() {
    clearTimeout(saveSizeTimer);
    const value = panelSize && {...panelSize};
    // Une écriture à la fin du geste, pas à chaque mouvement de souris.
    chrome.storage.sync.set({panelSize:value}).catch(()=>{});
  }
  function resizeFrom(rect,width,height) {
    sizeChanged = resizedThisOpen = true;
    panelSize = fitSize({width,height}); applySize(panelSize);
    // L'agrandissement reste possible même près du bord droit ou du bas.
    panel.style.left = Math.max(8,Math.min(rect.left,innerWidth-panelSize.width-8))+'px';
    panel.style.top = Math.max(8,Math.min(rect.top,innerHeight-panelSize.height-8))+'px';
  }
  resizeHandle.addEventListener('pointerdown',e=>{
    if (!e.isPrimary || e.button !== 0) return;
    e.preventDefault(); clearTimeout(timer); clearTimeout(saveSizeTimer);
    resizing = {pointerId:e.pointerId,x:e.clientX,y:e.clientY,rect:panel.getBoundingClientRect()};
    panel.classList.add('resizing'); resizeHandle.focus({preventScroll:true});
    resizeHandle.setPointerCapture(e.pointerId);
  });
  resizeHandle.addEventListener('pointermove',e=>{
    if (!resizing || e.pointerId !== resizing.pointerId) return;
    e.preventDefault();
    resizeFrom(resizing.rect,resizing.rect.width+e.clientX-resizing.x,resizing.rect.height+e.clientY-resizing.y);
  });
  function finishResize(e) {
    if (!resizing || e.pointerId !== resizing.pointerId) return;
    resizing = null; panel.classList.remove('resizing'); saveSize();
    if (resizeHandle.hasPointerCapture(e.pointerId)) resizeHandle.releasePointerCapture(e.pointerId);
  }
  resizeHandle.addEventListener('pointerup',finishResize);
  resizeHandle.addEventListener('pointercancel',finishResize);
  resizeHandle.addEventListener('lostpointercapture',finishResize);
  resizeHandle.addEventListener('keydown',e=>{
    const delta = {ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
    if (!delta) return;
    e.preventDefault(); e.stopPropagation();
    const rect = panel.getBoundingClientRect(), step = e.shiftKey ? 80 : 24;
    resizeFrom(rect,rect.width+delta[0]*step,rect.height+delta[1]*step);
    clearTimeout(saveSizeTimer); saveSizeTimer = setTimeout(saveSize,300);
  });
  resizeHandle.addEventListener('dblclick',()=>{
    sizeChanged = true; resizedThisOpen = false;
    panelSize = null; applySize(null); saveSize(); if (selection) position(panel,selection.rect);
  });
  css.addEventListener('load',()=>{if(mode === 'panel' && selection){applySize(panelSize);if(!resizedThisOpen)position(panel,selection.rect);}});
  function hide(restore=false) {
    if (resizing) finishResize({pointerId:resizing.pointerId});
    ticket++; mode = 'hidden'; bubble.hidden = panel.hidden = true;
    if (restore && previousFocus?.isConnected) previousFocus.focus({preventScroll:true});
  }
  function position(element, rect) {
    const gap = 10, w = element.offsetWidth, h = element.offsetHeight;
    element.style.left = Math.max(8,Math.min(rect.right,innerWidth-w-8))+'px';
    const below = rect.bottom+gap;
    element.style.top = Math.max(8,Math.min(below+h <= innerHeight-8 ? below : rect.top-h-gap,innerHeight-h-8))+'px';
  }
  function capture() {
    const active = document.activeElement;
    // Ne jamais lire les champs de saisie, mots de passe ou éditeurs.
    if (active?.matches('input, textarea') || active?.isContentEditable) return null;
    const sel = window.getSelection();
    if (!sel?.rangeCount || sel.isCollapsed) return null;
    const text = sel.toString().trim(); if (!text) return null;
    const range = sel.getRangeAt(0);
    const node = range.commonAncestorContainer;
    const parent = node.nodeType === 1 ? node : node.parentElement;
    if (parent?.closest('input,textarea,[contenteditable]:not([contenteditable="false"])')) return null;
    const rect = range.getBoundingClientRect();
    return {text,rect:{left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom}};
  }
  function offer() {
    if (!enabled || mode === 'panel') return;
    selection = capture();
    if (!selection) {hide(); return;}
    bubble.hidden = false; panel.hidden = true; mode = 'bubble'; position(bubble,selection.rect);
  }
  function label(code) {
    if (!code || code === 'auto') return 'Automatique';
    try { return new Intl.DisplayNames(['fr'],{type:'language'}).of(code); } catch {return code;}
  }
  async function translate() {
    if (!enabled || !selection) return;
    const id = ++ticket;
    resizedThisOpen = false;
    previousFocus = document.activeElement;
    mode = 'panel'; bubble.hidden = true; panel.hidden = false; translated = '';
    copy.hidden = true; retry.hidden = true; copy.textContent = 'Copier';
    panel.querySelector('.languages').textContent = 'Détection de la langue…';
    output.textContent = 'Traduction en cours…'; output.className = 'result loading';
    applySize(panelSize);
    position(panel,selection.rect); panel.querySelector('.close').focus({preventScroll:true});
    try {
      if (selection.text.length > 4000) throw new Error('Sélection trop longue : 4 000 caractères maximum.');
      const response = await chrome.runtime.sendMessage({type:'TRANSLATE',text:selection.text});
      if (id !== ticket) return;
      if (!response?.ok) throw new Error(response?.error || 'Réponse introuvable.');
      translated = response.translated; output.textContent = translated; output.className = 'result';
      panel.querySelector('.languages').textContent = `${label(response.detected)} → ${label(response.target)}`;
      copy.hidden = false;
    } catch(error) {
      if (id !== ticket) return;
      output.className = 'result error'; output.textContent = error.message.includes('context invalidated') ? 'Extension mise à jour. Rechargez la page.' : error.message;
      panel.querySelector('.languages').textContent = 'Traduction impossible'; retry.hidden = selection.text.length > 4000;
    }
    if (id === ticket && !resizing && !resizedThisOpen) position(panel,selection.rect);
  }
  bubble.addEventListener('pointerdown',e=>e.preventDefault());
  bubble.addEventListener('click',translate); retry.addEventListener('click',translate);
  panel.querySelector('.close').addEventListener('click',()=>hide(true));
  copy.addEventListener('click',async()=>{
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(translated);
      else {
        const area = document.createElement('textarea'); area.value = translated; root.append(area); area.select();
        const success = document.execCommand('copy'); area.remove(); copy.focus();
        if (!success) throw new Error('copy');
      }
      copy.textContent = '✓ Copié'; setTimeout(()=>copy.textContent='Copier',1600);
    } catch {copy.textContent = 'Sélectionnez pour copier';}
  });
  document.addEventListener('pointerup',e=>{if (e.composedPath().includes(host)) return; clearTimeout(timer); timer=setTimeout(offer,30);},true);
  document.addEventListener('pointerdown',e=>{if (!e.composedPath().includes(host)) hide();},true);
  document.addEventListener('keyup',e=>{if (e.key === 'Shift' || e.key.startsWith('Arrow')) offer();});
  document.addEventListener('keydown',e=>{if(e.key === 'Escape') hide(true);},true);
  document.addEventListener('selectionchange',()=>{if (mode === 'bubble' && !window.getSelection()?.toString().trim()) hide();});
  document.addEventListener('scroll',e=>{if (!e.composedPath().includes(host)) hide();},true);
  window.addEventListener('resize',()=>hide());
  chrome.storage.sync.get({enabled:true}).then(p=>{enabled=p.enabled;if(!enabled)hide();}).catch(()=>{});
  chrome.storage.sync.get({panelSize:null}).then(p=>{
    const saved = p.panelSize;
    if (!sizeChanged && saved && Number.isFinite(saved.width) && Number.isFinite(saved.height) && saved.width>0 && saved.height>0) {
      panelSize = {width:saved.width,height:saved.height};
      if (mode === 'panel' && selection) {applySize(panelSize);position(panel,selection.rect);}
    }
  }).catch(()=>{});
  chrome.storage.onChanged.addListener((changes,area)=>{if(area === 'sync' && changes.enabled){enabled=changes.enabled.newValue!==false;if(!enabled)hide();}});
  chrome.runtime.onMessage.addListener((message,_sender,reply)=>{
    if (message.type !== 'TRANSLATE_SELECTION') return;
    selection = capture();
    if (enabled && selection) translate();
    reply({ok:true});
  });
})();
