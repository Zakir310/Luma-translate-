// Browser-only adapter. Never included by the Chrome extension popup.
import {DEFAULTS} from './shared.js';
const listeners=[];
let stored={};
try{stored=JSON.parse(localStorage.getItem('luma-preview')||'{}')}catch{}
let history=[];
const inactive={ok:true,active:false,total:0,completed:0};
window.chrome={
 storage:{sync:{async get(defaults){return {...defaults,...stored}},async set(patch){const changes=Object.fromEntries(Object.entries(patch).map(([k,v])=>[k,{newValue:v}]));stored={...stored,...patch};try{localStorage.setItem('luma-preview',JSON.stringify(stored))}catch{}listeners.forEach(fn=>fn(changes,'sync'))}},onChanged:{addListener(fn){listeners.push(fn)}}},
 tabs:{async query(){return []}},
 runtime:{async sendMessage(message){switch(message.type){
 case 'GET_HISTORY':return {ok:true,history};
 case 'CLEAR_HISTORY':history=[];return {ok:true};
 case 'SPEECH_VOICES':return {ok:true,voices:[]};
 case 'SPEECH_STATUS':return inactive;
 default:return {ok:false,error:'Cette action nécessite l’extension Chrome installée.'};
 }}}
};
document.body.classList.add('web-preview');
const banner=document.createElement('aside');banner.className='preview-banner';banner.textContent='APERÇU WEB · Les actions sur les pages et les voix nécessitent Chrome + Luma.';document.body.prepend(banner);
await import('./popup.js');
