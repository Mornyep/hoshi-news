"""Narrow JMA VPWW53 adapter. No scheduler, location, model, private storage or UI wiring."""
from __future__ import annotations
from dataclasses import asdict, dataclass, replace
from datetime import datetime, timezone, timedelta
import hashlib
import re
import time
import urllib.request
import xml.etree.ElementTree as ET

FEED = 'https://www.data.jma.go.jp/developer/xml/feed/extra.xml'
PREFIX = 'https://www.data.jma.go.jp/developer/xml/data/'
DATA_URL = re.compile(re.escape(PREFIX) + r'\d{14}_\d+_VPWW53_\d{6}\.xml\Z')
NS = {'c': 'http://xml.kishou.go.jp/jmaxml1/', 'h': 'http://xml.kishou.go.jp/jmaxml1/informationBasis1/', 'm': 'http://xml.kishou.go.jp/jmaxml1/body/meteorology1/', 'a': 'http://www.w3.org/2005/Atom'}
TYPES = {'municipality': ('気象警報・注意報（市町村等）', 7), 'forecast_area': ('気象警報・注意報（府県予報区等）', 6)}


def date(value):
    try:
        result = datetime.fromisoformat(value.replace('Z', '+00:00'))
        if result.tzinfo is None:
            raise ValueError()
        return result.astimezone(timezone.utc)
    except (ValueError, AttributeError):
        raise ValueError('invalid_timestamp') from None


def xml(data, limit=1_000_000):
    if not isinstance(data, bytes) or len(data) > limit:
        raise ValueError('xml_size_limit')
    try:
        text = data.decode('utf-8-sig')
    except UnicodeError:
        raise ValueError('utf8_required') from None
    # No DTD, entities, XInclude, external stylesheets or alternate encodings.
    if re.search(r'<!\s*(DOCTYPE|ENTITY)', text, re.I):
        raise ValueError('external_entities_forbidden')
    text = re.sub(r'^\s*<\?xml\s[^?]*\?>', '', text, count=1)
    if '<?' in text:
        raise ValueError('processing_instruction_forbidden')
    try:
        root = ET.fromstring(text)
    except ET.ParseError:
        raise ValueError('invalid_xml') from None
    count = 0
    stack = [(root, 1)]
    while stack:
        node, depth = stack.pop()
        count += 1
        if count > 20000 or depth > 40 or node.tag.startswith('{http://www.w3.org/2001/XInclude}'):
            raise ValueError('xml_structure_limit')
        stack.extend((child, depth + 1) for child in node)
    return root


def text(node, path, required=True):
    found = node.findall(path, NS)
    if len(found) > 1 or (required and len(found) != 1):
        raise ValueError('unsupported_schema')
    value = ''.join(found[0].itertext()).strip() if found else ''
    if (required and not value) or len(value) > 12000:
        raise ValueError('unsupported_schema')
    return value


@dataclass(frozen=True)
class ManualRegion:
    kind: str
    code: str

    def __post_init__(self):
        if self.kind not in TYPES or not re.fullmatch(r'\d{' + str(TYPES[self.kind][1]) + '}', self.code):
            raise ValueError('explicit_jma_region_required')


@dataclass(frozen=True)
class Risk:
    area_kind: str
    area_code: str
    area_name: str
    name: str
    code: str
    status: str


@dataclass(frozen=True)
class Bulletin:
    source_url: str
    fingerprint: str
    series: tuple
    source_updated_at: datetime
    published_at: datetime
    fetched_at: datetime
    valid_until: datetime | None
    info_type: str
    serial: str
    headline: str
    risks: tuple


def parse_bulletin(data, source_url, fetched_at):
    if not DATA_URL.fullmatch(source_url):
        raise ValueError('official_vpww53_url_required')
    root = xml(data)
    if root.tag != '{' + NS['c'] + '}Report':
        raise ValueError('unsupported_schema')
    title = text(root, 'c:Control/c:Title')
    status = text(root, 'c:Control/c:Status')
    if title != '気象特別警報・警報・注意報' or status != '通常':
        raise ValueError('non_operational_or_unsupported')
    if text(root, 'h:Head/h:InfoKind') != '気象警報・注意報' or text(root, 'h:Head/h:InfoKindVersion') != '1.1_2':
        raise ValueError('unsupported_schema_version')
    office = text(root, 'c:Control/c:EditorialOffice')
    event_id = text(root, 'h:Head/h:EventID', False)
    info_type = text(root, 'h:Head/h:InfoType')
    if info_type not in ('発表', '訂正', '取消'):
        raise ValueError('unsupported_info_type')
    updated = date(text(root, 'c:Control/c:DateTime'))
    published = date(text(root, 'h:Head/h:ReportDateTime'))
    fetched = date(fetched_at)
    if updated > fetched + timedelta(minutes=5) or published > fetched + timedelta(minutes=5):
        raise ValueError('future_timestamp')
    valid = text(root, 'h:Head/h:ValidDateTime', False)
    risks = []
    for warning in root.findall('m:Body/m:Warning', NS):
        kind = next((k for k, (name, _) in TYPES.items() if name == warning.get('type')), None)
        if kind is None:
            continue
        for item in warning.findall('m:Item', NS):
            code = text(item, 'm:Area/m:Code')
            ManualRegion(kind, code)
            name = text(item, 'm:Area/m:Name')
            for risk in item.findall('m:Kind', NS):
                risks.append(Risk(kind, code, name, text(risk, 'm:Name'), text(risk, 'm:Code'), text(risk, 'm:Status')))
    if info_type != '取消' and not risks:
        raise ValueError('unsupported_empty_body')
    unique = {}
    for risk in risks:
        key = (risk.area_kind, risk.area_code, risk.code)
        if key in unique and unique[key] != risk:
            raise ValueError('conflicting_risk_items')
        unique[key] = risk
    return Bulletin(source_url, hashlib.sha256(data).hexdigest(), (title, office, status, event_id), updated, published, fetched, date(valid) if valid else None, info_type, text(root, 'h:Head/h:Serial', False), text(root, 'h:Head/h:Headline/h:Text', False), tuple(unique.values()))


def feed_links(data):
    root = xml(data, 2_000_000)
    if root.tag != '{' + NS['a'] + '}feed':
        raise ValueError('unsupported_feed')
    links = []
    for entry in root.findall('a:entry', NS):
        for link in entry.findall('a:link', NS):
            url = link.get('href', '')
            if DATA_URL.fullmatch(url) and url not in links:
                links.append(url)
    return tuple(links)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise ValueError('redirect_forbidden')


def fetch_public(url):
    """One request, no retry, exact official host/path, 10s deadline and bounded bytes."""
    if url != FEED and not DATA_URL.fullmatch(url):
        raise ValueError('official_url_required')
    limit = 2_000_000 if url == FEED else 1_000_000
    deadline = time.monotonic() + 10
    req = urllib.request.Request(url, headers={'User-Agent': 'Starnews-JMA-adapter/0.1', 'Accept': 'application/xml', 'Accept-Encoding': 'identity'})
    with urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect()).open(req, timeout=10) as response:
        if response.status != 200 or response.headers.get('Content-Encoding', 'identity') != 'identity':
            raise ValueError('unsupported_http_response')
        sock = response.fp.raw._sock
        chunks, size = [], 0
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError('jma_fetch_timeout')
            sock.settimeout(remaining)
            part = response.read1(min(65536, limit + 1 - size))
            if not part:
                return b''.join(chunks)
            size += len(part)
            if size > limit:
                raise ValueError('xml_size_limit')
            chunks.append(part)


@dataclass(frozen=True)
class Selection:
    latest: Bulletin
    region: ManualRegion
    risks: tuple
    previous_risks: tuple = ()
    conflict: bool = False

    def view(self, now, max_age=timedelta(minutes=30)):
        now = date(now)
        age = now - min(self.latest.fetched_at, self.latest.source_updated_at)
        if self.conflict:
            state = 'conflicting_revision'
        elif self.latest.info_type == '取消':
            state = 'telegram_cancelled'
        elif self.latest.valid_until and now >= self.latest.valid_until:
            state = 'source_validity_elapsed'
        elif age > max_age:
            state = 'stale'
        elif not self.risks:
            state = 'region_not_in_latest_report'
        else:
            state = 'source_snapshot'
        return {'state': state, 'safety': 'unknown', 'source': '気象庁', 'source_url': self.latest.source_url,
                'published_at': self.latest.published_at.isoformat(), 'source_updated_at': self.latest.source_updated_at.isoformat(),
                'fetched_at': self.latest.fetched_at.isoformat(), 'info_type': self.latest.info_type,
                'risks': [asdict(r) for r in self.risks], 'previous_risks': [asdict(r) for r in self.previous_risks], 'live': False,
                'freshness': 'stale' if age > max_age else 'within_local_age_limit',
                'interpretation': 'raw_source_only_not_a_safety_clearance'}


def reduce_bulletin(previous, bulletin, region):
    """Ordering uses Control/DateTime, never Serial. Cancellation tombstones retain prior raw risks."""
    if previous and (previous.region != region or previous.latest.series != bulletin.series):
        raise ValueError('different_series_or_region')
    selected = tuple(r for r in bulletin.risks if (r.area_kind, r.area_code) == (region.kind, region.code))
    if previous:
        old = previous.latest
        if bulletin.source_updated_at < old.source_updated_at or bulletin.fingerprint == old.fingerprint:
            return previous
        if bulletin.source_updated_at == old.source_updated_at:
            return replace(previous, conflict=True)
    history = previous.risks or previous.previous_risks if previous else ()
    if not previous and not selected:
        return None  # Includes cancellation of an unknown series: no invented region match.
    return Selection(bulletin, region, selected if bulletin.info_type != '取消' else (), history)
