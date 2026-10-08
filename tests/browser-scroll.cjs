// Run with Playwright available in NODE_PATH:
// node tests/browser-scroll.cjs http://127.0.0.1:8765 --fixture
// Omit --fixture to check the currently published editions without replacing data.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://127.0.0.1:8765';
const fixture = process.argv.includes('--fixture');
const sizes = [[1527,1024],[1280,720],[851,650],[850,1024],[768,1024],[621,800],[620,800],[390,844],[320,568]];
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const [width,height] of sizes) {
      const context = await browser.newContext({locale:'zh-CN', viewport:{width,height}, hasTouch:width<=850, isMobile:width<=620, serviceWorkers:'block' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      if (fixture) await page.route('**/ai-briefs.json', async route => {
        const response = await route.fetch();
        const data = await response.json();
        const source = data.editions.find(e => e.items?.length);
        assert(source, 'Need a public edition for the multi-session fixture');
        const date = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
        data.editions = ['morning','noon','evening'].map(session=>({...source,date,session}));
        await route.fulfill({response,json:data});
      });
      const loaded = page.waitForResponse(r=>r.url().endsWith('/ai-briefs.json'));
      await page.goto(base);
      await page.locator('[data-action=onboarding-skip]').click();
      await loaded;
      for (const edition of ['noon','ai','evening','morning']) {
        await page.locator('[data-edition-choice='+edition+']').click();
        await page.waitForTimeout(100);
        const cards = page.locator('#aiStoryList > details');
        if (await page.locator('#aiDesk').isVisible() && await cards.count()) {
          assert(await page.evaluate(()=>window.scrollY)<=1,'Channel starts at top (allow pixel rounding)');
          const box = await cards.first().boundingBox();
          await page.mouse.move(Math.min(width-15,box.x+box.width/2),Math.min(height-30,box.y+35));
          await page.mouse.wheel(0,650);
          await page.waitForTimeout(200);
          assert(await page.evaluate(()=>window.scrollY)>100,edition+' wheel must scroll document');
          await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
          await cards.first().locator('summary').click();
          assert(await cards.first().evaluate(e=>e.open),'News expands');
          assert(await cards.first().locator('.ai-source').isVisible(),'Source link visible');
          await cards.first().locator('summary').click();
          assert(!(await cards.first().evaluate(e=>e.open)),'News collapses');
          await page.locator('[data-ai-filter]').nth(1).click();
          assert(await cards.count()>0,'Category filter has results');
          await page.locator('[data-ai-filter=all]').click();
          await cards.last().locator('summary').click();
          assert(await cards.last().evaluate(e=>e.open),'Last article reachable and expandable');
          await page.locator('.bottom-bar').scrollIntoViewIfNeeded();
          const bottom = await page.locator('.bottom-bar').boundingBox();
          assert(bottom.y+bottom.height<=height+1,'Footer reachable');
          assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal page overflow '+JSON.stringify(await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,wide:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>[e.className,e.getBoundingClientRect().right]).slice(0,12)}))));
          await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
          await page.keyboard.press('PageDown');
          await page.waitForTimeout(200);
          assert(await page.evaluate(()=>window.scrollY)>0,'Keyboard scroll works');
          if (width<=620) {
            await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
            const cdp = await context.newCDPSession(page);
            await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:width/2,y:height-60}]});
            for(let y=height-90;y>150;y-=45) {
              await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:width/2,y}]});
              await page.waitForTimeout(16);
            }
            await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
            await page.waitForTimeout(200);
            assert(await page.evaluate(()=>window.scrollY)>50,'Touch swipe scrolls document');
            await cdp.detach();
          }
          if (edition==='noon' && (width===1527||width===390) && process.env.SCREENSHOT_DIR) {
            await page.evaluate(()=>window.scrollTo({top:650,behavior:'instant'}));
            await page.screenshot({path:process.env.SCREENSHOT_DIR+'/fixed-'+width+'.png'});
          }
        }
      }
      await page.locator('[data-edition-choice=breaking]').click();
      assert(await page.locator('#emptyEdition').isVisible(),'Breaking channel preserved');
      await page.locator('#emptyEdition [data-action=morning]').click();
      if(await page.locator('#hero').isVisible()) {
        await page.locator('[data-action=open-reader]').click();
        assert(await page.locator('#readerOverlay').isVisible(),'Archive reader opens');
        await page.locator('button[data-action=close-reader]').first().click();
      }
      await page.locator('[data-action=settings]').click();
      assert(await page.locator('#settingsOverlay').isVisible(),'Settings open');
      await page.locator('button[data-action=close-settings]').first().click();
      assert.deepEqual(errors,[],'No browser errors');
      console.log(JSON.stringify({width,height,fixture,result:'passed'}));
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
