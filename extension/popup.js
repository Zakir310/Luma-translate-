import {LANGUAGES, DEFAULTS, normalizeSettings, languageName, isLanguage} from './shared.js';
import {voiceKey,baseLanguage} from './speech-utils.js';
const $ = id => document.getElementById(id);
let prefs, choosing = 'target', lastDetected = 'en', saving = Promise.resolve();
let activeTabId, pageState = null, pageAction = false, pageSupported = true;
let speechState = null, speechAction = false;
let voiceCatalog=null,voicesLoading=false,voiceError='';
function notice(text){$('notice').textContent=text;}
function label(code){const lang=LANGUAGES.find(([id])=>id===code);return lang ? `${lang[2]}  ${lang[1]}` : '✦  Détection auto';}
function renderPrefs(){
  $('enabled').checked=prefs.enabled; $('remember').checked=prefs.historyEnabled;
  $('page-bold').checked=prefs.pageBold;
  $('read-rate').value=String(prefs.readRate);
  $('state').textContent=prefs.enabled?'PRÊTE À TRADUIRE':'EN PAUSE';
  document.body.classList.toggle('paused',!prefs.enabled);
  for(const key of ['source','target']){
    $(key).replaceChildren(document.createTextNode(label(prefs[key])));
    const arrow=document.createElement('span');arrow.textContent='⌄';$(key).append(arrow);
  }
  renderPage();
  renderVoicePicker();
  renderSpeech();
}
function renderVoicePicker(){
  const picker=$('read-voice');picker.replaceChildren();
  const automatic=document.createElement('option');automatic.value='';automatic.textContent='Automatique · voix améliorées en priorité';picker.append(automatic);
  for(const voice of voiceCatalog || []){
    const option=document.createElement('option');option.value=voice.key;
    option.textContent=`${voice.voiceName} · ${voice.lang || 'langue non précisée'}${voice.qualityLabel?' · '+voice.qualityLabel:''}`;
    picker.append(option);
  }
  const chosen=prefs.readVoice;
  if(chosen && voiceCatalog && !voiceCatalog.some(voice=>voice.key===voiceKey(chosen))){
    const missing=document.createElement('option');missing.value=voiceKey(chosen);missing.disabled=true;
    missing.textContent=`${chosen.voiceName} · indisponible ici (choix auto)`;picker.append(missing);
  }
  picker.value=chosen?voiceKey(chosen):'';
  $('voice-hint').textContent=voiceError || (voicesLoading || !voiceCatalog?'Chargement des voix…':
    !voiceCatalog.length?'Aucune voix locale disponible. Ajoute une voix dans les réglages de ton ordinateur.':
    chosen?(chosen.lang?`Choix mémorisé pour ${LANGUAGES.find(([code])=>baseLanguage(code)===baseLanguage(chosen.lang))?.[1] || chosen.lang}. Les autres langues restent automatiques.`:
      'Voix mémorisée. Sa langue n’est pas précisée par le système.'):
    'La langue du texte est détectée automatiquement. Choisis une voix et écoute un aperçu pour comparer.');
}
async function refreshVoices(){
  if(voicesLoading)return;
  voicesLoading=true;voiceError='';renderVoicePicker();renderSpeech();
  try{
    const response=await chrome.runtime.sendMessage({type:'SPEECH_VOICES'});
    if(!response?.ok || !Array.isArray(response.voices))throw new Error(response?.error || 'Voix indisponibles. Recharge Luma.');
    voiceCatalog=response.voices;
  }catch(problem){voiceError=problem.message || 'Impossible de charger les voix.';voiceCatalog ||= [];}
  finally{voicesLoading=false;renderVoicePicker();renderSpeech();}
}
function renderSpeech(){
  $('read-selection').disabled=$('read-page').disabled=speechAction || !prefs.enabled || !pageSupported;
  $('speech-controls').hidden=!speechState?.active;
  $('speech-pause').disabled=$('speech-stop').disabled=speechAction;
  $('speech-pause').textContent=speechState?.paused?'Reprendre':'Pause';
  $('speech-preview').disabled=speechAction || !prefs.enabled || voicesLoading || !voiceCatalog?.length;
  $('read-voice').disabled=speechAction || voicesLoading || !voiceCatalog?.length;
  $('refresh-voices').disabled=speechAction || voicesLoading;
  $('speech-progress').max=Math.max(1,speechState?.characters || speechState?.total || 0);
  $('speech-progress').value=speechState?.characters?speechState.spoken || 0:speechState?.completed || 0;
  if(speechAction)$('speech-status').textContent='Préparation de la lecture…';
  else if(speechState?.error)$('speech-status').textContent=speechState.error;
  else if(speechState?.active){
    const mode=speechState.mode==='preview'?'Aperçu de la voix':speechState.mode==='selection'?'Lecture de la sélection':'Lecture de la page';
    const owner=speechState.tabId!=null && speechState.tabId!==activeTabId?' · autre onglet':'';
    const progress=speechState.characters?`${Math.min(100,Math.round(100*(speechState.spoken || 0)/speechState.characters))} %`:`${speechState.completed+1} / ${speechState.total} passages`;
    $('speech-status').textContent=`${speechState.paused?'En pause':mode}${owner} · ${progress}`;
    $('speech-status').textContent+=`\nVoix : ${speechState.voice}${speechState.fallback?' (voix de remplacement)':''}`;
    if(speechState.voiceNotice)$('speech-status').textContent+='\n'+speechState.voiceNotice;
  }else if(speechState?.total && speechState.completed>=speechState.total)$('speech-status').textContent=speechState.mode==='preview'?'Aperçu terminé.':'Lecture terminée.';
  else if(!prefs.enabled)$('speech-status').textContent='Active Luma pour écouter un texte.';
  else if(!pageSupported)$('speech-status').textContent='Ouvre une page web pour choisir un texte à lire.';
  else $('speech-status').textContent='Choisis le texte sélectionné ou toute la page.';
}
async function refreshSpeech(){
  if(speechAction)return;
  try{const response=await chrome.runtime.sendMessage({type:'SPEECH_STATUS'});if(response?.ok){speechState=response;renderSpeech();}}
  catch{ /* Le prochain clic affichera l'erreur si le service vient d'être rechargé. */ }
}
async function speechClick(type,mode){
  if(speechAction)return;
  speechAction=true;renderSpeech();
  try{
    await saving;
    const response=await chrome.runtime.sendMessage({type,mode,tabId:activeTabId});
    if(!response?.ok)throw new Error(response?.error || 'Impossible de lancer la lecture.');
    speechState=response;
  }catch(problem){speechState={...speechState,error:problem.message || 'Lecture impossible.'};}
  finally{speechAction=false;renderSpeech();}
}
function renderPage(){
  $('page-target').textContent=languageName(prefs.target);
  $('translate-page').disabled=pageAction || !prefs.enabled || !pageSupported;
  const sameTarget=pageState?.target===prefs.target && pageState?.source===prefs.source;
  const running=pageState?.active && sameTarget && !pageState.error && pageState.busy;
  const complete=pageState?.active && sameTarget && !pageState.error && !pageState.busy && pageState.translated>0 && !pageState.remaining;
  $('translate-page').textContent=pageAction?'Un instant…':pageState?.error?'Réessayer':running?'Traduction en cours…':complete?'Page traduite':'Traduire cette page';
  if(running || complete)$('translate-page').disabled=true;
  $('restore-page').hidden=!pageState?.active;
  $('restore-page').disabled=pageAction;
  $('page-progress').hidden=!pageState?.busy;
  $('page-progress').max=Math.max(1,pageState?.total || 0);
  $('page-progress').value=pageState?.translated || 0;
  if(!pageSupported)$('page-status').textContent='Ouvre une page web HTTP ou HTTPS pour utiliser ce bouton.';
  else if(!prefs.enabled)$('page-status').textContent='Active Luma pour traduire cette page.';
  else if(pageState?.error)$('page-status').textContent=pageState.error;
  else if(pageState?.active){
    const count=pageState.translated || 0;
    const language=languageName(pageState.target);
    $('page-status').textContent=pageState.busy?`Traduction vers ${language}… ${count} / ${pageState.total} blocs`:
      count?`Le texte de la page est remplacé en ${language} · ${count} blocs.`:'Aucun texte lisible détecté. Essaie de recharger la page ou de relancer la traduction.';
    if(!sameTarget)$('page-status').textContent+=' Clique sur « Traduire cette page » pour appliquer les langues choisies.';
  }else $('page-status').textContent='Traduire le texte de l’onglet actuel.';
}
async function pageMessage(type,inject=false){
  if(!activeTabId)throw new Error('Ouvre une page web pour utiliser ce bouton.');
  try{return await chrome.tabs.sendMessage(activeTabId,{type},{frameId:0});}
  catch(problem){
    if(!inject)throw problem;
    await chrome.scripting.executeScript({target:{tabId:activeTabId},files:['content.js','page.js']});
    return chrome.tabs.sendMessage(activeTabId,{type},{frameId:0});
  }
}
async function refreshPage(){
  if(!activeTabId || pageAction || !pageSupported)return;
  try{const state=await pageMessage('PAGE_STATUS');if(state?.ok){pageState=state;renderPage();}}
  catch{pageState=null;renderPage(); /* Le prochain clic réinjectera les scripts si l'onglet a navigué. */}
}
async function pageClick(type){
  if(pageAction)return;
  pageAction=true;renderPage();
  try{
    await saving;
    const response=await pageMessage(type,true);
    if(!response?.ok)throw new Error(response?.error || 'Impossible de communiquer avec la page.');
    pageState=response;
    if(type==='PAGE_RESTORE')notice('Texte original rétabli.');
  }catch(problem){
    pageState={...pageState,error:problem.message.includes('Cannot access')?'Chrome interdit la traduction sur cette page.':problem.message};
  }finally{pageAction=false;renderPage();}
}
function save(patch){
  prefs={...prefs,...patch};renderPrefs();
  saving=saving.then(()=>chrome.storage.sync.set(patch)).catch(()=>notice('Préférences non enregistrées. Réessayez.'));
  return saving;
}
function listLanguages(){
  const fold=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const query=fold($('search').value);
  const entries=choosing==='source'?[['auto','Détection auto','✦'],...LANGUAGES]:LANGUAGES;
  $('languages').replaceChildren();
  for(const [code,name,flag] of entries.filter(([code,name])=>fold(name+' '+code).includes(query))){
    const button=document.createElement('button');button.className='option';button.type='button';
    button.textContent=`${flag}  ${name}${prefs[choosing]===code?'  ✓':''}`;
    button.classList.toggle('selected',prefs[choosing]===code);
    button.addEventListener('click',()=>{save({[choosing]:code});$('picker').close();});
    $('languages').append(button);
  }
  if(!$('languages').childElementCount){const empty=document.createElement('p');empty.textContent='Aucune langue trouvée.';$('languages').append(empty);}
}
async function renderHistory(){
  const response=await chrome.runtime.sendMessage({type:'GET_HISTORY'});
  if(!response?.ok)throw new Error('Historique indisponible.');
  const history=response.history || []; $('history').replaceChildren();$('clear').disabled=!history.length;
  if(isLanguage(history[0]?.detected))lastDetected=history[0].detected;
  if(!history.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='Tes prochaines traductions apparaîtront ici.';$('history').append(empty);}
  for(const item of history){
    const article=document.createElement('article');article.className='entry';
    const top=document.createElement('div');top.className='entry-top';
    const pair=document.createElement('span');pair.textContent=`${languageName(item.detected)} → ${languageName(item.target)}`;
    const button=document.createElement('button');button.textContent='Copier';button.setAttribute('aria-label','Copier la traduction');
    button.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(item.translated);button.textContent='✓ Copié';setTimeout(()=>button.textContent='Copier',1500);}catch{notice('Copie refusée par le navigateur.');}});
    top.append(pair,button);
    const original=document.createElement('p');original.className='original';original.dir='auto';original.textContent=item.original;original.title=item.original;
    const result=document.createElement('p');result.dir='auto';result.textContent=item.translated;result.title=item.translated;
    article.append(top,original,result);$('history').append(article);
  }
}
async function init(){
  prefs=normalizeSettings(await chrome.storage.sync.get(DEFAULTS));renderPrefs();await renderHistory();
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  activeTabId=tab?.id;
  pageSupported=!!activeTabId && /^https?:/.test(tab?.url || '');
  $('translate-page').addEventListener('click',()=>pageClick('PAGE_START'));
  $('restore-page').addEventListener('click',()=>pageClick('PAGE_RESTORE'));
  $('page-bold').addEventListener('change',()=>save({pageBold:$('page-bold').checked}));
  $('read-selection').addEventListener('click',()=>speechClick('SPEECH_START','selection'));
  $('read-page').addEventListener('click',()=>speechClick('SPEECH_START','page'));
  $('speech-pause').addEventListener('click',()=>speechClick(speechState?.paused?'SPEECH_RESUME':'SPEECH_PAUSE'));
  $('speech-stop').addEventListener('click',()=>speechClick('SPEECH_STOP'));
  $('read-rate').addEventListener('change',()=>save({readRate:Number($('read-rate').value)}));
  $('read-voice').addEventListener('change',()=>{
    const voice=voiceCatalog?.find(item=>item.key===$('read-voice').value);
    return save({readVoice:voice?{voiceName:voice.voiceName,lang:voice.lang}:null});
  });
  $('speech-preview').addEventListener('click',()=>speechClick('SPEECH_PREVIEW'));
  $('refresh-voices').addEventListener('click',refreshVoices);
  chrome.tts?.onVoicesChanged?.addListener(()=>{void refreshVoices();});
  renderPage();renderSpeech();await Promise.allSettled([refreshPage(),refreshSpeech(),refreshVoices()]);
  setInterval(()=>{void refreshPage();void refreshSpeech();},800);
  for(const key of ['source','target'])$(key).addEventListener('click',()=>{choosing=key;$('picker-title').textContent=key==='source'?'Langue source':'Langue cible';$('search').value='';listLanguages();$('picker').showModal();$('search').focus();});
  $('search').addEventListener('input',listLanguages);
  $('close-picker').addEventListener('click',()=>$('picker').close());
  $('enabled').addEventListener('change',()=>save({enabled:$('enabled').checked}));
  $('remember').addEventListener('change',async()=>{
    const enabled=$('remember').checked;await save({historyEnabled:enabled});
    if(!enabled){await chrome.runtime.sendMessage({type:'CLEAR_HISTORY'});await renderHistory();}
  });
  $('swap').addEventListener('click',()=>{
    let source=prefs.source==='auto'?lastDetected:prefs.source;
    if(source===prefs.target)source=prefs.target==='en'?'fr':'en';
    save({source:prefs.target,target:source});notice('Langues inversées. Choisis « Détection auto » pour la réactiver.');
  });
  $('clear').addEventListener('click',async()=>{await chrome.runtime.sendMessage({type:'CLEAR_HISTORY'});await renderHistory();notice('Historique effacé.');});
  chrome.storage.onChanged.addListener((changes,area)=>{
    if(area==='local'&&changes.history)renderHistory().catch(error=>notice(error.message));
    if(area==='sync'){for(const key of Object.keys(DEFAULTS))if(changes[key])prefs[key]=changes[key].newValue;prefs=normalizeSettings(prefs);renderPrefs();}
  });
}
init().catch(error=>notice(error.message || 'Impossible de charger Luma. Rouvre le menu.'));
