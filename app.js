(() => {
  'use strict';
  const app = document.getElementById('app');
  if (!app) return;
  const $ = q => app.querySelector(q);
  const $$ = q => Array.from(app.querySelectorAll(q));
  const txt = (selector, value) => {const el=$(selector);if (el) el.textContent=String(value ?? '');};
  const mk = (tag, className, textContent) => {
    const el=document.createElement(tag);
    if(className)el.className=className;
    if(textContent!==undefined)el.textContent=textContent;
    return el;
  };
  // Only non-sensitive guest preferences are stored; the public news pool is separate.
  // Browser storage is isolated by origin and browser profile, NOT by authenticated user.
  const storageKey = 'starnews:guest:v4.3';
  const oldStorageKey = 'hoshi-news-console-v2';
  const interests=[
    {id:'world',label:'国际',symbol:'◎'},
    {id:'japan',label:'日本',symbol:'〒'},
    {id:'politics',label:'政治政策',symbol:'⚑'},
    {id:'economy',label:'经济金融',symbol:'↗'},
    {id:'society',label:'社会民生',symbol:'◇'},
    {id:'health',label:'医疗健康',symbol:'✚'},
    {id:'science',label:'科学',symbol:'◉'},
    {id:'environment',label:'环境气候',symbol:'♧'},
    {id:'culture',label:'文化教育',symbol:'✳'},
    {id:'sports',label:'体育',symbol:'◩'},
    {id:'tech',label:'科技数码',symbol:'◈'},
    {id:'game',label:'游戏动漫',symbol:'✦'}
  ];
  const themes=[
    {id:'auto',label:'自动',color:'#dcff42'},
    {id:'lime',label:'酸柠',color:'#dcff42'},
    {id:'cyan',label:'电光蓝',color:'#78dcff'},
    {id:'pink',label:'莓粉',color:'#ff83b5'},
    {id:'purple',label:'星紫',color:'#c2a1ff'},
    {id:'amber',label:'日落橙',color:'#ffc975'}
  ];
  const allowedThemes=new Set(themes.map(t=>t.id));
  const allowedInterests=new Set(interests.map(t=>t.id));
  const seed = window.__STARNEWS_SEED;
  if (!seed || !Array.isArray(seed.items) || !seed.items.length) {
    txt('#readTitle','暂时无法加载今早的新闻');
    txt('#readText','请检查网站文件是否完整。');
    return;
  }
  let data=seed;
  // Public AI publication is independent of individual preferences.
  let publicAI={schema:1,editions:[]};
  let aiSession='morning';
  let aiOpen=false;
  let aiLastFocus=null;
  let aiFilter='all';
  const aiSessionNames={morning:'早间',noon:'午间',evening:'晚间'};
  function jstDay(){
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const get=k=>parts.find(x=>x.type===k)?.value||'00';
    return get('year')+'-'+get('month')+'-'+get('day');
  }
  function latestAISession(){
    const day=jstDay();
    const matches=(Array.isArray(publicAI.editions)?publicAI.editions:[])
      .filter(e=>e&&e.date===day&&['morning','noon','evening'].includes(e.session)&&Array.isArray(e.items)&&e.items.length)
      .sort((a,b)=>String(b.generated_at||'').localeCompare(String(a.generated_at||'')));
    return matches[0]?.session||'morning';
  }
  function aiEditionForSession(session){
    return (Array.isArray(publicAI.editions)?publicAI.editions:[])
      .find(e=>e&&e.date===jstDay()&&e.session===session&&Array.isArray(e.items)&&e.items.length);
  }
  function renderAI(){
    $$('#aiDesk [data-ai-session]').forEach(b=>{
      const active=b.dataset.aiSession===aiSession;
      b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));
    });
    const edition=aiEditionForSession(aiSession);
    const list=$('#aiStoryList');list.replaceChildren();
    const status=$('#aiStatusLight');status.classList.toggle('ready',Boolean(edition));
    const filterRow=$('#aiFilterRow');filterRow.replaceChildren();
    const filters=[{id:'all',label:'全部'}];
    const catLabels={headlines:'综合头条',world:'国际',japan:'日本',politics:'政治',economy:'经济',
      society:'社会',health:'健康',science:'科学',environment:'环境',culture:'文化',sports:'体育',tech:'科技',game:'动漫游戏'};
    if(edition){
      const present = new Set(edition.items.map(s=>s.category));
      for(const [id,label] of Object.entries(catLabels)){
        if(present.has(id)) filters.push({id,label});
      }
    }
    if(!filters.some(f=>f.id===aiFilter))aiFilter='all';
    for(const filter of filters){
      const btn=mk('button',filter.id===aiFilter?'active':'',filter.label);
      btn.type='button';btn.dataset.aiFilter=filter.id;
      btn.setAttribute('aria-pressed',String(filter.id===aiFilter));
      filterRow.append(btn);
    }
    if(!edition){
      txt('#aiStatus','今日'+aiSessionNames[aiSession]+'综合简报尚未生成');
      txt('#aiGenerated','没有完成新一期生成 · 不显示旧报道冒充实时新闻');
      txt('#aiIntro','后台按公开新闻源整理综合新闻，若当期未成功生成，保留透明的空状态。');
      txt('#aiEditNote','暂无本期数据，不能根据用户兴趣推测新闻');
      const blank=mk('div','ai-blank');
      blank.append(mk('strong','','NO NEW EDITION'),mk('p','','你可以切换到已发布的其他时段；上午静态存档会注明原始日期。'));
      const back=mk('button','ai-blank-back','↗ 查看历史新闻存档');back.type='button';back.dataset.action='morning';blank.append(back);
      list.append(blank);txt('#aiTopState','✳ PUBLIC NEWS');return;
    }
    txt('#aiTopState','✳ NEWS ONLINE');
    const categories=new Set(edition.items.map(s=>s.category));
    txt('#aiStatus',aiSessionNames[aiSession]+'综合新闻 · '+edition.items.length+' 条');
    txt('#aiGenerated',edition.date+' · '+(edition.provider||'后台')+' / '+(edition.model||'AI'));
    txt('#aiIntro','先展示综合头条与有公共价值的重要领域，再考虑个人兴趣。AI 仅整理原报道标题与简讯，不代表已阅读全文。');
    txt('#aiEditNote',`覆盖 ${categories.size} 类 · 综合头条优先 · 内容数量取决于消息与来源质量`);
    const ordered=edition.items.map((s,index)=>({s,index})).sort((a,b)=>{
      const rank=x=>x.s.is_headline||x.s.category==='headlines'?2:(state.interests.has(x.s.category)?1:0);
      return rank(b)-rank(a)||a.index-b.index;
    });
    ordered.filter(x=>aiFilter==='all'||x.s.category===aiFilter).forEach(({s},i)=>{
      if(typeof s.title!=='string'||typeof s.summary!=='string'||!s.source||typeof s.source.url!=='string')return;
      const safe=validUrl(s.source.url);if(!safe)return;
      const card=mk('details','ai-story-card'+((s.is_headline||s.category==='headlines')?' ai-headline-card':''));
      const summary=mk('summary','ai-story-summary');
      const meta=mk('div','ai-story-top');
      const isHeadline=s.is_headline||s.category==='headlines';
      meta.append(mk('span','ai-story-number',String(i+1).padStart(2,'0')),
        mk('span','ai-story-category',s.categoryLabel||catLabels[s.category]||'新闻'),
        mk('span','ai-story-personal',isHeadline?'▣ 编辑头条':(state.interests.has(s.category)?'◆ 你的兴趣':'◇ 综合新闻')));
      const title=mk('h3','',s.title.slice(0,220));title.lang='auto';
      summary.append(meta,title,mk('p','ai-story-preview',s.summary.slice(0,320)),mk('span','ai-story-toggle','展开解读 ↗'));
      card.append(summary);
      const more=mk('div','ai-story-expanded');
      more.append(mk('div','ai-story-section-label','CONTEXT / 摘要背景'),mk('p','',s.context||'建议阅读原始报道进一步了解。'),
        mk('div','ai-story-section-label','UNCERTAINTY / 待核实'),mk('p','',s.uncertainty||'仅基于 RSS 简讯，尚需核实更多细节。'));
      const source=mk('a','ai-source','↗ '+(s.source.name||'公开新闻来源')+' · 阅读原文');
      source.href=safe;source.target='_blank';source.rel='noopener noreferrer';more.append(source);
      card.append(more);list.append(card);
    });
    if(!list.childElementCount)list.append(mk('p','ai-no-category','这一类别本期尚无可用报道。换个栏目看看。'));
  }
  function openAI(){changeEdition('ai');}
  function closeAI(){changeEdition('morning');}

  const state={
    index:0,
    edition:'morning',
    lens:'brief',
    filterSaved:false,
    reader:false,
    settings:false,
    motion:!window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    spoiler:true,
    largeText:false,
    saved:new Set(),
    interests:new Set(),
    theme:'auto',
    layout:'overdrive',
    privateMode:false,
    onboarding:false,
    onboarded:false,
    lastFocus:null,
    toastTimer:null
  };
  try {
    const prefs=JSON.parse(localStorage.getItem(storageKey)||'{}');
    if (prefs?.version===43) {
      if (typeof prefs.motion==='boolean') state.motion=prefs.motion;
      if (typeof prefs.spoiler==='boolean') state.spoiler=prefs.spoiler;
      if (typeof prefs.largeText==='boolean') state.largeText=prefs.largeText;
      if (typeof prefs.onboarded==='boolean') state.onboarded=prefs.onboarded;
      if (Array.isArray(prefs.saved)) state.saved=new Set(prefs.saved.filter(v=>typeof v==='string').slice(0,500));
      if (Array.isArray(prefs.interests)) state.interests=new Set(prefs.interests.filter(v=>allowedInterests.has(v)));
      if (allowedThemes.has(prefs.theme)) state.theme=prefs.theme;
      if (['overdrive','quiet'].includes(prefs.layout)) state.layout=prefs.layout;
    }
  } catch(e) { /* Browsers with disabled storage operate with in-memory defaults. */ }
  // A shared appearance link only carries UI style, never interests, saved news or identity.
  try {
    const params=new URLSearchParams(location.search);
    const sharedTheme=params.get('theme'),sharedLayout=params.get('layout');
    if (allowedThemes.has(sharedTheme)) state.theme=sharedTheme;
    if (['overdrive','quiet'].includes(sharedLayout)) state.layout=sharedLayout;
  } catch(e){}
  function persist(){
    if(state.privateMode)return;
    const payload={version:43,onboarded:state.onboarded,motion:state.motion,spoiler:state.spoiler,largeText:state.largeText,theme:state.theme,layout:state.layout,interests:[...state.interests],saved:[...state.saved]};
    try{localStorage.setItem(storageKey,JSON.stringify(payload));}catch(e){}
  }
  function forget(){try{localStorage.removeItem(storageKey);localStorage.removeItem(oldStorageKey);}catch(e){}}
  function getItems(){return data.items;}
  function item(){return getItems()[state.index];}
  function validUrl(url){try{const u=new URL(url);return u.protocol==='https:'?u.href:null;}catch(e){return null}}
  function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>el.classList.remove('show'),1900);}
  function label(index){const s=getItems()[index];return s?.categoryLabel||'新闻';}
  function indices(){
    const all=getItems().map((x,i)=>i);
    // Local ranking only. Public news, source links and original facts are unchanged.
    const score=i=>state.interests.has(getItems()[i].category)?1:0;
    const ordered=all.sort((a,b)=>score(b)-score(a)||a-b);
    return state.filterSaved?ordered.filter(i=>state.saved.has(getItems()[i].id)):ordered;
  }
  function relevance(s){
    if(!state.interests.size)return '你还没有选择兴趣领域。当前展示所有公共新闻，没有个性化排序。';
    if(state.interests.has(s.category))return `你在本机关注了「${s.categoryLabel}」，所以这条新闻会优先显示。这个选择不会上传至服务器。`;
    return '这条不属于你选择的主要领域，但仍保留在新闻池中，让你有机会了解兴趣圈外的变化。';
  }
  function reading(s){
    const view=s.reading?.[state.lens]||s.reading.brief;
    return state.lens==='personal'?{...view,paragraphs:[relevance(s),...view.paragraphs]}:view;
  }
  function firstAvailable(){return indices()[0]??0;}
  function bounce(){if(!state.motion || state.edition!=='morning')return;app.classList.remove('switching');void app.offsetWidth;app.classList.add('switching');}
  function updateTheme(){
    app.dataset.tone=state.theme==='auto'?({violet:'purple',orange:'amber'}[item().tone]||item().tone||'lime'):state.theme;
    app.dataset.motion=state.motion?'on':'off';app.dataset.largeText=String(state.largeText);
    app.dataset.edition=state.edition;app.dataset.layout=state.layout;
  }
  function iconNumber(i){return String(i+1).padStart(2,'0');}
  function renderQueue(){
    const q=$('#queueList');q.replaceChildren();
    const strip=$('#mobileStoryStrip');strip.replaceChildren();
    const visible=indices();
    if(!visible.length && state.filterSaved){
      const n=mk('div','queue-none','尚无收藏。点击 ☆ 就能加入。');q.append(n);
      const b=mk('button','','暂无收藏 · 点击取消筛选');b.dataset.action='saved-only';strip.append(b);
      renderMore([]);return;
    }
    visible.forEach(i=>{
      const s=getItems()[i];
      const b=mk('button','queue-card'+(i===state.index?' active':''));b.type='button';b.dataset.story=String(i);b.setAttribute('aria-current',i===state.index?'true':'false');
      b.append(mk('span','queue-number',iconNumber(i)));
      const middle=mk('span','queue-description');middle.append(mk('small','',s.categoryLabel.toUpperCase()),mk('strong','',s.title));b.append(middle);q.append(b);
      const chip=mk('button',i===state.index?'active':'');chip.type='button';chip.dataset.story=String(i);chip.setAttribute('aria-current',i===state.index?'true':'false');chip.append(mk('small','',iconNumber(i)+' / '+s.categoryLabel),mk('strong','',s.categoryLabel==='AI 科技'?s.art+' · '+s.categoryLabel:s.categoryLabel));strip.append(chip);
    });
    renderMore(visible);
  }
  function renderMore(visible){
    const list=$('#moreList');list.replaceChildren();
    const others=visible.filter(i=>i!==state.index);
    const beyond=others.find(i=>state.interests.size && !state.interests.has(getItems()[i].category));
    const chosen=others.slice(0,2);
    if(beyond!==undefined && !chosen.includes(beyond))chosen[1]=beyond;
    for(const i of chosen){
      const s=getItems()[i];
      const b=mk('button','more-card');b.type='button';b.dataset.story=String(i);
      const mark=mk('span','more-card-index',iconNumber(i));
      const body=mk('span','more-card-body');
      body.append(mk('small','',state.interests.has(s.category)?'◈ 你的兴趣频道':'✳ 公共探索 / '+s.categoryLabel),mk('strong','',s.title));
      b.append(mark,body,mk('span','more-card-arrow','↗'));list.append(b);
    }
    txt('#personalSortLabel',state.interests.size?'按照本机 '+state.interests.size+' 个兴趣排序 · 全部新闻保留':'所有新闻 · 公开原始排序');
  }
  function updateTabs(){
    $$('.lens-tabs [data-lens]').forEach(b=>{
      const yes=b.dataset.lens===state.lens;b.classList.toggle('active',yes);b.setAttribute('aria-selected',String(yes));
    });
    $$('.reader-lenses [data-lens]').forEach(b=>b.classList.toggle('active',b.dataset.lens===state.lens));
  }
  function renderMain(){
    const s=item();updateTheme();
    txt('#heroBackNum',iconNumber(state.index));txt('#heroSymbol',s.art);txt('#heroSymbolSub',s.categoryLabel);
    txt('#heroChannel',s.channel);txt('#heroPriority',s.priority);txt('#heroDek',s.dek);txt('#heroPublished',s.published);
    const headline=$('#heroHeadline');headline.replaceChildren();
    (s.headline||[s.title]).forEach((line,i,lines)=>headline.append(mk('span',i===lines.length-1?'hero-impact':'',line)));
    txt('#decodeProgress','FILE '+iconNumber(state.index)+' / '+String(getItems().length).padStart(2,'0'));
    const view=reading(s);
    txt('#readEyebrow',view.eyebrow);txt('#readTitle',view.title);
    txt('#readText',view.paragraphs.slice(0,1).join('\n\n'));
    $('#decodeArticle').scrollTop=0;
    const sources=(s.sources||[]).filter(src=>validUrl(src.url));
    txt('#sourceName',sources.length?sources[0].name:'尚无可核实链接');
    const quick=$('#sourceQuick');
    if(sources.length){quick.href=validUrl(sources[0].url);quick.removeAttribute('aria-disabled');quick.tabIndex=0;}
    else{quick.removeAttribute('href');quick.setAttribute('aria-disabled','true');quick.tabIndex=-1;}
    const marked=state.saved.has(s.id);
    const save=$('.hero-save');save.textContent=marked?'★':'☆';save.setAttribute('aria-pressed',String(marked));save.setAttribute('aria-label',marked?'取消收藏新闻':'收藏新闻');
    $('#readerSave').textContent=marked?'★':'☆';$('#readerSave').setAttribute('aria-pressed',String(marked));
    const favButton=$('#favoritesButton');favButton.classList.toggle('active',state.filterSaved);favButton.setAttribute('aria-pressed',String(state.filterSaved));
    txt('#bottomEdition',state.filterSaved?'收藏 · '+indices().length+' 条':'早间情报 · '+getItems().length+' 条');
    updateTabs();renderQueue();
    if(state.reader)renderReader();
  }
  function renderReader(){
    const s=item();const view=reading(s);
    txt('#readerCode',s.channel);txt('#readerArt',iconNumber(state.index));txt('#readerTitle',s.title);txt('#readerDate',s.published);
    const body=$('#readerCopy');body.replaceChildren(mk('span','',view.eyebrow),mk('h3','',view.title));
    view.paragraphs.forEach(p=>body.append(mk('p','',p)));
    const src=$('#readerSources');src.replaceChildren();
    (s.sources||[]).forEach(source=>{
      const safe=validUrl(source.url);if(!safe)return;
      const a=mk('a','source-link');a.href=safe;a.target='_blank';a.rel='noopener noreferrer';
      a.append(mk('span','',source.name),mk('span','','↗'));src.append(a);
    });
    if(!src.children.length)src.append(mk('p','','尚无可以核实的外部来源链接。'));
    updateTabs();
    $('#readerSave').textContent=state.saved.has(s.id)?'★':'☆';
  }
  function setIndex(next, animate=true){
    const available=indices();
    if(!available.length){toast('还没有收藏的新闻');return;}
    if(!available.includes(next))return;
    if(state.index===next&&animate){bounce();return;}
    state.index=next;state.lens='brief';renderMain();
    if(animate)bounce();
    const selected=$(`#mobileStoryStrip button[data-story="${next}"]`);
    if(selected){const strip=$('#mobileStoryStrip');strip.scrollTo({left:selected.offsetLeft-strip.offsetLeft-12,behavior:state.motion?'smooth':'instant'});}
  }
  function changeStory(dir){
    const arr=indices();if(!arr.length){toast('没有可切换的新闻');return;}
    const n=arr.indexOf(state.index);setIndex(arr[(n+dir+arr.length)%arr.length]);
  }
  function setLens(lens){
    if(!['brief','personal','verify'].includes(lens))return;
    state.lens=lens;
    renderMain();
    if(state.reader){$('#readerCopy').parentElement.scrollTop=0;}
  }
  function save(){
    const id=item().id;
    if(state.saved.has(id)){state.saved.delete(id);toast('☆ 已取消收藏');}else{state.saved.add(id);toast('★ 已保存到本机收藏');}
    persist();
    if(state.filterSaved&&!state.saved.has(id)){
      const available=indices();
      if(available.length){state.index=available[0];state.lens='brief';}else{state.filterSaved=false;toast('收藏夹已清空');}
    }
    renderMain();
  }
  const placeholders={
    noon:{num:'02',eyebrow:'MIDDAY / AWAITING BRIEF',title:'午间简报\n尚未同步。',desc:'目前只有 10 月 8 日早间的已核实快照。ChatGPT 的中午定时消息与此网页尚未自动同步。'},
    evening:{num:'03',eyebrow:'EVENING / AWAITING BRIEF',title:'夜间回顾\n尚未同步。',desc:'晚上新的报道必须重新收集、核实后才能显示。当前网页不会重复早报冒充实时更新。'},
    breaking:{num:'!!',eyebrow:'BREAKING / NO LIVE FEED',title:'紧急播报\n未连接实时源。',desc:'此网页不具备实时地震、天气、交通或新闻报警能力。紧急情况请查看日本气象厅及所在地政府的官方警报。'}
  };
  function changeEdition(edition){
    if(!['morning','noon','evening','breaking','ai'].includes(edition))return;
    const morning=edition==='morning'&&!aiEditionForSession('morning');
    const aiMode=edition==='ai'||edition==='noon'||edition==='evening'||(edition==='morning'&&!morning);
    state.edition=edition;
    aiOpen=aiMode;
    if(edition==='ai') aiSession=latestAISession();
    else if(['morning','noon','evening'].includes(edition)) { aiSession=edition;aiFilter='all'; }
    $$('.edition-tabs [data-edition-choice]').forEach(b=>{
      const active=b.dataset.editionChoice===edition;
      b.classList.toggle('active',active);
      b.setAttribute('aria-current',active?'page':'false');
    });
    $('#aiDesk').hidden=!aiMode;
    $('#emptyEdition').hidden=edition!=='breaking';
    $('#queueList').hidden=!morning;
    $('.queue').hidden=!morning;
    $('.hero').hidden=!morning;
    $('.decode').hidden=!morning;
    $('#mobileStoryStrip').hidden=!morning;
    $('#moreSignals').hidden=!morning;
    $('.scroll-nudge').hidden=!morning;
    if(aiMode){
      renderAI();
      txt('#bottomEdition',aiSessionNames[aiSession]+' · 公共 AI');
      txt('#snapshotStatus','综合新闻 / AI 整理 · RSS 来源');
      if(state.reader)closeReader();
    }else if(edition==='breaking'){
      const e=placeholders.breaking;
      txt('#emptyArt',e.num);txt('#emptyEyebrow',e.eyebrow);txt('#emptyCopy',e.desc);
      const heading=$('#emptyHeading');heading.replaceChildren();
      e.title.split('\n').forEach((line,i)=>{if(i)heading.append(document.createElement('br'));heading.append(document.createTextNode(line));});
      txt('#bottomEdition','不提供实时报警');txt('#snapshotStatus','NOT A LIVE ALERT');
      if(state.reader)closeReader();
    }else{
      txt('#snapshotStatus',jstDay()==='2026-10-08'?'2026.10.08 / 早间编辑快照':'2026.10.08 / 历史新闻存档');renderMain();
    }
    app.dataset.edition=edition;
    app.dataset.newsMode=aiMode?'feed':'archive';
    if(state.motion && morning)bounce();
    if(window.scrollY>0) window.scrollTo({top:0,behavior:'instant'});
  }
  function openReader(){
    if(state.edition!=='morning')return;
    state.lastFocus=document.activeElement;
    state.reader=true;$('#readerOverlay').hidden=false;
    renderReader();$('.reader-scroll').scrollTop=0;
    $('.reader-top [data-action="close-reader"]').focus({preventScroll:true});
  }
  function closeReader(){
    state.reader=false;$('#readerOverlay').hidden=true;
    if(state.lastFocus?.isConnected)state.lastFocus.focus({preventScroll:true});
  }
  function renderPersonalOptions(){
    for(const selector of ['#interestOptions','#onboardingPicks']){
      const box=$(selector);box.replaceChildren();
      for(const interest of interests){
        const active=state.interests.has(interest.id);
        const button=mk('button','interest-chip'+(active?' selected':''),interest.symbol+' '+interest.label);
        button.type='button';button.dataset.interest=interest.id;
        button.setAttribute('aria-pressed',String(active));box.append(button);
      }
    }
    const themesBox=$('#themeOptions');themesBox.replaceChildren();
    for(const theme of themes){
      const btn=mk('button','theme-chip'+(state.theme===theme.id?' active':''));btn.type='button';btn.dataset.themeChoice=theme.id;
      const dot=mk('i','');dot.style.background=theme.color;
      btn.append(dot,mk('span','',theme.label));btn.setAttribute('aria-pressed',String(state.theme===theme.id));themesBox.append(btn);
    }
    $$('#layoutOptions [data-layout-choice]').forEach(btn=>{
      const active=state.layout===btn.dataset.layoutChoice;
      btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active));
    });
    $('#motionToggle').checked=state.motion;
    $('#spoilerToggle').checked=state.spoiler;
    $('#largeTextToggle').checked=state.largeText;
    $('#privateModeToggle').checked=state.privateMode;
  }
  function toggleInterest(value){
    if(!allowedInterests.has(value))return;
    if(state.interests.has(value))state.interests.delete(value);else state.interests.add(value);
    state.filterSaved=false;state.index=firstAvailable();state.lens='brief';
    persist();renderMain();renderPersonalOptions();bounce();
  }
  function applyTheme(value){
    if(!allowedThemes.has(value))return;
    state.theme=value;persist();updateTheme();renderPersonalOptions();bounce();
  }
  function applyLayout(value){
    if(!['overdrive','quiet'].includes(value))return;
    state.layout=value;persist();updateTheme();renderPersonalOptions();
  }
  function openOnboarding(){
    state.onboarding=true;$('#onboardingOverlay').hidden=false;
    renderPersonalOptions();
    $('#onboardingOverlay [data-action=onboarding-done]').focus({preventScroll:true});
  }
  function closeOnboarding(){
    state.onboarding=false;state.onboarded=true;$('#onboardingOverlay').hidden=true;
    persist();renderMain();
    $('.settings-btn').focus({preventScroll:true});
  }
  function resetGuest(){
    forget();state.interests.clear();state.saved.clear();state.theme='auto';state.layout='overdrive';
    state.motion=!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    state.spoiler=true;state.largeText=false;state.onboarded=false;state.privateMode=true;
    state.filterSaved=false;state.lens='brief';state.index=0;
    renderMain();renderPersonalOptions();toast('本机的星闻数据已经清空');
  }
  async function shareTheme(){
    const url=new URL(location.href);url.search='';url.hash='';
    url.searchParams.set('theme',state.theme);url.searchParams.set('layout',state.layout);
    try{
      await navigator.clipboard.writeText(url.toString());
      toast('已复制外观链接 · 不含个人信息');
    }catch(e){
      // Clipboard may be blocked on non-HTTPS contexts; show an explicit selectable link.
      const input=mk('input','share-fallback');input.value=url.toString();input.readOnly=true;
      const panel=$('.settings-extras');panel.append(input);input.focus();input.select();
      toast('复制受限：已选中分享链接，可手动复制');
    }
  }
  function openSettings(){
    state.lastFocus=document.activeElement;state.settings=true;
    $('#settingsOverlay').hidden=false;
    renderPersonalOptions();
    $('.settings-heading [data-action="close-settings"]').focus({preventScroll:true});
  }
  function closeSettings(){
    state.settings=false;$('#settingsOverlay').hidden=true;
    if(state.lastFocus?.isConnected)state.lastFocus.focus({preventScroll:true});
  }
  function toggleSavedOnly(){
    if(state.edition!=='morning'){changeEdition('morning');}
    if(!state.filterSaved && !state.saved.size){toast('还没有收藏，先点击 ☆ 收藏一条吧');return;}
    state.filterSaved=!state.filterSaved;
    const arr=indices();if(arr.length&&!arr.includes(state.index)){state.index=arr[0];state.lens='brief';}
    renderMain();
  }
  app.addEventListener('click', event=>{
    const b=event.target.closest('button');if(!b||!app.contains(b))return;
    if(b.dataset.aiFilter){aiFilter=b.dataset.aiFilter;renderAI();return;}
    if(b.dataset.aiSession){aiSession=b.dataset.aiSession;aiFilter='all';if(state.edition==='noon'||state.edition==='evening'){state.edition='ai';app.dataset.edition='ai';$$('.edition-tabs [data-edition-choice]').forEach(tab=>{const active=tab.dataset.editionChoice==='ai';tab.classList.toggle('active',active);tab.setAttribute('aria-current',active?'page':'false');});}renderAI();txt('#bottomEdition',aiSessionNames[aiSession]+' · 公共 AI');return;}
    if(b.dataset.editionChoice){changeEdition(b.dataset.editionChoice);return;}
    if(b.dataset.interest){toggleInterest(b.dataset.interest);return;}
    if(b.dataset.themeChoice){applyTheme(b.dataset.themeChoice);return;}
    if(b.dataset.layoutChoice){applyLayout(b.dataset.layoutChoice);return;}
    if(b.dataset.story!==undefined){setIndex(Number(b.dataset.story));if(b.closest('#moreList'))$('#hero').scrollIntoView({behavior:state.motion?'smooth':'instant',block:'start'});return;}
    if(b.dataset.lens){setLens(b.dataset.lens);return;}
    const action=b.dataset.action;
    if(action==='prev'){changeStory(-1);return;}
    if(action==='next'){changeStory(1);return;}
    if(action==='save'){save();return;}
    if(action==='open-reader'){openReader();return;}
    if(action==='close-reader'){closeReader();return;}
    if(action==='open-ai'){openAI();return;}
    if(action==='close-ai'){closeAI();return;}
    if(action==='settings'){openSettings();return;}
    if(action==='close-settings'){closeSettings();return;}
    if(action==='morning'){changeEdition('morning');return;}
    if(action==='saved-only'){toggleSavedOnly();return;}
    if(action==='onboarding-done'||action==='onboarding-skip'){closeOnboarding();return;}
    if(action==='share-theme'){shareTheme();return;}
    if(action==='reset-guest'){resetGuest();return;}
  });
  $$('.backdrop').forEach(backdrop=>backdrop.addEventListener('click',()=>{
    if(!$('#readerOverlay').hidden)closeReader();
    else if(!$('#settingsOverlay').hidden)closeSettings();
  }));
  $('#motionToggle').addEventListener('change',e=>{state.motion=e.target.checked;updateTheme();app.classList.remove('switching');persist();});
  $('#spoilerToggle').addEventListener('change',e=>{state.spoiler=e.target.checked;persist();toast(state.spoiler?'防剧透已开启':'防剧透已关闭（当前数据本身无剧情）');});
  $('#largeTextToggle').addEventListener('change',e=>{state.largeText=e.target.checked;updateTheme();persist();});
  $('#privateModeToggle').addEventListener('change',e=>{
    state.privateMode=e.target.checked;
    if(state.privateMode){forget();toast('临时模式已开启，不再写入本机存储');}
    else{persist();toast('本机偏好保存已恢复');}
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      if(aiOpen)changeEdition('morning');else if(state.onboarding)closeOnboarding();else if(state.settings)closeSettings();else if(state.reader)closeReader();return;
    }
    if(state.settings||state.onboarding||state.edition!=='morning')return;
    const tag=document.activeElement?.tagName||'';
    if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return;
    if(e.key==='ArrowLeft'){e.preventDefault();changeStory(-1);}
    if(e.key==='ArrowRight'){e.preventDefault();changeStory(1);}
    if(e.key==='1')setLens('brief');if(e.key==='2')setLens('personal');if(e.key==='3')setLens('verify');
  });
  // Touch gestures on the visual panel only, so vertical scrolling in reading content remains usable.
  const hero=$('#hero');let sx=0,sy=0;
  hero.addEventListener('touchstart',e=>{sx=e.changedTouches[0]?.clientX||0;sy=e.changedTouches[0]?.clientY||0;},{passive:true});
  hero.addEventListener('touchend',e=>{
    const dx=(e.changedTouches[0]?.clientX||0)-sx,dy=(e.changedTouches[0]?.clientY||0)-sy;
    if(Math.abs(dx)>55&&Math.abs(dy)<65&&state.edition==='morning')changeStory(dx<0?1:-1);
  },{passive:true});
  const drawer=$('.reader');
  let tx=0,ty=0;
  drawer.addEventListener('touchstart',e=>{tx=e.changedTouches[0]?.clientX||0;ty=e.changedTouches[0]?.clientY||0;},{passive:true});
  drawer.addEventListener('touchend',e=>{
    const dx=(e.changedTouches[0]?.clientX||0)-tx,dy=(e.changedTouches[0]?.clientY||0)-ty;
    if(Math.abs(dx)>100&&Math.abs(dy)<55){changeStory(dx<0?1:-1);}
  },{passive:true});
  state.index=firstAvailable();
  renderMain();
  if(!state.onboarded)openOnboarding();
  // Always fetch only the public shared AI file; NEVER transmit interests or favorites.
  if(location.protocol!=='file:'){
    fetch('./ai-briefs.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('AI publication not found');return r.json()}).then(payload=>{
      if(payload?.schema!==1||!Array.isArray(payload.editions))throw new Error('Invalid AI publication');
      publicAI=payload;
      if(aiOpen){if(state.edition==='ai')aiSession=latestAISession();renderAI();}else if(state.edition==='morning'&&aiEditionForSession('morning')){changeEdition('morning');}else{const today=publicAI.editions.some(e=>e?.date===jstDay()&&Array.isArray(e.items)&&e.items.length);if(today)txt('#aiTopState','✳ NEWS ONLINE');}
    }).catch(()=>{if(aiOpen)renderAI();});
  }

  // A newer public JSON replaces the offline snapshot. It never contains personal profiles.
  if(location.protocol!=='file:'){
    fetch('./news.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('fetch failed');return r.json()}).then(v=>{
      if(v?.edition?.id && Array.isArray(v.items) && v.items.length && v.edition.id!==data.edition.id){
        data=v;state.index=firstAvailable();state.filterSaved=false;state.lens='brief';renderMain();toast('已加载新的公共新闻快照');
      }
    }).catch(()=>{});
    if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost')){
      window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}),{once:true});
    }
  }
})();
