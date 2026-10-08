#!/usr/bin/env python3
"""Run the existing bounded generator once and publish credential-free health."""
import datetime as dt
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
LOCALES = ('zh-CN', 'zh-TW', 'ja', 'en')


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
    started = dt.datetime.now(dt.timezone.utc)
    code = subprocess.run([sys.executable, str(ROOT / 'scripts/public_ai.py')], cwd=ROOT).returncode
    try:
        payload = json.loads((ROOT / 'ai-briefs.json').read_text(encoding='utf-8'))
    except (OSError, ValueError):
        payload = {}
    status = result_status(payload, started, dt.datetime.now(dt.timezone.utc), code)
    run_id = os.environ.get('GITHUB_RUN_ID', '')
    if run_id.isdigit():
        status['run_url'] = 'https://github.com/Mornyep/hoshi-news/actions/runs/' + run_id
    (ROOT / 'public-status.json').write_text(json.dumps(status, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('Public generation status: ' + status['status'])
    return 0 if status['status'] == 'published' else 1


if __name__ == '__main__':
    raise SystemExit(main())
