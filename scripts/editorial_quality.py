"""Evidence depth and conservative same-event grouping; no additional retrieval.

A substantial RSS excerpt is still an excerpt, never a full article. Grouping is
an editorial association, not independent corroboration. No opaque trust score.
"""
import difflib
import hashlib
import re
import public_ai as core


def depth(ref):
    article = ref.get('article_text') or {}
    if len(article.get('paragraphs', [])) >= 5 and sum(map(len, article['paragraphs'])) >= 600:
        return 'article'
    excerpt = ref.get('excerpt', '').strip()
    cjk = len(re.findall(r'[\u3040-\u30ff\u3400-\u9fff]', excerpt))
    # Thresholds are language-sensitive and inspect acquired text, not AI output.
    if (cjk >= 140 or (cjk < 40 and len(excerpt) >= 280)):
        return 'substantial_excerpt'
    return 'brief'


def same_event(a, b):
    if a['url'] == b['url']:
        return True
    if a['category'] != b['category'] or a['language'] != b['language']:
        return False
    dates = [core.parse_date(x.get('published_at')) for x in (a, b)]
    if not all(dates) or abs((dates[0] - dates[1]).total_seconds()) > 18 * 3600:
        return False
    normalize = lambda text: re.sub(r'[^\w]+', ' ', text.casefold()).strip()
    left, right = [normalize(x['title']) for x in (a, b)]
    if min(len(left), len(right)) < 20:
        return False
    if re.findall(r'\d+(?:[.,/-]\d+)*', left) != re.findall(r'\d+(?:[.,/-]\d+)*', right):
        return False
    # CJK names cannot be reliably identified by this lightweight detector.
    # Require identical normalized CJK headlines instead of guessing entities.
    if re.search(r'[\u3040-\u30ff\u3400-\u9fff]', left + right):
        return left == right
    names = lambda text: set(re.findall(r'\b[A-Z][A-Za-z]+\b', text))
    if names(a['title']) != names(b['title']) or not names(a['title']):
        return False
    tokens = lambda text: set(re.findall(r'[a-z]{4,}', text))
    shared = tokens(left) & tokens(right)
    return len(shared) >= 5 and difflib.SequenceMatcher(None, left, right).ratio() >= .88


def group_events(pool):
    groups = []
    for ref in sorted(pool, key=lambda x: x['published_at'], reverse=True):
        # Pairwise agreement avoids transitive A~B~C merging unrelated A/C.
        group = next((g for g in groups if len(g) < 4 and all(same_event(ref, member) for member in g)), None)
        if group is None:
            groups.append([ref])
        elif not any(x['url'] == ref['url'] for x in group):
            group.append(ref)
    ranks = {'article': 2, 'substantial_excerpt': 1, 'brief': 0}
    result = []
    for group in groups:
        ordered = sorted(group, key=lambda x: (ranks[depth(x)], x['published_at']), reverse=True)
        primary = dict(ordered[0])
        primary['related_sources'] = ordered[1:]
        primary['evidence_depth'] = depth(primary)
        primary['event_id'] = hashlib.sha256(min(x['url'] for x in group).encode()).hexdigest()[:14]
        result.append(primary)
    return result


def source_records(ref):
    return [{'name': x['publisher'], 'url': x['url'], 'language': x['language'],
             'title': x['title'], 'excerpt': x.get('excerpt', '')[:460],
             'published_at': x['published_at'], 'retrieved_at': x.get('retrieved_at'),
             'scope': 'publisher_feed_article_text' if depth(x) == 'article' else 'rss_title_excerpt_only'}
            for x in [ref, *ref.get('related_sources', [])][:4]]
