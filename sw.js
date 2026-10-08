// Cache only public static site assets and the public editorial snapshot.
// NEVER cache personal API responses or credentials in this service worker.
const CACHE_NAME='starnews-public-v43-20261008-v1';
const ASSETS=['./','./index.html','./app.js','./style.css','./seed.js','./news.json','./manifest.webmanifest','./assets/icon.svg','./assets/icon-180.png'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('starnews-')&&k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
 const url=new URL(req.url),isNews=url.pathname.endsWith('/news.json');
 // Limit service worker to listed public assets. Any future authenticated route must not be cached.
 const known=ASSETS.some(asset=>new URL(asset,self.registration.scope).pathname===url.pathname);
 if(!known)return;
 const networkFirst=req.mode==='navigate'||isNews;
 if(networkFirst){
  event.respondWith(fetch(req).then(r=>{
   if(r.ok){const copy=r.clone();caches.open(CACHE_NAME).then(c=>c.put(req,copy)).catch(()=>{});}
   return r;
  }).catch(()=>caches.match(req).then(c=>c||caches.match('./index.html'))));
 }else{
  event.respondWith(caches.match(req).then(c=>c||fetch(req).then(r=>{
   if(r.ok){const copy=r.clone();caches.open(CACHE_NAME).then(cache=>cache.put(req,copy)).catch(()=>{});}
   return r;
  })));
 }
});