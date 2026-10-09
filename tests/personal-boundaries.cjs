const test=require('node:test'),assert=require('node:assert/strict');
const evidence=require('../personal-evidence.js'),profilesFactory=require('../personal-profile.js');
const store=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k),map};};
test('local profiles require explicit entry and isolate focus and settings',()=>{
 const disk=store(),session=store(),p=profilesFactory(disk,session,require('node:crypto'));
 disk.setItem('starnews:guest:v4.3',JSON.stringify({version:43,saved:['old']}));
 assert.equal(p.active(),null);assert.throws(()=>p.focus('private'));
 const a=p.create('A');p.focus('A-only');const ak=p.prefix();disk.setItem(ak+':preferences','A-settings');
 const b=p.create('B');assert.equal(p.focus(),'');p.focus('B-only');assert.notEqual(ak,p.prefix());
 assert.equal(disk.getItem(p.prefix()+':preferences'),null);
 p.select(a.id);assert.equal(p.focus(),'A-only');assert.equal(disk.getItem(p.prefix()+':preferences'),'A-settings');
 p.exit();assert.equal(p.prefix(),null);assert.throws(()=>p.select('foreign'));
 p.select(b.id);assert.equal(p.focus(),'B-only');assert.equal(disk.getItem('starnews:guest:v4.3').includes('old'),true);
 assert.equal(profilesFactory(disk,store(),require('node:crypto')).active(),null,'new tab/session has no selected account');
});
test('manual packet excludes all unselected private fields and full articles',()=>{
 const story={id:'news',title:'Example title',summary:'Public summary',memory:'SECRET',history:['SECRET'],favorites:['SECRET'],sources:[{url:'https://example.org/news',name:'Source'},{url:'https://user:secret@example.org'}],archive:{sections:[{id:'summary',text:'bounded'},{id:'background',mode:'licensed_source_text',text:'FULL ARTICLE'}]}};
 const p=evidence.packet(story,{locale:'ja',question:'why?',focus:'PRIVATE'});
 assert.equal(p.response_language,'ja');assert.equal(p.disclosure.automatic_send,false);assert.equal(p.disclosure.includes_private_preferences,false);
 assert(!JSON.stringify(p).includes('SECRET'));assert(!JSON.stringify(p).includes('PRIVATE'));assert(!JSON.stringify(p).includes('FULL ARTICLE'));assert.equal(p.report.sources.length,1);
 assert.equal(evidence.packet(story,{includeFocus:true,focus:'chosen'}).focus,'chosen');
});
test('free-text research without supplied evidence cannot impersonate generated news',()=>{
 assert.throws(()=>evidence.packet(null));assert.throws(()=>evidence.packet(null,{question:'news',locale:'xx'}));
 const p=evidence.packet(null,{question:'my question',locale:'en'});assert.equal(p.report,null);assert.equal(p.kind,'personal_research_request');
 assert.match(evidence.prompt(null,{question:'today'}),/no news evidence/);assert.match(evidence.prompt(null,{question:'today'}),/Never label old news as current/);
 for(const provider of evidence.providers){assert.equal(provider.connected,false);assert.equal(provider.mode,'official_client_handoff');assert.equal(new URL(provider.url).protocol,'https:');}
});
test('AI presentation is bounded exact text, fixed palette and no warning overrides',()=>{
 const s={title:'A useful news title',summary:'Evidence first'};
 assert.deepEqual(evidence.presentation({tone:'cyan',highlights:['useful','Evidence']},s),{tone:'cyan',highlights:['useful','Evidence']});
 for(const v of [{tone:'red',highlights:[]},{tone:'cyan',highlights:['invented']},{tone:'lime',highlights:['<script>']},{tone:'lime',highlights:[],css:'evil'},{tone:'lime',highlights:['A','A','A','A']}])assert.throws(()=>evidence.presentation(v,s));
 assert.throws(()=>evidence.presentation({tone:'lime',highlights:[]},{...s,official_warning:true}));
});
test('automation has no public models, cron, credentials or writes',()=>{
 const fs=require('node:fs'),workflow=fs.readFileSync('.github/workflows/public-ai.yml','utf8').split('\n').filter(x=>!x.trim().startsWith('#')).join('\n');
 for(const disallowed of ['schedule:','workflow_dispatch:','secrets.','contents: write','publication_status.py','public_ai.py'])assert(!workflow.includes(disallowed));
 assert(workflow.includes('unittest'));assert(!fs.readFileSync('backend/worker.mjs','utf8').includes('key=env.PUBLIC_POOL_KEY'));
});

test('untrusted JSON and source links cannot introduce executable content',()=>{
 const story={title:'Safe title',summary:'Safe summary',sources:[{url:'javascript:alert(1)'},{url:'data:text/html,bad'},{url:'https://trusted.example@evil.example/path'},{url:'https://example.org/source'}]};
 assert.deepEqual(evidence.packet(story).report.sources.map(s=>s.url),['https://example.org/source']);
 for(const value of [JSON.parse('{"tone":"lime","highlights":[],"__proto__":{}}'),{tone:'lime',highlights:[{}]},{tone:'lime',highlights:['x'.repeat(81)]},{tone:'lime',highlights:[],html:'<img src=x onerror=alert(1)>'},{tone:'lime',highlights:[],sources:['https://evil.example']}])assert.throws(()=>evidence.presentation(value,story));
 const fs=require('node:fs'),vm=require('node:vm'),match=fs.readFileSync('app.js','utf8').match(/function validUrl\(url\)\{.*?\}catch\(e\)\{return null\}\}/);
 assert(match);const check=vm.runInNewContext('('+match[0]+')',{URL});
 for(const source of story.sources.slice(0,3))assert.equal(check(source.url),null);assert.equal(check(story.sources[3].url),'https://example.org/source');
});
