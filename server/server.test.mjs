import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from './server.mjs';
async function serve(options,fn){const s=createServer(options);await new Promise(r=>s.listen(0,'127.0.0.1',r));try{await fn(`http://127.0.0.1:${s.address().port}`)}finally{await new Promise(r=>s.close(r))}}
test('missing key and hostile origin are rejected',async()=>{
 await serve({key:''},async base=>{
  assert.equal((await fetch(base+'/voices')).status,503);
  assert.equal((await fetch(base+'/health',{headers:{Origin:'https://evil.example'}})).status,403);
  assert.equal((await (await fetch(base+'/health')).json()).configured,false);
 });
});
test('voices and speech use upstream API; key never sent to client',async()=>{
 const calls=[];
 await serve({key:'test-only',request:async(url,options)=>{calls.push({url,options});return url.endsWith('/voices')?Response.json({voices:[{voice_id:'voice123',name:'Test voice'}]}):new Response(new Uint8Array([1,2,3]),{headers:{'Content-Type':'audio/mpeg'}})}},async base=>{
  const voices=await (await fetch(base+'/voices')).json();assert.equal(voices.voices[0].name,'Test voice');assert.ok(!JSON.stringify(voices).includes('test-only'));
  const response=await fetch(base+'/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({voice:'voice123',text:'Bonjour'})});
  assert.equal(response.headers.get('content-type'),'audio/mpeg');assert.equal((await response.arrayBuffer()).byteLength,3);
  assert.equal(calls[1].options.headers['xi-api-key'],'test-only');assert.equal(JSON.parse(calls[1].options.body).model_id,'eleven_multilingual_v2');
  const invalid=await fetch(base+'/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({voice:'../bad',text:'x'})});assert.equal(invalid.status,400);
  const long=await fetch(base+'/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({voice:'voice123',text:'x'.repeat(5001)})});assert.equal(long.status,400);assert.equal(calls.length,2);
 });
});
test('quota errors are translated without upstream details',async()=>{
 await serve({key:'test-only',request:async()=>new Response('private details',{status:429})},async base=>{const r=await fetch(base+'/voices');assert.equal(r.status,429);assert.deepEqual(await r.json(),{error:'Quota ou limite ElevenLabs atteint.'})});
});
