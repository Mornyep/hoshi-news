"""Bounded evidence packets and independently validated AI reading angles.

Exact evidence anchors and token guards are not semantic fact checking. No
search tool, arbitrary URL access or model memory is treated as a factual source.
"""
import re
import public_ai as core

LABELS = {
 'zh-CN': ['AI 补充阅读 · 待核验分析', '背景线索', '可能影响', '后续观察问题', '分析仅基于下列已取得资料，不代表独立核验或各方完整立场。'],
 'zh-TW': ['AI 補充閱讀 · 待查核分析', '背景線索', '可能影響', '後續觀察問題', '分析僅依據下列已取得資料，不代表獨立查核或各方完整立場。'],
 'ja': ['AI 補足読解・未検証の分析', '背景の手がかり', '考えられる影響', '今後の確認事項', '以下の取得済み資料のみに基づく分析。独立検証や各当事者の立場を網羅するものではありません。'],
 'en': ['AI further reading · unverified analysis', 'Background context', 'Possible implications', 'Questions to follow', 'Analysis uses only the acquired material below; it is neither independent verification nor a complete account of stakeholder positions.']
}
KINDS = ('background', 'implications', 'questions')

def evidence_packet(ref):
    result=[]
    for i, source in enumerate([ref,*ref.get('related_sources',[])][:4]):
        paragraphs=(source.get('article_text') or {}).get('paragraphs',[])
        result.append({'id':f's{i+1}', 'name':source['publisher'], 'url':source['url'],
                       'language':source['language'], 'published_at':source['published_at'],
                       'scope':'acquired_article_text' if paragraphs else 'rss_excerpt',
                       'text':(source['title']+'\n'+ ('\n'.join(paragraphs) if paragraphs else source.get('excerpt','')))[:16000]})
    return result

def validate(answer, ref, locale, numbers, names, quotes):
    if not isinstance(answer,dict) or answer.get('id')!=ref['id']:return None
    rows=answer.get('analysis')
    if not isinstance(rows,list) or not 1<=len(rows)<=3:return None
    sources={s['id']:s for s in evidence_packet(ref)}; result=[];seen=set()
    for row in rows:
        if not isinstance(row,dict) or set(row)!={'kind','text','evidence'}:return None
        kind,text,anchors=row['kind'],row['text'],row['evidence']
        if kind not in KINDS or kind in seen or not isinstance(text,str) or not 25<=len(text)<=600:return None
        if not isinstance(anchors,list) or not 1<=len(anchors)<=4:return None
        cited=[]
        for anchor in anchors:
            if not isinstance(anchor,dict) or set(anchor)!={'source_id','quote'}:return None
            sid,quote=anchor['source_id'],anchor['quote']
            if not isinstance(sid,str) or sid not in sources or not isinstance(quote,str) or not 15<=len(quote)<=160 or quote not in sources[sid]['text']:return None
            cited.append(sources[sid])
        evidence=' '.join(s['text'] for s in cited)
        if re.search(r'https?://|<|>|ignore previous|system prompt|independently verified|fact.checked',text,re.I):return None
        if not numbers(text).issubset(numbers(evidence)) or not names(text).issubset(names(evidence)):return None
        if any(q not in quotes(evidence) for q in quotes(text)):return None
        if locale=='ja' and not re.search(r'[\u3040-\u30ff]',text):return None
        if locale.startswith('zh') and not re.search(r'[\u3400-\u9fff]',text):return None
        if locale=='en' and len(re.findall(r'[A-Za-z]',text))<len(re.findall(r'[\u3400-\u9fff]',text))*2:return None
        # No long verbatim republication, even when an excerpt was available.
        if any(text[j:j+100] in s['text'] for s in cited for j in range(max(0,len(text)-99))):return None
        seen.add(kind)
        result.append({'kind':kind,'title':LABELS[locale][KINDS.index(kind)+1], 'text':core.clean(text,600),
                       'sources':[ {k:s[k] for k in ('id','name','url','scope','published_at')} for s in sources.values() if s['id'] in {x['id'] for x in cited}]})
    return {'title':LABELS[locale][0], 'notice':LABELS[locale][4], 'language':locale,
            'method':'evidence_anchored_machine_analysis', 'independently_verified':False,
            'validation':'exact_anchor_and_token_guards_not_semantic_verification', 'sections':result}


def highlight(answer,title):
    """One exact headline span; keep attribution/uncertainty inside emphasis."""
    if not isinstance(answer,dict):return None
    span=answer.get('highlight')
    if not isinstance(span,str) or not 3<=len(span)<=max(3,min(100,len(title))) or title.count(span)!=1 or span.strip()!=span:return None
    # Language-specific caution markers. Reject emphasis that drops a qualifier.
    markers=re.findall(r'声称|宣称|据报道|疑似|可能|尚未|聲稱|宣稱|據報導|疑似|主張|と発表|と報道|疑い|可能性|allegedly|reportedly|claims?|may|might|unconfirmed',title,re.I)
    if any(marker.casefold() not in span.casefold() for marker in markers):return None
    return {'text':span,'method':'machine_selected_exact_headline_span'}
