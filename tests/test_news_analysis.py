import json
import sys
from pathlib import Path
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import multilingual as ml
import news_analysis as analysis
import source_text
from test_multilingual import story,translation

class EvidenceAnalysisTests(unittest.TestCase):
    def answer(self,ref):
        return {**translation(ref),'analysis':[{'kind':'questions','text':'Which details in the NHK report still require follow-up evidence?', 'evidence':[{'source_id':'s1','quote':'NHK reports 12 people.'}]}]}
    def test_valid_analysis_attributed_without_model_urls(self):
        ref=story();ref['related_sources']=[{**story('ja',2),'excerpt':'Second account available.'}]
        item=ml.make_item(ref,'en',self.answer(ref));a=item['archive']['analysis']
        self.assertFalse(a['independently_verified']);self.assertEqual(a['sections'][0]['sources'][0]['url'],ref['url'])
        self.assertIs(item['localized']['en']['archive']['analysis'],a)
    def test_invalid_anchors_and_unsupported_claims_omit_only_analysis(self):
        ref=story()
        for mutation in ('quote','source','figure','name','markup','duplicate','wrong_language'):
            a=self.answer(ref);row=a['analysis'][0]
            if mutation=='quote':row['evidence'][0]['quote']='This did not occur in source'
            if mutation=='source':row['evidence'][0]['source_id']='invented'
            if mutation=='figure':row['text']+=' There are 99 casualties.'
            if mutation=='name':row['text']+=' NASA is involved.'
            if mutation=='markup':row['text']+='<script>bad</script>'
            if mutation=='duplicate':a['analysis']*=2
            if mutation=='wrong_language':row['text']='这里提供的是不符合英文要求的分析问题以及后续观察。'
            item=ml.make_item(ref,'en',a)
            self.assertNotIn('analysis',item['archive'],mutation);self.assertEqual(item['title'],a['title'])
    def test_exact_emphasis_preserves_qualifier(self):
        title='NHK claims 12 people died in airport attack'
        self.assertIsNone(analysis.highlight({'highlight':'12 people died'},title))
        self.assertIsNotNone(analysis.highlight({'highlight':'claims 12 people died'},title))
        self.assertIsNone(analysis.highlight({'highlight':'claims 13 people died'},title))
        self.assertIsNone(analysis.highlight({'highlight':'<b>attack</b>'},title))
        self.assertIsNone(analysis.highlight({'highlight':'attack'},'attack and attack'))
    def test_highlight_attaches_to_exact_localized_title_only(self):
        ref=story();a={**translation(ref),'highlight':'12 people'}
        item=ml.make_item(ref,'en',a)
        self.assertEqual(item['localized']['en']['highlight']['text'],'12 people')
        a['title']='NHK 13 people';self.assertNotIn('highlight',ml.make_item(ref,'en',a))
    def test_nasa_rest_exact_identity_failures_and_feed_fallback(self):
        url='https://www.nasa.gov/news-release/test/'
        body=''.join('<p>NASA release describes 12 experiments with detailed scientific background for public informational use and reading.</p>' for _ in range(8))
        class Response:
            def __init__(self,data):self.data=data
            def __enter__(self):return self
            def __exit__(self,*a):pass
            def geturl(self):return 'https://www.nasa.gov/wp-json/wp/v2/press-release'
            def read(self,n):return json.dumps(self.data).encode()
        def opener(req,timeout):return Response([{'link':url,'content':{'rendered':body}}])
        result=source_text.nasa_api_text(url,opener);self.assertEqual(result['acquired_via'],'official_public_rest_api')
        self.assertFalse(result['website_completeness_verified'])
        self.assertIsNone(source_text.nasa_api_text('https://evil.test/news-release/test/',opener))
        self.assertIsNone(source_text.nasa_api_text(url,lambda *a,**kw:Response([{'link':url+'other','content':{'rendered':body}}])))
        def failed(*a,**kw):raise OSError('offline')
        ref={**story('en'),'publisher':'NASA','url':url,'article_text':result}
        source_text.enrich_articles([ref],failed);self.assertEqual(ref['article_text'],result)
        self.assertEqual(ref['body_retrieval']['status'],'unavailable')
    def test_nasa_requests_bounded_and_redirect_rejected_before_follow(self):
        calls=[]
        def failed(*a,**kw):calls.append(1);raise OSError()
        source_text.enrich_articles([{**story('en',i),'publisher':'NASA','url':f'https://www.nasa.gov/news-release/test-{i}/'} for i in range(8)],failed)
        self.assertEqual(len(calls),2)
        with self.assertRaises(ValueError):source_text.NASAOnlyRedirect().redirect_request(None,None,302,'',{},'https://evil.test/')

class LegacyLanguageTests(unittest.TestCase):
    def test_backfill_uses_source_titles_never_old_ai_summary(self):
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/'briefs.json';ref=story('ja')
            legacy={'id':'legacy-noon','date':'2026-10-08','session':'noon','generated_at':ref['retrieved_at'],
                    'items':[{'id':ref['id'],'title':ref['title'],'summary':'UNVERIFIED OLD AI CLAIM 99',
                              'category':'world','source':{'name':'NHK','url':ref['url']}}]}
            path.write_text(json.dumps({'schema':1,'editions':[legacy]}));calls=[]
            def caller(url,payload,headers):
                packet=json.loads(payload['messages'][1]['content']);calls.append(packet)
                self.assertNotIn('UNVERIFIED OLD AI CLAIM',json.dumps(packet))
                self.assertEqual(packet[0]['excerpt'],'')
                return {'choices':[{'message':{'content':'{"items":[]}'}}]}
            self.assertEqual(ml.backfill_legacy_editions(path,'groq','TEST',caller),4)
            self.assertEqual(len(calls),4)
            self.assertEqual(ml.backfill_legacy_editions(path,'groq','TEST',caller),0)
            self.assertEqual(len(calls),4)
            editions=json.loads(path.read_text())['editions'];self.assertEqual(len(editions),5)
            self.assertTrue(all(not e['items'] for e in editions if e.get('locale')))

class ProviderFailureTests(unittest.TestCase):
    def test_failed_locale_is_marked_without_claiming_ai_completion(self):
        def offline(*args,**kwargs):raise OSError('offline')
        editions=ml.build_editions([story('en',1)],[],ml.dt.datetime(2026,10,8,13,tzinfo=ml.dt.timezone.utc),'groq','TEST',offline)
        self.assertTrue(all(e['ai_status']=='unavailable' for e in editions))
    def test_same_session_refresh_does_not_exclude_existing_story(self):
        import tempfile
        import public_ai as core
        now=ml.dt.datetime(2026,10,8,13,tzinfo=ml.dt.timezone.utc)
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/'briefs.json';core.publish_edition(core.pack_edition([{'id':'same'}],'m','p',now,'en'),path)
            self.assertEqual(core.recent_edition_ids(now,path,locale='en'),{'same'})
            self.assertEqual(core.recent_edition_ids(now,path,locale='en',exclude_current_session=True),set())

class SharedSupplementTests(unittest.TestCase):
    def test_single_bounded_call_with_attributed_validated_result(self):
        ref=story('en');titles={'en':'NHK reports 12 people'};calls=[]
        def call(rules,prompt):
            packet=json.loads(prompt);calls.append(packet)
            self.assertTrue(all(len(s['text'])<=6000 for s in packet['evidence_packet']))
            answer={**EvidenceAnalysisTests().answer(ref),'highlight':'12 people'}
            return json.dumps({'locales':{'en':answer}})
        result=analysis.generate(ref,titles,call,ml.number_tokens,ml.protected_names,ml.quote_tokens)
        self.assertEqual(len(calls),1);self.assertEqual(result['en']['highlight']['text'],'12 people')
        self.assertFalse(result['en']['analysis']['independently_verified'])
    def test_failed_supplement_never_invents_analysis(self):
        def offline(*args):raise OSError()
        self.assertEqual(analysis.generate(story('en'),{'en':'NHK reports'},offline,ml.number_tokens,ml.protected_names,ml.quote_tokens),{})

class ModelBudgetTests(unittest.TestCase):
    def test_groq_reasoning_and_output_budget_are_bounded(self):
        captured=[]
        def fake(url,payload,headers):
            captured.append(payload);return {'choices':[{'message':{'content':'{"items":[]}'}}]}
        ml.call_model('rules','[]','groq','TEST',fake)
        self.assertEqual(captured[0]['reasoning_effort'],'low')
        self.assertEqual(captured[0]['max_tokens'],3600)

class SupplementRetentionTests(unittest.TestCase):
    def test_keep_only_exact_source_bound_prior_supplement(self):
        import tempfile,copy
        import public_ai as core
        now=ml.dt.datetime(2026,10,8,13,tzinfo=ml.dt.timezone.utc)
        archive={'source_text_sha256':'exact','analysis':{'language':'en','sections':[]}}
        item={'id':'article','title':'NASA cargo','source':{'url':'https://www.nasa.gov/news-release/test/'},'archive':archive,'localized':{'en':{'archive':archive}}}
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/'briefs.json';old=core.pack_edition([item],'m','p',now,'en');core.publish_edition(old,path)
            fresh=copy.deepcopy(item);del fresh['archive']['analysis'];edition=core.pack_edition([fresh],'m','p',now,'en');core.publish_edition(edition,path)
            self.assertIn('analysis',edition['items'][0]['archive'])
            fresh=copy.deepcopy(item);del fresh['archive']['analysis'];fresh['archive']['source_text_sha256']='changed';edition=core.pack_edition([fresh],'m','p',now,'en');core.publish_edition(edition,path)
            self.assertNotIn('analysis',edition['items'][0]['archive'])
