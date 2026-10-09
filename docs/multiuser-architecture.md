[简体中文](guide.zh-CN.md) · [繁體中文](guide.zh-TW.md) · [English](guide.en.md) · [日本語](guide.ja.md) · [한국어](guide.ko.md)

# Local profiles and private accounts

The public Pages site serves read-only historical evidence and the personal AI handoff interface. Public model generation is retired. Personal requirements and replies never enter the repository, public archives or source-test workflow.

Local profiles use separate storage keys for requirements, settings, bookmarks and reading position. They have no authentication or password protection. Switching or exiting clears the page session while saved local records remain. Shared devices need separate browser profiles.

The optional Worker/D1/Supabase backend is undeployed. Its candidate code verifies identity and authorizes records by owner, encrypts user keys, rejects shared model fallback and returns private no-store responses. Mock tests do not establish production isolation. Configuration and genuine two-account acceptance remain necessary before enabling a service. Exact routes and deployment details remain in the [technical appendix](private-ai.md).
