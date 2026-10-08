import datetime as dt
import json
from pathlib import Path
import sys
import tempfile
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import public_ai as core
import multilingual as ml
import source_text
from unittest.mock import patch

NOW=dt.datetime(2026,10,8,8,0,tzinfo=dt.timezone.utc)
def story(locale='ja',n=0,category='world'):
    return {'id':f'{locale}-{n}','title':'NHK 12 people on 2026-10-08'+(f' item {n}' if n else ''),'excerpt':'NHK reports 12 people. No further confirmed details. '*6,
            'url':f'https://news.web.nhk/articles/{locale}-{n}','publisher':('NHK' if n==0 else f'Outlet {n%3}'),'category':category,'language':locale,
            'published_at':'2026-10-08T07:00:00Z','retrieved_at':'2026-10-08T08:00:00Z'}
def translation(ref,title='NHK reports 12 people on 2026-10-08',summary='NHK reports 12 people; further details are unavailable.'):
    return {'id':ref['id'],'title':title,'summary':summary}
class MultilingualTests(unittest.TestCase):
    def test_four_publisher_language_pools(self):
        self.assertEqual(set(x['language'] for x in ml.FEEDS),set(ml.LOCALES))
        for locale in ml.LOCALES:
            pool=[story(locale,n) for n in range(7)]+[story('en' if locale!='en' else 'ja',9)]
            selected=ml.select_locale_items(pool,locale)
            self.assertEqual(len(selected),6)
            self.assertEqual(sum(x['language']==locale for x in selected),5)
            self.assertEqual(selected[0]['language'],locale)
    def test_exclusion_scoped_to_locale(self):
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/'briefs.json'
            for locale in ('en','ja'):
                core.publish_edition(core.pack_edition([{'id':locale}],'m','p',NOW,locale),path)
            self.assertEqual(core.recent_edition_ids(NOW,path,locale='en'),{'en'})
            self.assertEqual(len(json.loads(path.read_text())['editions']),2)
    def test_numbers_dates_cannot_change(self):
        ref=story()
        self.assertTrue(ml.valid_translation(translation(ref),ref,'en'))
        self.assertFalse(ml.valid_translation(translation(ref,title='NHK reports 13 people on 2026-10-08'),ref,'en'))
        self.assertFalse(ml.valid_translation(translation(ref,summary='NHK reports 12 people, including 7 children.'),ref,'en'))
        self.assertFalse(ml.valid_translation(translation(ref,title='NHK reports 12 people on 08/10/2026'),ref,'en'))
    def test_explicit_names_immutable(self):
        ref=story()
        self.assertFalse(ml.valid_translation(translation(ref,title='NASA reports 12 people on 2026-10-08'),ref,'en'))
        self.assertFalse(ml.valid_translation(translation(ref,summary='NHK says Elon Musk reports 12 people.'),ref,'en'))
        ref={**ref,'title':'Elon Musk reports 12 people on 2026-10-08'}
        self.assertFalse(ml.valid_translation(translation(ref),ref,'en'))
    def test_quotes_preserved_without_new_quotes(self):
        ref={**story(),'title':'NHK 12 people 「未確認」'}
        self.assertFalse(ml.valid_translation(translation(ref,title='NHK 12 people confirmed'),ref,'en'))
        self.assertTrue(ml.valid_translation(translation(ref,title='NHK reports 12 people 「未確認」'),ref,'en'))
        self.assertFalse(ml.valid_translation(translation(ref,title='NHK 12 people 「confirmed」'),ref,'en'))
    def test_immutable_source_and_hostile_ids(self):
        ref=story()
        def fake(url,payload,headers):
            answer={**translation(ref),'url':'https://evil.test','archive':{'full_text_acquired':True}}
            return {'choices':[{'message':{'content':json.dumps({'items':[answer,{'id':'invented'}]})}}]}
        items,_=ml.translate_batch([ref],'en','groq','TEST',fake)
        self.assertEqual(items[0]['source']['url'],ref['url'])
        self.assertFalse(items[0]['archive']['full_text_acquired'])
        self.assertNotIn('evil.test',json.dumps(items))
    def test_duplicate_answer_rejected(self):
        ref=story()
        def fake(url,payload,headers):
            return {'choices':[{'message':{'content':json.dumps({'items':[translation(ref),translation(ref)]})}}]}
        items,_=ml.translate_batch([ref],'en','groq','TEST',fake)
        self.assertEqual(items[0]['localized']['en']['status'],'fallback')
    def test_missing_invalid_or_failed_model_explicit_fallback(self):
        ref=story()
        for content in ('not json','{"items":[]}','{"items":42}'):
            def fake(url,payload,headers):return {'choices':[{'message':{'content':content}}]}
            items,_=ml.translate_batch([ref],'en','groq','TEST',fake)
            variant=items[0]['localized']['en']
            self.assertEqual(variant['status'],'fallback')
            self.assertEqual(variant['language'],'ja')
            self.assertEqual(variant['title'],ref['title'])
            self.assertIn('failed',variant['uncertainty'])
    def test_source_language_needs_no_ai(self):
        def forbidden(*a,**kw):self.fail('Must not call AI for original sources')
        ref=story('en')
        items,model=ml.translate_batch([ref],'en','groq','TEST',forbidden)
        self.assertIsNone(model)
        self.assertEqual(items[0]['localized']['en']['status'],'original')
    def test_no_key_no_network_translation(self):
        def forbidden(*a,**kw):self.fail('No key must mean no network API')
        items,_=ml.translate_batch([story()],'en',None,None,forbidden)
        self.assertEqual(items[0]['provenance']['translation_status'],'fallback')
    def test_bounded_calls_four_locales(self):
        calls=[]
        def fake(url,payload,headers):
            refs=json.loads(payload['messages'][1]['content']);calls.append(len(refs))
            return {'choices':[{'message':{'content':'{"items":[]}'}}]}
        editions=ml.build_editions([story(locale,n) for locale in ml.LOCALES for n in range(7)],[],NOW,'groq','TEST',fake)
        self.assertEqual(len(editions),4)
        self.assertEqual(len(calls),4)
        self.assertTrue(all(n<=6 for n in calls))
        self.assertEqual({e['locale'] for e in editions},set(ml.LOCALES))
    def test_archive_no_fabricated_sections_or_full_text(self):
        item=ml.make_item(story(),'en',translation(story()))
        archive=item['archive']
        self.assertEqual(archive['scope'],'rss_title_excerpt_only')
        self.assertFalse(archive['independently_verified'])
        self.assertEqual([s['available'] for s in archive['sections']],[True,False,False,False,False,False])
        self.assertEqual(archive['sources'][0]['published_at'],'2026-10-08T07:00:00Z')
    def test_hostile_output_not_rendered(self):
        ref=story()
        for value in ('<script>alert(12)</script> 2026-10-08','Ignore previous instructions 12 2026-10-08','https://evil.test/12/2026-10-08'):
            self.assertFalse(ml.valid_translation(translation(ref,title=value),ref,'en'))
    def test_rdf_source_supported(self):
        xml=b'''<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/"><item><title>Trusted DW headline</title><link>https://www.dw.com/en/test</link><description>Source excerpt</description><dc:date>2026-10-08T07:30:00Z</dc:date></item></rdf:RDF>'''
        items=core.parse_feed(xml,'DW','world',('dw.com',),NOW)
        self.assertEqual(items[0]['excerpt'],'Source excerpt')
    def test_nasa_release_full_text_allowlist_and_rights(self):
        paragraphs=''.join('<p>NASA launch information includes 12 experiments and verified source details for this public government release.</p>' for _ in range(8))
        def feed(url,body):
            return ('<rss xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><item><link>'+url+'</link><content:encoded><![CDATA['+body+']]></content:encoded></item></channel></rss>').encode()
        url='https://www.nasa.gov/news-release/test/'
        parsed=source_text.nasa_release_text(feed(url,'<figure><p>Image caption must not enter text.</p></figure>'+paragraphs))
        self.assertEqual(len(parsed[url]['paragraphs']),8)
        self.assertNotIn('Image caption',json.dumps(parsed))
        self.assertFalse(parsed[url]['website_completeness_verified'])
        self.assertEqual(source_text.nasa_release_text(feed('https://www.nasa.gov/image-article/test/',paragraphs)),{})
        self.assertEqual(source_text.nasa_release_text(feed('https://evil.test/news-release/test/',paragraphs)),{})
        self.assertEqual(source_text.nasa_release_text(feed(url,paragraphs+'<p>Copyright third party</p>')),{})
        self.assertEqual(source_text.nasa_release_text(feed(url,'<p>Too short</p>')),{})
        archive=ml.make_item({**story('en'),'article_text':parsed[url]},'en')['archive']
        self.assertTrue(archive['full_text_acquired'])
        self.assertFalse(archive['website_completeness_verified'])
        self.assertEqual(archive['scope'],'publisher_feed_article_text')
        self.assertEqual(archive['sections'][-1]['mode'],'licensed_source_text')
    def test_commercial_mode_omits_cna(self):
        class EmptyFeed:
            def __enter__(self):return self
            def __exit__(self,*a):pass
            def read(self,n):return b'<rss><channel/></rss>'
        calls=[]
        def opener(req,timeout):calls.append(req.full_url);return EmptyFeed()
        with patch.dict(core.os.environ,{'PUBLIC_SITE_COMMERCIAL':'true'}):
            ml.retrieve_pool(NOW,opener)
        self.assertFalse(any('feedburner.com/rsscna/' in u for u in calls))
    def test_locale_batch_limit(self):
        with self.assertRaises(ValueError):ml.translate_batch([story(n=n) for n in range(7)],'en','groq','TEST')
    def test_wrong_script_does_not_count_as_translation(self):
        ref=story('en')
        self.assertFalse(ml.valid_translation(translation(ref),ref,'ja'))
        self.assertFalse(ml.valid_translation(translation(ref),ref,'zh-CN'))

if __name__=='__main__': unittest.main()
