# Starnews local official connection

The first automatic connection is ChatGPT on the same desktop computer through OpenAI's official SIWC flow. It is prepared for user sign-in, not already authenticated. The existing GitHub Pages site remains the public interface. No cloud identity backend is enabled.

Open Personal AI, choose ChatGPT, and use Continue with ChatGPT. The page checks the fixed loopback component, opens its local consent page, then OpenAI's official login. Complete login and consent yourself. A returned ID token is signature-verified against official JWKS with issuer, audience, expiry and nonce checks; returning identities must match the selected registration. Callback credentials remain in memory for at most 60 seconds until the original browser profile and tab complete pairing; an abandoned callback creates no persistent account record. Tokens stay in a dedicated owner-only directory, in atomically written 0600 files. Existing Codex credentials are never copied or read.

The component listens only on `127.0.0.1:45457`. It rejects foreign Origin and Host, uses one-time pairing bound to local profile and browser tab, and keeps only capability hashes for restart restoration. The browser stores a scoped pairing capability in sessionStorage, never OAuth tokens. Response generations prevent late results crossing profiles, languages or providers. It has no command, file-access or arbitrary-URL endpoint. Model requests contain bounded supplied evidence, no tools, `store:false`, `stream:true`, and a 700-token output cap. This initial installation permits one user-triggered inference total; failures consume that attempt and are not retried automatically. No subscription is purchased and no API-key paid fallback is enabled.

The desktop loopback address is unreachable from a phone. The browser may require Local Network Access permission; do not disable browser security. Browser transport, real sign-in and real inference await the user's test. Installation/readiness and fixture tests are separate from account connection success. Manual handoff is a collapsed fallback.

Use Disconnect to remove this profile's dedicated local credential record and request official session revocation. If the official service is unreachable, local tokens are still removed and remote revocation is reported as unconfirmed; disconnect the app in ChatGPT settings. Exiting a browser profile clears its page session and pairing capability; dedicated local authorization records remain until Disconnect. Deleting a browser profile removes that browser namespace; if it is currently paired and the component is reachable, it also removes the matching component credentials. For an unpaired browser session, separately disconnect its component authorization before deleting the browser profile. Deleting a profile never deletes the official ChatGPT account or its registered client.

Start the dedicated installation with:

```sh
STARNEWS_STATE_DIR=/path/to/dedicated-runtime/state node /path/to/dedicated-runtime/app/server.mjs
```

Stop the foreground component with Ctrl+C. No login window or model request is opened on startup. No system startup daemon was installed. State is outside the repository and excluded from source control. Directory permissions are 0700; account records, pairing hashes, host ID and initial test budget files are 0600. Different people sharing a computer should use separate OS/browser profiles and authorize their own accounts; a local browser profile is not a password-protected identity.

Other-provider code in `bridge/adapters.mjs` contains disabled, no-credential contracts. Claude uses only an unmodified official native client route candidate, never a third-party Claude.ai OAuth token export. Grok uses the official native ACP route candidate; all filesystem/terminal/permission requests must be denied before enabling a runtime. Neither candidate is installed or authenticated by this change. Mainland providers use standard API guidance with separate key, region and billing consent; no Coding Plan or consumer-subscription token is substituted. DeepSeek/Qwen fixed-endpoint request contracts are mocked only. Yuanbao stays an official-client handoff. No other provider is advertised as connected.

Other-provider implementation checked 2026-10-09:

| Provider | Code available | Current blocker / next authorization |
| --- | --- | --- |
| Claude | Fixed unmodified native CLI contract, tools disabled, empty MCP configuration; mock only | `claude` was not found on the current PATH, so no version/help or authentication was inspected. Authorize a specific official CLI installation and native invocation first, then personally sign in through Anthropic. No third-party Claude subscription token handling. |
| Grok | ACP initialize/authenticate/prompt contract and capability denial mocks | `grok` was not found on the current PATH. Authorize a specific official CLI installation/native invocation, then native login and verify real filesystem/terminal denial before activation. |
| DeepSeek | Executable standard Chat Completions response adapter with injected host transport; fixed endpoint, one request, bounded output, cancellation, timeout, 401/403/429 and incomplete-response states | Not wired into the running bridge or website. Before adding a real transport, authorize this provider's standard API billing, chosen model/request budget, and a dedicated local API-key input/storage/deletion design. No key was requested or saved. |
| Qwen | Same standard adapter and contract, requiring explicit Beijing/Singapore region | Same separate standard API authorization plus matching key region; no Coding Plan endpoints. |
| Doubao / Kimi / Zhipu | Official API guides only | No executable adapter yet; provider-specific standard API authorization and schema validation required. |
| Yuanbao | Official webpage/manual handoff only in Starnews | No supported native/API adapter implemented or inferred from consumer login. |

`bridge/standard-api.mjs` has no fetch, credential field or storage dependency. Its injected transport is currently exercised only by synthetic mocks. It rejects arbitrary endpoints and credential fields, accepts only a complete single assistant text answer, labels facts unverified, and never retries. A mock approval is not a real account connection. Existing ChatGPT routes, pairing state and the running component are untouched by this increment.

Primary references checked 2026-10-09:
- [SIWC registration](https://developers.openai.com/siwc/token-sharing-open-source/sign-in)
- [Account-specific model catalog and inference](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference)
- [Sessions and revocation](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions)
- [Claude credential boundaries](https://code.claude.com/docs/en/legal-and-compliance)
- [Grok native ACP](https://docs.x.ai/build/cli/headless-scripting)
- [DeepSeek standard API](https://api-docs.deepseek.com/)
- [Qwen regional API keys](https://help.aliyun.com/en/model-studio/get-api-key)

## Local approval troubleshooting (2026-10-09)

A real Chrome native-form test reproduced the earlier `/approve` rejection before any official authorization: `Referrer-Policy: no-referrer` on the local consent document caused `Origin: null` on its form POST, while the server required the exact loopback Origin. Only the consent document now uses `same-origin`. Its same-origin POST retains the correct Origin; the subsequent authorization redirect and all other responses still use `no-referrer`. Host/loopback checks, exact Origin and one-time expiring CSRF remain mandatory; null, missing and foreign Origins are rejected. No permissive fallback was added.

A GET/reload of `/approve` cannot start authorization. `approval_method_rejected`, `approval_origin_rejected` and `approval_expired` distinguish local failures without returning tokens or request parameters. After a component restart or five-minute consent expiry, return to Starnews → Personal AI → Continue with ChatGPT to obtain a fresh local consent page; do not resubmit an old `/approve` page. Native-form tests use an isolated mocked begin handler and never request official authorization. Actual OpenAI account authentication and a real model call still require the user to complete them. Local Network Access permission remains separate from this local form bug.
