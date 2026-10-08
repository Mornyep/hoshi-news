const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base=process.env.STARNEWS_TEST_URL||'http://127.0.0.1:8877';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
 const context=await browser.newContext({locale:'en-US',reducedMotion:'reduce',viewport:{width:1280,height:800}});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const title={'zh-CN':'可靠标题 42','zh-TW':'可靠標題 42',ja:'確認済みの見出し 42',en:'Verified headline 42'};
 const summary={'zh-CN':'来源报告数值 42。','zh-TW':'來源報告數值 42。',ja:'出典の数値は 42。',en:'The source reports 42.'};
 const editions=Object.keys(title).map(locale=>({date,session:'noon',locale,generated_at:new Date().toISOString(),items:[{id:'first',category:'world',title:title[locale],summary:summary[locale],source:{name:'Example',url:'https://example.com/report',language:locale},localized:{[locale]:{title:title[locale],summary:summary[locale],status:'original',language:locale,archive:{full_text_acquired:false,generated_at:'2026-10-08T00:00:00Z',sections:Array.from({length:7},(_,i)=>({title:'Section '+i,text:('Reported fact 42. ').repeat(22),available:true}))}}}},{id:'fallback',category:'japan',title:'原文のみ 23',summary:'確認できる情報のみ。',source:{name:'Example Japan',url:'https://example.com/ja',language:'ja'},localized:{[locale]:{title:'原文のみ 23',summary:'確認できる情報のみ。',language:'ja',status:'fallback'}}}]}));
 await page.route('**/ai-briefs.json',route=>route.fulfill({json:{schema:1,editions}}));
 await page.goto(base);await page.locator('[data-action=onboarding-skip]').click();
 await page.waitForFunction(()=>document.querySelector('#heroHeadline')?.innerText.includes('Verified'));
 assert.equal(await page.locator('html').getAttribute('lang'),'en');
 assert.equal(await page.locator('[data-edition-choice=noon] b').innerText(),'Midday');
 for(const locale of ['zh-CN','zh-TW','ja','en']){
  await page.locator('[data-action=settings]').click();await page.selectOption('#languageSelect',locale);
  assert.equal(await page.locator('html').getAttribute('lang'),locale);
  await page.locator('.settings-heading button[data-action=close-settings]').click();
  assert((await page.locator('#heroHeadline').innerText()).replaceAll('\n','').includes(title[locale]));
  assert.equal(await page.evaluate(()=>window.StarnewsBridge.getLocale()),locale);
 }
 await page.locator('.hero-save').click();
 await page.locator('#favoritesButton').click();
 await page.locator('[data-action=settings]').click();await page.selectOption('#languageSelect','ja');await page.locator('.settings-heading button[data-action=close-settings]').click();
 assert((await page.locator('#heroHeadline').innerText()).replaceAll('\n','').includes(title.ja));
 await page.locator('[data-action=settings]').click();await page.selectOption('#languageSelect','en');await page.locator('.settings-heading button[data-action=close-settings]').click();
 await page.locator('[data-edition-choice=noon]').click();
 await page.reload();assert.equal(await page.locator('html').getAttribute('lang'),'en');
 await page.locator('#newsSearch').fill('42');assert.equal(await page.locator('#queueList button').count(),1);
 await page.locator('#newsSearch').fill('');await page.locator('#queueList button').nth(1).click();
 assert.match(await page.locator('#contentLanguageNotice').innerText(),/Original-language fallback/);
 await page.locator('#queueList button').first().click();await page.locator('[data-action=open-reader]').click();
 assert.equal(await page.locator('#readerCopy h3').count(),7);assert.match(await page.locator('#readerCopy').innerText(),/Only RSS excerpts retrieved/);
 const scroll=await page.locator('.reader-scroll').evaluate(el=>{el.scrollTop=500;return {top:el.scrollTop,height:el.clientHeight,total:el.scrollHeight};});assert(scroll.top>0&&scroll.total>scroll.height);
 assert.equal(await page.locator('#readerSources a').getAttribute('href'),'https://example.com/report');
 await page.screenshot({path:'/tmp/hoshi-ui-reader-desktop.png',fullPage:false});
 await page.locator('button[data-action=close-reader]').click();await page.setViewportSize({width:390,height:844});
 await page.locator('[data-action=open-reader]').click();
 assert(await page.locator('.reader-scroll').evaluate(el=>{el.scrollTop=700;return el.scrollTop>0;}));
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 await page.screenshot({path:'/tmp/hoshi-ui-reader-mobile.png',fullPage:false});
 await page.locator('button[data-action=close-reader]').click();
 await page.locator('[data-edition-choice=ai]').click();await page.locator('#newsSearch').fill('42');assert.equal(await page.locator('#aiStoryList details').count(),1);
 assert.deepEqual(errors,[]);
 await page.screenshot({path:'/tmp/hoshi-ui-mobile.png',fullPage:true});
 await context.close();
 for(const [language,expected] of [['ja-JP','ja'],['zh-HK','zh-TW'],['zh-SG','zh-CN']]){const c=await browser.newContext({locale:language});const p=await c.newPage();await p.goto(base);assert.equal(await p.locator('html').getAttribute('lang'),expected);await c.close();}
 console.log('PASS browser locale default/persistence, 4 translated editions, immediate content update, original fallback, search, archive provenance, mobile scroll and width; no page errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
