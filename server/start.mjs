import readline from 'node:readline';
import {createServer} from './server.mjs';

const [major]=process.versions.node.split('.').map(Number);
if(major<18){console.error(`Node.js ${process.versions.node} est trop ancien. Installez Node.js 22 depuis https://nodejs.org puis relancez.`);process.exit(1)}

const PORT=8787;
const server=createServer({key:''});

async function existingLuma(){
  try{const r=await fetch(`http://127.0.0.1:${PORT}/health`,{signal:AbortSignal.timeout(2000)});return (await r.json()).app==='luma'}catch{return false}
}

// Listen first so Luma can see the server even before the key is typed.
await new Promise(resolve=>{
  server.once('error',async error=>{
    if(error.code==='EADDRINUSE'){
      console.error(await existingLuma()
        ?'Un serveur Luma tourne déjà dans une autre fenêtre. Utilisez-la, ou fermez-la (Ctrl+C) avant de relancer.'
        :`Le port ${PORT} est occupé par un autre programme. Fermez-le ou redémarrez l’ordinateur, puis relancez.`);
    }else console.error(`Impossible de démarrer le serveur : ${error.code||error.message}`);
    process.exit(1);
  });
  server.listen(PORT,'127.0.0.1',resolve);
});
console.log(`Luma : serveur local démarré sur http://127.0.0.1:${PORT}. Gardez cette fenêtre ouverte.`);

function askKey(){
  if(!process.stdin.isTTY){console.error('Ouvrez un terminal interactif ou configurez ELEVENLABS_API_KEY.');process.exit(1)}
  process.stdout.write('Clé ElevenLabs (saisie masquée, non enregistrée) : ');
  readline.emitKeypressEvents(process.stdin);process.stdin.setRawMode(true);process.stdin.resume();
  return new Promise(resolve=>{
    let value='';
    const input=(text,event)=>{
      if(event?.ctrl&&event.name==='c'){process.stdin.setRawMode(false);process.exit(0)}
      if(event?.name==='return'||event?.name==='enter'){
        process.stdin.off('keypress',input);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');resolve(value.trim());
      }else if(event?.name==='backspace'){value=value.slice(0,-1)}
      else if(text&&!event?.ctrl&&!/\p{C}/u.test(text)){value+=text}
    };process.stdin.on('keypress',input);
  });
}

let key=process.env.ELEVENLABS_API_KEY?.trim();
while(true){
  if(!key)key=await askKey();
  if(!key){console.error('Clé vide. Collez votre clé puis appuyez sur Entrée.');continue}
  if(/\s/.test(key)||/[="']/.test(key)){console.error('Saisie incorrecte : collez uniquement la clé, sans commande, guillemets ni ELEVENLABS_API_KEY=.');key='';continue}
  server.setKey(key);
  console.log('Vérification de l’accès aux voix ElevenLabs…');
  try{
    const response=await fetch(`http://127.0.0.1:${PORT}/voices`,{signal:AbortSignal.timeout(65000)});
    const data=await response.json();
    if(response.ok){console.log(`ElevenLabs connecté : ${data.voices.length} voix disponibles. Gardez cette fenêtre ouverte, puis cliquez « Connecter » dans Luma.`);break}
    console.error(data.error);
    if(response.status===401||response.status===403){server.setKey('');key='';console.error('Saisissez une autre clé (ou Ctrl+C pour quitter).');continue}
    break;
  }catch{console.error('Vérification impossible (connexion Internet ?). Le serveur reste ouvert : réessayez depuis Luma.');break}
}
