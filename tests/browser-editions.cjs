// Daily briefs reuse the console. General news alone keeps the list.
// Fixture editions never leave this isolated browser; omit --fixture for live data.
const assert=require('node:assert/strict'),{chromium}=require('playwright');
const base=process.argv[2]||'http://127.0.0.1:8765',fixture=process.argv.includes('--fixture');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
  for(const [width,height]of [[1527,1024],[1280,720],[851,650],[850,1024],[768,1024],[621,800],[620,800],[390,844],[320,568]]){
    const context=await browser.newContext({locale:'zh-CN',viewport:{width,height},hasTouch:width<=850,isMobile:width<=620,serviceWorkers:'block'});
    const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
    if(fixture)await p.route('**/ai-briefs.json',async route=>{
      const response=await route.fetch(),data=await response.json(),source=data.editions.reduce((a,e)=>(e.items?.length||0)>(a?.items?.length||0)?e:a,null);
      const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
      data.editions=['morning','noon','evening'].map(session=>({...source,date,session,items:source.items.map((s,i)=>i===source.items.length-1?{...s,title:'長いタイトルの折り返しを検証する公開ニュース。'.repeat(7)}:s)}));
      await route.fulfill({response,json:data});
    });
    const loaded=p.waitForResponse(r=>r.url().endsWith('/ai-briefs.json'));
    await p.goto(base);await loaded;await p.locator('[data-action=onboarding-skip]').click();
    for(const edition of ['morning','noon','evening']){
      await p.locator('[data-edition-choice='+edition+']').click();
      assert(!(await p.locator('#aiDesk').isVisible()),'Only general news uses list');
      if(await p.locator('#hero').isVisible()){
        const count=await p.locator('#queueList button').count();assert(count>0);
        assert(await p.locator('.decode').isVisible(),'Decode console visible');
        if(width>850){
          assert(await p.locator('.queue').isVisible(),'Desktop queue visible');
          const hero=await p.locator('#hero').boundingBox(),decode=await p.locator('.decode').boundingBox();
          assert(hero.x<decode.x,'Console remains three columns');
          const headline=await p.locator('#heroHeadline').boundingBox();
          assert(headline.y<height&&headline.y+headline.height<=hero.y+hero.height,'Headline stays inside visible console');
          await p.locator('#queueList button').last().click();
          assert.equal(await p.locator('#queueList button').last().getAttribute('aria-current'),'true','Last queued story reachable');
          assert(await p.locator('#queueList').evaluate(e=>e.scrollTop)>0||count<=5,'Long queue scrolls');
        }else{
          await p.locator('#mobileStoryStrip button').last().click();
          assert.equal(await p.locator('#mobileStoryStrip button').last().getAttribute('aria-current'),'true','Last mobile story reachable');
          assert(await p.locator('#mobileStoryStrip').evaluate(e=>e.scrollWidth<=e.clientWidth+1||e.scrollLeft>0),'Overflowing mobile strip scrolls');
        }
        const title=await p.locator('#readTitle').textContent();
        await p.locator('[data-action=open-reader]').click();
        if(await p.locator('#app').getAttribute('data-story-kind')==='public')
          assert.equal(await p.locator('#readerTitle').textContent(),title,'Reader preserves full public title');
        else assert((await p.locator('#readerTitle').textContent()).trim(),'Original archive reader has title');
        assert(await p.locator('.reader-scroll').evaluate(e=>e.clientHeight)>80,'Long title leaves room for reading body');
        await p.locator('.reader-lenses [data-lens=verify]').click();
        assert(await p.locator('#readerSources a').count()>0,'Source links preserved');
        if(await p.locator('#app').getAttribute('data-story-kind')==='public'){
          assert((await p.locator('.source-disclaimer').textContent()).includes('未经独立全文核验'),'Public source boundary retained');
          assert((await p.locator('#readerCopy').textContent()).includes('RSS'),'Verify lens explains RSS basis');
        }
        await p.locator('#readerSources a').last().scrollIntoViewIfNeeded();
        await p.keyboard.press('Escape');
        const progress=await p.locator('#decodeProgress').textContent();
        await p.locator('.hero-next').click();
        assert.notEqual(await p.locator('#decodeProgress').textContent(),progress,'Story controls work in each edition');
        if(width<=620){
          await p.locator('.bottom-bar').scrollIntoViewIfNeeded();
          assert(await p.evaluate(()=>scrollY)>100,'Daily page naturally scrolls on phone');
        }
        assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');
      }else{
        assert(await p.locator('#emptyEdition').isVisible(),'Unpublished daily edition has explicit empty state');
      }
    }
    // New public daily stories can use the existing local collection without losing old archive bookmarks.
    await p.locator('[data-edition-choice=noon]').click();
    if(await p.locator('#hero').isVisible()){
      const savedTitle=await p.locator('#readTitle').textContent();
      await p.locator('.hero-save').click();
      await p.locator('#favoritesButton').click();
      assert.equal(await p.locator('#readTitle').textContent(),savedTitle,'Saved public story appears in collection');
      assert.equal(await p.locator('#favoritesButton').getAttribute('aria-pressed'),'true','Collection filter active');
      const reloaded=p.waitForResponse(r=>r.url().endsWith('/ai-briefs.json'));
      await p.reload();await reloaded;
      await p.locator('#favoritesButton').click();
      assert.equal(await p.locator('#readTitle').textContent(),savedTitle,'Public bookmark survives reload');
    }
    await p.locator('[data-edition-choice=ai]').click();
    assert(await p.locator('#aiDesk').isVisible(),'General news uses list');
    assert(!(await p.locator('#hero').isVisible()),'General channel hides console');
    if(await p.locator('#aiStoryList details').count()){
      await p.locator('#aiStoryList summary').first().click();
      assert(await p.locator('#aiStoryList details').first().evaluate(e=>e.open),'General article expands');
      await p.locator('[data-ai-filter]').nth(1).click();
      assert(await p.locator('#aiStoryList details').count()>0,'General categories work');
    }
    await p.locator('[data-edition-choice=breaking]').click();
    assert(await p.locator('#emptyEdition').isVisible(),'Breaking preserved');
    assert.deepEqual(errors,[],'No browser errors');
    console.log(JSON.stringify({width,height,fixture,result:'passed'}));
    await context.close();
  }
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
