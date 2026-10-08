const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const origin='https://example.test',scope=origin+'/hoshi-news/';
const handlers={},entries=new Map();let offline=false,seen=[];
class SiteRequest extends Request{constructor(input,options){super(typeof input==='string'?new URL(input,scope):input,options)}}
const cache={addAll:async requests=>{assert(requests.every(r=>r.cache==='reload'));},put:async(r,v)=>entries.set(r.url,v)};
vm.runInNewContext(fs.readFileSync('sw.js','utf8'),{Request:SiteRequest,Response,Headers,URL,Promise,
  self:{location:{origin},registration:{scope},addEventListener:(name,fn)=>handlers[name]=fn,skipWaiting:async()=>{},clients:{claim:async()=>{}}},
  caches:{open:async()=>cache,match:async r=>entries.get(typeof r==='string'?new URL(r,scope).href:r.url),keys:async()=>[],delete:async()=>true},
  fetch:async req=>{seen.push(req);if(offline)throw new Error('offline');return new Response('{"fresh":true}',{headers:{'Content-Type':'application/json'}});}});
async function get(name,headers){let result;handlers.fetch({request:new SiteRequest(scope+name,{headers}),respondWith:p=>result=p});return result?await result:null;}
(async()=>{
  let install;handlers.install({waitUntil:p=>install=p});await install;
  entries.set(scope+'ai-briefs.json',new Response('{"stale":true}'));
  assert.deepEqual(await (await get('ai-briefs.json')).json(),{fresh:true});assert.equal(seen.at(-1).cache,'no-store');
  await get('app.js');assert.equal(seen.at(-1).cache,'no-cache');
  offline=true;entries.delete(scope+'public-status.json');
  const missing=await get('public-status.json');assert.equal(missing.status,503);assert.deepEqual(await missing.json(),{error:'offline'});
  const old=await get('ai-briefs.json');assert.equal(old.headers.get('X-Starnews-Cache'),'offline');assert.deepEqual(await old.json(),{fresh:true});
  assert.equal(await get('ai-briefs.json',{Authorization:'Bearer TEST'}),null);
  assert.equal(await get('private-api'),null);
  console.log('SW reload install, fresh public data, shell validation, offline JSON and private route exclusion passed');
})().catch(e=>{console.error(e);process.exitCode=1});
