const CACHE_NAME = 'starnews-onescreen-20261008-v4';
const ASSETS=['./','./index.html','./news.json','./manifest.webmanifest','./assets/icon.svg','./assets/icon-180.png'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(names=>Promise.all(names.filter(name=>name.startsWith('starnews-')&&name!==CACHE_NAME).map(name=>caches.delete(name)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
  const pathname=new URL(req.url).pathname;
  if(req.mode==='navigate'||pathname.endsWith('/news.json')){
    event.respondWith(fetch(req).then(response=>{
      if(response.ok){const clone=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(req,clone));}
      return response;
    }).catch(()=>caches.match(req).then(cached=>cached||caches.match('./index.html'))));
  }else{
    event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(response=>{
      if(response.ok){const clone=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(req,clone));}
      return response;
    })));
  }
});
