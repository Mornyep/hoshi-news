(() => {
  'use strict';
  const app = document.getElementById('app');
  if (!app) return;
  const $ = q => app.querySelector(q);
  const $$ = q => Array.from(app.querySelectorAll(q));
  const locales=window.StarnewsLocales;
  const positions=window.StarnewsReading;
  let readerPosition=null, restoringPosition=false, positionTimer=null, readerReturn=null;
  const supported=Object.keys(locales.names);
  const detectLocale=()=>{for(const language of navigator.languages||[navigator.language]){if(/^zh/i.test(language))return /TW|HK|Hant/i.test(language)?'zh-TW':'zh-CN';if(/^ja/i.test(language))return 'ja';if(/^en/i.test(language))return 'en';}return 'en';};
  let locale=detectLocale();
  const t=value=>{
    if(typeof value!=='string')return String(value??'');
    const trimmed=value.trim(), translated=locales.messages[locale][trimmed]??locales.messages[locale][value];
    return translated===undefined?value:value.replace(trimmed,translated);
  };
  // Capture only initial interface nodes. Reporting text is selected from localized data instead.
  const interfaceText=[];const walker=document.createTreeWalker(app,NodeFilter.SHOW_TEXT);
  while(walker.nextNode()){const node=walker.currentNode;if(node.textContent.trim())interfaceText.push([node,node.textContent]);}
  const interfaceAttributes=[];
  app.querySelectorAll('[aria-label],[placeholder]').forEach(el=>{for(const name of ['aria-label','placeholder'])if(el.hasAttribute(name))interfaceAttributes.push([el,name,el.getAttribute(name)]);});
  function translateInterface(){
    document.documentElement.lang=locale;document.title=locale==='en'?'STARNEWS // BREAK':locale==='ja'?'星聞 // BREAK':'星闻 // BREAK';
    interfaceText.forEach(([node,original])=>{if(node.isConnected)node.textContent=t(original);});
    interfaceAttributes.forEach(([el,name,original])=>el.setAttribute(name,t(original)));
    $('#languageSelect').value=locale;
  }
  const sessionName=session=>t({morning:'早间',noon:'午间',evening:'晚间'}[session]||'公开');
  const languageName=language=>locales.names[language]||(language==='und'?t('原文语言未核实'):language)||'und';
  const fallbackText=language=>t('原语回退')+' · '+languageName(language)+' — '+t('未提供可靠译文，保留原文。');
  function localizeStory(story){
    const translated=story.localized?.[locale];
    const language=translated?.language||story.source?.language||story.language||(/[\u3040-\u30ff]/.test(story.title||'')?(/[\u4e00-\u9fff]/.test(story.summary||'')&&!/[\u3040-\u30ff]/.test(story.summary||'')?'und':'ja'):/^[\x00-\x7f]+$/.test(story.title||'')?'en':'zh-CN');
    const fallback=!translated||translated.status==='fallback';
    return {...story,...(translated||{}),source:story.source,localized:story.localized,
      originalLanguage:language,localeFallback:fallback&&language!==locale};
  }
  function localizeItem(story){
    if(story.public)return story;
    const value=localizeStory(story), translated=story.localized?.[locale];
    const categoryLabel=t(interests.find(i=>i.id===story.category)?.label||story.categoryLabel);
    return {...value,categoryLabel,headline:translated?headlineLines(value.title):story.headline,
      dek:translated?.summary||story.dek,channel:categoryLabel,
      priority:categoryLabel,reading:translated?.reading||story.reading};
  }
  const txt = (selector, value) => {const el=$(selector);if (el) el.textContent=t(value);};
  const mk = (tag, className, textContent) => {
    const el=document.createElement(tag);
    if(className)el.className=className;
    if(textContent!==undefined)el.textContent=t(textContent);
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
  let editionItems=null;
  // Public AI publication is independent of individual preferences.
  let publicAI={schema:1,editions:[]};
  let publicArchive={schema:1,editions:[]};
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
      .filter(e=>e&&e.date===day&&['morning','noon','evening'].includes(e.session)&&Array.isArray(e.items)&&(e.items.length||e.briefs?.length))
      .sort((a,b)=>String(b.generated_at||'').localeCompare(String(a.generated_at||'')));
    return matches.find(e=>e.locale===locale)?.session||matches[0]?.session||'morning';
  }
  function aiEditionForSession(session){
    const matches=(Array.isArray(publicAI.editions)?publicAI.editions:[]).filter(e=>e&&e.date===jstDay()&&e.session===session&&Array.isArray(e.items)&&(e.items.length||e.briefs?.length));
    return matches.find(e=>e.locale===locale)||matches.find(e=>e.items.some(s=>s.localized?.[locale]))||matches[0];
  }
  function renderAI(){
    renderBriefs(aiEditionForSession(aiSession));
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
      txt('#aiStatus',sessionName(aiSession)+' · '+t('简报尚未发布。'));
      txt('#aiGenerated','没有完成新一期生成 · 不显示旧报道冒充实时新闻');
      txt('#aiIntro','后台按公开新闻源整理综合新闻，若当期未成功生成，保留透明的空状态。');
      txt('#aiEditNote','暂无本期数据，不能根据用户兴趣推测新闻');
      const blank=mk('div','ai-blank');
      blank.append(mk('strong','','NO NEW EDITION'),mk('p','','你可以切换到已发布的其他时段；上午静态存档会注明原始日期。'));
      const back=mk('button','ai-blank-back','↗ 查看历史新闻存档');back.type='button';back.dataset.action='archive';blank.append(back);
      list.append(blank);txt('#aiTopState','✳ PUBLIC NEWS');return;
    }
    txt('#aiTopState','✳ NEWS ONLINE');
    const categories=new Set(edition.items.map(s=>s.category));
    txt('#aiStatus',sessionName(aiSession)+' · '+t('综合新闻')+' · '+edition.items.length);
    txt('#aiGenerated',edition.date+' · '+(edition.provider||'PUBLIC')+' / '+(edition.model||'AI'));
    txt('#aiIntro',edition.editorial_policy?'优先展示资料充分的报道；短消息单列，正文获取状态以档案标注为准。':'先展示综合头条与有公共价值的重要领域，再考虑个人兴趣。AI 仅整理原报道标题与简讯，不代表已阅读全文。');
    txt('#aiEditNote',categories.size+' · '+t('综合头条优先 · 各类别适当兼顾 · 兴趣只影响次序'));
    const ordered=edition.items.map((raw,index)=>({s:localizeStory(raw),index})).sort((a,b)=>{
      const rank=x=>x.s.is_headline||x.s.category==='headlines'?2:(state.interests.has(x.s.category)?1:0);
      return rank(b)-rank(a)||a.index-b.index;
    });
    ordered.filter(x=>(aiFilter==='all'||x.s.category===aiFilter)&&(!state.query||[x.s.title,x.s.summary,x.s.source.name].join(' ').toLocaleLowerCase(locale).includes(state.query.toLocaleLowerCase(locale)))).forEach(({s},i)=>{
      if(typeof s.title!=='string'||typeof s.summary!=='string'||!s.source||typeof s.source.url!=='string')return;
      const safe=validUrl(s.source.url);if(!safe)return;
      const card=mk('details','ai-story-card'+((s.is_headline||s.category==='headlines')?' ai-headline-card':''));
      const summary=mk('summary','ai-story-summary');
      const meta=mk('div','ai-story-top');
      const isHeadline=s.is_headline||s.category==='headlines';
      meta.append(mk('span','ai-story-number',String(i+1).padStart(2,'0')),
        mk('span','ai-story-category',t(catLabels[s.category]||'新闻')),
        mk('span','ai-story-personal',isHeadline?'▣ '+t('综合头条'):(state.interests.has(s.category)?'◆ '+t('与你有关'):'◇ '+t('综合新闻'))));
      const title=mk('h3','',s.title.slice(0,220));title.lang=s.localeFallback?s.originalLanguage:locale;
      summary.append(meta,title,mk('p','ai-story-preview',s.summary.slice(0,320)),mk('span','ai-story-toggle','展开解读 ↗'));
      if(s.localeFallback)summary.append(mk('small','language-fallback',fallbackText(s.originalLanguage)));
      card.append(summary);
      const more=mk('div','ai-story-expanded');
      more.append(mk('div','ai-story-section-label','CONTEXT / 摘要背景'),mk('p','',s.context||'建议阅读原始报道进一步了解。'),
        mk('div','ai-story-section-label','UNCERTAINTY / 待核实'),mk('p','',s.uncertainty||'仅基于 RSS 简讯，尚需核实更多细节。'));
      const source=mk('a','ai-source','↗ '+(s.source.name||'公开新闻来源')+' · '+t('阅读原文'));
      source.href=safe;source.target='_blank';source.rel='noopener noreferrer';more.append(source);
      appendArchive(more,s.archive);appendEventEvidence(more,s.event);
      card.append(more);list.append(card);
    });
    if(!list.childElementCount)list.append(mk('p','ai-no-category','这一类别本期尚无可用报道。换个栏目看看。'));
  }
  function openAI(){changeEdition('ai');}
  function closeAI(){changeEdition('morning');}

  const state={
    index:0,
    query:'',
    edition:'morning',
    archiveView:false,
    editionChosen:false,
    sessionChosen:false,
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
      if(supported.includes(prefs.locale))locale=prefs.locale;
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
    const payload={version:43,locale,onboarded:state.onboarded,motion:state.motion,spoiler:state.spoiler,largeText:state.largeText,theme:state.theme,layout:state.layout,interests:[...state.interests],saved:[...state.saved]};
    try{localStorage.setItem(storageKey,JSON.stringify(payload));}catch(e){}
  }
  function forget(){positions?.clear();try{localStorage.removeItem(storageKey);localStorage.removeItem(oldStorageKey);}catch(e){}}
  function publicItems(edition,includeBriefs=false){
    if(!edition||!Array.isArray(edition.items))return [];
    const symbols={headlines:'✳',world:'◎',japan:'JP',politics:'⚑',economy:'↗',society:'◇',health:'✚',science:'SCI',environment:'♧',culture:'✳',sports:'◩',tech:'TECH',game:'GAME'};
    return [...edition.items,...(includeBriefs&&Array.isArray(edition.briefs)?edition.briefs:[])].filter(s=>typeof s.title==='string'&&typeof s.summary==='string'&&validUrl(s.source?.url)).map(s=>{
      s=localizeStory(s);
      const category=t(interests.find(i=>i.id===s.category)?.label||'综合头条'),session=sessionName(edition.session);
      const text=(eyebrow,title,paragraphs)=>({eyebrow,title,paragraphs});
      return {
        id:'public:'+edition.date+':'+edition.session+':'+(s.id||s.source.url),
        public:true,event:s.event,evidenceDepth:s.evidence_depth,archive:s.archive,originalLanguage:s.originalLanguage,localeFallback:s.localeFallback,is_headline:Boolean(s.is_headline||s.category==='headlines'),
        title:s.title,category:s.category,categoryLabel:category,art:symbols[s.category]||'✳',tone:'lime',
        channel:session+' / '+category,priority:s.is_headline?'综合头条':category,
        headline:headlineLines(s.title),dek:s.summary,
        published:edition.date+' · '+session,
        sources:(s.event?.sources?.length?s.event.sources:[{name:s.source.name||'公开报道',url:s.source.url,published_at:s.source.published_at||s.published_at,retrieved_at:s.source.retrieved_at}]),
        reading:{
          brief:text('01 // RSS / AI',s.title,[s.summary,s.context||'请阅读原始报道了解更多背景。']),
          personal:text('02 // CONTEXT',s.title,[s.context||s.summary]),
          verify:text('03 // SOURCE','原始来源与待核实信息',s.archive?.full_text_acquired?[s.archive.notice,...(s.archive.sections||[]).filter(x=>x.id==='verification').map(x=>x.text)]:[s.uncertainty||'仅根据 RSS 标题与简讯整理，尚需核实更多细节。','本条 AI 摘要基于 RSS 标题与简讯，未经独立全文核验；请以原始报道和后续更新为准。'])
        }
      };
    });
  }
  function headlineLines(title){
    const tokens=title.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*|[^\x00-\x7F]|\s+|./gu)||[title];
    const lines=[];let line='',width=0;
    for(const token of tokens){
      const size=Array.from(token).reduce((n,c)=>n+(c.charCodeAt(0)<128?.55:1),0);
      if(line&&width+size>12&&lines.length<2){lines.push(line.trim());line='';width=0;}
      line+=token;width+=size;
    }
    if(line.trim())lines.push(line.trim());
    return lines;
  }
  function collectionItems(){
    const pool=[...data.items,...[...publicAI.editions,...publicArchive.editions].slice().sort((a,b)=>Number(a.locale===locale)-Number(b.locale===locale)).flatMap(e=>publicItems(e,true))];
    return Array.from(new Map(pool.map(s=>[s.id,s])).values());
  }
  function getItems(){return (editionItems||data.items).map(localizeItem);}
  function item(){return getItems()[state.index];}
  function validUrl(url){try{const u=new URL(url);return u.protocol==='https:'?u.href:null;}catch(e){return null}}
  function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>el.classList.remove('show'),1900);}
  function label(index){const s=getItems()[index];return s?.categoryLabel||'新闻';}
  function indices(){
    const query=state.query.toLocaleLowerCase(locale);
    const all=getItems().map((x,i)=>i).filter(i=>!query||[getItems()[i].title,getItems()[i].dek,...(getItems()[i].sources||[]).map(x=>x.name)].join(' ').toLocaleLowerCase(locale).includes(query));
    // Local ranking only. Public news, source links and original facts are unchanged.
    const score=i=>(getItems()[i].archive?.full_text_acquired?10:0)+(getItems()[i].is_headline?2:(state.interests.has(getItems()[i].category)?1:0));
    const ordered=all.sort((a,b)=>score(b)-score(a)||a-b);
    return state.filterSaved?ordered.filter(i=>state.saved.has(getItems()[i].id)):ordered;
  }
  function relevance(s){
    if(!state.interests.size)return '你还没有选择兴趣领域。当前展示所有公共新闻，没有个性化排序。';
    if(state.interests.has(s.category))return locale==='en'?`You follow ${s.categoryLabel} on this device, so this story ranks higher. This preference is not uploaded.`:locale==='ja'?`この端末で「${s.categoryLabel}」を選択したため優先表示します。この設定は送信しません。`:`${locale==='zh-TW'?'你在本機關注':'你在本机关注'}「${s.categoryLabel}」。`;
    return '这条不属于你选择的主要领域，但仍保留在新闻池中，让你有机会了解兴趣圈外的变化。';
  }
  function reading(s){
    const view=s.reading?.[state.lens]||s.reading.brief;
    return state.lens==='personal'?{...view,paragraphs:[relevance(s),...view.paragraphs]}:view;
  }
  function firstAvailable(){return indices()[0]??0;}
  function bounce(){if(!state.motion || $('#hero').hidden)return;app.classList.remove('switching');void app.offsetWidth;app.classList.add('switching');}
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
    if(!visible.length){
      if(state.query){q.append(mk('p','queue-none','无匹配新闻'));renderMore([]);return;}
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
      body.append(mk('small','',state.interests.has(s.category)?'◆ '+t('与你有关'):'✳ '+s.categoryLabel),mk('strong','',s.title));
      b.append(mark,body,mk('span','more-card-arrow','↗'));list.append(b);
    }
    txt('#personalSortLabel',state.interests.size?state.interests.size+' · '+t('与你有关'):t('所有新闻 · 公共排序'));
  }
  function updateTabs(){
    $$('.lens-tabs [data-lens]').forEach(b=>{
      const yes=b.dataset.lens===state.lens;b.classList.toggle('active',yes);b.setAttribute('aria-selected',String(yes));
    });
    $$('.reader-lenses [data-lens]').forEach(b=>b.classList.toggle('active',b.dataset.lens===state.lens));
  }
  function renderMain(){
    const s=item();updateTheme();
    app.dataset.storyKind=s.public?'public':'archive';
    txt('.verified-mark',s.public?'● RSS / AI ASSISTED':'● SOURCE LINKED');
    txt('.snapshot-label',s.public?'● AI / RSS':'● SNAPSHOT');
    txt('#queueCount',String(indices().length).padStart(2,'0')+' FILES');
    txt('#heroBackNum',iconNumber(state.index));txt('#heroSymbol',s.art);txt('#heroSymbolSub',s.categoryLabel);
    txt('#heroChannel',s.channel);txt('#heroPriority',s.priority);txt('#heroDek',s.dek);txt('#heroPublished',s.published);
    const headline=$('#heroHeadline');headline.replaceChildren();
    (s.headline||[s.title]).forEach((line,i,lines)=>headline.append(mk('span',i===lines.length-1?'hero-impact':'',line)));
    txt('#decodeProgress','FILE '+iconNumber(state.index)+' / '+String(getItems().length).padStart(2,'0'));
    const view=reading(s);
    txt('#readEyebrow',view.eyebrow);txt('#readTitle',view.title);
    txt('#readText',view.paragraphs.slice(0,1).join('\n\n'));
    let notice=$('#contentLanguageNotice');if(!notice){notice=mk('small','language-fallback');notice.id='contentLanguageNotice';$('#decodeArticle').append(notice);}notice.hidden=!s.localeFallback;notice.textContent=s.localeFallback?fallbackText(s.originalLanguage):'';
    $('#heroHeadline').lang=s.localeFallback?s.originalLanguage:locale;
    let evidence=$('#contentEvidence');if(!evidence){evidence=mk('small','content-evidence');evidence.id='contentEvidence';$('#decodeArticle').append(evidence);}
    evidence.textContent=t(s.archive?.full_text_acquired?'正文资料整理':!s.public?'据来源整理':s.evidenceDepth==='brief'?'短简讯':'RSS 摘录')+(s.event?.sources?.length>1?' · '+s.event.sources.length+' '+t('来源对照'):'');
    $('#decodeArticle').scrollTop=0;
    const sources=(s.sources||[]).filter(src=>validUrl(src.url));
    txt('#sourceName',sources.length?sources[0].name:'尚无可核实链接');
    const quick=$('#sourceQuick');
    if(sources.length){quick.href=validUrl(sources[0].url);quick.removeAttribute('aria-disabled');quick.tabIndex=0;}
    else{quick.removeAttribute('href');quick.setAttribute('aria-disabled','true');quick.tabIndex=-1;}
    const marked=state.saved.has(s.id);
    const save=$('.hero-save');save.textContent=marked?'★':'☆';save.setAttribute('aria-pressed',String(marked));save.setAttribute('aria-label',t(marked?'取消收藏新闻':'收藏新闻'));
    $('#readerSave').textContent=marked?'★':'☆';$('#readerSave').setAttribute('aria-pressed',String(marked));
    const favButton=$('#favoritesButton');favButton.classList.toggle('active',state.filterSaved);favButton.setAttribute('aria-pressed',String(state.filterSaved));
    const count=state.filterSaved?indices().length:getItems().length;
    const channel=state.filterSaved?t('收藏'):state.archiveView?t('新闻档案'):sessionName(state.edition);
    txt('#bottomEdition',locale==='zh-CN'?channel+(state.filterSaved||state.archiveView?'':'情报')+' · '+count+' 条':locale==='zh-TW'?channel+(state.filterSaved||state.archiveView?'':'情報')+' · '+count+' 則':channel+' · '+count+(locale==='en'?' stories':' 件'));
    updateTabs();renderQueue();
    if(state.reader)renderReader();
  }
  function renderReader(){
    saveReaderPosition();
    const s=item();const view=reading(s);
    let original=$('#readerOriginalTop');if(!original){original=mk('a','reader-original-top');original.id='readerOriginalTop';original.target='_blank';original.rel='noopener noreferrer';$('#readerOverlay .reader-top span').replaceWith(original);}
    const sourceURL=validUrl(s.sources?.[0]?.url);original.hidden=!sourceURL;if(sourceURL)original.href=sourceURL;else original.removeAttribute('href');original.textContent='↗ '+t('阅读原文');
    $('#readerTitle').lang=s.localeFallback?s.originalLanguage:locale;
    txt('#readerCode',s.channel);txt('#readerArt',iconNumber(state.index));txt('#readerTitle',s.title);txt('#readerDate',s.published);
    const body=$('#readerCopy');body.replaceChildren();
    body.lang=s.localeFallback?s.originalLanguage:locale;
    if(s.localeFallback)body.append(mk('small','language-fallback',fallbackText(s.originalLanguage)));
    // A single title lives in the cover; source-bounded sections form the reading body.
    if(s.archive&&state.lens==='brief')appendArchive(body,s.archive);
    else{body.append(mk('span','',view.eyebrow));view.paragraphs.forEach(p=>body.append(mk('p','',p)));}
    body.prepend(mk('small','content-evidence',t(s.archive?.full_text_acquired?'正文资料整理':!s.public?'据来源整理':s.evidenceDepth==='brief'?'短简讯':'RSS 摘录')));
    appendEventEvidence(body,s.event);
    const src=$('#readerSources');src.replaceChildren();
    (s.sources||[]).forEach(source=>{
      const safe=validUrl(source.url);if(!safe)return;
      const a=mk('a','source-link');a.href=safe;a.target='_blank';a.rel='noopener noreferrer';
      a.append(mk('span','',source.name+' · '+t('阅读原文')) ,mk('span','','↗'));src.append(a);
      if(source.published_at)src.append(mk('small','source-timestamp',t('原文发表')+' · '+source.published_at));
    });
    if(!src.children.length)src.append(mk('p','','尚无可以核实的外部来源链接。'));
    txt('.source-disclaimer',s.archive?.full_text_acquired?s.archive.notice:s.public?'本条由公开 RSS 标题与简讯整理，未经独立全文核验；不是实时灾害警报。':'2026-10-08 · ARCHIVE · '+t('仅供新闻阅读，不是实时灾害警报'));
    updateTabs();
    $('#readerSave').textContent=state.saved.has(s.id)?'★':'☆';
    restoreReaderPosition();
  }
  function setIndex(next, animate=true){
    const available=indices();
    if(!available.length){toast('还没有收藏的新闻');return;}
    if(!available.includes(next))return;
    if(state.index===next&&animate){bounce();return;}
    saveReaderPosition();state.index=next;state.lens='brief';renderMain();
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
    saveReaderPosition();state.lens=lens;
    renderMain();
  }
  function save(){
    const id=item().id;
    if(state.saved.has(id)){state.saved.delete(id);toast('☆ 已取消收藏');}else{state.saved.add(id);toast('★ 已保存到本机收藏');}
    persist();
    if(state.filterSaved&&!state.saved.has(id)){
      const available=indices();
      if(available.length){state.index=available[0];state.lens='brief';}else{state.filterSaved=false;changeEdition('morning',{automatic:true});toast('收藏夹已清空');return;}
    }
    renderMain();
  }
  const placeholders={
    noon:{num:'02',eyebrow:'MIDDAY / AWAITING BRIEF',title:'午间简报\n尚未同步。',desc:'目前只有 10 月 8 日早间的已核实快照。ChatGPT 的中午定时消息与此网页尚未自动同步。'},
    evening:{num:'03',eyebrow:'EVENING / AWAITING BRIEF',title:'夜间回顾\n尚未同步。',desc:'晚上新的报道必须重新收集、核实后才能显示。当前网页不会重复早报冒充实时更新。'},
    breaking:{num:'!!',eyebrow:'BREAKING / NO LIVE FEED',title:'紧急播报\n未连接实时源。',desc:'此网页不具备实时地震、天气、交通或新闻报警能力。紧急情况请查看日本气象厅及所在地政府的官方警报。'}
  };
  function changeEdition(edition,{archive=false,automatic=false}={}){
    if(!['morning','noon','evening','breaking','ai'].includes(edition))return;
    const previousId=item()?.id;
    state.edition=edition;
    if(!automatic)state.editionChosen=true;
    state.archiveView=archive;
    if(!archive)state.filterSaved=false;
    aiOpen=edition==='ai';
    if(state.reader)closeReader();
    if(aiOpen){aiSession=latestAISession();state.sessionChosen=false;aiFilter='all';}
    const publicEdition=!archive?aiEditionForSession(edition):null;
    const mapped=publicItems(publicEdition);
    editionItems=archive?collectionItems():(mapped.length?mapped:null);
    const consoleMode=!aiOpen&&(archive||mapped.length>0||(!publicEdition&&edition==='morning'));
    renderBriefs(archive||aiOpen?null:publicEdition);
    state.index=archive?Math.max(0,getItems().findIndex(s=>s.id===previousId)):firstAvailable();
    if(!indices().includes(state.index))state.index=firstAvailable();
    state.lens='brief';
    $$('.edition-tabs [data-edition-choice]').forEach(b=>{
      const active=b.dataset.editionChoice===edition;
      b.classList.toggle('active',active);b.setAttribute('aria-current',active?'page':'false');
    });
    $('#aiDesk').hidden=!aiOpen;
    $('#emptyEdition').hidden=consoleMode||aiOpen;
    for(const selector of ['.queue','.hero','.decode','#queueList','#mobileStoryStrip','#moreSignals','.scroll-nudge'])$(selector).hidden=!consoleMode;
    app.dataset.edition=edition;app.dataset.newsMode=aiOpen?'feed':consoleMode?'console':'empty';
    $('#favoritesButton').classList.toggle('active',state.filterSaved);
    $('#favoritesButton').setAttribute('aria-pressed',String(state.filterSaved));
    if(aiOpen){
      renderAI();txt('#bottomEdition',sessionName(aiSession)+' · '+t('综合新闻'));
      txt('#snapshotStatus',t('综合新闻')+' / AI · RSS');
    }else if(consoleMode){
      txt('#snapshotStatus',state.archiveView&&!state.filterSaved?t('新闻档案')+' / '+t('原文可追溯'):state.filterSaved?t('收藏')+' / ARCHIVE':mapped.length?publicEdition.date+' / '+sessionName(edition)+' · AI / RSS':'2026.10.08 / ARCHIVE');
      renderMain();if(state.motion)bounce();
    }else{
      const e=edition==='breaking'?{...placeholders.breaking,title:t('紧急播报')+'\n'+t('未连接实时源。')}:{
        num:edition==='noon'?'02':'03',eyebrow:'AWAITING / '+edition.toUpperCase(),
        title:sessionName(edition)+'\n'+t(publicEdition?.briefs?.length?'本期暂无充分资料':'简报尚未发布。'),
        desc:'本期尚无已发布的公共新闻。你可以切换其他时段或查看综合新闻；这里不会用晨报代替本期内容。'
      };
      txt('#emptyArt',e.num);txt('#emptyEyebrow',e.eyebrow);txt('#emptyCopy',publicEdition?.briefs?.length?'本期只有短简讯，可在下方阅读；完整档案仍可从顶部进入。':e.desc);
      const heading=$('#emptyHeading');heading.replaceChildren();
      e.title.split('\n').forEach((line,i)=>{if(i)heading.append(document.createElement('br'));heading.append(document.createTextNode(line));});
      txt('#bottomEdition',edition==='breaking'?'不提供实时报警':sessionName(edition)+' · '+t(publicEdition?.briefs?.length?'简讯':'简报尚未发布。'));
      txt('#snapshotStatus',edition==='breaking'?'NOT A LIVE ALERT':publicEdition?.briefs?.length?t('简讯'):'等待本期公开简报');
    }
    if(window.scrollY>0)window.scrollTo({top:0,behavior:'instant'});
  }
  function openReader(){
    if($('#hero').hidden)return;
    state.editionChosen=true;
    state.lastFocus=document.activeElement;
    readerReturn={page:window.scrollY,decode:$('#decodeArticle').scrollTop};
    state.reader=true;$('#readerOverlay').hidden=false;syncModal();
    renderReader();
    $('.reader-top [data-action="close-reader"]').focus({preventScroll:true});
  }
  function closeReader(){
    saveReaderPosition();readerPosition=null;clearTimeout(positionTimer);
    state.reader=false;$('#readerOverlay').hidden=true;syncModal();
    if(readerReturn){window.scrollTo({top:readerReturn.page,behavior:'instant'});$('#decodeArticle').scrollTop=readerReturn.decode;}
    if(state.lastFocus?.isConnected)state.lastFocus.focus({preventScroll:true});
  }
  function renderCurrentView(){
    updateTheme();
    renderBriefs(state.archiveView||aiOpen?null:aiEditionForSession(state.edition));
    if(aiOpen){renderAI();txt('#bottomEdition',sessionName(aiSession)+' · '+t('综合新闻'));}
    else if(!$('#hero').hidden)renderMain();
  }
  function activeModal(){
    return ['#onboardingOverlay','#settingsOverlay','#readerOverlay'].map($).find(el=>!el.hidden);
  }
  function modalControls(modal){
    return Array.from(modal.querySelectorAll('button,a[href],input,select,textarea,[tabindex]'))
      .filter(el=>!el.disabled&&el.tabIndex>=0&&!el.closest('[hidden],[inert]')&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden');
  }
  function syncModal(){
    const modal=activeModal();
    Array.from(app.children).forEach(el=>{el.inert=Boolean(modal&&el!==modal&&el.id!=='toast');});
    document.documentElement.classList.toggle('modal-open',Boolean(modal));
  }
  document.addEventListener('focusin',event=>{
    if(app.inert)return;
    const modal=activeModal();
    if(modal&&!modal.contains(event.target))modalControls(modal)[0]?.focus({preventScroll:true});
  });
  function renderPersonalOptions(){
    const focused=document.activeElement;
    const focusBox=focused?.closest('#interestOptions,#onboardingPicks,#themeOptions');
    const focusKey=['interest','themeChoice'].find(key=>focused?.dataset[key]);
    const focusValue=focusKey?focused.dataset[focusKey]:null;
    for(const selector of ['#interestOptions','#onboardingPicks']){
      const box=$(selector);box.replaceChildren();
      for(const interest of interests){
        const active=state.interests.has(interest.id);
        const button=mk('button','interest-chip'+(active?' selected':''),interest.symbol+' '+t(interest.label));
        button.type='button';button.dataset.interest=interest.id;
        button.setAttribute('aria-pressed',String(active));box.append(button);
      }
    }
    const themesBox=$('#themeOptions');themesBox.replaceChildren();
    for(const theme of themes){
      const btn=mk('button','theme-chip'+(state.theme===theme.id?' active':''));btn.type='button';btn.dataset.themeChoice=theme.id;
      const dot=mk('i','');dot.style.background=theme.color;
      btn.append(dot,mk('span','',t(theme.label)));btn.setAttribute('aria-pressed',String(state.theme===theme.id));themesBox.append(btn);
    }
    $$('#layoutOptions [data-layout-choice]').forEach(btn=>{
      const active=state.layout===btn.dataset.layoutChoice;
      btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active));
    });
    $('#motionToggle').checked=state.motion;
    $('#spoilerToggle').checked=state.spoiler;
    $('#largeTextToggle').checked=state.largeText;
    $('#privateModeToggle').checked=state.privateMode;
    if(focusBox&&focusKey){
      Array.from(focusBox.querySelectorAll('button')).find(btn=>btn.dataset[focusKey]===focusValue)?.focus({preventScroll:true});
    }
  }
  function toggleInterest(value){
    if(!allowedInterests.has(value))return;
    if(state.interests.has(value))state.interests.delete(value);else state.interests.add(value);
    state.index=firstAvailable();state.lens='brief';
    persist();renderCurrentView();renderPersonalOptions();bounce();
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
    state.onboarding=true;$('#onboardingOverlay').hidden=false;syncModal();
    renderPersonalOptions();
    $('#onboardingOverlay [data-action=onboarding-done]').focus({preventScroll:true});
  }
  function closeOnboarding(){
    state.onboarding=false;state.onboarded=true;$('#onboardingOverlay').hidden=true;syncModal();
    persist();renderCurrentView();
    $('.settings-btn').focus({preventScroll:true});
  }
  function resetGuest(){
    forget();positions?.temporary(true);readerPosition=null;state.interests.clear();state.saved.clear();state.theme='auto';state.layout='overdrive';
    state.motion=!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    state.spoiler=true;state.largeText=false;state.onboarded=false;state.privateMode=true;
    state.filterSaved=false;state.lens='brief';state.index=0;locale=detectLocale();translateInterface();
    renderCurrentView();renderPersonalOptions();toast('本机的星闻数据已经清空');
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
    $('#settingsOverlay').hidden=false;syncModal();
    renderPersonalOptions();
    $('.settings-heading [data-action="close-settings"]').focus({preventScroll:true});
  }
  function closeSettings(){
    state.settings=false;$('#settingsOverlay').hidden=true;syncModal();
    if(state.lastFocus?.isConnected)state.lastFocus.focus({preventScroll:true});
  }
  function toggleSavedOnly(){
    if(state.archiveView&&state.filterSaved){changeEdition('morning');return;}
    if(!state.saved.size){toast('还没有收藏，先点击 ☆ 收藏一条吧');return;}
    state.filterSaved=true;
    const arr=indices();if(arr.length&&!arr.includes(state.index)){state.index=arr[0];state.lens='brief';}
    changeEdition('morning',{archive:true});
  }
  app.addEventListener('click', event=>{
    const b=event.target.closest('button');if(!b||!app.contains(b))return;
    if(b.dataset.aiFilter){aiFilter=b.dataset.aiFilter;renderAI();return;}
    if(b.dataset.aiSession){state.sessionChosen=true;aiSession=b.dataset.aiSession;aiFilter='all';renderAI();txt('#bottomEdition',sessionName(aiSession)+' · '+t('综合新闻'));return;}
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
    if(action==='restart-reading'){positions?.reset(readerPosition?.key);$('.reader-scroll').scrollTop=0;saveReaderPosition();return;}
    if(action==='open-reader'){openReader();return;}
    if(action==='close-reader'){closeReader();return;}
    if(action==='archive'){changeEdition('morning',{archive:true});return;}
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
    state.privateMode=e.target.checked;positions?.temporary(state.privateMode);
    if(state.privateMode){forget();toast('临时模式已开启，不再写入本机存储');}
    else{persist();toast('本机偏好保存已恢复');}
  });
  document.addEventListener('keydown',e=>{
    if(app.inert)return;
    const modal=activeModal();
    if(e.key==='Escape'){
      if(state.onboarding)closeOnboarding();else if(state.settings)closeSettings();else if(state.reader)closeReader();else if(aiOpen)changeEdition('morning');else return;
      e.preventDefault();return;
    }
    if(modal&&e.key==='Tab'){
      const controls=modalControls(modal),first=controls[0],last=controls[controls.length-1];
      if(!modal.contains(document.activeElement)||(e.shiftKey&&document.activeElement===first)||(!e.shiftKey&&document.activeElement===last)){
        e.preventDefault();(e.shiftKey?last:first)?.focus({preventScroll:true});
      }
      return;
    }
    if(state.settings||state.onboarding||$('#hero').hidden)return;
    const tag=document.activeElement?.tagName||'';
    if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return;
    if(e.key==='ArrowLeft'){e.preventDefault();changeStory(-1);}
    if(e.key==='ArrowRight'){e.preventDefault();changeStory(1);}
    if(e.key==='1')setLens('brief');if(e.key==='2')setLens('personal');if(e.key==='3')setLens('verify');
  });


  function renderBriefs(edition){
    const desk=$('#briefDesk'),list=$('#briefList');list.replaceChildren();
    const briefs=(edition?.briefs||[]).map(localizeStory).filter(s=>!state.query||[s.title,s.summary,s.source?.name].join(' ').toLocaleLowerCase(locale).includes(state.query.toLocaleLowerCase(locale)));
    desk.hidden=!briefs.length;txt('#briefHeading','简讯');txt('#briefNotice','这些来源只提供短消息，保留原语，不扩写为长篇档案。');
    for(const s of briefs){
      const url=validUrl(s.source?.url);if(!url)continue;
      const card=mk('details','brief-card'),head=mk('summary','',s.title);head.lang=s.originalLanguage;
      const copy=mk('p','',s.summary);copy.lang=s.originalLanguage;
      const a=mk('a','',s.source.name+' · '+t('阅读原文'));a.href=url;a.target='_blank';a.rel='noopener noreferrer';
      card.append(head,mk('small','',t('原语内容')+' · '+languageName(s.originalLanguage)),copy,a);list.append(card);
    }
  }
  function appendEventEvidence(body,event){
    if(!event?.sources||event.sources.length<2)return;
    const block=mk('section','event-evidence');block.append(mk('h3','','同一事件 · 来源对照'),mk('p','',t('按标题、日期和关键实体保守归并；多来源不等于事实已交叉核验。')));
    for(const source of event.sources.slice(0,4)){
      const url=validUrl(source.url);if(!url)continue;
      const entry=mk('article','event-source'),link=mk('a','',source.name+' · '+source.title);link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.lang=source.language||'und';
      const text=mk('p','',source.excerpt||'');text.lang=source.language||'und';entry.append(link,mk('small','',t('原语内容')+' · '+languageName(source.language)),text);
      if(source.published_at)entry.append(mk('small','',t('原文发表')+' · '+source.published_at));block.append(entry);
    }
    body.append(block);
  }
  function saveReaderPosition(){
    if(!state.reader||!readerPosition||restoringPosition)return;
    const scroll=$('.reader-scroll'),max=scroll.scrollHeight-scroll.clientHeight;
    const ratio=max>0?scroll.scrollTop/max:0;
    positions?.save(readerPosition.key,readerPosition.fingerprint,ratio);
    const label=$('#readerPositionLabel');if(label)label.textContent=t('阅读位置')+' · '+Math.round(ratio*100)+'% · '+t('仅本机');
    const progress=$('#readerPositionProgress');if(progress)progress.value=ratio*100;
  }
  function restoreReaderPosition(){
    let bar=$('#readerPositionBar');if(!bar){
      bar=mk('div','reader-position');bar.id='readerPositionBar';const label=mk('span');label.id='readerPositionLabel';
      const progress=mk('progress');progress.id='readerPositionProgress';progress.max=100;progress.setAttribute('aria-label',t('阅读位置'));
      const restart=mk('button','','从头阅读');restart.type='button';restart.dataset.action='restart-reading';bar.append(label,progress,restart);$('.reader-lenses').after(bar);
    }
    bar.querySelector('button').textContent=t('从头阅读');$('#readerPositionProgress').setAttribute('aria-label',t('阅读位置'));
    const s=item(),key=positions?.key(validUrl(s.sources?.[0]?.url)||s.id,locale,state.lens),fingerprint=positions?.fingerprint(s.title+'|'+$('#readerCopy').textContent),previous=positions?.get(key);
    readerPosition={key,fingerprint};restoringPosition=true;
    requestAnimationFrame(()=>{
      if(!state.reader||readerPosition?.key!==key){restoringPosition=false;return;}
      const scroll=$('.reader-scroll'),matched=previous?.fingerprint===fingerprint;
      scroll.scrollTop=matched?previous.ratio*Math.max(0,scroll.scrollHeight-scroll.clientHeight):0;restoringPosition=false;saveReaderPosition();
      if(previous&&!matched)toast('资料已更新，从头阅读');
    });
  }
  $('.reader-scroll').addEventListener('scroll',()=>{clearTimeout(positionTimer);positionTimer=setTimeout(saveReaderPosition,180);},{passive:true});
  window.addEventListener('pagehide',saveReaderPosition);

  function appendArchive(body,archive){
    if(!archive)return;
    const scope=mk('p','archive-scope',archive.notice||t(archive.full_text_acquired?'已获取全文用于事实整理':'仅获取 RSS 摘要')+' · '+t('据来源整理'));
    body.append(scope);
    for(const section of archive.sections||[]){
      const block=mk('section','archive-section'+(section.available===false?' unavailable':''));
      block.append(mk('h3','',section.title||t(section.id)));if(section.language&&section.language!==locale){block.append(mk('small','language-fallback',t('原语内容')+' · '+languageName(section.language)));}const paragraph=mk('p','',section.text||'');if(section.language)paragraph.lang=section.language;block.append(paragraph);body.append(block);
    }
    if(archive.editorial_at)body.append(mk('small','archive-stamp',t('整理时间')+' · '+archive.editorial_at));
    if(archive.rights?.rights_url){const license=mk('a','archive-rights',t('来源使用规则'));license.href=validUrl(archive.rights.rights_url);license.target='_blank';license.rel='noopener noreferrer';body.append(license);}
    if(archive.generated_at)body.append(mk('small','archive-stamp',t('检索记录')+' · '+archive.generated_at));
  }
  $('#languageSelect').addEventListener('change',event=>{
    if(!supported.includes(event.target.value))return;
    const wasReader=state.reader;const currentId=item()?.id;
    saveReaderPosition();locale=event.target.value;persist();translateInterface();
    const edition=aiEditionForSession(state.edition);if(state.archiveView)editionItems=collectionItems();else if(edition){const mapped=publicItems(edition);editionItems=mapped.length?mapped:null;}
    if(editionItems){const i=editionItems.findIndex(s=>s.id===currentId);if(i>=0)state.index=i;}
    if(!wasReader&&$('#hero').hidden&&!aiOpen)changeEdition(state.edition,{archive:state.archiveView,automatic:true});else renderCurrentView();renderPersonalOptions();if(wasReader)renderReader();
    window.dispatchEvent(new CustomEvent('starnews:locale',{detail:{locale}}));
  });
  $('#newsSearch').addEventListener('input',event=>{state.query=event.target.value.trim();const available=indices();if(available.length&&!available.includes(state.index))state.index=available[0];renderCurrentView();const result=$('#searchStatus');result.textContent=state.query?String(aiOpen?$('#aiStoryList details').length:available.length):'';});
  const safeArticle=s=>({title:s.title.slice(0,220),summary:(s.dek||s.summary||'').slice(0,1200),url:validUrl(s.sources?.[0]?.url||s.source?.url)});
  window.StarnewsBridge={getLocale:()=>locale,getArticle:()=>safeArticle(item()),getArticles:()=>collectionItems().map(localizeItem).slice(0,100).map(s=>({id:s.id,title:s.title.slice(0,220),summary:(s.dek||s.summary||'').slice(0,100),category:s.category,is_headline:Boolean(s.is_headline)})),getTopics:()=>[...state.interests]};

  // Touch gestures on the visual panel only, so vertical scrolling in reading content remains usable.
  const hero=$('#hero');let sx=0,sy=0;
  hero.addEventListener('touchstart',e=>{sx=e.changedTouches[0]?.clientX||0;sy=e.changedTouches[0]?.clientY||0;},{passive:true});
  hero.addEventListener('touchend',e=>{
    const dx=(e.changedTouches[0]?.clientX||0)-sx,dy=(e.changedTouches[0]?.clientY||0)-sy;
    if(Math.abs(dx)>55&&Math.abs(dy)<65&&!$('#hero').hidden)changeStory(dx<0?1:-1);
  },{passive:true});
  const drawer=$('.reader');
  let tx=0,ty=0;
  drawer.addEventListener('touchstart',e=>{tx=e.changedTouches[0]?.clientX||0;ty=e.changedTouches[0]?.clientY||0;},{passive:true});
  drawer.addEventListener('touchend',e=>{
    const dx=(e.changedTouches[0]?.clientX||0)-tx,dy=(e.changedTouches[0]?.clientY||0)-ty;
    if(Math.abs(dx)>100&&Math.abs(dy)<55){changeStory(dx<0?1:-1);}
  },{passive:true});
  translateInterface();
  state.index=firstAvailable();
  renderMain();
  if(!state.onboarded)openOnboarding();
  // Always fetch only the public shared AI file; NEVER transmit interests or favorites.
  if(location.protocol!=='file:'){
    fetch('./ai-briefs.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('AI publication not found');return r.json()}).then(payload=>{
      if(payload?.schema!==1||!Array.isArray(payload.editions))throw new Error('Invalid AI publication');
      publicAI=payload;
      const latest=latestAISession();
      if(!state.editionChosen&&aiEditionForSession(latest))changeEdition(latest,{automatic:true});
      else if(aiOpen){if(!state.sessionChosen)aiSession=latest;renderCurrentView();}
      else if(!state.reader)changeEdition(state.edition,{archive:state.archiveView,automatic:true});
      if(aiEditionForSession(latest))txt('#aiTopState','✳ NEWS ONLINE');
    }).catch(()=>{if(aiOpen)renderAI();});
  }

  // Durable public long reads are independent of scheduled edition replacement.
  if(location.protocol!=='file:'){
    fetch('./archive-stories.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('archive unavailable');return r.json();}).then(payload=>{
      if(payload?.schema!==1||!Array.isArray(payload.editions))throw new Error('invalid archive');
      publicArchive=payload;
      if(state.archiveView&&!state.reader)changeEdition(state.edition,{archive:true,automatic:true});
    }).catch(()=>{});
  }

  // A newer public JSON replaces the offline snapshot. It never contains personal profiles.
  if(location.protocol!=='file:'){
    fetch('./news.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('fetch failed');return r.json()}).then(v=>{
      if(v?.edition?.id && Array.isArray(v.items) && v.items.length && v.edition.id!==data.edition.id){
        data=v;changeEdition(state.edition,{archive:state.archiveView,automatic:true});toast('已加载新的公共新闻快照');
      }
    }).catch(()=>{});
    if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost')){
      window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}),{once:true});
    }
  }
})();
