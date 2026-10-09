// Optional private-service UI; all identities, credentials and network are fixtures.
const {JSDOM,VirtualConsole}=require('jsdom'),fs=require('node:fs'),assert=require('node:assert/strict');
const tick=()=>new Promise(r=>setTimeout(r,0));
async function fixture(){
 const errors=[],calls=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{url:'https://example.test/?login_state=fixture-state#access_token=fixture-token&expires_in=3600',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc}),w=dom.window;
 w.crypto.randomUUID=()=>require('node:crypto').randomUUID();w.AbortSignal=AbortSignal;w.AbortController=AbortController;
 w.eval(fs.readFileSync('personal-profile.js','utf8'));const a=w.StarnewsProfiles.create('Fixture A'),b=w.StarnewsProfiles.create('Fixture B');w.StarnewsProfiles.select(a.id);
 const endpoint='https://fixture.workers.dev',prefix=w.StarnewsProfiles.prefix();w.localStorage.setItem(prefix+':private:endpoint',endpoint);w.localStorage.setItem(prefix+':private:login',JSON.stringify({state:'fixture-state',email:'fixture@example.test',endpoint,expires:Date.now()+60000}));
 let language='en',release;
 w.StarnewsBridge={getLocale:()=>language,getArticle:()=>({title:'Fixture report',summary:'Supplied excerpt',url:'https://example.org/report'}),getEvidenceArticle:()=>({title:'Fixture report'}),getTopics:()=>[],getArticles:()=>[]};
 w.fetch=async(url,init={})=>{calls.push({url,init});let data={ok:true};
  if(url.endsWith('/health'))data={enabled:true,auth:{url:'https://fixture.supabase.co',anonKey:'fixture-public-anon'},publicPool:false};
  else if(url.endsWith('/auth/v1/user'))data={email:'fixture@example.test',email_confirmed_at:'2026-10-09'};
  else if(url.endsWith('/preferences'))data={preferences:{memory:'A-fixture-memory'},keys:['groq']};
  else if(url.endsWith('/chat'))return new Promise(r=>release=()=>r({ok:true,status:200,json:async()=>({answer:'A-fixture-late-answer'})}));
  return {ok:true,status:200,json:async()=>data};
 };
 w.eval(fs.readFileSync('personal-evidence.js','utf8'));w.eval(fs.readFileSync('personal-ai.js','utf8'));for(let i=0;i<5;i++)await tick();
 assert.equal(w.document.querySelector('#personalAISigned').hidden,false);
 function ask(){w.document.querySelector('#personalAIConsent').checked=true;w.document.querySelector('#personalAIQuestion').value='fixture question';w.document.querySelector('#personalAIConsent').closest('form').querySelector('button').click();}
 return {w,a,b,calls,errors,ask,release:()=>release(),language:l=>language=l,close:()=>w.close()};
}
(async()=>{
 for(const scenario of ['logout','profile-switch','profile-exit','language-change','provider-change']){
  const f=await fixture();f.ask();await tick();const call=f.calls.find(x=>x.url.endsWith('/chat'));assert(call);assert.equal(call.init.cache,'no-store');assert.equal(call.init.credentials,'omit');assert.equal(call.init.redirect,'error');
  if(scenario==='logout')f.w.document.querySelector('#personalAISigned').querySelector('button').click();
  if(scenario==='profile-switch'||scenario==='profile-exit'){
   if(scenario==='profile-switch')f.w.document.querySelector('#personalProfileSelect').value=f.b.id;
   const label=scenario==='profile-switch'?'Switch and clear session':'Exit and clear session';Array.from(f.w.document.querySelector('#personalProfileSelect').closest('form').querySelectorAll('button')).find(b=>b.textContent===label).click();
  }
  if(scenario==='language-change'){f.language('ja');f.w.dispatchEvent(new f.w.Event('starnews:locale'));}
  if(scenario==='provider-change')f.w.document.querySelector('#personalAIProvider').value='gemini';
  await tick();
  if(['logout','profile-switch','profile-exit'].includes(scenario)){
   assert.equal(f.w.document.querySelector('#personalAISigned').hidden,true,'Exit must work during a pending request');assert.equal(call.init.signal.aborted,true);
  }
  if(scenario==='profile-switch')assert.equal(f.w.StarnewsProfiles.active().id,f.b.id);
  if(scenario==='profile-exit')assert.equal(f.w.StarnewsProfiles.active(),null);
  f.release();await tick();await tick();assert.equal(f.w.document.querySelector('#personalAIAnswer').textContent,'','Late response cannot cross personal context');
  assert.deepEqual(f.errors.filter(e=>!e.startsWith('Not implemented: navigation')),[]);f.close();console.log(scenario+' late-response isolation passed');
 }
})().catch(e=>{console.error(e);process.exitCode=1});
