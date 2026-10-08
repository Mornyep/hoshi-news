# 星闻 SIGNAL//BREAK · AI CORE 4.4 (PUBLIC BETA)

这是一个公开的、移动端优先的游戏式新闻阅读器，支持轻下滑阅读和每位访客自己的**本地**兴趣、收藏、主题设置。

## 已部署到代码层的 AI 能力

**公共 AI 引擎**：`.github/workflows/public-ai.yml` 在日本时间约 08:13、12:13、19:13（GitHub 定时任务可能延迟）启动 `scripts/public_ai.py`，从固定的发布者 RSS 源提取近期新闻标题、发表时间和摘要，调用 Groq 免费 API（也支持通过 Secret 改用 Gemini / OpenRouter），生成带对应原始来源链接的 `ai-briefs.json`，全站共享。RSS 及模型生成结果均属*需要进一步核实的信息*；不能称为已经全文核验的新闻。

**目前的实际状态（2026-10-08）**：公共 AI 引擎已成功调用 Groq 的 `openai/gpt-oss-20b`，生成首份午间简报（4 条），并由 `github-actions[bot]` 写入公开的 `ai-briefs.json`。后续三时段定时生成仍须观察实际运行情况；当某时段没有成功生成时，网站会明确显示“AI 简报尚未生成”，不会把旧新闻冒充新内容。早间旧新闻仍是 `news.json` 中 2026-10-08 的人工核查快照。`ai-briefs.json` 与旧快照分开，AI 内容统一标记为 RSS 摘要。

### 只需一次设置，即可启动免费公共 AI

1. 去 [Groq 控制台](https://console.groq.com/keys) 注册账号，获取 API Key，确认账户当前免费额度。根据 Groq 官方限额说明，免费计划的 `openai/gpt-oss-20b` 模型基础限额约为 30 RPM、1000 RPD，仍受 Token 限制约束，且未来可能调整。
2. 打开仓库 `Settings → Secrets and variables → Actions → New repository secret`，名称填 **`GROQ_API_KEY`**，内容粘贴密钥。**绝对不要把密钥提交到公开代码、issue、网页或聊天记录。**
3. 打开 `Actions → Starnews Public AI → Run workflow` 手动运行一次（如果 Actions 没开放，需要先启用仓库 Actions）。
4. 如果执行日志提示工作流没有权限推送数据，去 `Settings → Actions → General → Workflow permissions` 允许 **Read and write permissions**；工作流本身已声明 `contents: write`。
5. 运行成功后检查 `ai-briefs.json` 是否有当前日期的早/中/晚数据，网站点击右上角 **✳ AI CORE** 即可看到公共简报。定时工作流不保证准点：GitHub 在高负载时会延迟。

无需任何 JS API Key，不需要用户注册；公共 AI 运行由仓库密钥管理。**你个人的 ChatGPT Pro 订阅不会被网站直接调用。**

也可将 Secret 设置为 `GEMINI_API_KEY`（默认为 `gemini-2.5-flash-lite`）或 `OPENROUTER_API_KEY`（默认为免费模型路由），使用 `AI_PROVIDER` 环境变量切换供应商。默认优先 Groq → Gemini → OpenRouter。某些免费服务可能将公开输入用于产品改进，本项目只发送公开 RSS 内容，绝不发送私人访客信息。可在工作流修改 `AI_PROVIDER` 选择使用哪家。

### 数据可靠性边界

- 仅采集固定的 RSS 发布者，使用发布日期判断新旧；只接受预定域名的 HTTPS 来源链接，禁止重定向到不可信域名、`http:` 链接和来源跨域。
- AI 只接受标题与有限摘要，不能声称阅读全文、经过采访或交叉验证。对争议或突发事件不触发紧急通知；普通 RSS 摘录不能替代日本气象厅防灾信息。
- 模型生成的字段必须严格通过格式、长度与源 ID 校验，最终的来源名称、URL、原始标题和时间只能来自 RSS 解析器；失败时停止生成，不会覆盖之前的公开新闻。
- 后台仅提交一个公开 `ai-briefs.json` 文件，最多保留 9 个近期时段；前端只显示**日本当天**的 AI 时段内容，过期简报不会冒充实时更新。
- API 调用次数仅随每日公共更新次数增长，不随网站访问人数增长。

## 所有人的数据各自分开

- 公开 `news.json`、`ai-briefs.json` 所有人只读共享。
- 偏好、收藏、主题、本地阅读模式保存在当前浏览器的 `localStorage["starnews:guest:v4.3"]`；**不会提交到 GitHub，也不会用于 AI 请求**。
- 同一浏览器资料可能被同设备的人看到；公用设备请使用临时访客模式。此版本**没有账号注册、真正的跨设备同步或在线私人 AI 聊天**。
- 如果未来做云端用户账户，必须在服务端进行认证、行级授权和跨用户越权测试，详见 [安全设计](docs/multiuser-architecture.md)。禁止把任何个人凭证放进公开仓库。

## 部署、测试

这是一个无需构建工具的 GitHub Pages 静态站。仓库 `main` → `/(root)` 发布。浏览器读取 `seed.js` 作为离线人工快照、`news.json` 作为公共新闻更新、`ai-briefs.json` 作为公共 AI 结果。本机 PWA 的 Service Worker 仅缓存声明过的公开资源。

本地单元测试（无真实 API 消耗）：

```bash
python -m unittest discover -s tests -v
python scripts/public_ai.py
node --check app.js
```

没有 API Secret 时第二条命令会明确说明未启动并原样退出，不会修改已发布数据。

## 链接

- [公开站点](https://mornyep.github.io/hoshi-news/)
- [Groq API 限额](https://console.groq.com/docs/rate-limits)
- [Cloudflare Workers AI 免费额度](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Google Gemini 免费计划](https://ai.google.dev/gemini-api/docs/pricing)
- [OpenRouter 免费计划](https://openrouter.ai/pricing)
