// Run with Playwright in NODE_PATH; fixture data stays in the isolated browser.
// node tests/browser-interactions.cjs http://127.0.0.1:8765
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.argv[2]||'http://127.0.0.1:8765';
async function trap(page,overlay,count=38){
  for(let i=0;i<count;i++){
    await page.keyboard.press('Tab');
    assert(await page.evaluate(id=>!!document.activeElement.closest(id),overlay),'Tab stays inside '+overlay);
  }
  for(let i=0;i<4;i++){
    await page.keyboard.press('Shift+Tab');
    assert(await page.evaluate(id=>!!document.activeElement.closest(id),overlay),'Reverse Tab stays inside '+overlay);
  }
}
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    for(const [width,height] of [[1527,1024],[768,1024],[390,844],[320,568]]){
      const context=await browser.newContext({viewport:{width,height},serviceWorkers:'block',reducedMotion:width===320?'reduce':'no-preference'});
      const page=await context.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      let delay=0;
      await page.route('**/ai-briefs.json',async route=>{
        const response=await route.fetch(),data=await response.json();
        const source=data.editions.find(e=>e.items?.some(s=>s.category==='game'));
        assert(source,'Need public game story to test interest ranking');
        const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
        data.editions=['morning','noon','evening'].map(session=>({...source,date,session}));
        if(delay)await new Promise(r=>setTimeout(r,delay));
        await route.fulfill({response,json:data});
      });
      let loaded=page.waitForResponse(r=>r.url().endsWith('/ai-briefs.json'));
      await page.goto(base);await loaded;
      await trap(page,'#onboardingOverlay',18);
      await page.keyboard.press('Escape');
      assert(!(await page.locator('#onboardingOverlay').isVisible()),'Onboarding closes');
      await page.locator('[data-edition-choice=noon]').click();
      await page.locator('[data-action=settings]').click();
      await trap(page,'#settingsOverlay');
      await page.keyboard.press('Escape');
      assert(!(await page.locator('#settingsOverlay').isVisible()),'Escape closes settings');
      assert.equal(await page.locator('#app').getAttribute('data-edition'),'noon','Escape preserves channel');
      assert.equal(await page.evaluate(()=>document.activeElement.dataset.action),'settings','Focus returns to settings entry');
      assert(!(await page.locator('.edition-tabs').evaluate(e=>e.inert)),'Background unlocked');
      const before=await page.locator('.ai-story-preview').first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize));
      await page.locator('[data-action=settings]').click();
      await page.locator('#interestOptions [data-interest=game]').click();
      assert(await page.evaluate(()=>!!document.activeElement.closest('#settingsOverlay')),'Interest rebuild preserves focus');
      await page.locator('#largeTextToggle').check();
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#bottomEdition').textContent(),'午间 · 公共 AI','Footer keeps current session');
      assert.equal(await page.locator('.ai-story-category').first().textContent(),'游戏动漫','Interest ranking updates immediately');
      const after=await page.locator('.ai-story-preview').first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize));
      assert(after>before,'Large text enlarges feed preview');
      await page.locator('.ai-story-summary').first().click();
      assert.equal(await page.locator('.ai-story-expanded p').first().evaluate(e=>getComputedStyle(e).fontSize),'15px','Expanded text is large');
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Large text fits viewport');
      const ids=await page.evaluate(()=>window.__STARNEWS_SEED.items.slice(0,2).map(s=>s.id));
      await page.evaluate(ids=>{const key='starnews:guest:v4.3',prefs=JSON.parse(localStorage.getItem(key));prefs.saved=ids;localStorage.setItem(key,JSON.stringify(prefs));},ids);
      // Delay public AI arrival to confirm it cannot hide an explicitly opened collection.
      delay=800;loaded=page.waitForResponse(r=>r.url().endsWith('/ai-briefs.json'));
      await page.reload();await page.locator('#favoritesButton').click();await loaded;
      assert(await page.locator('#hero').isVisible(),'Late morning AI does not hide saved archive');
      assert(!(await page.locator('#aiDesk').isVisible()),'Collection does not display AI list');
      assert.equal(await page.locator('#favoritesButton').getAttribute('aria-pressed'),'true','Collection active');
      assert.equal(await page.locator('#bottomEdition').textContent(),'收藏 · 2 条','Collection count');
      await page.locator('[data-action=open-reader]').click();
      await trap(page,'#readerOverlay',18);
      await page.keyboard.press('Escape');
      assert(!(await page.locator('#readerOverlay').isVisible()),'Escape closes reader');
      assert.equal(await page.evaluate(()=>document.activeElement.dataset.action),'open-reader','Reader returns focus');
      await page.locator('.hero-save').click();
      assert.equal(await page.locator('#bottomEdition').textContent(),'收藏 · 1 条','Cancel saved story updates count');
      await page.locator('.hero-save').click();
      assert.equal(await page.locator('#favoritesButton').getAttribute('aria-pressed'),'false','Last cancellation leaves empty filter safely');
      await page.locator('[data-edition-choice=morning]').click();
      assert(await page.locator('#aiDesk').isVisible(),'Morning button returns to public morning edition');
      const edition=await page.locator('#app').getAttribute('data-edition');
      await page.locator('#favoritesButton').click();
      assert.equal(await page.locator('#app').getAttribute('data-edition'),edition,'Empty collection preserves channel');
      await page.locator('[data-action=settings]').click();
      assert(await page.locator('#largeTextToggle').isChecked(),'Text preference survives reload');
      assert.equal(await page.locator('#interestOptions [data-interest=game]').getAttribute('aria-pressed'),'true','Interest survives reload');
      await page.locator('button[data-action=close-settings]').first().click();
      assert(!(await page.locator('#settingsOverlay').isVisible()),'Close button works');
      assert.deepEqual(errors,[],'No browser errors');
      console.log(JSON.stringify({width,height,result:'passed',cases:'modal focus / Escape / interest / typography / saved archive / late AI / persistence'}));
      await context.close();
    }
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
