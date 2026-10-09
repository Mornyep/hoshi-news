import datetime as dt
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from publication_status import result_status, already_published, LOCALES


class PublicationStatusTests(unittest.TestCase):
    def setUp(self):
        self.start = dt.datetime(2026, 10, 8, 23, 45, tzinfo=dt.timezone.utc)
        self.finish = self.start + dt.timedelta(minutes=4)

    def payload(self, locales=LOCALES, timestamp='2026-10-08T23:46:00Z'):
        return {'updated_at': timestamp, 'editions': [
            {'date': '2026-10-09', 'session': 'morning', 'locale': locale,
             'generated_at': timestamp, 'items': [{'id': 'source-bound'}]}
            for locale in locales]}

    def test_today_jst_requires_fresh_generation_for_each_locale(self):
        status = result_status(self.payload(), self.start, self.finish, 0)
        self.assertEqual(status['date'], '2026-10-09')
        self.assertEqual(status['session'], 'morning')
        self.assertEqual(status['status'], 'published')
        self.assertIsNone(status['error'])

    def test_successful_noop_does_not_claim_old_same_session_is_fresh(self):
        status = result_status(self.payload(timestamp='2026-10-08T23:30:00Z'), self.start, self.finish, 0)
        self.assertEqual(status['status'], 'failed')
        self.assertTrue(all(v == 'unavailable' for v in status['locales'].values()))
        self.assertEqual(status['last_success_at'], '2026-10-08T23:30:00Z')

    def test_partial_locale_failure_is_public_and_keeps_success(self):
        status = result_status(self.payload(('en',)), self.start, self.finish, 0)
        self.assertEqual(status['status'], 'failed')
        self.assertEqual(status['locales']['en'], 'published')
        self.assertEqual(status['locales']['zh-CN'], 'unavailable')

    def test_failed_process_cannot_claim_complete_success(self):
        self.assertEqual(result_status(self.payload(), self.start, self.finish, 1)['status'], 'failed')

    def complete(self):
        payload = self.payload(timestamp='2026-10-08T23:30:00Z')
        for edition in payload['editions']:
            edition['ai_status'] = 'completed'
        return payload

    def test_complete_same_slot_skips_without_rewriting_time(self):
        payload = self.complete()
        import copy
        before = copy.deepcopy(payload)
        self.assertTrue(already_published(payload, self.start))
        self.assertEqual(payload, before)

    def test_next_natural_slot_and_incomplete_locale_are_not_skipped(self):
        payload = self.complete()
        self.assertFalse(already_published(payload, self.start + dt.timedelta(hours=4)))
        payload['editions'].pop()
        self.assertFalse(already_published(payload, self.start))

    def test_date_only_or_future_generated_time_never_passes(self):
        for stamp in ['2026-10-07T23:30:00Z', '2026-10-09T04:00:00Z', 'invalid', '2026-10-08T23:30:00']:
            payload = self.complete()
            payload['editions'][0]['generated_at'] = stamp
            self.assertFalse(already_published(payload, self.start))


if __name__ == '__main__':
    unittest.main()
