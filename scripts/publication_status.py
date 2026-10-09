#!/usr/bin/env python3
"""Retired publication entry point; retain pure archive-status helpers."""
import datetime as dt
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
LOCALES = ('zh-CN', 'zh-TW', 'ja', 'en')


def already_published(payload, now):
    """An already-complete slot is a NO-OP, including its original timestamps."""
    local = now.astimezone(dt.timezone(dt.timedelta(hours=9)))
    session = 'morning' if local.hour < 11 else 'noon' if local.hour < 17 else 'evening'
    for locale in LOCALES:
        valid = False
        for edition in payload.get('editions', []):
            if not isinstance(edition, dict):
                continue
            if (edition.get('date') != local.strftime('%Y-%m-%d') or edition.get('session') != session
                    or edition.get('locale') != locale or edition.get('ai_status') != 'completed'
                    or not (edition.get('items') or edition.get('briefs'))):
                continue
            try:
                generated = dt.datetime.fromisoformat(edition['generated_at'].replace('Z', '+00:00'))
                valid = (generated.tzinfo is not None and generated <= now
                         and generated.astimezone(local.tzinfo).date() == local.date())
            except (KeyError, TypeError, ValueError):
                continue
            if valid:
                break
        if not valid:
            return False
    return True


def read_publication():
    try:
        payload = json.loads((ROOT / 'ai-briefs.json').read_text(encoding='utf-8'))
        return payload if isinstance(payload, dict) and isinstance(payload.get('editions'), list) else {}
    except (OSError, ValueError):
        return {}


def result_status(payload, started, finished, returncode):
    local = started.astimezone(dt.timezone(dt.timedelta(hours=9)))
    session = 'morning' if local.hour < 11 else 'noon' if local.hour < 17 else 'evening'
    day = local.strftime('%Y-%m-%d')
    locales = {}
    for locale in LOCALES:
        fresh = any(e.get('date') == day and e.get('session') == session
                    and e.get('locale') == locale and e.get('generated_at', '') >= started.isoformat().replace('+00:00', 'Z')
                    and (e.get('items') or e.get('briefs'))
                    for e in payload.get('editions', []))
        locales[locale] = 'published' if fresh else 'unavailable'
    success = returncode == 0 and all(v == 'published' for v in locales.values())
    return {'schema': 1, 'date': day, 'session': session,
            'attempted_at': started.isoformat().replace('+00:00', 'Z'),
            'finished_at': finished.isoformat().replace('+00:00', 'Z'),
            'status': 'published' if success else 'failed', 'locales': locales,
            'error': None if success else 'generation_unavailable',
            'last_success_at': payload.get('updated_at')}


def main():
    print('Public AI retired. Use your own personal AI. No generation or timestamp changes.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
