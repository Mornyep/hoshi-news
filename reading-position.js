/* Optional local reading positions. No network, account data, or article text. */
(() => {
  'use strict';
  const storageKey=(window.StarnewsProfiles?.prefix()||'starnews:temporary')+':reading-positions:v1';
  let records={},temporary=!window.StarnewsProfiles?.active();
  const hash=value=>{let h=2166136261;for(const c of value){h^=c.codePointAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(16);};
  try{
    const parsed=JSON.parse(localStorage.getItem(storageKey)||'{}');
    if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed)){
      records=Object.fromEntries(Object.entries(parsed).filter(([key,r])=>/^[a-f0-9]+:(zh-CN|zh-TW|ja|en):(brief|personal|verify)$/.test(key)&&r&&Number.isFinite(r.ratio)&&r.ratio>=0&&r.ratio<=1&&Number.isFinite(r.updated)&&Date.now()-r.updated<90*86400000&&typeof r.fingerprint==='string').slice(0,200));
    }
  }catch{}
  const persist=()=>{if(temporary)return;try{localStorage.setItem(storageKey,JSON.stringify(records));}catch{}};
  window.StarnewsReading={
    key:(url,locale,lens)=>hash(url)+':'+locale+':'+lens,
    fingerprint:text=>hash(text)+':'+text.length,
    get:key=>records[key],
    save(key,fingerprint,ratio){
      if(!Number.isFinite(ratio))return;
      records[key]={fingerprint,ratio:Math.max(0,Math.min(1,ratio)),updated:Date.now()};
      records=Object.fromEntries(Object.entries(records).sort((a,b)=>b[1].updated-a[1].updated).slice(0,200));persist();
    },
    reset(key){delete records[key];persist();},
    clear(){records={};try{localStorage.removeItem(storageKey);}catch{}},
    temporary(value){temporary=Boolean(value)||!window.StarnewsProfiles?.active();if(temporary)this.clear();}
  };
})();
