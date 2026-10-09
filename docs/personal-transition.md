[简体中文](guide.zh-CN.md) · [繁體中文](guide.zh-TW.md) · [English](guide.en.md) · [日本語](guide.ja.md) · [한국어](guide.ko.md)

# Personal news transition — 2026-10-09

The existing Pages site now opens a personal reading setup. Broad category selection and public morning/noon/evening AI editions are retired. Historical reports retain their original dates, source URLs and original-language warnings. No historical item is relabelled as today's personal news.

## Available now

- Write any reading requirements instead of selecting broad categories.
- Create local browser profiles. Settings, bookmarks, reading position and requirements use separate keys. Switching or exiting reloads the page and discards in-memory credentials, prepared packets and pasted answers. Stored profile content remains. Profiles are neither authenticated accounts nor password protection: anyone using this browser can select them. Use separate browser profiles on shared devices.
- Select an official AI homepage, prepare a cited report or a free-text research request, inspect and copy it, then submit it yourself. Saved requirements enter the packet only after a separate checkbox. The site sends nothing automatically and cannot read subscription chats. Provider, declared model, paste timestamp and unverified status accompany imported plain-text answers; answers are not persisted.
- Four interface languages and an explicit requested response language. Source material without a reliable translation remains labelled in its original language. The site cannot verify the language, citations or truth of a pasted AI response.
- Optional AI presentation JSON has only a fixed palette and at most three exact existing title/summary spans. No arbitrary markup or styling. Official warning metadata prevents overrides. Highlights are textual emphasis, never risk labels.

## Public inference retired

`public-ai.yml` runs source unit tests only on code changes: no cron, dispatch, provider credentials, model call, data commit or write permission. The legacy publication wrapper is a no-op; the generator rejects normal inference execution. Explicit RSS-only/dry-run collection remains available. The private backend cannot fall back to any shared model key even if old environment settings remain. No secrets, old publications or Pages settings are deleted. Existing public data files serve history only.

## Not deployed

The existing private Worker/Auth/DB code is a candidate backend, not a running service. Authenticated cross-device records require verified identity, owner authorization, credential encryption, private no-store responses and deployed isolation checks. No account, paid API, database or credentials were created. Local profiles must not be described as account isolation.

Official ChatGPT token sharing for eligible open-source/local apps is an optional future route requiring explicit user permission, client registration, PKCE/state/nonce, protected per-user credentials and preview-compatible Responses settings. See [official token sharing](https://developers.openai.com/siwc/token-sharing-open-source). Current implementation is manual only. Other provider subscriptions require their own official supported integration; an official homepage entry does not establish API entitlement.

Nearby official alerts remain a future dependency card: coarse region selection, direct official information independent of AI, immutable severity text/colors, cancel/update semantics and durable delivery infrastructure. No GPS collection, notification permission, push credentials, background alert feed or real-time guarantee is implemented. The existing emergency page explicitly says it has no live alert connection.

## Validation

Run Python source tests, Node backend isolation tests, `tests/personal-boundaries.cjs`, syntax checks and DOM acceptance. Browser/offline/layout acceptance requires a separately coordinated isolated browser session. Manual official-client answers cannot be end-to-end tested without the user's own explicit action; never consume a subscription automatically for validation.
