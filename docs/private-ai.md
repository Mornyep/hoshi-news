[简体中文](guide.zh-CN.md) · [繁體中文](guide.zh-TW.md) · [English](guide.en.md) · [日本語](guide.ja.md) · [한국어](guide.ko.md)

> 2026-10-09：公共 AI 已停用，共享额度分支已删除。以下为未部署的私人服务说明；本站当前提供手动官方 AI 和本机 profile。参见 [迁移边界](personal-transition.md)。

# 私人 AI 后端：部署与隐私

本仓库提供可部署的 Cloudflare Worker + D1 后端候选，Supabase Auth 负责账号认证。GitHub Pages 只发布静态新闻与前端。当前 `backend/wrangler.toml` 保持 `ENABLED=false`，没有创建远端数据库、账号或密钥，没有上线后端，没有实际调用付费模型。普通新闻阅读不依赖此服务。

## 架构与信任边界

- 浏览器登录 Supabase 后，携带 `Authorization: Bearer <access_token>` 调用 Worker。Worker 每次调用 Supabase `/auth/v1/user` 验证 token，要求已验证邮箱并拒绝匿名用户；不信任本地解析 token 得到的用户信息。
- 所有 D1 查询使用验证后的用户 ID。请求中的 `userId`、`user_id`、`owner`、`subject` 和 query 参数一律拒绝。没有管理员跨用户查询 API。
- BYOK 只允许一次写入/删除，不提供原始读取接口。服务端用 32 字节 AES-GCM 密钥加密，随机 12 字节 nonce，将用户 ID + 提供商绑定为认证数据。数据库密文被复制到另一用户也无法解密。
- `KEY_ENCRYPTION_SECRET` 必须保存在 Worker secrets，绝不能放入 Pages、Git、前端 localStorage 或响应。用户输入自己的 key 时浏览器必然短暂持有该 key，前端应立即清空输入，不持久保存。本站不是端到端加密：受授权的服务器运营者具有解密能力。
- Groq / Gemini / OpenRouter / OpenAI 是固定 HTTPS 端点与固定模型。拒绝任意端点、任意模型和 redirect；不抓取客户端 URL，不提供工具执行，防止 SSRF 与高价模型滥用。输入源 URL 仅作为模型引用材料。
- 源文、用户显式记忆和问题均属不可信材料。用户记忆放在 user message，不放进 system 指令。模型无数据库、身份切换、外部请求或密钥访问工具。提示词限制不能保证模型事实正确；回答必须供用户核查。
- 不透传提供商错误、响应 headers 或调试 payload；返回固定错误码。成功回复额外清除当前 key 的字面值和 URL 编码值。服务端代码不打印认证、密钥、问答或个人记忆日志。
- 所有响应包括错误都使用 `Cache-Control: private, no-store`。CORS 仅允许一个精确 Origin（GitHub Pages 的 Origin 是 `https://mornyep.github.io`，不包含 `/hoshi-news/`）。CORS 不能隔离同一 github.io Origin 下的其他路径；不要在同域其他项目运行不可信脚本。

## 一次性配置（需运营者提供自己的服务）

1. 在自己的 Cloudflare 账号创建 D1，填入 `wrangler.toml` 的 `[[d1_databases]]`，binding 必须是 `DB`。不要提交真实秘密或 `.dev.vars`。
2. 在自己的 Supabase 项目启用邮件登录、邮箱验证；关闭匿名登录。配置站点 URL 为实际星闻页面；邮件回调带随机 `login_state` query，redirect allowlist 只允许该站点的准确路径及该回调 query。不得允许任意外部站点。客户端校验一次性登录状态、有效期与已验证邮箱，拒绝从任意共享 URL 自动登录。公开注册应启用 Supabase 的 CAPTCHA/邮件速率限制，并在 Cloudflare 入口配置滥用限制；本代码不创建这些外部配置。
3. 设置 Worker 的 `SUPABASE_URL=https://PROJECT.supabase.co` 和公开的 `SUPABASE_ANON_KEY`（anon/publishable key，绝不是 service-role secret）。`ALLOWED_ORIGIN` 必须与静态站 Origin 完全一致。当前仅允许标准 Supabase 项目域名，定制域名需明确修改服务器校验。
4. 用密码学安全随机数生成 32 字节并以 base64 保存为 `KEY_ENCRYPTION_SECRET`，通过 `wrangler secret put KEY_ENCRYPTION_SECRET` 交互录入。不要把值打印进共享日志或命令历史。更换该 secret 将使旧 BYOK 无法解密；此版本无轮换迁移工具，更换后应让用户删除并重新录入 BYOK。
5. 在 `backend/` 安装开发依赖后先执行 `npm test`，再按自己的绑定运行 `npx wrangler d1 migrations apply hoshi-private-ai --remote`。这是远端写入，需由已获授权的运营者执行。
6. 公共额度配置不再生效。确认配置、数据库与认证后设置 `ENABLED=true`，执行 `npx wrangler deploy`。这些命令是待执行步骤，不代表本次已部署。
7. 将部署后的 HTTPS Worker URL 配置到静态前端的个人 AI 设置。前端 CSP 必须放行实际后端和认证域：当前集成使用 `*.workers.dev`、`*.supabase.co`。定制域名必须显式加入 CSP `connect-src`，不能放宽为任意来源。
8. 在真实部署做 A/B 两个邮箱账号交叉测试：A 的偏好、记忆、历史、BYOK 状态和删除不能影响 B；检查 Worker 日志不含正文或密钥；确认未登录依然可以阅读全部新闻。完成这些才可称为线上多用户验证。

仓库不包含 Supabase service-role key，`DELETE /account` 只删除星闻应用数据，**不会删除 Supabase 登录账号**。需彻底注销认证账号时由用户联系运营者，运营者通过 Supabase 管理面板执行。不要给静态前端任何账号管理权限。

## HTTP 合同

除 `/health` 和 CORS OPTIONS 外所有 API 都需要已验证 bearer。JSON 请求体最大 24 KB；key 写入最大 4 KB。未知字段拒绝。日期以服务端 UTC 计算。

| Route | 请求 / 结果 |
| --- | --- |
| `GET /health` | 未配置 `{enabled:false}`；配置后含 `auth:{url,anonKey}`, `providers`, `models`, `publicPool`，不含秘密 |
| `GET /preferences` | `{preferences:{language,topics,memory},keys:[provider]}`；keys 只是名称 |
| `PUT /preferences` | 完整 `{language,topics,memory}`；语言 `zh-CN/zh-TW/ja/en`，最多20个主题，每个60字符，显式记忆2000字符 |
| `PUT /keys/:provider` | `{key}`，10–512字符，无空白；只回 `{ok:true}` |
| `DELETE /keys/:provider` | 删除本人该提供商密文 |
| `POST /chat` | `{provider,message,language?,model?,article?:{title,url,summary}}`；model 只能是服务端固定默认值；message4000字符、summary6000字符；回复 `{answer,provider,model}` |
| `GET /history` | 本人最近100条 `{history:[{id,role,content,createdAt}]}`；createdAt 为毫秒 |
| `DELETE /history` | 清空本人问答记录 |
| `POST /recommendations` | `{articles:[{id,title,summary?,category?,is_headline?}],language?}`，最多100条；返回 `{ids,method:'saved_topic_match'}` |
| `DELETE /account` | 删除本人 preferences、keys、history；`{ok:true,scope:'application_data',authAccountDeleted:false}` |

推荐使用已保存主题 ID 对新闻 category 精确匹配，兼顾标题文本匹配，重要新闻保留优先位置。这是可解释的偏好排序，不声称已实现模型推荐或浏览行为画像。用户未填写记忆时为空；系统不偷偷生成或跨用户共享长期记忆。

错误统一 `{error:code}`：401 登录/邮箱验证，403 Origin，409 需录入 key，413 输入过大，429 限流/并发/提供商限额，502 提供商失败，503 未配置/服务不可用。不自动切换提供商或把私人数据发送给另一个服务。API 返回内容只能以纯文本或经严格消毒的 Markdown 展示。

## 额度与降级

- 所有已登录 API：每用户每自然分钟30次（包含失败路由），D1 单语句条件 UPSERT 原子计数。
- 同一用户最多1个正在处理的请求，D1 租约60秒；提供商网络超时20秒、认证超时5秒。重复聊天或正在聊天时删除返回429，待前一次结束重试。
- BYOK 每用户每天30次。公共池已停用，即使保留旧环境配置也不会回退使用。失败请求也消耗已预留额度，避免重试风暴。
- 每次回复最多1200输出 token，使用最近6条历史。聊天历史每人最多100条。删除应用数据不重置当天额度；UTC 次日自然重置。
- 提供商返回429或限额用尽时明确报错；静态新闻仍可读，不自动付费、不购买额度、不悄悄切换服务。
- 这些是请求上限，不是货币预算。BYOK、OpenAI 与这里默认的 OpenRouter `openai/gpt-4o-mini` 可能收费；只有用户自己的账户/套餐能够决定价格。公共池应使用独立项目 key，在提供商控制台配置硬额度/不启用自动充值。不要仅靠站内限制承诺免费。
- Cloudflare Worker、D1、Supabase 和模型免费层都有独立限制，额度和模型可用性会变化。D1 免费额度耗尽会失败；服务应保持关闭或返回明确不可用，不能保证全天候免费运行。

## 用户隐私说明（上线前需填写运营者联系方式）

保存内容：Supabase 保存邮箱和认证记录；Cloudflare D1 保存用户 ID、用户主动设置的语言/主题/记忆、加密 BYOK、问答历史和限流计数。偏好、记忆与历史在 D1 并非应用层加密，权限由 Worker 和 Cloudflare 账户控制。

数据发送：用户按下提问时，将本次问题、所选新闻标题/链接/摘要、用户主动填写的主题/记忆和最近6条本人历史发送给所选 AI 提供商。不会将其发送给其他用户。不自动上传浏览器全部阅读历史。不带 key 的 GET 响应只列已配置提供商名称。

保留/删除：问答最多100条，超过30天的记录由每小时定时任务删除；偏好、显式记忆和 BYOK 保留至用户修改/删除。删除应用数据立即删除在线 D1 记录；用于反滥用的用户 ID 关联额度最多保留约3天（每日清理阈值2天，加自然日边界），分钟额度约1小时内清理。Supabase、Cloudflare 备份和各模型供应商日志受各自保留政策约束，不能承诺即时物理擦除。可通过 preferences/history API 导出自己的数据，不可导出原始 BYOK。

用户控制：可单独删除 BYOK、清空历史、修改或清空显式记忆、删除所有星闻应用数据。删除登录账号需运营者在 Supabase 操作。上线前必须在站内提供有效联系渠道、声明所用提供商及政策链接；本仓库没有替运营者创建联系身份。

免费模型尤其应查看数据使用条款：Gemini 免费层定价页面标注内容可用于改进产品，敏感个人材料不应在不了解这些条款时发送。任何模型输出都可能有事实错误。

## 已运行检查与待验收

`node --test backend/tests/private.test.mjs` 使用 Node 24 自带 SQLite 执行真实迁移和 SQL，D1 适配层模拟 API；Auth 和模型网络是 mock。覆盖跨用户读写删除、推荐、密文 AAD、伪造身份、错误脱敏、固定端点、并发、每日窗口、公共池停用、请求大小、无缓存、未配置默认关闭与保留清理。

没有做真实 Cloudflare/D1 部署、Supabase 邮件登录、真实 provider key、实际模型账单、生产流量/地理数据位置或跨浏览器验证。部署后还需验证 D1 远端事务/限流、邮件投递、CSP、真实账户隔离、提供商当前模型可用性与取消/超时。离线通过不代表生产安全审计完成。

## 官方依据（2026-10-08 查阅）

- Supabase [getUser](https://supabase.com/docs/reference/javascript/auth-getuser)：向 Auth 服务请求验证后的身份，不能把客户端 session 内容作为服务端授权依据。
- Cloudflare [D1 FAQ](https://developers.cloudflare.com/d1/reference/faq/)：免费层有每日和存储限额，耗尽后请求可能失败。
- Groq [Rate limits](https://console.groq.com/docs/rate-limits)、[Text generation](https://console.groq.com/docs/text-chat)：免费层配额依模型/账号而异，使用固定 chat 接口。
- Gemini [Pricing](https://ai.google.dev/gemini-api/docs/pricing)、[Generate content](https://ai.google.dev/api/generate-content)：免费/付费条款与模型可用性以账号及当前页面为准。
- OpenRouter [Chat API](https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request)：固定 endpoint；本候选默认模型不承诺免费。
- OpenAI [Chat API](https://platform.openai.com/docs/api-reference/chat/create)：标准 chat completion 接口，实际调用按账户定价。
