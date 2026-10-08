// No real login, external AI, private content or paid requests. HTTPS routes are mocked.
const assert=require('node:assert/strict'),{chromium}=require('playwright');
const base=process.argv[2]||'http://127.0.0.1:8877';
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const locale of ['zh-CN','zh-TW','ja','en']){
 const context=await browser.newContext({viewport:{width:390,height:844},locale,serviceWorkers:'block'}),p=await context.newPage(),errors=[],calls=[];
 p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{localStorage.setItem('starnews:private:endpoint','https://private.test.workers.dev');localStorage.setItem('starnews:private:login',JSON.stringify({state:'fixture-login-state',email:'fixture@example.test',endpoint:'https://private.test.workers.dev',expires:Date.now()+60000}));});
 await p.route('https://test.supabase.co/auth/v1/user',r=>r.fulfill({status:200,headers:{'access-control-allow-origin':new URL(base).origin,'access-control-allow-headers':'Authorization,apikey'},json:{email:'fixture@example.test',email_confirmed_at:'2026-10-08'}}));
 let hasKey=false,chatCount=0;
 await p.route('https://private.test.workers.dev/**',async route=>{
  const r=route.request(),path=new URL(r.url()).pathname,method=r.method();
  calls.push({path,method,body:r.postDataJSON()});
  const headers={'access-control-allow-origin':new URL(base).origin,'access-control-allow-headers':'Authorization,Content-Type','access-control-allow-methods':'GET,PUT,POST,DELETE,OPTIONS','cache-control':'private,no-store'};
  if(method==='OPTIONS')return route.fulfill({status:204,headers});
  let data={ok:true};
  if(path==='/health')data={enabled:true,auth:{url:'https://test.supabase.co',anonKey:'public-anon'},providers:['groq','gemini','openrouter','openai'],publicPool:false};
  else {assert.equal(r.headers().authorization,'Bearer fixture-token');
   if(path==='/preferences')data={preferences:{language:locale,topics:['tech'],memory:'My explicit memory'},keys:hasKey?['groq']:[]};
   if(path.startsWith('/keys/')){assert.equal(method,'PUT');assert.equal(r.postDataJSON().key,'fixture-secret-key');hasKey=true;}
   if(path==='/chat'){chatCount++;assert.equal(r.postDataJSON().language,locale);assert(r.postDataJSON().article.title);assert(!r.postDataJSON().article.id);data={answer:'Analysis <script>window.evil=1</script> based on supplied excerpt.'};}
   if(path==='/history')data={history:[{role:'user',content:'My question'}]};
   if(path==='/recommendations')data={ids:r.postDataJSON().articles.slice(0,2).map(a=>a.id)};
  }
  await route.fulfill({status:200,headers,json:data});
 });
 await p.goto(base+'/?login_state=fixture-login-state#access_token=fixture-token&expires_in=3600');
 await p.locator('#personalAISigned').waitFor({state:'visible'});
 assert(!p.url().includes('access_token')&&!p.url().includes('login_state'),'Callback secrets removed from URL');
 await p.locator('#personalAIKey').fill('fixture-secret-key');
 await p.locator('#personalAIKey').locator('..').locator('button').first().click();
 await p.waitForFunction(()=>document.querySelector('#personalAIKeys').textContent.includes('groq'));
 assert.equal(await p.locator('#personalAIKey').inputValue(),'','Input cleared');
 await p.locator('#personalAIQuestion').fill('Explain only sourced facts');
 const ask=p.locator('#personalAIQuestion').locator('..').locator('button');
 await ask.click();assert.equal(chatCount,0,'No transmission without consent');
 await p.locator('#personalAIConsent').check();await ask.click();
 await p.waitForFunction(()=>document.querySelector('#personalAIAnswer').textContent.includes('Analysis'));
 assert.equal(chatCount,1);assert.equal(await p.evaluate(()=>window.evil),undefined,'Answer rendered as text');
 const saved=await p.evaluate(()=>JSON.stringify({...localStorage}));assert(!saved.includes('fixture-secret-key')&&!saved.includes('fixture-token'),'No secrets stored');
 for(let i=0;i<24;i++){await p.keyboard.press('Tab');assert(await p.evaluate(()=>!!document.activeElement.closest('#personalAIOverlay')),'Focus trapped');}
 assert(await p.locator('.personal-ai-panel').evaluate(e=>e.scrollHeight>e.clientHeight),'Mobile private panel scrolls');
 await p.locator('#personalAISigned > button').click();
 assert(!(await p.locator('#personalAISigned').isVisible()));assert.equal(await p.locator('#personalAIAnswer').textContent(),'');
 assert.equal(await p.locator('#personalAIMemory').inputValue(),'');
 await p.keyboard.press('Escape');assert(!(await p.locator('#personalAIOverlay').isVisible()));
 assert.deepEqual(errors,[]);console.log(JSON.stringify({locale,result:'passed',cases:'memory-only session, isolated API, consent, encrypted-key submission, logout clearing, text-only answers, focus, mobile scroll'}));await context.close();
 }
 const context=await browser.newContext({locale:'en',serviceWorkers:'block'}),p=await context.newPage();await p.goto(base+'/#access_token=unrequested-token&expires_in=3600');assert(!p.url().includes('access_token'),'Unrequested callback scrubbed');await p.locator('[data-action=onboarding-skip]').click();await p.locator('[data-action=settings]').click();await p.locator('#personalAISettings button').click();assert(await p.locator('#personalAIStatus').textContent());assert(!(await p.locator('#personalAIAuth').isVisible()));assert(await p.locator('#hero').count());await context.close();
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
