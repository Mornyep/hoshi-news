/* Local browser profiles, not authenticated accounts. No remote or secret storage. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else {const safe=name=>{try{return root[name];}catch{return {getItem:()=>null,setItem:()=>{throw new Error('Storage unavailable');},removeItem:()=>{}};}};root.StarnewsProfiles=factory(safe('localStorage'),safe('sessionStorage'),root.crypto);}})(typeof window==='undefined'?globalThis:window,(store,session,crypto)=>{
  'use strict';
  const INDEX='starnews:profiles:v1',ACTIVE='starnews:active-profile:v1';
  const valid=id=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id);
  const read=key=>{try{return JSON.parse(store.getItem(key)||'null');}catch{return null;}};
  const list=()=>{const data=read(INDEX);return Array.isArray(data)?data.filter(x=>valid(x?.id)&&typeof x.name==='string').slice(0,20):[];};
  const active=()=>{try{const id=session.getItem(ACTIVE);return list().find(p=>p.id===id)||null;}catch{return null;}};
  const prefix=()=>active()?'starnews:profile:'+active().id:null;
  function select(id){if(!list().some(p=>p.id===id))throw new Error('Unknown local profile');session.setItem(ACTIVE,id);}
  function create(name){name=String(name||'').trim().slice(0,60);if(!name)throw new Error('Profile name required');const profiles=list();if(profiles.length>=20)throw new Error('Profile limit reached');const row={id:crypto.randomUUID(),name};store.setItem(INDEX,JSON.stringify([...profiles,row]));select(row.id);return row;}
  function focus(value){const key=prefix();if(!key)throw new Error('Choose a local profile');if(value===undefined)return String(read(key+':focus')||'');store.setItem(key+':focus',JSON.stringify(String(value).slice(0,2000)));}
  function exit(){session.removeItem(ACTIVE);}
  function importLegacy(){const key=prefix();if(!key)throw new Error('Choose a local profile');const old=read('starnews:guest:v4.3');if(old?.version===43)store.setItem(key+':preferences',JSON.stringify(old));}
  function remove(id){if(!list().some(p=>p.id===id))throw new Error('Unknown local profile');const scope='starnews:profile:'+id+':';const keys=[];for(let i=0;i<store.length;i++){const key=store.key(i);if(key?.startsWith(scope))keys.push(key);}for(const key of keys)store.removeItem(key);store.setItem(INDEX,JSON.stringify(list().filter(p=>p.id!==id)));if(active()?.id===id||session.getItem(ACTIVE)===id)exit();}
  return Object.freeze({list,active,prefix,create,select,exit,focus,importLegacy,remove});
});
