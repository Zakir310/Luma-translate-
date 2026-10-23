// Fonctions pures : aucune requête réseau, aucune dépendance au DOM ou à Chrome.
export const MAX_SPEECH_CHUNK = 24000; // Marge sous les 32 768 caractères de chrome.tts.
export const baseLanguage = language => (language || '').toLowerCase().split('-')[0];
export const voiceKey = voice => JSON.stringify([voice.lang || '',voice.voiceName]);

function voiceQuality(voice) {
  const name=voice.voiceName.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if (/premium|neural|natural|naturelle|\bhq\b/.test(name)) return {score:100,label:'Qualité supérieure annoncée'};
  if (/enhanced|amelioree?|superieure|\bsiri\b/.test(name)) return {score:70,label:'Voix améliorée annoncée'};
  if (/compact|espeak|microsoft sam|fred|trinoids|bad news|good news|bells|bubbles|whisper|zarvox|boing/.test(name)) return {score:-50,label:''};
  return {score:0,label:''};
}
export function localVoices(all) {
  const seen=new Set();
  return all.filter(voice=>!voice.remote && !voice.extensionId && typeof voice.voiceName==='string' && voice.voiceName.trim() &&
      (!Array.isArray(voice.eventTypes) || voice.eventTypes.includes('end')))
    .filter(voice=>{const key=voiceKey(voice);if(seen.has(key))return false;seen.add(key);return true;});
}
function rank(voices,language,uiLanguage) {
  const desired=language.toLowerCase(),ui=uiLanguage.toLowerCase();
  return [...voices].sort((a,b)=>{
    const score=voice=>voiceQuality(voice).score + ((voice.lang || '').toLowerCase()===desired?15:0) +
      ((voice.lang || '').toLowerCase()===ui?5:0);
    return score(b)-score(a) || a.voiceName.localeCompare(b.voiceName);
  });
}
export function chooseVoice(voices,language,preferred,uiLanguage) {
  const compatible=voices.filter(voice=>baseLanguage(voice.lang)===baseLanguage(language));
  const preferenceApplies=preferred && (!preferred.lang || baseLanguage(preferred.lang)===baseLanguage(language));
  const selected=preferenceApplies && voices.find(voice=>voiceKey(voice)===voiceKey(preferred));
  const fallback=voices.filter(voice=>baseLanguage(voice.lang)===baseLanguage(uiLanguage));
  const voice=selected || rank(compatible.length?compatible:fallback.length?fallback:voices,language,uiLanguage)[0];
  return {voice,fallback:baseLanguage(voice.lang)!==baseLanguage(language),
    voiceNotice:preferenceApplies && !selected?'La voix choisie n’est pas disponible ici ; choix automatique.':''};
}
export function listVoices(voices,uiLanguage) {
  return rank(voices,uiLanguage,uiLanguage).map(voice=>({key:voiceKey(voice),voiceName:voice.voiceName,lang:voice.lang || '',qualityLabel:voiceQuality(voice).label}));
}
export function prepareSpeechText(text) {
  return text.replace(/\r\n?/g,'\n').replace(/[\u00AD\u200B\uFEFF]/g,'')
    .replace(/[\u00A0\u202F]/g,' ').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,'')
    .replace(/[ \t]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}
export function splitForSpeech(text,language) {
  const chunks=[],ends=[];let offset=0;
  try {
    for(const segment of new Intl.Segmenter(language,{granularity:'sentence'}).segment(text)) ends.push(segment.index+segment.segment.length);
  } catch {
    for(const match of text.matchAll(/[.!?。！？]["'’”»\])]*(?:\s+|$)/g)) ends.push(match.index+match[0].length);
  }
  while(offset<text.length) {
    let end=Math.min(offset+MAX_SPEECH_CHUNK,text.length);
    if(end<text.length) {
      const minimum=offset+MAX_SPEECH_CHUNK/2;
      let sentence=0;
      for(const boundary of ends) {if(boundary>end)break;if(boundary>minimum)sentence=boundary;}
      if(sentence) end=sentence;
      else {
        const paragraph=text.lastIndexOf('\n\n',end),space=text.lastIndexOf(' ',end);
        if(paragraph>minimum)end=paragraph+2;
        else if(space>minimum)end=space+1;
      }
      // Ne pas séparer les deux unités UTF-16 d'un emoji lors d'un repli forcé.
      const last=text.charCodeAt(end-1);if(last>=0xD800 && last<=0xDBFF)end--;
    }
    const part=text.slice(offset,end).trim();if(part)chunks.push(part);offset=end;
  }
  return chunks;
}

const previews={
  fr:'Bonjour ! Prends un instant pour écouter cette voix. Je lis les phrases tranquillement, en respectant les pauses et la ponctuation.',
  en:'Hello! Take a moment to listen to this voice. I read at a gentle pace, with natural pauses between sentences.',
  es:'¡Hola! Escucha esta voz un momento. Leo con calma, respetando las pausas y la puntuación.',
  de:'Hallo! Höre dir diese Stimme kurz an. Ich lese ruhig und beachte die Pausen zwischen den Sätzen.',
  it:'Ciao! Ascolta questa voce per un momento. Leggo con calma, rispettando le pause e la punteggiatura.',
  pt:'Olá! Escuta esta voz por um momento. Leio com calma, respeitando as pausas e a pontuação.',
  ar:'مرحباً! استمع إلى هذا الصوت للحظة. أقرأ بهدوء، مع احترام الوقفات وعلامات الترقيم.',
  az:'Salam! Bu səsi bir an dinlə. Cümlələri sakit şəkildə, fasilələrə və durğu işarələrinə riayət edərək oxuyuram.',
  tr:'Merhaba! Bir an bu sesi dinle. Cümleleri sakin bir şekilde, duraklamalara ve noktalama işaretlerine dikkat ederek okuyorum.',
  ru:'Здравствуйте! Послушайте этот голос. Я читаю спокойно, соблюдая паузы и знаки препинания.',
  uk:'Вітаю! Послухайте цей голос. Я читаю спокійно, дотримуючись пауз і розділових знаків.',
  ja:'こんにちは。この声を少し聞いてみてください。句読点に合わせて、ゆっくりと読み上げます。',
  ko:'안녕하세요! 잠시 이 목소리를 들어 보세요. 문장 사이에 자연스럽게 쉬면서 차분하게 읽습니다.',
  zh:'你好！请听一听这个声音。我会平静地朗读，并根据标点符号自然停顿。',
  nl:'Hallo! Luister even naar deze stem. Ik lees rustig, met natuurlijke pauzes tussen de zinnen.',
  pl:'Cześć! Posłuchaj przez chwilę tego głosu. Czytam spokojnie, zachowując pauzy między zdaniami.',
  ro:'Bună! Ascultă această voce pentru un moment. Citesc liniștit, respectând pauzele și semnele de punctuație.',
  el:'Γεια σας! Ακούστε για λίγο αυτή τη φωνή. Διαβάζω ήρεμα, με φυσικές παύσεις ανάμεσα στις προτάσεις.',
  sv:'Hej! Lyssna på den här rösten en stund. Jag läser lugnt, med naturliga pauser mellan meningarna.',
  hi:'नमस्ते! कुछ क्षण इस आवाज़ को सुनिए। मैं वाक्यों के बीच स्वाभाविक विराम के साथ धीरे और शांति से पढ़ता हूँ।',
  vi:'Xin chào! Hãy nghe thử giọng nói này. Tôi đọc chậm rãi, với những khoảng nghỉ tự nhiên giữa các câu.',
  id:'Halo! Dengarkan suara ini sejenak. Saya membaca dengan tenang, dengan jeda alami di antara kalimat.',
  th:'สวัสดี! ลองฟังเสียงนี้สักครู่ ฉันอ่านอย่างนุ่มนวลและเว้นจังหวะตามเครื่องหมายวรรคตอน',
  he:'שלום! הקשיבו לרגע לקול הזה. אני קורא בנחת, עם הפסקות טבעיות בין המשפטים.',
  fa:'سلام! لحظه‌ای به این صدا گوش کنید. جمله‌ها را آرام و با مکث‌های طبیعی می‌خوانم.'
};
export function previewText(language,uiLanguage) {
  const key=baseLanguage(language);
  // Même une langue hors catalogue peut échantillonner sa voix avec des chiffres.
  return previews[key]?{text:previews[key],language}:{text:'1, 2, 3. 4, 5, 6.',language:language || uiLanguage};
}
