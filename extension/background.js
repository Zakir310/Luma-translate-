import {DEFAULTS, MAX_TEXT, normalizeSettings, isLanguage} from './shared.js';
import {handleSpeech} from './speech.js';

// Serialise les écritures : deux onglets ne doivent pas écraser l'historique.
let writes = Promise.resolve();
let historyEpoch = 0;
const pending = new Map();
function write(task) { const next = writes.then(task); writes = next.catch(()=>{}); return next; }
const settings = async () => normalizeSettings(await chrome.storage.sync.get(DEFAULTS));
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'}).catch(()=>{});
});

async function requestTranslation(text, source, target) {
  if (source === target) return {translated:text, detected:source};
  const url = new URL('https://translate.googleapis.com/translate_a/single');
  url.search = new URLSearchParams({client:'gtx', sl:source, tl:target, dt:'t', q:text}).toString();
  const abort = new AbortController();
  const timeout = setTimeout(()=>abort.abort(), 12000);
  try {
    const response = await fetch(url, {signal:abort.signal, credentials:'omit', cache:'no-store', referrerPolicy:'no-referrer'});
    if (!response.ok) throw new Error(response.status === 429 ? 'Service sollicité. Réessayez dans quelques instants.' : 'Service de traduction indisponible. Réessayez.');
    const data = await response.json();
    if (!Array.isArray(data?.[0])) throw new Error('Réponse du service non reconnue.');
    const translated = data[0].map(row=>typeof row?.[0] === 'string' ? row[0] : '').join('');
    if (!translated.trim()) throw new Error('Aucune traduction reçue.');
    return {translated, detected:typeof data[2] === 'string' ? data[2] : source};
  } catch(error) {
    if (error.name === 'AbortError') throw new Error('Le service met trop de temps à répondre. Réessayez.');
    if (error instanceof TypeError) throw new Error('Connexion impossible. Vérifiez votre connexion Internet.');
    throw error;
  } finally { clearTimeout(timeout); }
}

async function translatePageBatch(message, sender) {
  if (!sender.tab || !/^https?:/.test(sender.url || '') || sender.frameId > 0) throw new Error('Requête non autorisée.');
  const prefs = await settings();
  if (!prefs.enabled) throw new Error('Luma est en pause.');
  const {texts,source,target} = message;
  if (!isLanguage(target) || !(source === 'auto' || isLanguage(source))) throw new Error('Langue non reconnue.');
  if (!Array.isArray(texts) || !texts.length || texts.length > 12 ||
      texts.some(text=>typeof text !== 'string' || !text.trim() || text.length > 2500) ||
      texts.reduce((sum,text)=>sum+text.length,0) > 2800) throw new Error('Lot de textes trop volumineux.');
  // Les pages ne remplissent pas l'historique des sélections.
  if (source === target) return {ok:true,translations:texts};
  if (texts.length === 1) {
    const result = await requestTranslation(texts[0],source,target);
    return {ok:true,translations:[result.translated]};
  }
  // Identifiants aléatoires pour conserver l'association entre texte et nœud DOM.
  const nonce = crypto.randomUUID().replaceAll('-','');
  const markers = texts.map((_,index)=>`[LUMA_${nonce}_${index}]`);
  const joined = texts.map((text,index)=>`${markers[index]}\n${text}`).join('\n');
  const {translated} = await requestTranslation(joined,source,target);
  const positions = markers.map(marker=>translated.indexOf(marker));
  const valid = positions.every((position,index)=>position >= 0 &&
    (index === 0 || position > positions[index-1]) &&
    translated.indexOf(markers[index],position+markers[index].length) === -1);
  if (!valid || translated.slice(0,positions[0]).trim()) return {ok:true,needsIndividual:true};
  const translations = markers.map((marker,index)=>translated.slice(
    positions[index]+marker.length,index+1 < markers.length ? positions[index+1] : undefined).trim());
  // Si le fournisseur modifie un identifiant, le contenu réessaie un texte à la fois.
  // On n'applique jamais une réponse dont l'ordre ou les séparateurs sont ambigus.
  if (translations.some(text=>!text)) return {ok:true,needsIndividual:true};
  return {ok:true,translations};
}

async function handle(message, sender) {
  const isPopup = !sender.tab && sender.url === chrome.runtime.getURL('popup.html');
  if (typeof message.type === 'string' && message.type.startsWith('SPEECH_')) {
    if (!isPopup) throw new Error('Requête non autorisée.');
    return handleSpeech(message);
  }
  if (message.type === 'CLEAR_HISTORY' && isPopup) {
    historyEpoch++;
    await write(()=>chrome.storage.local.set({history:[]})); return {ok:true};
  }
  if (message.type === 'GET_HISTORY' && isPopup) {
    await writes; return {ok:true, history:(await chrome.storage.local.get({history:[]})).history};
  }
  if (message.type === 'TRANSLATE_PAGE_BATCH') return translatePageBatch(message,sender);
  if (message.type !== 'TRANSLATE' || !sender.tab || !/^https?:/.test(sender.url || '')) throw new Error('Requête non autorisée.');
  const prefs = await settings();
  if (!prefs.enabled) throw new Error('Luma est en pause. Activez-la dans son menu.');
  const text = typeof message.text === 'string' ? message.text.trim() : '';
  if (!text || text.length > MAX_TEXT) throw new Error(`Sélectionnez entre 1 et ${MAX_TEXT} caractères.`);
  const epoch = historyEpoch;
  const key = JSON.stringify([text,prefs.source,prefs.target]);
  if (!pending.has(key)) {
    if (pending.size >= 5) throw new Error('Plusieurs traductions sont en cours. Patientez.');
    pending.set(key, requestTranslation(text,prefs.source,prefs.target).finally(()=>pending.delete(key)));
  }
  const result = {...await pending.get(key), target:prefs.target};
  await write(async()=>{
    if (epoch !== historyEpoch || !(await settings()).historyEnabled || sender.tab.incognito) return;
    const {history=[]} = await chrome.storage.local.get('history');
    const entry = {original:text,...result,date:Date.now()};
    await chrome.storage.local.set({history:[entry,...history.filter(h=>h.original!==text || h.target!==prefs.target)].slice(0,3)});
  });
  return {ok:true,...result};
}
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if (sender.id !== chrome.runtime.id) return;
  handle(message || {},sender).then(reply,error=>reply({ok:false,error:error.message || 'Erreur inattendue.'}));
  return true;
});
chrome.commands.onCommand.addListener(async(command, tab)=>{
  if (command !== 'translate-selection') return;
  try {
    const active = tab || (await chrome.tabs.query({active:true,lastFocusedWindow:true}))[0];
    if (!active?.id) return;
    try { await chrome.tabs.sendMessage(active.id,{type:'TRANSLATE_SELECTION'}); }
    catch {
      await chrome.scripting.executeScript({target:{tabId:active.id},files:['content.js']});
      await chrome.tabs.sendMessage(active.id,{type:'TRANSLATE_SELECTION'});
    }
  } catch { /* Chrome interdit l'injection sur ses pages internes et le Web Store. */ }
});
