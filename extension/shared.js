export const LANGUAGES = [
  ['fr','Français','🇫🇷'],['en','Anglais','🇬🇧'],['es','Espagnol','🇪🇸'],
  ['de','Allemand','🇩🇪'],['it','Italien','🇮🇹'],['pt','Portugais','🇵🇹'],
  ['ar','Arabe','🇸🇦'],['az','Azerbaïdjanais','🇦🇿'],['tr','Turc','🇹🇷'],
  ['ru','Russe','🇷🇺'],['uk','Ukrainien','🇺🇦'],['ja','Japonais','🇯🇵'],
  ['ko','Coréen','🇰🇷'],['zh-CN','Chinois simplifié','🇨🇳'],['nl','Néerlandais','🇳🇱'],
  ['pl','Polonais','🇵🇱'],['ro','Roumain','🇷🇴'],['el','Grec','🇬🇷'],
  ['sv','Suédois','🇸🇪'],['hi','Hindi','🇮🇳'],['vi','Vietnamien','🇻🇳'],
  ['id','Indonésien','🇮🇩'],['th','Thaï','🇹🇭'],['he','Hébreu','🇮🇱'],['fa','Persan','🇮🇷']
];
export const DEFAULTS = {enabled:true, source:'auto', target:'fr', historyEnabled:true, pageBold:true, readRate:0.95, readVoice:null};
export const MAX_TEXT = 4000;
export const isLanguage = code => LANGUAGES.some(([id]) => id === code);
export const languageName = code => code === 'auto' ? 'Détection auto' : LANGUAGES.find(([id])=>id===code)?.[1] || code;
export function normalizeSettings(value) {
  return {enabled: value.enabled !== false, source: value.source === 'auto' || isLanguage(value.source) ? value.source : 'auto',
    target:isLanguage(value.target) ? value.target : 'fr', historyEnabled:value.historyEnabled !== false, pageBold:value.pageBold !== false,
    readRate:[0.8,0.9,0.95,1,1.2,1.5].includes(value.readRate) ? value.readRate : DEFAULTS.readRate,
    readVoice:value.readVoice && typeof value.readVoice.voiceName==='string' && value.readVoice.voiceName.trim() && value.readVoice.voiceName.length<=200 &&
      typeof value.readVoice.lang==='string' && (value.readVoice.lang==='' || /^[a-z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(value.readVoice.lang))?
      {voiceName:value.readVoice.voiceName,lang:value.readVoice.lang}:null};
}
