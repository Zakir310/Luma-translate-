// Shared ElevenLabs helpers (popup + background player). The key lives only in
// chrome.storage.local on this computer; it is never synced nor sent elsewhere.
export const API='https://api.elevenlabs.io/v1';
export const SERVER='http://127.0.0.1:8787';
export const CHUNK=4500, MAX_TOTAL=20000;
const REASONS={
  invalid_api_key:'La clé est invalide ou révoquée. Créez une nouvelle clé sur ElevenLabs.',
  missing_permissions:'La clé n’a pas les bonnes permissions : activez « Voices : Read » et « Text to Speech ».',
  insufficient_permissions:'La clé n’a pas les bonnes permissions : activez « Voices : Read » et « Text to Speech ».',
  quota_exceeded:'Crédits ElevenLabs épuisés. Vérifiez votre abonnement.',
  unusual_activity_detected:'ElevenLabs bloque le compte gratuit (VPN ou activité inhabituelle). Désactivez le VPN ou passez à une offre payante.',
  system_busy:'ElevenLabs est surchargé. Réessayez dans un instant.',
  voice_not_found:'Cette voix n’existe plus. Rechargez les voix et choisissez-en une autre.',
};
export async function apiError(response){
  const data=await response.json().catch(()=>null);
  const code=data?.detail?.status;
  if(Object.hasOwn(REASONS,code))return `${REASONS[code]} (HTTP ${response.status})`;
  if(data?.error)return data.error; // message du serveur local
  return ({401:'Clé refusée par ElevenLabs. Vérifiez la clé et ses permissions.',403:'Accès refusé par ElevenLabs.',429:'Limite ElevenLabs atteinte. Patientez un peu.'})[response.status]||`ElevenLabs indisponible (HTTP ${response.status}).`;
}
export function looksLikeKey(key){return /^[A-Za-z0-9_-]{20,200}$/.test(key)}
export async function listVoices(key){
  let response;
  try{response=key?await fetch(`${API}/voices`,{headers:{'xi-api-key':key},signal:AbortSignal.timeout(30000)}):await fetch(`${SERVER}/voices`,{signal:AbortSignal.timeout(70000)})}
  catch(e){throw Error(key?'Connexion à ElevenLabs impossible. Vérifiez Internet.':'Aucune clé enregistrée et serveur local absent. Collez votre clé ElevenLabs ci-dessus puis cliquez « Enregistrer ».')}
  if(!response.ok)throw Error(await apiError(response));
  const data=await response.json();
  return (data.voices||[]).map(v=>({voice_id:v.voice_id,name:v.name}));
}
export async function synthesize(key,voice,text,signal){
  let response;
  try{
    response=key
      ?await fetch(`${API}/text-to-speech/${encodeURIComponent(voice)}`,{method:'POST',headers:{'xi-api-key':key,'Content-Type':'application/json',Accept:'audio/mpeg'},body:JSON.stringify({text,model_id:'eleven_multilingual_v2',voice_settings:{stability:0.5,similarity_boost:0.75}}),signal})
      :await fetch(`${SERVER}/speech`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,voice}),signal});
  }catch(e){if(signal?.aborted)throw e;throw Error(key?'Connexion à ElevenLabs impossible. Vérifiez Internet.':'Serveur local absent. Enregistrez votre clé dans Luma pour ne plus en avoir besoin.')}
  if(!response.ok)throw Error(await apiError(response));
  return response.blob();
}
// Split long text into pieces ElevenLabs accepts, on paragraph/sentence boundaries.
export function chunks(text,size=CHUNK){
  const out=[];let rest=text.trim();
  while(rest.length>size){
    const slice=rest.slice(0,size);
    let cut=Math.max(slice.lastIndexOf('\n'),slice.lastIndexOf('. '),slice.lastIndexOf('! '),slice.lastIndexOf('? '));
    if(cut<size*0.5)cut=slice.lastIndexOf(' ');
    if(cut<=0)cut=size; else cut+=1;
    out.push(rest.slice(0,cut).trim());rest=rest.slice(cut).trim();
  }
  if(rest)out.push(rest);
  return out;
}
