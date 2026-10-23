import {DEFAULTS,normalizeSettings} from './shared.js';
import {localVoices,chooseVoice,listVoices,prepareSpeechText,splitForSpeech,previewText} from './speech-utils.js';

const empty = () => ({active:false,paused:false,tabId:null,mode:null,total:0,completed:0,characters:0,spoken:0,language:'',voice:'',voiceLanguage:'',fallback:false,voiceNotice:'',error:''});
let state = empty(), generation = 0, requests = 0, heartbeat, queued = false;
let saves = Promise.resolve();
function persist() {
  const snapshot = {...state};
  // Métadonnées uniquement : le texte lu ne va ni dans le stockage ni dans l'historique.
  saves = saves.then(()=>chrome.storage.session?.set({speechState:snapshot})).catch(()=>{});
}
function status() {return {ok:true,...state};}
function keepActive() {
  if (heartbeat) return;
  // La vérification n'existe que pendant la tâche de lecture, pas à l'arrêt.
  heartbeat = setInterval(async()=>{
    try {
      const speaking = await chrome.tts.isSpeaking();
      if (state.active && !state.paused && queued && !speaking) {
        state.active = false; state.completed = state.total; state.spoken=state.characters; persist();
        clearInterval(heartbeat); heartbeat = null;
      }
    } catch {stop('La synthèse vocale est indisponible. Recharge Luma.');}
  },20000);
}
const ready = (async()=>{
  try {
    const saved = (await chrome.storage.session?.get('speechState'))?.speechState;
    if (saved && typeof saved.active === 'boolean' && (saved.tabId===null || Number.isInteger(saved.tabId))) {
      state = {...empty(),...saved};
      if (state.active) {queued = true;keepActive();}
    }
  } catch { /* Une nouvelle session commence sans état antérieur. */ }
})();

function stop(error='') {
  requests++; generation++;
  clearInterval(heartbeat); heartbeat = null; queued = false;
  state = {...empty(),error};
  chrome.tts?.stop(); persist();
  return status();
}
async function excerpt(tabId,mode) {
  try {return await chrome.tabs.sendMessage(tabId,{type:'READ_TEXT',mode},{frameId:0});}
  catch {
    await chrome.scripting.executeScript({target:{tabId},files:['content.js','page.js','reader.js']});
    return chrome.tabs.sendMessage(tabId,{type:'READ_TEXT',mode},{frameId:0});
  }
}
async function detectLanguage(text,hint) {
  try {
    const detection = await chrome.i18n.detectLanguage(text.slice(0,6000));
    const first = [...(detection.languages || [])].sort((a,b)=>b.percentage-a.percentage)[0];
    if (first && first.language !== 'und' && (detection.isReliable || first.percentage >= 60)) return first.language;
  } catch { /* Les extraits très courts utilisent la langue de la page. */ }
  if (/^[a-z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(hint || '')) return hint;
  return chrome.i18n.getUILanguage();
}
async function start(message,preview=false) {
  if (!preview && (!Number.isInteger(message.tabId) || message.tabId < 0 || !['selection','page'].includes(message.mode))) throw new Error('Choix de lecture non reconnu.');
  const request = ++requests;
  const prefs = normalizeSettings(await chrome.storage.sync.get(DEFAULTS));
  if (!prefs.enabled) throw new Error('Active Luma pour écouter un texte.');
  if (!chrome.tts) throw new Error('Recharge l’extension pour activer la lecture vocale.');
  const demo=preview?previewText(prefs.readVoice?.lang || prefs.target,chrome.i18n.getUILanguage()):null;
  const content = preview?{ok:true,text:demo.text}:await excerpt(message.tabId,message.mode);
  if (!content?.ok) throw new Error(content?.error || 'Impossible de récupérer le texte.');
  if (typeof content.text !== 'string' || !content.text.trim() || content.text.length > 250000) throw new Error('Sélectionne un texte lisible et plus court.');
  const text=prepareSpeechText(content.text);
  if(!text)throw new Error('Ce texte ne contient aucun mot à lire.');
  const language = preview?demo.language:await detectLanguage(text,content.langHint);
  const voices = localVoices(await chrome.tts.getVoices());
  if (!voices.length) throw new Error('Aucune voix locale disponible. Ajoute une voix dans les réglages de ton ordinateur.');
  const {voice,fallback,voiceNotice} = chooseVoice(voices,language,prefs.readVoice,chrome.i18n.getUILanguage());
  const chunks = splitForSpeech(text,language);
  const offsets=[];let characters=0;for(const part of chunks){offsets.push(characters);characters+=part.length;}
  if (request !== requests) return status();
  // La nouvelle lecture remplace l'ancienne seulement après validation de son texte.
  stop(); const token = generation;
  state = {...empty(),active:true,tabId:Number.isInteger(message.tabId)?message.tabId:null,mode:preview?'preview':message.mode,total:chunks.length,characters,
    language,voice:voice.voiceName,voiceLanguage:voice.lang || '',fallback,voiceNotice};
  persist(); keepActive();
  try {
    // La file est confiée au moteur natif : elle reste audible si le menu se ferme.
    for (let index=0;index<chunks.length;index++) {
      if (token !== generation || !state.active) return status();
      await chrome.tts.speak(chunks[index],{
        enqueue:true,voiceName:voice.voiceName,lang:voice.lang || language,rate:prefs.readRate,pitch:1,
        requiredEventTypes:['end'],desiredEventTypes:['start','word','sentence','end','error','interrupted','cancelled','pause','resume'],
        onEvent(event) {
          if (token !== generation) return;
          if ((event.type==='word' || event.type==='sentence') && Number.isFinite(event.charIndex)) {
            state.spoken=Math.max(state.spoken,offsets[index]+Math.max(0,Math.min(chunks[index].length,event.charIndex)));
          } else if (event.type === 'end') {
            state.completed = Math.max(state.completed,index+1);
            state.spoken=Math.max(state.spoken,offsets[index]+chunks[index].length);
            if (state.completed >= state.total) {state.active=false;state.paused=false;clearInterval(heartbeat);heartbeat=null;}
            persist();
          } else if (event.type === 'error') stop(event.errorMessage || 'La voix n’a pas pu lire ce texte.');
          else if (event.type === 'interrupted' || event.type === 'cancelled') stop('Lecture interrompue.');
          else if (event.type === 'pause') {state.paused=true;persist();}
          else if (event.type === 'resume') {state.paused=false;persist();}
        }
      });
    }
    if (token === generation) queued = true;
    return status();
  } catch(problem) {
    if (token === generation) stop(problem.message || 'Impossible de démarrer cette voix.');
    throw problem;
  }
}
export async function handleSpeech(message) {
  await ready;
  if (message.type === 'SPEECH_STATUS') return status();
  if (message.type === 'SPEECH_VOICES') {
    if(!chrome.tts)throw new Error('Recharge Luma pour charger les voix.');
    return {ok:true,voices:listVoices(localVoices(await chrome.tts.getVoices()),chrome.i18n.getUILanguage())};
  }
  if (message.type === 'SPEECH_START' || message.type === 'SPEECH_PREVIEW') {
    const expected = requests+1;
    try {return await start(message,message.type==='SPEECH_PREVIEW');}
    catch(problem) {
      // Garde l'indication après la prochaine actualisation du menu, sans couper
      // la lecture précédente lorsqu'une nouvelle sélection est vide.
      if (expected === requests) {state.error=problem.message || 'Lecture impossible.';persist();}
      throw problem;
    }
  }
  if (message.type === 'SPEECH_STOP') return stop();
  if (message.type === 'SPEECH_PAUSE' && state.active) {chrome.tts.pause();state.paused=true;state.error='';persist();return status();}
  if (message.type === 'SPEECH_RESUME' && state.active) {chrome.tts.resume();state.paused=false;state.error='';persist();keepActive();return status();}
  throw new Error('Commande de lecture non reconnue.');
}
chrome.tabs?.onRemoved?.addListener(async tabId=>{await ready;if(state.active && state.tabId===tabId)stop();});
chrome.tabs?.onUpdated?.addListener(async(tabId,change)=>{await ready;if(state.active && state.tabId===tabId && change.status==='loading')stop();});
chrome.storage.onChanged?.addListener(async(changes,area)=>{await ready;if(area==='sync' && changes.enabled?.newValue===false)stop();});
