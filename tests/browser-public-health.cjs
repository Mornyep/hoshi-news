const assert=require('node:assert/strict'),{chromium}=require('playwright');
const base=process.argv[2]||'http://127.0.0.1:8877';
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
  const context=await browser.newContext({locale:'zh-CN',serviceWorkers:'block'});
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  let mode='old',count=0;
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  await p.route('**/ai-briefs.json',async route=>{
    count++;
    if(mode==='error'){await route.fulfill({status:503,body:'unavailable'});return;}
    const response=await route.fetch(),data=await response.json();
    const source=data.editions.find(e=>e.locale==='zh-CN'&&e.items?.length);assert(source);
    data.updated_at=mode==='old'?'2000-01-01T00:00:00Z':day+'T00:01:00Z';
    data.editions=[{...source,date:mode==='old'?'2000-01-01':day,session:'morning',generated_at:data.updated_at}];
    await route.fulfill({response,json:data,headers:{...response.headers(),'X-Starnews-Cache':mode==='offline'?'offline':'network'}});
  });
  await p.route('**/public-status.json',route=>route.fulfill({json:{schema:1,date:day,session:'morning',status:mode==='old'?'failed':'published',attempted_at:day+'T00:00:00Z',locales:{'zh-CN':mode==='old'?'unavailable':'published'}}}));
  await p.goto(base);await p.locator('[data-action=onboarding-skip]').click();
  await p.waitForFunction(()=>document.querySelector('#emptyCopy').textContent.includes('generation_unavailable'));
  assert(await p.locator('#emptyEdition').isVisible());assert(!(await p.locator('#hero').isVisible()));
  assert((await p.locator('#emptyCopy').textContent()).includes('2000'));
  assert((await p.locator('#emptyCopy').textContent()).includes('ChatGPT'));
  assert((await p.locator('#snapshotStatus').textContent()).includes(day));
  mode='fresh';await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  await p.waitForFunction(()=>document.querySelector('#aiTopState').textContent.includes('NEWS ONLINE'));
  assert(await p.locator('#hero').isVisible());assert((await p.locator('#snapshotStatus').textContent()).includes(day));
  assert((await p.locator('#snapshotStatus').textContent()).includes('JST'));
  // A repeated unchanged refresh must keep the reader's selected story.
  await p.locator('.hero-next').click();const title=await p.locator('#readTitle').textContent();
  const before=count,refreshed=p.waitForResponse(r=>r.url().endsWith('/ai-briefs.json'));
  await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await refreshed;await p.waitForTimeout(100);
  assert(count>before);assert.equal(await p.locator('#readTitle').textContent(),title);
  mode='offline';await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  await p.waitForFunction(()=>document.querySelector('#aiTopState').textContent.includes('LOAD FAILED'));
  assert(await p.locator('#hero').isVisible(),'Cached current news remains readable with an explicit error');
  mode='fresh';await p.evaluate(()=>window.dispatchEvent(new Event('online')));
  await p.waitForFunction(()=>document.querySelector('#aiTopState').textContent.includes('NEWS ONLINE'));
  mode='error';await p.evaluate(()=>window.dispatchEvent(new Event('online')));
  await p.waitForFunction(()=>document.querySelector('#aiTopState').textContent.includes('LOAD FAILED'));
  assert((await p.locator('#snapshotStatus').textContent()).includes('加载失败'));
  mode='fresh';await p.evaluate(()=>window.dispatchEvent(new Event('online')));
  await p.waitForFunction(()=>document.querySelector('#aiTopState').textContent.includes('NEWS ONLINE'));
  await p.locator('[data-action=archive]').first().click();
  assert(await p.locator('#hero').isVisible());
  assert((await p.locator('#snapshotStatus').textContent()).includes('档案'));
  assert.deepEqual(errors,[]);console.log('publication failure, JST freshness, foreground refresh, load error, recovery and archive passed');
  await context.close();
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
