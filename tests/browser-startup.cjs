// Check homepage selection with public-data fixtures held inside an isolated browser.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.argv[2]||'http://127.0.0.1:8765';
const cases=[
  {sessions:['noon'],expected:'noon'},
  {sessions:['morning','noon'],expected:'noon'},
  {sessions:['morning','noon','evening'],expected:'evening'},
  {sessions:['noon'],old:true,expected:'morning'},
  {sessions:['noon'],manual:'evening',expected:'evening'},
  {sessions:['noon'],manual:'morning',expected:'morning'}
];
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
  for(const [width,height]of [[1527,1024],[390,844]]){
    for(const scenario of cases){
      const context=await browser.newContext({locale:'zh-CN',viewport:{width,height},serviceWorkers:'block'});
      const page=await context.newPage();let release;
      const gate=new Promise(r=>{release=r});
      await page.route('**/ai-briefs.json',async route=>{
        const response=await route.fetch(),data=await response.json();
        const source=data.editions.find(e=>e.items?.length);assert(source);
        const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
        const date=scenario.old?'2000-01-01':today;
        const hours={morning:'00',noon:'04',evening:'10'};
        data.editions=scenario.sessions.map(session=>({...source,date,session,generated_at:date+'T'+hours[session]+':00:00Z'}));
        await gate;await route.fulfill({response,json:data});
      });
      const loaded=page.waitForResponse(r=>r.url().endsWith('/ai-briefs.json'));
      await page.goto(base);await page.locator('[data-action=onboarding-skip]').click();
      if(scenario.manual)await page.locator('[data-edition-choice='+scenario.manual+']').click();
      release();await loaded;
      await page.waitForFunction(edition=>document.querySelector('#app').dataset.edition===edition,scenario.expected);
      await page.waitForTimeout(100);
      assert.equal(await page.locator('#app').getAttribute('data-edition'),scenario.expected);
      assert.equal(await page.locator('.edition-tabs .active').getAttribute('data-edition-choice'),scenario.expected);
      if(scenario.old||scenario.manual==='morning'){
        assert(await page.locator('#hero').isVisible(),'Morning archive remains available');
      }else if(!scenario.manual){
        assert(await page.locator('#hero').isVisible(),'Latest briefing uses console on homepage');
        assert(await page.locator('#queueList button').count()>0,'Latest published news available');
        assert(!(await page.locator('#aiDesk').isVisible()),'Daily homepage does not use general list');
      }else{
        assert(await page.locator('#emptyEdition').isVisible(),'Unpublished manually selected session stays explicit');
      }
      console.log(JSON.stringify({width,...scenario,result:'passed'}));
      await context.close();
    }
  }
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
