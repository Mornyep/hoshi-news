import unittest
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import editorial_quality as quality
import multilingual as ml
from test_multilingual import story, NOW

class EditorialQualityTests(unittest.TestCase):
    def test_depth_uses_acquired_material_not_title_or_generated_summary(self):
        ref=story();ref['excerpt']='Short RSS.';ref['summary']='x'*4000
        self.assertEqual(quality.depth(ref),'brief')
        self.assertEqual(quality.depth({**ref,'excerpt':'事実を報じる。'*30}),'substantial_excerpt')
        self.assertEqual(quality.depth({**ref,'excerpt':'Actual source material. '*16}),'substantial_excerpt')
        self.assertEqual(quality.depth({**ref,'article_text':{'paragraphs':['Source material. '*15]*5}}),'article')
    def test_short_local_does_not_outweigh_substantial_cross_language(self):
        short={**story('ja'),'excerpt':'短いニュース。'}
        long=story('en',1)
        selected=ml.select_locale_items([short,long],'ja')
        self.assertEqual([x['id'] for x in selected],[long['id']])
    def test_briefs_are_separate_and_do_not_trigger_model_calls(self):
        pool=[{**story(locale,n),'excerpt':'Short source excerpt.'} for n,locale in enumerate(ml.LOCALES)]
        def forbidden(*args,**kwargs):self.fail('Short RSS must not be expanded or translated to fill main quota')
        editions=ml.build_editions(pool,[],NOW,'groq','TEST',forbidden)
        self.assertEqual(len(editions),4)
        for edition in editions:
            self.assertEqual(edition['items'],[])
            self.assertEqual(len(edition['briefs']),4)
            self.assertTrue(all(not x['archive']['full_text_acquired'] for x in edition['briefs']))
    def test_same_event_preserves_attributed_sources(self):
        a={**story('en'),'title':'NASA announces new station cargo launch plans for October 13','publisher':'NASA'}
        b={**a,'id':'other','url':'https://example.org/report','publisher':'Another outlet','title':'NASA announces updated station cargo launch plans for October 13','excerpt':'Another source only states plans, not completed launch. '*8}
        grouped=quality.group_events([a,b])
        self.assertEqual(len(grouped),1)
        result=ml.make_item(grouped[0],'en')
        self.assertEqual(len(result['event']['sources']),2)
        self.assertEqual({x['url'] for x in result['event']['sources']},{a['url'],b['url']})
        self.assertFalse(result['event']['independently_verified'])
    def test_distinct_numbers_entities_time_category_and_language_not_merged(self):
        a={**story('en'),'title':'NASA announces new station cargo launch plans for October 13'}
        changes=[{'title':a['title'].replace('13','14')},{'title':a['title'].replace('NASA','JAXA')},{'published_at':'2026-10-06T07:00:00Z'},{'category':'society'},{'language':'ja'}]
        for change in changes:
            b={**a,'id':'other','url':'https://example.org/other',**change}
            self.assertFalse(quality.same_event(a,b),change)
    def test_cjk_names_require_identical_headlines(self):
        a={**story('ja'),'title':'東京都で新たな公共交通の計画を発表、来年から導入へ'}
        b={**a,'url':'https://example.org/other','title':a['title'].replace('東京都','大阪府')}
        self.assertFalse(quality.same_event(a,b))
    def test_publisher_full_text_cap_and_main_no_thin_filler(self):
        pool=[{**story('en',n),'publisher':'NASA','article_text':{'paragraphs':['Reusable release factual material. '*12]*5}} for n in range(6)]
        pool += [story('ja',n+10) for n in range(5)]
        selected=ml.select_locale_items(pool,'ja')
        self.assertLessEqual(sum(x['publisher']=='NASA' for x in selected),1)
        self.assertTrue(all(quality.depth(x)!='brief' for x in selected))

if __name__=='__main__':unittest.main()
