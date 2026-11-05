import {listVoices,looksLikeKey,MAX_TOTAL} from './eleven-api.js';
const $=id=>document.getElementById(id);
let key='',voices=[],loading=false,player={status:'idle'};
const playing=()=>['loading','playing','paused'].includes(player.status);
function status(text){$('el-status').textContent=text}
function render(){
  const ready=!!voices.length&&!loading;
  for(const id of ['el-selection','el-page','el-preview'])$(id).disabled=!ready;
  $('el-voice').disabled=!ready;$('el-connect').disabled=loading;
  $('el-stop').disabled=!playing();$('el-pause').disabled=!['playing','paused'].includes(player.status);
  $('el-pause').textContent=player.status==='paused'?'Reprendre':'Pause';
  $('el-key-row').hidden=!!key;$('el-key-saved').hidden=!key;
  $('el-key-label').textContent=key?`Clé enregistrée · ••••${key.slice(-4)}`:'';
}
function fillVoices(list,saved){
  voices=list;
  $('el-voice').replaceChildren(...(list.length?list.map(v=>{const o=document.createElement('option');o.value=v.voice_id;o.textContent=v.name;return o}):[new Option(key?'Aucune voix':'Enregistrez votre clé','')]));
  if(list.some(v=>v.voice_id===saved))$('el-voice').value=saved;
}
async function loadVoices(quiet=false){
  loading=true;render();if(!quiet)status('Connexion à ElevenLabs…');
  try{
    const list=await listVoices(key);
    if(!list.length)throw Error('Aucune voix disponible sur ce compte ElevenLabs.');
    const {elevenVoice}=await chrome.storage.local.get('elevenVoice');
    fillVoices(list,elevenVoice);await chrome.storage.local.set({elevenVoices:list});
    if(!playing())status('ElevenLabs connecté. Choisissez une voix puis un texte à lire.');
    return true;
  }catch(e){if(!quiet||!voices.length)status(e.message);return false}
  finally{loading=false;render()}
}
$('el-save').onclick=async()=>{
  const value=$('el-key').value.trim().replace(/^ELEVENLABS_API_KEY=/,'').replace(/^["']|["']$/g,'');
  if(!looksLikeKey(value))return status('Ceci ne ressemble pas à une clé ElevenLabs. Copiez-la depuis elevenlabs.io → API Keys.');
  const previous=key;key=value;
  if(await loadVoices()){await chrome.storage.local.set({elevenKey:key});$('el-key').value='';status('Clé enregistrée. Luma est prêt, plus besoin du serveur.')}
  else{key=previous;render()}
};
$('el-key').addEventListener('keydown',e=>{if(e.key==='Enter')$('el-save').click()});
$('el-forget').onclick=async()=>{
  await chrome.storage.local.remove(['elevenKey','elevenVoices']);key='';fillVoices([],'');render();
  status('Clé supprimée de Luma. Collez la nouvelle clé puis cliquez « Enregistrer ».');$('el-key').focus();
};
$('el-connect').onclick=()=>loadVoices();
$('el-voice').onchange=()=>chrome.storage.local.set({elevenVoice:$('el-voice').value});

// Read the selection straight from the page (all frames), without relying on a
// content script that may be missing or stale after the extension was updated.
function grabSelection(){
  const field=document.activeElement;
  if(field?.matches?.('input[type="password"]'))return {error:'La lecture des mots de passe est désactivée.'};
  if(field?.matches?.('input,textarea')&&typeof field.selectionStart==='number')return {text:field.value.slice(field.selectionStart,field.selectionEnd).trim()};
  return {text:(getSelection()?.toString()||'').trim()};
}
async function selectionText(tabId){
  let results;
  try{results=await chrome.scripting.executeScript({target:{tabId,allFrames:true},func:grabSelection})}
  catch{results=await chrome.scripting.executeScript({target:{tabId},func:grabSelection}).catch(()=>null)}
  if(!results)throw Error('Luma n’a pas accès à cette page. Rechargez-la (Cmd+R ou F5), sélectionnez le texte, puis rouvrez Luma.');
  const found=results.map(r=>r.result).filter(Boolean);
  const blocked=found.find(r=>r.error);if(blocked&&!found.some(r=>r.text))throw Error(blocked.error);
  const best=found.filter(r=>r.text).sort((a,b)=>b.text.length-a.text.length)[0];
  if(!best)throw Error('Aucun texte sélectionné. Surlignez un passage sur la page, puis cliquez « Lire la sélection ».');
  return best.text;
}
async function pageText(tabId){
  const ask=()=>chrome.tabs.sendMessage(tabId,{type:'READ_TEXT',mode:'page'},{frameId:0});
  let result;
  try{result=await ask()}catch{}
  if(!result){try{await chrome.scripting.executeScript({target:{tabId},files:['reader.js']});result=await ask()}catch{}}
  if(!result)throw Error('Luma n’a pas accès à cette page. Rechargez-la (Cmd+R ou F5), puis rouvrez Luma.');
  if(!result.ok)throw Error(result.error||'Texte de la page indisponible.');
  return result.text;
}

async function playerExists(){
  const contexts=await chrome.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT']});
  return contexts.length>0;
}
async function send(type,extra={}){
  if(type==='PLAY'&&!(await playerExists())){
    try{await chrome.offscreen.createDocument({url:'player.html',reasons:['AUDIO_PLAYBACK'],justification:'Lecture des voix ElevenLabs quand le menu est fermé.'})}
    catch(e){if(!String(e.message).includes('single offscreen'))throw e}
  }else if(!(await playerExists()))return null;
  const answer=await chrome.runtime.sendMessage({target:'luma-player',type,...extra});
  return answer?.state||null;
}
function show(state){if(!state)return;player=state;if(state.message)status(state.message);render()}
chrome.runtime.onMessage.addListener(message=>{if(message?.target==='luma-popup'&&message.type==='EL_STATE')show(message.state)});

async function read(mode){
  try{
    const prefs=await chrome.storage.sync.get({enabled:true});if(!prefs.enabled)throw Error('Activez Luma pour lancer la lecture.');
    let text='Bonjour, je suis votre voix Luma. Les mots, sans les frontières.';
    if(mode!=='preview'){
      const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
      if(!tab?.id||!/^https?:/.test(tab.url||''))throw Error('Ouvrez une page web ordinaire pour lire son texte.');
      text=mode==='selection'?await selectionText(tab.id):await pageText(tab.id);
    }
    if(text.length>MAX_TOTAL)throw Error(`Texte trop long (${text.length.toLocaleString('fr')} caractères). Sélectionnez un passage de moins de ${MAX_TOTAL.toLocaleString('fr')} caractères pour préserver vos crédits.`);
    status('Préparation de la voix ElevenLabs…');
    show(await send('PLAY',{key,voice:$('el-voice').value,text}));
  }catch(e){status(e.message)}
}
for(const mode of ['selection','page','preview'])$('el-'+mode).onclick=()=>read(mode);
$('el-stop').onclick=async()=>show(await send('STOP'));
$('el-pause').onclick=async()=>show(await send(player.status==='paused'?'RESUME':'PAUSE'));

// Startup: saved key + cached voices are shown at once, then refreshed quietly.
(async()=>{
  const saved=await chrome.storage.local.get(['elevenKey','elevenVoices','elevenVoice']);
  key=saved.elevenKey||'';
  if(saved.elevenVoices?.length){fillVoices(saved.elevenVoices,saved.elevenVoice);status('ElevenLabs prêt. Choisissez un texte à lire.')}
  render();
  show(await send('STATUS').catch(()=>null));
  if(key)loadVoices(true);
  else{
    // Older setups: the local server still works if it is running.
    try{const r=await fetch('http://127.0.0.1:8787/health',{signal:AbortSignal.timeout(1500)});if((await r.json()).configured){status('Serveur local détecté. Vous pouvez aussi enregistrer votre clé ici pour ne plus le lancer.');loadVoices(true)}}catch{}
  }
})();
