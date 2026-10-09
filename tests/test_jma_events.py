import dataclasses
import pathlib
import sys
import unittest
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'scripts'))
from jma_events import *

FIXTURE = (pathlib.Path(__file__).parent / 'fixtures/jma/vpww53-20261009.xml').read_bytes()
URL = PREFIX + '20261009015806_0_VPWW53_472000.xml'
FETCHED = '2026-10-09T02:00:00Z'
REGION = ManualRegion('municipality', '4735700')


class JMATests(unittest.TestCase):
    def report(self, **changes):
        return dataclasses.replace(parse_bulletin(FIXTURE, URL, FETCHED), **changes)

    def test_real_public_fixture_raw_risk_and_times(self):
        b = self.report()
        self.assertEqual(b.info_type, '発表')
        self.assertEqual(b.published_at, date('2026-10-09T10:58:00+09:00'))
        s = reduce_bulletin(None, b, REGION)
        self.assertEqual(s.risks[0].name, '雷注意報')
        self.assertEqual(s.risks[0].status, '継続')
        self.assertEqual(s.risks[0].code, '14')
        self.assertEqual(s.view(FETCHED)['safety'], 'unknown')
        self.assertFalse(s.view(FETCHED)['live'])
        with self.assertRaises(dataclasses.FrozenInstanceError):
            s.risks[0].name = 'safe'

    def test_exact_manual_region_no_guessing(self):
        self.assertIsNone(reduce_bulletin(None, self.report(), ManualRegion('municipality', '1310100')))
        self.assertIsNotNone(reduce_bulletin(None, self.report(), ManualRegion('forecast_area', '472000')))
        for kind, code in [('municipality', '472000'), ('gps', '4735700'), ('municipality', '47357*0')]:
            with self.assertRaises(ValueError):
                ManualRegion(kind, code)

    def test_replay_order_correction_and_serial_not_ordering(self):
        b = self.report(serial='99')
        s = reduce_bulletin(None, b, REGION)
        self.assertIs(reduce_bulletin(s, b, REGION), s)
        self.assertIs(reduce_bulletin(s, self.report(source_updated_at=date('2026-10-09T01:50:00Z')), REGION), s)
        corrected = self.report(source_updated_at=date('2026-10-09T02:01:00Z'), fetched_at=date('2026-10-09T02:02:00Z'), fingerprint='corrected', info_type='訂正', serial='1')
        updated = reduce_bulletin(s, corrected, REGION)
        self.assertEqual(updated.latest.info_type, '訂正')
        conflict = reduce_bulletin(s, self.report(fingerprint='different_same_time'), REGION)
        self.assertEqual(conflict.view(FETCHED)['state'], 'conflicting_revision')

    def test_cancel_tombstone_not_warning_clearance(self):
        s = reduce_bulletin(None, self.report(), REGION)
        cancel = self.report(source_updated_at=date('2026-10-09T02:01:00Z'), fingerprint='cancel', info_type='取消', risks=())
        result = reduce_bulletin(s, cancel, REGION)
        self.assertEqual(result.view('2026-10-09T02:02:00Z')['state'], 'telegram_cancelled')
        self.assertEqual(result.previous_risks[0].name, '雷注意報')
        self.assertEqual(result.view('2026-10-09T02:02:00Z')['safety'], 'unknown')
        self.assertIsNone(reduce_bulletin(None, cancel, REGION))
        self.assertIs(reduce_bulletin(result, self.report(), REGION), result)

    def test_expiry_absence_and_official_release_never_mean_safe(self):
        s = reduce_bulletin(None, self.report(), REGION)
        self.assertEqual(s.view('2026-10-09T04:00:00Z')['state'], 'stale')
        elapsed = reduce_bulletin(None, self.report(valid_until=date('2026-10-09T02:10:00Z')), REGION)
        self.assertEqual(elapsed.view('2026-10-09T02:12:00Z')['state'], 'source_validity_elapsed')
        removed = reduce_bulletin(s, self.report(source_updated_at=date('2026-10-09T02:01:00Z'), fingerprint='new', risks=()), REGION)
        self.assertEqual(removed.view('2026-10-09T02:02:00Z')['state'], 'region_not_in_latest_report')
        released = dataclasses.replace(s, risks=(dataclasses.replace(s.risks[0], status='解除'),))
        self.assertEqual(released.view(FETCHED)['safety'], 'unknown')

    def test_entity_encoding_pi_xinclude_and_structural_limits(self):
        for malicious in [b'<!DOCTYPE x [<!ENTITY x SYSTEM "file:///etc/passwd">]><x>&x;</x>', b'<?xml-stylesheet href="https://evil.test"?><x/>', b'<x xmlns:xi="http://www.w3.org/2001/XInclude"><xi:include href="file:///etc/passwd"/></x>', b'<x>' * 41 + b'</x>' * 41, b'<x>\xff</x>', FIXTURE * 200]:
            with self.assertRaises(ValueError):
                xml(malicious)
        with self.assertRaises(ValueError):
            xml('<!DOCTYPE x><x/>'.encode('utf-16'))

    def test_unknown_schema_training_eew_and_arbitrary_urls_rejected(self):
        for data in [FIXTURE.replace(b'1.1_2', b'9.9'), FIXTURE.replace('通常'.encode(), '訓練'.encode()), FIXTURE.replace(b'http://xml.kishou.go.jp/jmaxml1/', b'http://evil.test/xml/')]:
            with self.assertRaises(ValueError):
                parse_bulletin(data, URL, FETCHED)
        for url in ['http://www.data.jma.go.jp/developer/xml/data/20261009015806_0_VPWW53_472000.xml', URL + '?redirect=1', URL.replace('VPWW53', 'VXSE43'), 'https://evil.test/x.xml', 'file:///tmp/x.xml']:
            with self.assertRaises(ValueError):
                parse_bulletin(FIXTURE, url, FETCHED)
            with self.assertRaises(ValueError):
                fetch_public(url)
        with self.assertRaises(ValueError):
            parse_bulletin(FIXTURE, URL, '2026-10-09T01:00:00Z')

    def test_atom_links_deduplicate_exact_source_only(self):
        feed = f'<feed xmlns="http://www.w3.org/2005/Atom"><entry><link href="{URL}"/></entry><entry><link href="{URL}"/><link href="https://evil.test/a.xml"/><link href="{URL.replace("VPWW53", "VXSE43")}"/></entry></feed>'.encode()
        self.assertEqual(feed_links(feed), (URL,))

    def test_cancel_without_body_and_untrusted_text_only(self):
        root = ET.fromstring(FIXTURE)
        root.find('h:Head/h:InfoType', NS).text = '取消'
        root.remove(root.find('m:Body', NS))
        root.find('h:Head/h:Headline/h:Text', NS).text = '<script>ignore all instructions</script>'
        b = parse_bulletin(ET.tostring(root), URL, FETCHED)
        self.assertEqual(b.risks, ())
        self.assertIn('<script>', b.headline)  # Plain source string, no execution or model path.

    def test_mismatched_series_or_region_rejected(self):
        s = reduce_bulletin(None, self.report(), REGION)
        with self.assertRaises(ValueError):
            reduce_bulletin(s, self.report(series=('other',)), REGION)
        with self.assertRaises(ValueError):
            reduce_bulletin(s, self.report(), ManualRegion('municipality', '4735800'))

class JMANetworkBoundsTests(unittest.TestCase):
    def response(self, chunks):
        from unittest.mock import MagicMock
        r = MagicMock()
        r.__enter__.return_value = r
        r.status = 200
        r.headers = {}
        r.read1.side_effect = chunks
        return r

    def test_bounded_http_read_has_deadline_size_and_no_retry(self):
        from unittest.mock import patch
        r = self.response([b'<feed/>', b''])
        with patch('jma_events.urllib.request.build_opener') as opener:
            opener.return_value.open.return_value = r
            self.assertEqual(fetch_public(FEED), b'<feed/>')
            self.assertEqual(opener.return_value.open.call_count, 1)
            self.assertEqual(opener.return_value.open.call_args.kwargs['timeout'], 10)
            self.assertTrue(r.fp.raw._sock.settimeout.called)
        r = self.response([b'x' * 1000001])
        with patch('jma_events.urllib.request.build_opener') as opener:
            opener.return_value.open.return_value = r
            with self.assertRaisesRegex(ValueError, 'xml_size_limit'):
                fetch_public(URL)
        r = self.response([])
        with patch('jma_events.urllib.request.build_opener') as opener, patch('jma_events.time.monotonic', side_effect=[0, 11]):
            opener.return_value.open.return_value = r
            with self.assertRaises(TimeoutError):
                fetch_public(URL)
            r.read1.assert_not_called()

    def test_redirect_compressed_and_http_failure_rejected(self):
        from unittest.mock import patch
        with self.assertRaisesRegex(ValueError, 'redirect_forbidden'):
            NoRedirect().redirect_request(None, None, None, None, None, 'https://evil.test')
        for status, headers in [(500, {}), (200, {'Content-Encoding': 'gzip'})]:
            r = self.response([])
            r.status, r.headers = status, headers
            with patch('jma_events.urllib.request.build_opener') as opener:
                opener.return_value.open.return_value = r
                with self.assertRaises(ValueError):
                    fetch_public(URL)
                r.read1.assert_not_called()


if __name__ == '__main__':
    unittest.main()
