import copy,hashlib,json,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import editorial_archives as editorial
class EditorialArchiveTests(unittest.TestCase):
 def setUp(self):
  self.record=json.loads(editorial.RECORDS.read_text())[0]
  self.ref={'url':self.record['source_url'],'article_text':{'paragraphs':self.record['source_paragraphs']}}
 def item(self,locale):
  return {'localized':{locale:{'title':'original','summary':'original','archive':{'scope':'publisher_feed_article_text','full_text_acquired':True,'independently_verified':False,'rights':{'rights_url':'https://www.nasa.gov/nasa-brand-center/images-and-media/'}}}},'provenance':{}}
 def test_exact_source_required_and_all_four_original_accounts(self):
  self.assertEqual(hashlib.sha256('\n\n'.join(self.ref['article_text']['paragraphs']).encode()).hexdigest(),self.record['source_text_sha256'])
  for locale in ['zh-CN','zh-TW','ja','en']:
   item=editorial.apply_editorial(self.item(locale),self.ref,locale)
   a=item['archive'];self.assertTrue(a['full_text_acquired']);self.assertFalse(a['independently_verified']);self.assertEqual(a['method'],'source_bound_editorial_retelling')
   self.assertEqual({x['id'] for x in a['sections']},{'summary','background','timeline','data','stakeholders','verification'})
   body=' '.join(x['text'] for x in a['sections']);self.assertGreater(len(body),900);self.assertIn('6,300',body);self.assertIn('6:33',body);self.assertIn('Bill Spetch',body)
   self.assertTrue(all(x['language']==locale and x['mode']=='editorial_retelling' for x in a['sections']))
 def test_changed_text_or_url_cannot_reuse_old_facts(self):
  for ref in [dict(self.ref,url='https://www.nasa.gov/news-release/other/'),dict(self.ref,article_text={'paragraphs':self.record['source_paragraphs']+['Updated launch postponed']})]:
   original=self.item('en');self.assertEqual(editorial.apply_editorial(copy.deepcopy(original),ref,'en'),original)
 def test_rss_only_never_claims_editorial_full_text(self):
  original=self.item('ja');self.assertEqual(editorial.apply_editorial(copy.deepcopy(original),{'url':self.record['source_url']},'ja'),original)
if __name__=='__main__':unittest.main()

class MachineRetellingGuardTests(unittest.TestCase):
 def test_licensed_text_only_and_unsupported_numbers_quotes_and_urls_fail(self):
  import multilingual
  record=json.loads(editorial.RECORDS.read_text())[0]
  ref={'title':'NASA SpaceX mission','article_text':{'paragraphs':record['source_paragraphs']}}
  answer={'archive_sections':[{'id':sid,'text':'NASA describes a planned SpaceX resupply flight. The schedule is provisional and the linked publisher remains the sole source.'} for sid in ('summary','background','timeline','data','stakeholders','verification')]}
  self.assertIsNotNone(multilingual.validate_archive_sections(answer,ref,'en'))
  self.assertIsNone(multilingual.validate_archive_sections(answer,{'title':ref['title']},'en'))
  for extra in [' The cargo weighs 999999 pounds.',' Visit https://evil.example/ for credentials.',' They said “a new invented quotation”.']:
   changed=copy.deepcopy(answer);changed['archive_sections'][0]['text']+=extra
   self.assertIsNone(multilingual.validate_archive_sections(changed,ref,'en'))
 def test_incomplete_sections_fail_and_detailed_scope_is_preserved(self):
  import multilingual
  record=json.loads(editorial.RECORDS.read_text())[0]
  ref={'title':'NASA SpaceX mission','article_text':{'paragraphs':record['source_paragraphs'],'rights_basis':'NASA factual reuse'}}
  answer={'archive_sections':[{'id':sid,'text':'NASA describes a planned SpaceX resupply flight. The schedule is provisional and the linked publisher remains the sole source.'} for sid in ('summary','background','timeline','data','stakeholders','verification')]}
  archive=multilingual.archive_for({**ref,'publisher':'NASA','url':record['source_url'],'published_at':'2026-10-07T21:16:42Z','article_text':{**ref['article_text'],'rights_url':'https://www.nasa.gov/nasa-brand-center/images-and-media/','acquired_via':'official_feed_content_encoded','extraction':'complete_supplied_paragraphs_no_images_or_logos'}},{'summary':'Source summary'},'en',answer)
  self.assertEqual(archive['method'],'source_bound_machine_retelling');self.assertFalse(archive['independently_verified']);self.assertTrue(all(x['language']=='en' for x in archive['sections']))
  answer['archive_sections'].pop();self.assertIsNone(multilingual.validate_archive_sections(answer,ref,'en'))
