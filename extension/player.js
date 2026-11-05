// Offscreen audio player: keeps ElevenLabs playback alive when the popup closes.
import {synthesize,chunks} from './eleven-api.js';
const audio=document.getElementById('audio');
let state={status:'idle',message:'',part:0,parts:0};
let controller=null,url=null,queue=[],job=0,prepared=null;
function emit(patch){state={...state,...patch};chrome.runtime.sendMessage({target:'luma-popup',type:'EL_STATE',state}).catch(()=>{})}
function release(){if(url)URL.revokeObjectURL(url);url=null}
function stop(message='Lecture arrêtée.'){job++;controller?.abort();controller=null;audio.pause();audio.removeAttribute('src');audio.load();release();queue=[];prepared=null;emit({status:'idle',message,part:0,parts:0})}
async function fetchPart(id,request,index){
  return synthesize(request.key,request.voice,queue[index],controller.signal).then(blob=>id===job?blob:null);
}
async function playPart(id,request,index,blob){
  if(id!==job)return;
  release();url=URL.createObjectURL(blob);audio.src=url;
  // Pre-fetch the next part while this one plays, so there is no gap.
  prepared=index+1<queue.length?fetchPart(id,request,index+1).catch(e=>e):null;
  emit({status:'playing',part:index+1,parts:queue.length,message:queue.length>1?`Lecture ElevenLabs · partie ${index+1}/${queue.length}. Vous pouvez fermer ce menu.`:'Lecture ElevenLabs. Vous pouvez fermer ce menu.'});
  try{await audio.play()}catch(e){if(id===job)stop(e.name==='NotSupportedError'?'Audio reçu illisible. Réessayez.':'Lecture impossible : '+e.message)}
  audio.onended=async()=>{
    if(id!==job)return;
    if(index+1>=queue.length)return stop('Lecture ElevenLabs terminée.');
    emit({status:'loading',message:`Préparation de la partie ${index+2}/${queue.length}…`});
    const next=await prepared;
    if(id!==job)return;
    if(next instanceof Error)return stop(next.message);
    if(next)playPart(id,request,index+1,next);
  };
}
async function play(request){
  stop('');const id=job;controller=new AbortController();queue=chunks(request.text);
  emit({status:'loading',part:0,parts:queue.length,message:'Préparation de la voix ElevenLabs…'});
  try{const blob=await fetchPart(id,request,0);if(blob)await playPart(id,request,0,blob)}
  catch(e){if(id===job)stop(e.name==='AbortError'?'Lecture annulée.':e.message)}
}
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message?.target!=='luma-player'||sender.id!==chrome.runtime.id)return;
  if(message.type==='PLAY')play(message);
  else if(message.type==='STOP')stop();
  else if(message.type==='PAUSE'){if(state.status==='playing'){audio.pause();emit({status:'paused',message:'Lecture en pause.'})}}
  else if(message.type==='RESUME'){if(state.status==='paused'){audio.play().catch(()=>{});emit({status:'playing',message:'Lecture ElevenLabs reprise.'})}}
  reply({ok:true,state});
});
