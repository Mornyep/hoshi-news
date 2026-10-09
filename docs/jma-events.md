# JMA nearby-event adapter — narrow foundation, not live alerts

Checked 2026-10-09 against JMA's current technical information (XML format Ver.1.3, technical/code updates dated 2026-10-07) and one actual VPWW53 weather-warning telegram (`InfoKindVersion=1.1_2`). This increment supports only **weather special warnings, warnings and advisories** from JMA's public extra Atom feed. It excludes EEW, earthquake, tsunami, volcano, railway and other sources. Unsupported versions fail explicitly; this is not full XSD validation or a complete JMA hazard service.

## Available code

`scripts/jma_events.py` has independent functions:

- `feed_links(bytes)` extracts and deduplicates only fixed official HTTPS VPWW53 data URLs.
- `fetch_public(url)` permits only that feed and those data paths, no redirects/proxy/retries, no compressed payload, a 10-second deadline, and 2 MB feed / 1 MB telegram limits. It is never called by import, tests or a schedule.
- `parse_bulletin(bytes, source_url, fetched_at)` preserves source, official publication and transmission timestamps, actual retrieval time, InfoType/Serial, optional official validity, raw hazard name/code/status and exact region codes. Frozen source objects have no AI override path.
- `ManualRegion('municipality', '4735700')` is a manually supplied **public sample** code for 南大東村, not a saved user preference or device location. `forecast_area` uses its distinct six-digit code system. Matching is exact code plus type, never fuzzy place-name matching or geographic proximity. There is no region picker UI or complete region catalogue yet.
- `reduce_bulletin(previous, bulletin, region)` tracks one report series and selected region. A caller must keep different series separate. It uses the official series identity (control title, editorial office, operational status, EventID) and orders revisions by Control/DateTime, never Serial. Hash-identical replays and older reports do not resurrect warnings; same-time different revisions become conflicts.
- `Selection.view(now)` returns serializable raw risks and prior raw risks plus timestamps and explicit state. It always says `live=false` and `safety=unknown`.

A telegram cancellation removes that series' current risks and retains its earlier raw risks as historical evidence. **Cancellation of a telegram is not equivalent to all weather warnings being lifted.** An explicit Kind/Status `解除` remains attached to that one named hazard/region; it never becomes a blanket safety claim. A region absent from a newer report becomes `region_not_in_latest_report`, not safe. Local freshness defaults to 30 minutes from the older of transmission/retrieval times; this is a conservative UI freshness policy, not an official hazard end time. Stale data and elapsed official validity remain historical, never safe. Lack of a matching bulletin or failed transport must be presented as unknown/unavailable; the short rolling feed is not exhaustive.

## Security and tests

UTF-8 only; DTD/entities, external processing instructions and XInclude are rejected, with bounded bytes, nodes and depth. Unknown namespaces, schemas, training/test reports, future timestamps and other telegram paths fail closed. Source free text remains untrusted plain text; a future renderer must use textContent, never HTML or executable instructions. No source text is sent to a model. Raw source risk names/codes/status must remain independently visible if commentary is added later.

12 deterministic tests cover the public fixture, exact regions, correction/replay/conflicting revisions, cancellation without a body, stale/validity/absence/release states, malicious XML/URLs, bounded HTTP reads/deadlines and HTTP/redirect failure. Network is mocked in tests. No new runtime dependency.

## Real fetch and remaining integration

This increment made three bounded public requests: one feed, one sample telegram, then the same telegram once through the implemented fetcher. Both feed and telegram responses to an Origin of `https://mornyep.github.io` returned HTTP 200 and `Access-Control-Allow-Origin: *`. **No CORS-only backend requirement was observed.** This does not verify the production browser path: the adapter is Python, the current website CSP does not allow JMA, and no JavaScript parser/UI is wired. The smallest next browser integration is a user-triggered equivalent bounded fetch/parser, the exact JMA origin in CSP, an official code catalogue/manual selector, and explicit fetching/error/stale states. Alternatively a separately scoped server adapter could use this Python interface; no backend is enabled or currently required solely because of CORS. Neither path should claim live completeness from a limited feed sample.

No timers, push, VAPID, geolocation, user preference writes or changes to the running ChatGPT component were added. The website currently displays no new nearby-event widget.

## Source and reuse

The public fixture in `tests/fixtures/jma/vpww53-20261009.xml` is an unmodified telegram from [JMA, 2026-10-09 10:58 JST](https://www.data.jma.go.jp/developer/xml/data/20261009015806_0_VPWW53_472000.xml); it is historical test data, not current safety advice. Normalized output is **Starnews processing of JMA data**, not a JMA-created Starnews forecast. Attribute the source and processing when rendering it.

JMA's current [content terms](https://www.jma.go.jp/jma/kishou/info/coment.html) reference Public Data Terms of Use 1.0, require attribution and identification of processing, and identify restrictions under the Meteorological Service Act. Its [XML FAQ](https://xml.kishou.go.jp/qanda.html) permits secondary reuse subject to the stated caveats. The [public PULL service](https://xml.kishou.go.jp/xmlpull.html) may be stopped/delayed and does not guarantee rapid/reliable delivery; do not substitute it for emergency alerts. This adapter republishes source facts without producing forecasts or issuing its own warnings.

Current primary technical references: [technical materials](https://xml.kishou.go.jp/tec_material.html), [series/correction/cancellation FAQ](https://xml.kishou.go.jp/qanda.html), [official PULL feed](https://xml.kishou.go.jp/xmlpull.html).
