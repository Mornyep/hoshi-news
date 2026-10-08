# 星闻 SIGNAL//BREAK · ONE-SCREEN OVERDRIVE

单屏个人新闻情报台，采用游戏式斜切转场与三层新闻阅读视角。针对 iPhone / iPad / 桌面浏览器和 PWA 主屏幕模式设计。

## 操作方式

- 顶部切换**晨报、午报、晚报、突发**。
- 晨报新闻可以左右滑动封面，或使用底部横向目录切换，不必不断向下滚动。
- 在同一屏切换 **发生什么 / 与你有关 / 事实核验**，点击来源可查看原文。
- 需要长文时才打开独立的**阅读档案**，那里可以滚动。
- 收藏、减少动态效果、防剧透和字号设置保存到**当前浏览器的本地存储**，并非云同步。

## 重要的信息边界

- 现有内容是 **2026-10-08 早间五条新闻快照**，不是自动更新的新闻数据库，也不是实时灾害警报。
- 午报、晚报和突发栏目尚未连接自动内容写入。显示为空并不表示世界上没有相关新闻或风险。
- ChatGPT 中的早 / 中 / 晚提醒与紧急检查**没有自动同步到此网站**。
- 任何涉及大学招生、票价、活动服务器时间或官方警报的信息，请再查看所附原始来源。
- 请勿向公开 GitHub Pages 提交账号密钥、私人邮箱、日历数据或个人敏感信息。

## GitHub Pages 发布

此仓库所有网页文件已放在 `main` 分支根目录，无需构建工具。

在 GitHub 打开：
`Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: main → Folder: /(root) → Save`

若 Pages 选项因当前 **Private** 仓库而不可用，检查 GitHub 计划是否支持私有仓库 Pages；若是 Free，一般需要先到 `Settings → General → Danger Zone → Change repository visibility` 更改为 **Public**。这会让源代码及新闻文本公开。改变可见性需要仓库所有者自行确认。

Pages 成功后，在设置中查看 GitHub 提供的站点 URL，预计为 `https://mornyep.github.io/hoshi-news/`；发布前它仅是预期地址，不能视为已上线。

iPhone Safari 打开 HTTPS 网站后：`分享 → 添加到主屏幕 → 作为网页 App 打开`。

## 文件

- `index.html`：自包含的单屏界面（HTML/CSS/JS），内置今日快照供离线回退
- `news.json`：可按日更换的新闻快照
- `manifest.webmanifest`：PWA 独立窗口设置
- `assets/icon.svg`：可缩放矢量图标（Safari 可能使用自动生成的主屏幕图标）
- `sw.js`：静态资源和新闻快照缓存

未来若自动更新新闻数据，请严格核实文章来源、日期、真实性，更新 `news.json` 的 `edition.id`，并同步核查缓存策略。更新 PWA 外壳时，还应递增 `sw.js` 中的 `CACHE_NAME`。

本项目为个人使用的演示原型，不是完整新闻采编系统。
