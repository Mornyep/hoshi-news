# JMA nearby-event adapter — narrow foundation, not live alerts

Checked 2026-10-09 against JMA's current technical information (XML format Ver.1.3, technical/code updates dated 2026-10-07) and one actual VPWW53 weather-warning telegram (`InfoKindVersion=1.1_2`). This increment supports only **weather special warnings, warnings and advisories** from JMA's public extra Atom feed. It excludes EEW, earthquake, tsunami, volcano, railway and other sources. Unsupported versions fail explicitly; this is not full XSD validation or a complete JMA hazard service.

## Available code

`scripts/jma_events.py` has independent functions:

- `feed_links(bytes)` extracts and deduplicates only fixed official HTTPS VPWW53 data URLs.
- `fetch_public(url)` permits only that feed and those data paths, no redirects/proxy/retries, no compressed payload, a 10-second deadline, and 2 MB feed / 1 MB telegram limits. It is never called by import, tests or a schedule.
- `parse_bulletin(bytes, source_url, fetched_at)` preserves source, official publication and transmission timestamps, actual retrieval time, InfoType/Serial, optional official validity, raw hazard name/code/status and exact region codes. Frozen source objects have no AI override path.
- `ManualRegion('municipality', '4735700')` is a manually supplied **public sample** code for 南大東村, not a saved user preference or device location. `forecast_area` uses its distinct six-digit code system. Matching is exact code plus type, never fuzzy place-name matching or geographic proximity. The browser picker uses the current official JMA area catalogue and validates municipality → class15 → class10 → office ancestry. Region selection stays in page memory, with no storage or geolocation.
- `reduce_bulletin(previous, bulletin, region)` tracks one report series and selected region. A caller must keep different series separate. It uses the official series identity (control title, editorial office, operational status, EventID) and orders revisions by Control/DateTime, never Serial. Hash-identical replays and older reports do not resurrect warnings; same-time different revisions become conflicts.
- `Selection.view(now)` returns serializable raw risks and prior raw risks plus timestamps and explicit state. It always says `live=false` and `safety=unknown`.

A telegram cancellation removes that series' current risks and retains its earlier raw risks as historical evidence. **Cancellation of a telegram is not equivalent to all weather warnings being lifted.** An explicit Kind/Status `解除` remains attached to that one named hazard/region; it never becomes a blanket safety claim. A region absent from a newer report becomes `region_not_in_latest_report`, not safe. Local freshness defaults to 30 minutes from the older of transmission/retrieval times; this is a conservative UI freshness policy, not an official hazard end time. Stale data and elapsed official validity remain historical, never safe. Lack of a matching bulletin or failed transport must be presented as unknown/unavailable; the short rolling feed is not exhaustive.

## Security and tests

UTF-8 only; DTD/entities, external processing instructions and XInclude are rejected, with bounded bytes, nodes and depth. Unknown namespaces, schemas, training/test reports, future timestamps and other telegram paths fail closed. Source free text remains untrusted plain text; a future renderer must use textContent, never HTML or executable instructions. No source text is sent to a model. Raw source risk names/codes/status must remain independently visible if commentary is added later.

12 deterministic tests cover the public fixture, exact regions, correction/replay/conflicting revisions, cancellation without a body, stale/validity/absence/release states, malicious XML/URLs, bounded HTTP reads/deadlines and HTTP/redirect failure. Network is mocked in tests. No new runtime dependency.

## Real fetch and remaining integration

This increment made three bounded public requests: one feed, one sample telegram, then the same telegram once through the implemented fetcher. Both feed and telegram responses to an Origin of `https://mornyep.github.io` returned HTTP 200 and `Access-Control-Allow-Origin: *`. **No CORS-only backend requirement was observed.** The browser implementation in `jma-events.js` is now wired to the page. It uses `https://www.jma.go.jp/bosai/common/const/area.json` and the official `extra_l.xml` longer rolling index to find the selected office's newest VPWW53 telegram. The user must choose an office and municipality and press Fetch / refresh. Opening the page fetches only the public catalogue. A query makes at most one index and two telegram requests (the second only to retain history on a cancellation); there is no automatic polling or model call. Regions appear with official names and codes; English names use JMA's own catalogue values, while risk names/codes/status remain labelled Japanese originals in all four UI languages. No manual region is sent to an unrelated third party. The JMA request path necessarily identifies the publicly selected forecast office.

Requests omit credentials, reject redirects, stop at 10 seconds, and cap bytes at 1 MB catalogue, 4 MB index and 1 MB telegram. In-page cache holds at most eight responses for three minutes; cached records retain their original retrieval timestamp. Refreshes are throttled to 45 seconds within one page session. A page reload clears the cache and selection. Selection changes abort requests and reject late results. Errors never show a live status or infer safety; catalogue failure requires a page reload to retry. The service worker does not intercept or persist JMA responses. Only the exact two official origins were added to CSP. No backend, timer, background push, VAPID or location permission was added. Existing ChatGPT scripts, pairing and runtime remain untouched.

The page displays source links, publication/retrieval time, correction/cancellation state, expiry/conflict/missing/error notices and attribution. It never says the selected region is safe. This remains a limited source snapshot, not a guaranteed current hazard state or emergency alert service. Earthquake and other event types remain out of scope. Browser CORS and production acceptance results are recorded separately under the local evidence directory; command-line fetch success is not browser acceptance.


## Source and reuse

The public fixture in `tests/fixtures/jma/vpww53-20261009.xml` is an unmodified telegram from [JMA, 2026-10-09 10:58 JST](https://www.data.jma.go.jp/developer/xml/data/20261009015806_0_VPWW53_472000.xml); it is historical test data, not current safety advice. Normalized output is **Starnews processing of JMA data**, not a JMA-created Starnews forecast. Attribute the source and processing when rendering it.

JMA's current [content terms](https://www.jma.go.jp/jma/kishou/info/coment.html) reference Public Data Terms of Use 1.0, require attribution and identification of processing, and identify restrictions under the Meteorological Service Act. Its [XML FAQ](https://xml.kishou.go.jp/qanda.html) permits secondary reuse subject to the stated caveats. The [public PULL service](https://xml.kishou.go.jp/xmlpull.html) may be stopped/delayed and does not guarantee rapid/reliable delivery; do not substitute it for emergency alerts. This adapter republishes source facts without producing forecasts or issuing its own warnings.

Current primary technical references: [technical materials](https://xml.kishou.go.jp/tec_material.html), [series/correction/cancellation FAQ](https://xml.kishou.go.jp/qanda.html), [official PULL feed](https://xml.kishou.go.jp/xmlpull.html).
