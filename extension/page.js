(() => {
  if (globalThis.__lumaPageLoaded) return;
  globalThis.__lumaPageLoaded = true;

  // Un clic explicite doit fonctionner même si le site désactive sa traduction
  // automatique avec translate="no" ou une classe globale notranslate.
  const EXCLUDED = 'script,style,noscript,textarea,input,select,option,pre,code,kbd,samp,svg,math,canvas,iframe,object,embed,[contenteditable]:not([contenteditable="false"]),luma-translate';
  const originals = new Map();
  const emphasis = new Map();
  const jobs = new Map();
  const roots = new Set();
  let queue = [], observer = null, scanTimer, epoch = 0, total = 0;
  let active = false, busy = false, error = '', source = 'auto', target = 'fr', individual = false, bold = true;
  let pumpEpoch = null;

  function status() {
    return {ok:true,active,busy,error,source,target,bold,translated:originals.size,total,remaining:jobs.size};
  }
  // Pont interne au monde isolé de l'extension, pour choisir la langue de lecture.
  globalThis.__lumaReadLanguage = () => active && originals.size ? target : null;
  function emphasize(node) {
    const parent = node.parentElement;
    if (!bold || !parent || parent === document.body || parent === document.documentElement) return;
    if (!emphasis.has(parent)) emphasis.set(parent,{
      value:parent.style.getPropertyValue('font-weight'),priority:parent.style.getPropertyPriority('font-weight')
    });
    // Garde les nœuds et événements du site ; ne crée pas de balises autour du texte.
    parent.style.setProperty('font-weight','700','important');
  }
  function clearEmphasis() {
    for (const [parent,original] of emphasis) {
      if (parent.style.getPropertyValue('font-weight') === '700' && parent.style.getPropertyPriority('font-weight') === 'important') {
        if (original.value) parent.style.setProperty('font-weight',original.value,original.priority);
        else parent.style.removeProperty('font-weight');
      }
    }
    emphasis.clear();
  }
  function changeBold(value) {
    clearEmphasis(); bold = value;
    if (bold) for (const [node,record] of originals) {
      if (node.isConnected && node.data === record.translated) emphasize(node);
    }
  }
  function splitText(text) {
    const pieces = [];
    let offset = 0;
    while (offset < text.length) {
      let end = Math.min(offset+2400,text.length);
      if (end < text.length) {
        const space = text.lastIndexOf(' ',end);
        if (space > offset+1200) end = space+1;
        // Ne pas couper une paire UTF-16 (emoji, caractères hors BMP).
        const last = text.charCodeAt(end-1);
        if (last >= 0xD800 && last <= 0xDBFF) end--;
      }
      const part = text.slice(offset,end), match = /^(\s*)([\s\S]*?)(\s*)$/.exec(part);
      pieces.push({prefix:match[1],text:match[2],suffix:match[3]});
      offset = end;
    }
    return pieces;
  }
  function eligible(node) {
    const parent = node.parentElement;
    if (!node.isConnected || !parent || parent.closest(EXCLUDED) || !/\p{L}/u.test(node.data)) return false;
    if (!parent.getClientRects().length) {
      // display:contents n'a pas de boîte propre, mais ses textes peuvent être visibles.
      const range = document.createRange(); range.selectNodeContents(node);
      if (![...range.getClientRects()].some(rect=>rect.width > 0 && rect.height > 0)) return false;
    }
    const style = getComputedStyle(parent);
    return style.visibility !== 'hidden' && style.visibility !== 'collapse';
  }
  function prepare(node) {
    const record = originals.get(node);
    if (record) {
      if (node.data === record.translated) return;
      // Le site vient de remplacer ce texte : sa nouvelle valeur devient l'original.
      originals.delete(node);
    }
    const existing = jobs.get(node);
    if (existing?.original === node.data) return;
    if (existing) jobs.delete(node); // Les éléments en attente devenus obsolètes seront ignorés.
    if (!eligible(node)) return;
    const pieces = splitText(node.data);
    const job = {node,original:node.data,pieces,results:pieces.map(piece=>piece.text ? null : piece.prefix+piece.suffix),left:pieces.filter(piece=>piece.text).length};
    if (!job.left) return;
    jobs.set(node,job); total++;
    pieces.forEach((piece,index)=>{if(piece.text)queue.push({job,index,text:piece.text});});
  }
  function collect(root) {
    if (!active || !root?.isConnected) return;
    if (root.nodeType === Node.TEXT_NODE) {prepare(root);return;}
    if (root.nodeType !== Node.ELEMENT_NODE || root.closest(EXCLUDED)) return;
    const walker = document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) prepare(walker.currentNode);
  }
  function prune() {
    for (const node of originals.keys()) if (!node.isConnected) originals.delete(node);
    for (const node of jobs.keys()) if (!node.isConnected) jobs.delete(node);
  }
  function schedule(root) {
    if (!active || error || !root) return;
    roots.add(root);
    if (scanTimer) return;
    scanTimer = setTimeout(()=>{
      scanTimer = null;
      const candidates = [...roots]; roots.clear(); prune();
      const elements = candidates.filter(node=>node.nodeType === Node.ELEMENT_NODE);
      for (const candidate of candidates) {
        if (!elements.some(other=>other !== candidate && other.contains(candidate))) collect(candidate);
      }
      void pump(epoch);
    },200);
  }
  function validUnit(unit) {
    return unit.job.node.isConnected && jobs.get(unit.job.node) === unit.job && unit.job.node.data === unit.job.original;
  }
  function batch() {
    const units = []; let size = 0;
    while (queue.length && units.length < (individual ? 1 : 12)) {
      const unit = queue[0];
      if (!validUnit(unit)) {queue.shift();continue;}
      if (units.length && size+unit.text.length > 2800) break;
      queue.shift(); units.push(unit); size += unit.text.length;
    }
    return units;
  }
  function apply(unit,translation) {
    if (!validUnit(unit)) return;
    const {job,index} = unit, piece = job.pieces[index];
    job.results[index] = piece.prefix+translation+piece.suffix;
    if (--job.left) return;
    jobs.delete(job.node);
    if (!eligible(job.node) || job.node.data !== job.original) return;
    const translated = job.results.join('');
    // Modifier uniquement les nœuds texte garde liens, boutons et événements du site.
    originals.set(job.node,{original:job.original,translated});
    job.node.data = translated;
    emphasize(job.node);
  }
  async function pump(id) {
    if (pumpEpoch === id || !active || error || id !== epoch) return;
    pumpEpoch = id; busy = true;
    try {
      while (active && !error && id === epoch) {
        const units = batch(); if (!units.length) break;
        const response = await chrome.runtime.sendMessage({type:'TRANSLATE_PAGE_BATCH',texts:units.map(unit=>unit.text),source,target});
        if (!active || id !== epoch) return;
        if (!response?.ok) {queue.unshift(...units);throw new Error(response?.error || 'Le service de traduction ne répond pas.');}
        if (response.needsIndividual) {
          individual = true; queue.unshift(...units);
        } else {
          if (!Array.isArray(response.translations) || response.translations.length !== units.length ||
              response.translations.some(text=>typeof text !== 'string' || !text.trim())) {
            queue.unshift(...units);throw new Error('Réponse de traduction non reconnue.');
          }
          units.forEach((unit,index)=>apply(unit,response.translations[index]));
        }
        // Un seul lot en vol par onglet, avec une courte pause entre les appels.
        await new Promise(resolve=>setTimeout(resolve,350));
      }
    } catch(problem) {
      if (active && id === epoch) error = problem.message.includes('context invalidated') ? 'Recharge la page après la mise à jour de Luma.' : problem.message;
    } finally {
      if (id === epoch) {busy = false;pumpEpoch = null;}
    }
  }
  function restore() {
    epoch++; active = false; busy = false; error = ''; pumpEpoch = null;
    observer?.disconnect(); observer = null; clearTimeout(scanTimer); scanTimer = null; roots.clear();
    clearEmphasis();
    queue = []; jobs.clear();
    for (const [node,record] of originals) {
      // Ne jamais remplacer une valeur modifiée entre-temps par le site.
      if (node.isConnected && node.data === record.translated) node.data = record.original;
    }
    originals.clear(); total = 0; individual = false;
    return status();
  }
  async function start() {
    restore(); const id = epoch;
    const prefs = await chrome.storage.sync.get({enabled:true,source:'auto',target:'fr',pageBold:true});
    if (id !== epoch) return status();
    if (!prefs.enabled) throw new Error('Active Luma pour traduire cette page.');
    if (!document.body) throw new Error('Cette page ne contient pas de texte à traduire.');
    source = prefs.source; target = prefs.target; bold = prefs.pageBold !== false; active = true;
    observer = new MutationObserver(mutations=>{
      for (const mutation of mutations) {
        if (mutation.type === 'characterData' || mutation.type === 'attributes') schedule(mutation.target);
        else for (const node of mutation.addedNodes) schedule(node);
      }
    });
    observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden','aria-hidden','class','style','translate','contenteditable']});
    collect(document.body); void pump(id);
    return status();
  }
  window.addEventListener('scroll',()=>{if(active && !error)schedule(document.body);},{passive:true});
  chrome.storage.onChanged.addListener((changes,area)=>{
    if (area === 'sync' && changes.enabled?.newValue === false) restore();
    if (area === 'sync' && changes.pageBold) changeBold(changes.pageBold.newValue !== false);
  });
  chrome.runtime.onMessage.addListener((message,sender,reply)=>{
    if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL('popup.html')) return;
    if (message.type === 'PAGE_STATUS') {prune();reply(status());return;}
    if (message.type === 'PAGE_RESTORE') {reply(restore());return;}
    if (message.type === 'PAGE_START') {
      start().then(reply,problem=>reply({ok:false,error:problem.message || 'Impossible de traduire cette page.'}));
      return true;
    }
  });
})();
