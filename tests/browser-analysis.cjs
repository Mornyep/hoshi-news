const assert=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs');
const base=process.argv[2]||'http://127.0.0.1:8877';
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
for(const locale of ['zh-CN','zh-TW','ja','en']){
 const context=await browser.newContext({locale,viewport:{width:390,height:844},serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const source=JSON.parse(fs.readFileSync('archive-stories.json')).editions.find(e=>e.locale===locale),edition=structuredClone(source);
 edition.date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo'}).format(new Date());edition.session='noon';edition.generated_at=new Date().toISOString();
 const s=edition.items[0],v=s.localized[locale];v.highlight={text:v.title.slice(2,12),method:'machine_selected_exact_headline_span'};
 v.archive.analysis={language:locale,title:'Analysis '+locale,notice:'Unverified analysis only.',sections:[{title:'Question',text:'Fixture evidence-bound question.',sources:[{name:'NASA',url:s.source.url}]}]};
 const legacy={...edition,id:'legacy',locale:undefined,items:[{...s,title:'混杂した legacy headline',localized:undefined}]};
 await page.route('**/ai-briefs.json',r=>r.fulfill({json:{schema:1,editions:[legacy,edition]}}));await page.goto(base);await page.locator('[data-action=onboarding-skip]').click();await page.locator('[data-edition-choice=noon]').click();
 await page.waitForFunction(()=>document.querySelector('#heroHeadline mark'));
 assert.equal(await page.locator('#heroHeadline').textContent(),v.title);assert.equal(await page.locator('#heroHeadline mark').textContent(),v.highlight.text);
 await page.locator('[data-action=open-reader]').click();assert.equal(await page.locator('.ai-analysis h3').first().textContent(),'Analysis '+locale);assert.equal(await page.locator('.ai-analysis a').first().getAttribute('href'),s.source.url);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.keyboard.press('Escape');await page.locator('[data-action=settings]').click();await page.locator('#languageSelect').selectOption(locale==='en'?'ja':'en');await page.keyboard.press('Escape');
 assert(await page.locator('#hero').isHidden(),'Missing locale must not display legacy mixed-language edition');assert.deepEqual(errors,[]);await context.close();
}
console.log('PASS: four locales, exact AI highlight, linked analysis, language switch and legacy rejection');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
