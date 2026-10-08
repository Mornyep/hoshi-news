import datetime as dt
import json
import tempfile
from pathlib import Path
import unittest
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import public_ai as core

NOW = dt.datetime(2026, 10, 8, 3, 20, tzinfo=dt.timezone.utc)

def story(category, n=0):
    return dict(id=f'{category}-{n}', category=category, publisher='Example',
                title=f'{category} story {n}: important public event with full reported context',
                excerpt='Public RSS summary', url=f'https://www.bbc.com/news/{category}-{n}',
                published_at=(NOW-dt.timedelta(minutes=n)).isoformat().replace('+00:00','Z'))

class EditorialNewsTests(unittest.TestCase):
    def test_all_editorial_sections_available(self):
        groups={k:[story(k,i) for i in range(3)] for k in core.CATEGORIES}
        items=core.select_editorial_items(groups)
        self.assertEqual(len(items),core.MAX_ITEMS)
        self.assertEqual([x['category'] for x in items[:2]],['headlines','headlines'])
        self.assertEqual(set(x['category'] for x in items),set(core.CATEGORIES))
        self.assertEqual(len(set(x['url'] for x in items)),len(items))

    def test_news_do_not_disappear_because_no_interest_or_missing_feed(self):
        groups={k:[] for k in core.CATEGORIES}
        groups['headlines']=[story('headlines'),story('headlines',1)]
        groups['world']=[story('world')]
        groups['society']=[story('society')]
        chosen=core.select_editorial_items(groups)
        self.assertEqual(len(chosen),4)
        self.assertIn('society',{x['category'] for x in chosen})
        self.assertEqual(len({x['id'] for x in chosen}),4)

    def test_de_duplicate_cross_sources_and_previous_editions(self):
        groups={k:[] for k in core.CATEGORIES}
        headline=story('headlines')
        near={**story('world'), 'title':headline['title'], 'url':headline['url']}
        groups['headlines']=[headline]
        groups['world']=[near,story('world',2)]
        chosen=core.select_editorial_items(groups)
        self.assertNotIn(near['id'], {x['id'] for x in chosen})
        self.assertIn('world-2',{x['id'] for x in chosen})
        self.assertNotIn(headline['id'],{x['id'] for x in core.select_editorial_items(groups, excluded_ids=[headline['id']])})

    def test_batched_generation_and_source_immutability(self):
        candidates=[story(k) for k in list(core.CATEGORIES)[:9]]
        calls=[]
        def fake(url,payload,headers):
            inputs=json.loads(payload['messages'][1]['content'].split('\n',1)[1])
            calls.append(len(inputs))
            answers=[{'id':x['id'],'summary':'安全中文摘要明确标注来源','context':'建议阅读原始文章了解更多','uncertainty':'缺少完整内容，需要进一步确认'} for x in inputs]
            return {'choices':[{'message':{'content':json.dumps({'items':answers},ensure_ascii=False)}}]}
        results,model=core.generate_summaries_batched(candidates,'groq','TEST',caller=fake,batch_size=4)
        self.assertEqual(calls,[4,4,1])
        self.assertEqual(len(results),9)
        self.assertTrue(all(x['source']['url'].startswith('https://www.bbc.com/news/') for x in results))
        self.assertTrue(results[0]['is_headline'])
        self.assertEqual(model,'openai/gpt-oss-20b')

    def test_same_day_no_repeat(self):
        with tempfile.TemporaryDirectory() as d:
            output=Path(d)/'ai-briefs.json'
            edition=core.pack_edition([{'id':'world-0','summary':'source only'}],'model','groq',NOW)
            core.publish_edition(edition,output)
            self.assertIn('world-0',core.recent_edition_ids(NOW,output))
            self.assertNotIn('world-0',core.recent_edition_ids(NOW+dt.timedelta(days=1),output))

if __name__=='__main__': unittest.main()
