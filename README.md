# 星闻 / BREAK · 4.7

公开、移动端优先的新闻阅读器。保留原有 lime 漫画式视觉，提供简体中文、繁體中文、日本語、English 界面与按语言优先的公共新闻。默认浏览器语言，设置可持久化。

网站由 GitHub Pages 发布：`main` → `/(root)`，无需前端构建。公共数据使用 `news.json`、`ai-briefs.json`，长篇档案独立存放在 `archive-stories.json`，离线快照使用 `seed.js`；私人 AI 必须另部署后端。

## 已实现的代码

- 四语 UI、时段/类别/搜索/主题与设置语言，来源语言优先新闻池，跨语言译文与明确原语回退。
- 档案单滚动区、缩小标题、深色遮罩、手机/电脑布局、来源与证据范围说明。
- 来源约束的摘要/翻译管线和 NASA 四语原创长篇示例；RSS 数据不足时明确缺失，不能冒充长篇全文核验。
- Cloudflare Worker + D1 + Supabase Auth 的用户独立服务，私人偏好、显式记忆、历史、推荐、AI 分析与加密 BYOK；默认未启用。页面已接入连接/登录/提交密钥/提问/导出/删除流程。

完整边界见 [4.7 实施记录](docs/release-4.7.md)，后端配置与隐私见 [私人 AI 部署说明](docs/private-ai.md)。本仓库包含可部署代码不等于后端已经运行。

## 公共新闻更新

`.github/workflows/public-ai.yml` 每天日本时间约 08:13、12:13、19:13 运行（GitHub 定时任务可能延迟）。按公开来源语言选择每版最多六条，每语种最多一次模型请求，总计最多四次；失败显式回退，不隐藏来源缺口。

模型 Key 仅放仓库 Actions Secret：`GROQ_API_KEY`、`GEMINI_API_KEY` 或 `OPENROUTER_API_KEY`。默认自动选择有 Secret 的供应商。免费额度会变化，供应商可拒绝请求；不要承诺永久免费或无限量。ChatGPT 订阅不能直接给站点提供 API。

```sh
python3 -m unittest discover -s tests -v
python3 scripts/public_ai.py --dry-run   # 只抓 RSS，不调用模型、不写数据
python3 scripts/public_ai.py --rss-only  # 明确发布原语 RSS，有翻译回退标记
node --check app.js
node --test backend/tests/*.test.mjs     # Node >=22，含 node:sqlite
```

默认执行生成脚本时如果没有 Secret，保留旧快照；不假装 AI 已启用。源码更新触发后台时，会依仓库已有 Secret 使用其额度。

浏览器测试需要 Playwright 与 Chrome，本地启动静态服务后运行：

```sh
python3 -m http.server 8877 --bind 127.0.0.1
node tests/browser-archive.cjs http://127.0.0.1:8877
node tests/browser-locales.cjs http://127.0.0.1:8877
node tests/browser-private.cjs http://127.0.0.1:8877
node tests/browser-startup.cjs http://127.0.0.1:8877
node tests/browser-scroll.cjs http://127.0.0.1:8877
node tests/browser-interactions.cjs http://127.0.0.1:8877
node tests/browser-editions.cjs http://127.0.0.1:8877 --fixture
```

## 隐私和版权

公共新闻和公共 AI 是共享内容。访客兴趣、收藏、主题和语言仅存本机；同设备同浏览器不构成独立账户，公用设备请用临时模式。可选私人服务按验证身份隔离；未登录也可正常查看公开新闻。

不未经许可转载或近似复刻 NHK 全文，不绕过付费墙。RSS 档案标明只获得标题/简讯，缺资料不编造。始终保留显著原文链接。CNA 等源另有非商业使用条件，商业化前须复核授权。完整源文合法可读不等于可公开全文复制。

- [公开站点](https://mornyep.github.io/hoshi-news/)
- [Groq 限额](https://console.groq.com/docs/rate-limits)
- [Supabase 邮箱登录](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [Cloudflare Workers 价格](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare D1 价格](https://developers.cloudflare.com/d1/platform/pricing/)
