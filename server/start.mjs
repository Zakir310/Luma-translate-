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
const server=createServer({key});
server.on('error',()=>{console.error('Le port 8787 est indisponible. Fermez l’autre serveur Luma avant de réessayer.');process.exitCode=1});
server.listen(8787,'127.0.0.1',()=>console.log('Serveur Luma prêt. Gardez ce terminal ouvert, puis cliquez sur « Connecter et charger les voix » dans l’extension.'));
