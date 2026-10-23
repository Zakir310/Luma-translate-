import readline from 'node:readline';
import {createServer} from './server.mjs';
let key=process.env.ELEVENLABS_API_KEY;
if(!key){
  if(!process.stdin.isTTY){console.error('Ouvrez un terminal interactif ou configurez ELEVENLABS_API_KEY.');process.exit(1)}
  process.stdout.write('Clé ElevenLabs (saisie masquée, non enregistrée) : ');
  readline.emitKeypressEvents(process.stdin);process.stdin.setRawMode(true);process.stdin.resume();
  key=await new Promise(resolve=>{
    let value='';
    const input=(text,event)=>{
      if(event?.ctrl&&event.name==='c'){process.stdin.setRawMode(false);process.exit(0)}
      if(event?.name==='return'){
        process.stdin.off('keypress',input);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');resolve(value.trim());
      }else if(event?.name==='backspace'){value=value.slice(0,-1)}
      else if(text&&!event?.ctrl&&!/\p{C}/u.test(text)){value+=text}
    };process.stdin.on('keypress',input);
  });
}
if(!key){console.error('Clé manquante. Relancez ce programme.');process.exit(1)}
if(/\s/.test(key)||key.includes('=')||key.includes('"')||key.includes("'")){
  console.error('Saisie incorrecte : collez uniquement la clé, sans commande, guillemets ni ELEVENLABS_API_KEY=.');process.exit(1);
}
const server=createServer({key});
server.on('error',()=>{console.error('Le port 8787 est indisponible. Fermez l’autre serveur Luma avant de réessayer.');process.exitCode=1});
server.listen(8787,'127.0.0.1',async()=>{
  console.log('Serveur local démarré. Vérification de l’accès aux voix ElevenLabs…');
  try{
    const response=await fetch('http://127.0.0.1:8787/voices',{signal:AbortSignal.timeout(65000)});
    const data=await response.json();
    if(!response.ok){console.error(data.error);console.error('Après correction : Ctrl+C, puis node start.mjs pour saisir la clé à nouveau.');return}
    console.log(`ElevenLabs connecté : ${data.voices.length} voix disponibles. Gardez ce terminal ouvert, puis connectez les voix dans Luma.`);
  }catch{console.error('Vérification impossible. Réessayez depuis le bouton de connexion de Luma.')}
});
