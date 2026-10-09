# Historical editorial pipeline / 历史资料管线

[Current five-language guides](guide.en.md) — Public generation was retired on 2026-10-09. These are historical implementation notes, not activation instructions.

### Evidence depth and reading positions (2026-10-08)

The main edition now selects acquired, reusable article bodies before substantial
RSS excerpts. An RSS excerpt remains an excerpt: it never implies full-text
access. Thin excerpts appear in a separate original-language brief rail (maximum
four), not as invented long archives. Selection uses acquired text rather than
model-generated length: five paragraphs and 600 characters for article bodies;
140 CJK characters or 280 predominantly Latin characters for substantial excerpts.
A main edition has at most six stories, three per publisher, and one acquired
article per publisher. Insufficient material can produce fewer main stories or
briefs only, without old morning content used as filler.

Conservative same-event associations preserve up to four attributed sources.
Same language/category, close publication times, matching figures and explicit
Latin entities are required; CJK headlines must match after normalization.
This is a duplicate-report association, not independent verification, and does
not establish a persistent event timeline or merge across languages. Each source's
original excerpt, timestamp and link remain separate in the reading archive.

Reading positions are optional local browser data, separated by article URL,
language and reading view. Reopening/reloading and viewport changes restore the
fractional scroll position; changed article content starts at the beginning.
Records contain only URL hashes, content fingerprints, ratios and timestamps,
with a 200-record / 90-day bound. They are not uploaded or account-synchronized.
Temporary mode and local-data reset clear them. Shared browser profiles still
share local data; server-side account isolation does not isolate guest storage.


### 来源补充、分析与重点标记（2026-10-08）

RSS 用于发现报道。NASA news-release 额外通过官方公开 REST 接口取得正文，每次运行最多两次正文请求，严格限制主机、文章身份、响应大小、超时和第三方版权声明；失败保留已取得供稿正文。其他媒体仍以已授权的 RSS 摘录为依据，尚未接入任意网页搜索或全文抓取。

公共 AI 先用四语请求处理主报道与简讯翻译和重点选择，再用最多一次共享请求补充一篇已取得正文报道的四语分析。证据包包含主来源正文/摘录及已归并的最多三个其他来源。补充阅读最多包含背景线索、条件式影响分析、后续观察问题三段，明确标为未独立核验，每段依据来源 ID 和精确文本锚点验证；数字、显式名称、引用、语言和长段复制另做检查。锚点只用于内部验证，公开显示来源链接。这些检查不证明语义正确，也不代表获取了各方立场；没有不同来源时不得编造反方意见，失败省略分析。

标题亮色只来自 AI 选择的当前标题连续片段，禁止固定高亮末行；必须完整保留标题中的声称/疑似等限定词。前后端使用纯文本，标题变化或译文回退后不套用其他语言的重点。AI 未给出可靠重点时不高亮。

旧版无语言元数据的混合标题/摘要不再自动代替当前语言版本。生成任务会一次性将一个旧时段最多六条原始标题转换为四语短简讯（额外最多四次模型请求）；旧 AI 摘要没有保留来源证据，不用于翻译或分析。历史原始记录保留作审计。后续旧版本回填需明确维护，不将旧新闻冒充当期报道。翻译失败仍以整条原语标记回退，不能承诺全部来源都翻译成功。

Groq 公共请求按至少 65 秒间隔发送，减少四语连续请求触发共享限流；仍不保证免费额度可用。模型请求失败时保留该语种已有版次，不以新失败结果覆盖。重新生成同一时段时允许更新本时段报道，仅跨早/午/晚去重。工作流最大运行时间 20 分钟，超过则失败，不后台无限重试。

翻译请求只携带标题与摘要，每条必须返回重点字段（无可靠重点可为 null）；补充阅读请求独立携带一份最多四来源、每来源最多 6000 字符的正文证据，并使用已确定的四语标题选择重点。常规最多五次模型调用，历史回填首轮最多另加四次。源语言提取正文仍单独标记并折叠展示，不冒充已完成四语长篇改写。

公共四语流程默认使用 Groq GPT-OSS 120B，仍可通过 GROQ_MODEL 环境变量选择模型；私人 AI 配置不受影响。不启用订阅或改变账单设置，实际账号额度由供应商决定。正文来源指纹与来源 URL 完全一致时，保留此前通过检查的补充阅读；来源有变更则不复用，普通短 RSS 不套用此缓存。

译文可附“原文名称/原文表記”索引，名称直接从原始标题提取，不由模型创造；数字、引语和新增名称检查仍保留。已有正文指纹绑定的整理稿标题作为 display_title 提供给 AI，重点直接从实际显示标题选择，避免按源文标题选出的重点与站内整理标题不匹配。
