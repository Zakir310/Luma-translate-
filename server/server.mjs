import http from 'node:http';
import {pathToFileURL} from 'node:url';

export function createServer({key=process.env.ELEVENLABS_API_KEY,request=fetch}={}) {
  let busy=false;
  return http.createServer(async(req,res)=>{
    const origin=req.headers.origin;
    const allowed=!origin || /^chrome-extension:\/\/[a-p]{32}$/.test(origin);
    const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
    if(!allowed)return send(403,{error:'Origine non autorisée.'});
    if(origin)res.setHeader('Access-Control-Allow-Origin',origin);
    res.setHeader('Vary','Origin');
    res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers','Content-Type');
    if(req.method==='OPTIONS'){res.writeHead(204);return res.end()}
    if(req.url==='/health'&&req.method==='GET')return send(200,{ok:true,configured:!!key});
    if(!key)return send(503,{error:'Configurez ELEVENLABS_API_KEY sur le serveur, puis redémarrez-le.'});
    const voices=req.url==='/voices'&&req.method==='GET';
    const speech=req.url==='/speech'&&req.method==='POST';
    if(!voices&&!speech)return send(404,{error:'Route inconnue.'});
    if(busy)return send(429,{error:'Une requête est déjà en cours. Patientez.'});
    busy=true;
    try{
      let payload;
      if(speech){
        if(!req.headers['content-type']?.startsWith('application/json'))return send(415,{error:'JSON requis.'});
        let body='';
        for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>24000)return send(413,{error:'Texte trop long (5 000 caractères maximum).'});}
        try{payload=JSON.parse(body)}catch{return send(400,{error:'JSON invalide.'})}
        if(typeof payload.text!=='string'||!payload.text.trim()||payload.text.length>5000||typeof payload.voice!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(payload.voice))return send(400,{error:'Choisissez une voix et un texte de 1 à 5 000 caractères.'});
      }
      const url=voices?'https://api.elevenlabs.io/v1/voices':`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(payload.voice)}`;
      const upstream=await request(url,{method:voices?'GET':'POST',headers:{'xi-api-key':key,...(speech?{'Content-Type':'application/json',Accept:'audio/mpeg'}:{})},...(speech?{body:JSON.stringify({text:payload.text,model_id:'eleven_multilingual_v2',voice_settings:{stability:0.5,similarity_boost:0.75}})}:{}),signal:AbortSignal.timeout(60000)});
      if(!upstream.ok){const messages={401:'Clé ElevenLabs refusée.',403:'Permission ElevenLabs manquante : accès aux voix et à Text to Speech requis.',429:'Quota ou limite ElevenLabs atteint.'};return send(upstream.status,messages[upstream.status]?{error:messages[upstream.status]}:{error:'ElevenLabs indisponible. Réessayez plus tard.'})}
      if(voices){const data=await upstream.json();return send(200,{voices:(data.voices||[]).map(v=>({voice_id:v.voice_id,name:v.name}))})}
      if(!upstream.headers.get('content-type')?.startsWith('audio/'))return send(502,{error:'Réponse audio ElevenLabs invalide.'});
      const audio=Buffer.from(await upstream.arrayBuffer());
      res.writeHead(200,{'Content-Type':'audio/mpeg','Cache-Control':'no-store'});res.end(audio);
    }catch{return send(502,{error:'Connexion ElevenLabs impossible ou délai dépassé.'})}
    finally{busy=false}
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const server=createServer();
  server.on('error',()=>{console.error('Serveur indisponible : vérifiez que le port 8787 est libre.');process.exitCode=1});
  server.listen(8787,'127.0.0.1',()=>console.log('Luma : serveur local démarré sur le port 8787. Gardez cette fenêtre ouverte.'));
}
