"""Reviewed original accounts only apply to the exact supplied source text.
No article URL match alone may attach stale facts to a changed release.
"""
import hashlib
import json
from pathlib import Path
RECORDS=Path(__file__).with_name('editorial_archives.json')
def apply_editorial(item,ref,locale):
    article=ref.get('article_text')
    if not article: return item
    fingerprint=hashlib.sha256('\n\n'.join(article['paragraphs']).encode()).hexdigest()
    records=json.loads(RECORDS.read_text(encoding='utf-8'))
    record=next((r for r in records if r['source_url']==ref['url'] and r['source_text_sha256']==fingerprint),None)
    variant=record.get('locales',{}).get(locale) if record else None
    if not variant:return item
    old=item['localized'][locale]
    archive={**old['archive'],'sections':[{'id':sid,'title':title,'text':text,'available':True,'language':locale,'mode':'editorial_retelling'} for sid,title,text in variant['sections']],
        'editorial_at':record['editorial_at'],'method':record['method'],'source_text_sha256':fingerprint}
    archive['notice']={'zh-CN':'据已取得的 NASA 官方供稿正文原创整理；未独立核验，未确认与网页全文完全一致。','zh-TW':'依已取得的 NASA 官方供稿正文原創整理；未獨立查核，未確認與網頁全文完全一致。','ja':'取得した NASA 公式配信本文を基に独自に再構成。独立検証・ウェブ全文との完全一致確認は未実施。','en':'Original retelling from acquired NASA syndicated article text; no independent verification or complete website comparison.'}[locale]
    localized={**old,'title':variant['title'],'summary':variant['summary'],'language':locale,'status':'editorial_retelling','translation_status':'editorial_retelling','archive':archive,'context':archive['notice'],'validation':'exact_source_text_bound_editorial'}
    item.update(title=localized['title'],summary=localized['summary'],context=localized['context'],archive=archive,localized={locale:localized})
    item['provenance'].update(translation_status='editorial_retelling',method=record['method'])
    return item
