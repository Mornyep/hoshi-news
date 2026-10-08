"""Allowlisted government press-release text from official NASA syndication.

No arbitrary URL fetches, page scraping, images, logos or paywall bypass.
NASA's factual-use guidance permits informational reuse with attribution but
third-party copyrighted content does not inherit that permission.
"""
import re
from html.parser import HTMLParser
import public_ai as core

NASA_TERMS='https://www.nasa.gov/nasa-brand-center/images-and-media/'
CONTENT='{http://purl.org/rss/1.0/modules/content/}encoded'

class ArticleParagraphs(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.paragraphs=[];self.parts=[];self.active=None;self.skip=0
    def handle_starttag(self,tag,attrs):
        if tag in ('figure','script','style','nav','aside','footer'):
            self.skip+=1
        if not self.skip and tag in ('p','li') and not self.active:
            self.active=tag;self.parts=[]
    def handle_endtag(self,tag):
        if tag==self.active and not self.skip:
            value=re.sub(r'\s+',' ',' '.join(self.parts)).strip()
            if value:self.paragraphs.append(value)
            self.active=None;self.parts=[]
        if tag in ('figure','script','style','nav','aside','footer'):
            self.skip=max(0,self.skip-1)
    def handle_data(self,data):
        if self.active and not self.skip:self.parts.append(data)

def nasa_release_text(xml_bytes):
    result={}
    root=core.ET.fromstring(xml_bytes)
    for node in root.findall('./channel/item'):
        url=core.validated_source_url(node.findtext('link') or '',('www.nasa.gov',))
        if not url or not core.urllib.parse.urlsplit(url).path.startswith('/news-release/'):continue
        content=node.findtext(CONTENT) or ''
        # Reject explicit third-party rights notices rather than guessing ownership.
        if not content or len(content)>100_000 or re.search(r'copyright|©|all rights reserved',content,re.I):continue
        parser=ArticleParagraphs();parser.feed(content);parser.close()
        text='\n\n'.join(parser.paragraphs)
        if parser.active or parser.skip or len(parser.paragraphs)<5 or not 600<=len(text)<=20_000:continue
        result[url]={'paragraphs':parser.paragraphs,'language':'en','rights_basis':'NASA factual informational use; no implied endorsement',
                     'rights_url':NASA_TERMS,'acquired_via':'official_feed_content_encoded','source_url':url,
                     'extraction':'complete_supplied_paragraphs_no_images_or_logos',
                     'website_completeness_verified':False}
    return result

class NASAOnlyRedirect(core.urllib.request.HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        if not core.validated_source_url(newurl,('www.nasa.gov',)):
            raise ValueError('Untrusted NASA redirect')
        return super().redirect_request(req,fp,code,msg,headers,newurl)


def nasa_api_text(url, opener=None):
    """Public publisher REST body, exact canonical article match; fail closed."""
    import json
    canonical=core.validated_source_url(url,('www.nasa.gov',))
    if not canonical or not core.urllib.parse.urlsplit(canonical).path.startswith('/news-release/'):return None
    slug=core.urllib.parse.urlsplit(canonical).path.rstrip('/').split('/')[-1]
    if not re.fullmatch(r'[a-z0-9-]+',slug):return None
    api='https://www.nasa.gov/wp-json/wp/v2/press-release?'+core.urllib.parse.urlencode({'slug':slug,'_fields':'link,content'})
    opener=opener or core.urllib.request.build_opener(NASAOnlyRedirect()).open
    try:
        with opener(core.urllib.request.Request(api,headers={'User-Agent':core.USER_AGENT}),timeout=8) as response:
            if not core.validated_source_url(response.geturl(),('www.nasa.gov',)):return None
            raw=response.read(200001)
        if len(raw)>200000:return None
        rows=json.loads(raw)
        if not isinstance(rows,list) or len(rows)!=1 or core.validated_source_url(rows[0]['link'],('www.nasa.gov',))!=canonical:return None
        content=rows[0]['content']['rendered']
        if not isinstance(content,str) or len(content)>100000 or re.search(r'copyright|©|all rights reserved',content,re.I):return None
        parser=ArticleParagraphs();parser.feed(content);parser.close()
        text='\n\n'.join(parser.paragraphs)
        if parser.active or parser.skip or len(parser.paragraphs)<5 or not 600<=len(text)<=20000:return None
        return {'paragraphs':parser.paragraphs,'language':'en','rights_basis':'NASA factual informational use; no implied endorsement',
                'rights_url':NASA_TERMS,'source_url':canonical,'acquired_via':'official_public_rest_api',
                'extraction':'complete_supplied_paragraphs_no_images_or_logos','website_completeness_verified':False}
    except (OSError,ValueError,KeyError,TypeError):return None


def enrich_articles(pool,opener=None,limit=2):
    """At most two public REST requests per edition; keep feed body on failure."""
    count=0
    for ref in sorted(pool,key=lambda x:x['published_at'],reverse=True):
        if ref['publisher']!='NASA' or '/news-release/' not in ref['url']:continue
        if count>=limit:break
        count+=1
        body=nasa_api_text(ref['url'],opener)
        ref['body_retrieval']={'method':'official_public_rest_api','status':'acquired' if body else 'unavailable'}
        if body:ref['article_text']=body
    return pool
