// Cache only public static site assets and the public editorial snapshot.
// NEVER cache personal API responses or credentials in this service worker.
const CACHE_NAME='starnews-public-news-v52-20261009-temporary-profile';
const ASSETS=['./','./index.html','./app.js','./reading-position.js','./locales.js','./personal-evidence.js','./personal-profile.js','./personal-ai.js','./personal-ai.css','./personal-config.js','./style.css','./seed.js','./news.json','./ai-briefs.json','./archive-stories.json','./manifest.webmanifest','./assets/icon.svg','./assets/icon-180.png'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(ASSETS.map(asset=>new Request(asset,{cache:'reload'})))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('starnews-')&&k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET'||req.headers.has('Authorization')||new URL(req.url).origin!==self.location.origin)return;
 const url=new URL(req.url),isNews=['news.json','ai-briefs.json','archive-stories.json','public-status.json'].some(name=>url.pathname.endsWith('/'+name));
 // Limit service worker to listed public assets. Any future authenticated route must not be cached.
 const known=isNews||ASSETS.some(asset=>new URL(asset,self.registration.scope).pathname===url.pathname);
 if(!known)return;
 const networkFirst=req.mode==='navigate'||isNews||/\.(js|css)$/.test(url.pathname);
 if(networkFirst){
  event.respondWith(fetch(new Request(req,{cache:isNews?'no-store':'no-cache'})).then(r=>{
   if(r.ok){const copy=r.clone();caches.open(CACHE_NAME).then(c=>c.put(req,copy)).catch(()=>{});}
   return r;
  }).catch(()=>caches.match(req).then(c=>{
   if(c&&isNews){const headers=new Headers(c.headers);headers.set('X-Starnews-Cache','offline');return new Response(c.body,{status:c.status,headers});}
   return c||(isNews?new Response('{"error":"offline"}',{status:503,headers:{'Content-Type':'application/json'}}):caches.match('./index.html'));
  })));
 }else{
  event.respondWith(caches.match(req).then(c=>c||fetch(req).then(r=>{
   if(r.ok){const copy=r.clone();caches.open(CACHE_NAME).then(cache=>cache.put(req,copy)).catch(()=>{});}
   return r;
  })));
 }
});
