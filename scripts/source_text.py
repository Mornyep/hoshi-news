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
