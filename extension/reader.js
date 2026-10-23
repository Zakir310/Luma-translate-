(() => {
  if (globalThis.__lumaReaderLoaded) return;
  globalThis.__lumaReaderLoaded = true;
  const MAX_READ = 250000;
  const EXCLUDED = 'script,style,noscript,textarea,input,select,option,pre,code,kbd,samp,svg,math,canvas,iframe,object,embed,[contenteditable]:not([contenteditable="false"]),luma-translate';
  let remembered = null;

  function languageHint() {
    return globalThis.__lumaReadLanguage?.() || document.documentElement.lang || '';
  }
  function selectedText() {
    const field = document.activeElement;
    if (field?.matches('input[type="password"]')) throw new Error('La lecture des mots de passe est désactivée.');
    if (field?.matches('input,textarea') && typeof field.selectionStart === 'number' && typeof field.selectionEnd === 'number') {
      const text = field.value.slice(field.selectionStart,field.selectionEnd).trim();
      return text ? {text,langHint:languageHint()} : null;
    }
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    return text ? {text,langHint:languageHint()} : null;
  }
  document.addEventListener('selectionchange',()=>{
    try {
      const selection = selectedText();
      if (selection) remembered = selection;
      else if (document.hasFocus()) remembered = null;
    } catch {remembered = null;}
  });
  document.addEventListener('pointerdown',event=>{
    if (!event.composedPath().some(node=>node.nodeName === 'LUMA-TRANSLATE')) remembered = null;
  },true);

  function visible(node) {
    const parent = node.parentElement;
    if (!parent || !node.isConnected || !node.data || parent.closest(EXCLUDED)) return false;
    const style = getComputedStyle(parent);
    if (style.visibility === 'hidden' || style.visibility === 'collapse') return false;
    if (parent.getClientRects().length) return true;
    const range = document.createRange(); range.selectNodeContents(node);
    return [...range.getClientRects()].some(rect=>rect.width > 0 && rect.height > 0);
  }
  function block(parent) {
    for (let element=parent;element && element !== document.body;element=element.parentElement) {
      const display = getComputedStyle(element).display;
      if (display !== 'inline' && display !== 'contents') return element;
    }
    return document.body;
  }
  function pageText() {
    if (!document.body) throw new Error('Cette page ne contient pas de texte lisible.');
    const walker = document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    const paragraphs = []; let previous = null, size = 0;
    while (walker.nextNode()) {
      const node = walker.currentNode;
      // Un saut de ligne HTML doit séparer les mots, même sans espace dans le DOM.
      if (node.nodeType === 1) {
        if (node.tagName === 'BR' && paragraphs.length && !node.closest(EXCLUDED) &&
            getComputedStyle(node).visibility === 'visible' && node.getClientRects().length) paragraphs[paragraphs.length-1] += ' ';
        continue;
      }
      if (!visible(node)) continue;
      const group = block(node.parentElement);
      if (group !== previous || !paragraphs.length) {paragraphs.push('');previous=group;}
      paragraphs[paragraphs.length-1] += node.data;
      size += node.data.length;
      if (size > MAX_READ) throw new Error('Cette page est très longue. Sélectionne un passage à écouter.');
    }
    const text = paragraphs.map(part=>part.replace(/\s+/g,' ').trim()).filter(Boolean).join('\n\n');
    if (!text) throw new Error('Aucun texte visible à lire sur cette page.');
    return {text,langHint:languageHint()};
  }
  chrome.runtime.onMessage.addListener((message,sender,reply)=>{
    if (message.type !== 'READ_TEXT' || sender.id !== chrome.runtime.id) return;
    try {
      if (message.mode !== 'selection' && message.mode !== 'page') throw new Error('Choix de lecture non reconnu.');
      const excerpt = message.mode === 'page' ? pageText() : selectedText() || (!document.hasFocus() ? remembered : null);
      if (!excerpt?.text) throw new Error('Sélectionne un texte sur la page, puis clique sur « Lire la sélection ».');
      if (excerpt.text.length > MAX_READ) throw new Error('Texte trop long. Sélectionne un passage plus court.');
      reply({ok:true,...excerpt});
    } catch(problem) {reply({ok:false,error:problem.message || 'Impossible de lire ce texte.'});}
  });
})();
