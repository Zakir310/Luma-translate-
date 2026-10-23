const $=id=>document.getElementById(id);
const base='http://127.0.0.1:8787';
let url,controller,busy=false,connected=false;
function status(text){$('el-status').textContent=text}
function render(){for(const id of ['el-selection','el-page','el-preview'])$(id).disabled=busy||!connected;$('el-connect').disabled=busy;$('el-voice').disabled=busy||!connected;$('el-stop').disabled=!busy&&!url}
function stop(){controller?.abort();$('el-audio').pause();$('el-audio').removeAttribute('src');$('el-audio').load();if(url)URL.revokeObjectURL(url);url=null;$('el-audio').hidden=true;render()}
async function call(path,options={}){
  let response;
  try{response=await fetch(base+path,{...options,signal:controller?.signal||AbortSignal.timeout(15000)})}catch(error){if(error.name==='AbortError')throw error;throw Error('Serveur inaccessible. Lancez le serveur du ZIP sur cet ordinateur (port 8787).')}
  if(!response.ok){const data=await response.json().catch(()=>({}));throw Error(data.error||'Erreur du serveur ElevenLabs.')}
  return response;
}
$('el-connect').onclick=async()=>{
  busy=true;render();status('Connexion à ElevenLabs…');
  try{const {voices}=await (await call('/voices')).json();if(!voices?.length)throw Error('Aucune voix disponible sur ce compte ElevenLabs.');$('el-voice').replaceChildren(...voices.map(v=>{const o=document.createElement('option');o.value=v.voice_id;o.textContent=v.name;return o}));const saved=await chrome.storage.local.get('elevenVoice');if(voices.some(v=>v.voice_id===saved.elevenVoice))$('el-voice').value=saved.elevenVoice;connected=true;status('ElevenLabs connecté. Choisissez une voix puis un texte à lire.')}catch(e){connected=false;status(e.message)}finally{busy=false;render()}
};
$('el-voice').onchange=()=>chrome.storage.local.set({elevenVoice:$('el-voice').value});
async function read(mode){
  if(busy)return;stop();busy=true;controller=new AbortController();render();status('Préparation de la voix ElevenLabs…');
  try{
    const prefs=await chrome.storage.sync.get({enabled:true});if(!prefs.enabled)throw Error('Activez Luma pour lancer la lecture.');
    let text='Bonjour, je suis votre voix Luma. Les mots, sans les frontières.';
    if(mode!=='preview'){
      const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
      if(!tab?.id||!/^https?:/.test(tab.url||''))throw Error('Ouvrez une page web ordinaire pour lire son texte.');
      let result;
      try{result=await chrome.tabs.sendMessage(tab.id,{type:'READ_TEXT',mode},{frameId:0})}catch{await chrome.scripting.executeScript({target:{tabId:tab.id},files:['reader.js']});result=await chrome.tabs.sendMessage(tab.id,{type:'READ_TEXT',mode},{frameId:0})}
      if(!result?.ok)throw Error(result?.error||'Texte indisponible.');text=result.text;
    }
    if(text.length>5000)throw Error('Sélectionnez un passage plus court (5 000 caractères maximum). Aucun texte envoyé.');
    const response=await call('/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,voice:$('el-voice').value})});
    const blob=await response.blob();if(controller.signal.aborted)return;
    url=URL.createObjectURL(blob);$('el-audio').src=url;$('el-audio').hidden=false;
    await $('el-audio').play();status('Lecture ElevenLabs. Gardez ce menu ouvert. Utilisez le lecteur pour mettre en pause.');
  }catch(e){status(e.name==='AbortError'?'Lecture annulée.':e.message)}finally{busy=false;controller=null;render()}
}
for(const mode of ['selection','page','preview'])$('el-'+mode).onclick=()=>read(mode);
$('el-stop').onclick=()=>{stop();status('Lecture arrêtée.')};
$('el-audio').onended=()=>status('Lecture ElevenLabs terminée.');
$('el-audio').onerror=()=>status('Impossible de lire cet audio. Reconnectez ElevenLabs et réessayez.');
window.addEventListener('pagehide',stop);
