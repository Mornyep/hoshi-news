# STARNEWS guide

[简体中文](guide.zh-CN.md) · [繁體中文](guide.zh-TW.md) · [English](guide.en.md) · [日本語](guide.ja.md) · [한국어](guide.ko.md) · [Project](../README.en.md)

## Getting started

Open [STARNEWS](https://mornyep.github.io/hoshi-news/) and Personal AI. Create or select a local profile, then save free-text reading requirements: for example, “Follow Japanese space missions; distinguish official announcements from speculation and include dates and sources.” There is no broad category picker.

The interface supports Simplified Chinese, Traditional Chinese, Japanese and English. It starts with the browser language and offers a setting to change it. Korean documentation does not imply a Korean interface. Missing reliable translations remain labelled in the original language. Check the language and accuracy of pasted replies yourself.

## Usage

Enter a question, choose an official AI entry and decide whether to include saved requirements. Selecting an archived report adds its sources. Without a selected report, the packet is a research request with no supplied news evidence.

Prepare and inspect the sources, times and evidence scope. Copy the material and submit it yourself in your official AI client. Optionally paste a reply and declare its model. The page labels your declared provider, paste time and unverified status. Paste time is not a news update time. Packets and replies are neither sent automatically nor persisted.

Optional presentation JSON accepts only `tone` and `highlights`: `lime/cyan/purple/amber`, and at most three exact existing title/summary spans of 2–80 characters. Arbitrary HTML, CSS, scripts, invented text and official warning overrides are rejected. Emphasis is a reading aid, not a risk rating.

Archives retain original dates, links and evidence scope. RSS excerpts do not establish full-article access; linked reports do not establish independent verification. Offline reading requires previously cached files. Cached history and load failures are labelled; an initial offline visit is not guaranteed to work.

## Configuration

Ordinary reading and manual AI need no API key or backend. An official homepage opens a provider website; it does not authenticate a subscription or enable automatic calls. Provider account, region, usage and data policies apply.

The existing GitHub Pages deployment publishes the root of `main`, without a build. Public model generation is retired; Actions runs source tests only. Explicit `--dry-run` and `--rss-only` collection remain source-only tools. Normal model-generation execution is rejected.

The private backend is an undeployed candidate. An operator would need their own Worker/D1 and Supabase email authentication: configure `DB`, migrations, `SUPABASE_URL`, a public anon key, a 32-byte AES-GCM `KEY_ENCRYPTION_SECRET`, exact `ALLOWED_ORIGIN`, email callbacks and abuse limits before enabling and deploying it. Secrets stay on the backend, outside Pages, Git and browser storage. The shared model allowance branch is removed; old environment switches cannot activate it.

The authentication service must validate tokens; every record is authorized against the verified user ID. Encryption binds keys to user and provider. Private APIs use `private, no-store`; secrets and conversations are not logged, and provider errors are sanitized. Origin-based CORS does not isolate projects on the same github.io origin. Real deployment needs two-account tests for access, deletion, caching, logs, email and model limits. Mocks do not replace these checks. The [technical appendix](private-ai.md) retains exact routes and commands. Remote deployment requires the operator's approved resources and costs.

## Privacy and limitations

Local profiles separate storage keys, not authenticated or password-protected accounts. Others using the same browser can select them; use separate browser profiles on shared devices. Switching or exiting reloads and discards the page session, tokens, packets and replies. Saved local content remains. Clearing the current profile's reading data removes requirements, settings, bookmarks and reading positions without touching other profiles. Legacy guest records remain separate and are not imported automatically.

Manual packets contain the question, selected public evidence and requirements checked for this packet—not bookmarks, private memory, history or credentials. After you submit to an official AI, that provider processes the data. The optional private service requires explicit consent before sending a question, report, saved memory and recent conversation. Its operator can decrypt stored keys; this is not end-to-end encryption. Deleting application data does not delete the authentication account.

Cross-device accounts, automatic subscription integration, automatic personal news research and nearby disaster notifications are unavailable. The emergency page has no live earthquake, weather or traffic feed. Use the meteorological agency and local authorities directly. Future alerts must remain independent of AI, without promises of zero latency or earthquake early warning.

## Sources and rights

Media, images and trademarks belong to their owners. Preserve source credits and third-party terms. NASA material may include third-party rights; restrictions such as CNA's noncommercial conditions still apply. Readable content is not permission to reproduce an entire article. Unauthorized full-text copying and paywall bypassing are excluded. Summaries, translations and AI analysis may be wrong; original links remain available.

## Development

```sh
python3 -m unittest discover -s tests -q
node --test tests/personal-boundaries.cjs backend/tests/private.test.mjs
node tests/service-worker-health.cjs
node --check app.js
```

Backend tests require Node 24 and mock authentication and model networks. `tests/personal-dom.cjs` needs the development dependency `jsdom`. Validation does not consume a model subscription. Real browser scrolling, offline installation and production account separation require their own acceptance checks.

## Updates

2026-10-09: retired public inference; introduced personal requirements, manual official AI handoff, local profiles, bounded presentation JSON and archive offline/error labels. Kept historical data and Pages. Documentation now covers five languages.

2026-10-08: the historical release added four-language evidence labels, source associations, article archives and reading positions. Earlier public generation and allowance instructions are superseded by retirement. The [technical record](release-4.7.md) remains historical.
