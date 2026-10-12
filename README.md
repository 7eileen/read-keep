# 拾词 · Read & Keep

雅思阅读生词日志的可交互 Demo。用电脑导入阅读文章，在手机布局下选词、记录和翻阅。

## 公开站点

[Netlify 正式站点](https://enchanting-faun-41350f.netlify.app/) · [GitHub 仓库](https://github.com/7eileen/read-keep) · [部署说明](docs/DEPLOYMENT.md) · [Supabase 配置与验证](docs/SUPABASE-SETUP.md)。

原生 HTML、CSS、JavaScript 界面，Supabase 提供邮箱账号与按用户隔离的云端数据。访客仍可直接体验；登录后保存文章、生词、译文、笔记、收藏和回顾进度。同一账号在另一设备登录即可读取已同步记录。

GitHub main → Netlify 自动运行 `npm test && npm run build` → 通过后发布 `dist`。构建使用固定版本的官方 Supabase SDK，并注入两项公开配置。测试或构建失败时保留旧的线上版本。

公众邮箱注册和找回密码仍需管理员配置自定义 SMTP；请参照配置文档。没有配置邮件服务不影响已确认账号的密码登录及数据同步。

## 体验

- 今天：阅读概览、最近生词、文章入口。
- 文章选词：导入文字版 PDF、TXT 或粘贴全文；点选单词，或依次点短语的首尾两词；立即收录到今日记录。
- 自动翻译：MyMemory 在线翻译所选词语和原句。FreeDictionaryAPI 补充词性、常见词形和词典例句；支持关闭、失败重试、编辑释义，手动修改不会被晚到的翻译覆盖。
- 点选切换：点一次收录并高亮，再点同一处取消收录、移出生词本。选中的短语可点其中一个词取消；其他位置的同词记录保留。取消会停止该条翻译，晚到的结果不会恢复记录。
- 阅读语境：保留文章来源、段落和 PDF 页码，支持从词条返回原文，已选词高亮，同一位置避免重复收录。
- 文章管理：在“我的阅读文章”卡片上改名或删除；改名同步关联词条的来源。删除文章会保留已收录的词语、原句、释义、笔记和回顾进度，词条详情标识原文章已删除。
- 正文编辑：阅读页点击“编辑文章”，可改标题和正文，回车换行、空行分段，保存后继续选词。已有词条保留收录时的原句与释义；匹配明确的词语更新高亮位置，原句被修改、删除或匹配不唯一时标识位置已变化。PDF 段落重新编辑后，仅能匹配原段落的页码会保留。
- 生词本：关键词搜索、文章筛选、按日期或文章分组、收藏、查看和编辑。
- 批量删除：进入“批量管理”后勾选多条记录，或全选当前搜索/筛选结果；确认词条清单后统一删除。切换筛选会取消隐藏条目的选择，删除会同步更新回顾与文章选词高亮，保留原文章和未选中的其他记录。确认删除后无法撤销。
- 记录：批量输入，或粘贴英文原句后点选生词；支持短语。
- 回顾：原句阅读、明天再看、按设置间隔回顾、减少出现、撤销上一次操作。
- 保存：访客仅在浏览器保存；登录后先写入该账号的本机队列，再同步 Supabase。同步失败会显示待处理状态；同一记录跨设备同时修改时由用户选择版本。支持导出 JSON 备份。
- 迁移：我的账号 → 迁移此浏览器的访客记录。不会把访客记录自动上传给刚登录的账号；非演示记录按 ID 去重，冲突时停止迁移。

## 本地运行与测试

需要 Node.js 22+、pnpm 11.25.0 和任一静态 HTTP 服务器。

```sh
git clone https://github.com/7eileen/read-keep.git
cd read-keep
pnpm install --frozen-lockfile
# 将 .env.example 复制为 .env，填写 Supabase URL 和 publishable key
pnpm test
pnpm build
python -m http.server 4180 --directory dist
```

访问 http://127.0.0.1:4180/ 。不配置 Supabase 时本地构建支持访客模式；Netlify 构建会拒绝缺少云端配置的部署。PDF 模块需要 HTTP/HTTPS 服务。

测试覆盖原有七组业务逻辑，以及同步合并、迁移、版本冲突、账号缓存隔离、离线队列、保存失败回滚和保存期间继续编辑。`node tests/live-supabase.cjs` 是单独运行的真实数据库集成测试，需要两个专用测试账号；**会删除这两个测试账号的学习数据**，不得填真实用户账号。详细运行方法见配置文档。常规 CI 不需要也不保存用户密码。

## 范围说明

本版本使用自拟示例语料，不是真实雅思试题。访客与已登录账号的数据空间分开；已同步内容在 Supabase，未同步内容仍依赖本机缓存。尚未接入专门的 AI 语境释义或系统通知。导出包含词条和文章，本版尚无导入恢复界面。

PDF 在本地提取为文字阅读视图，不保留原版排版；最多 10 MB、40 页、60,000 字符。不支持扫描版 OCR。复杂分栏可能需要手动修正文段。PDF.js 6.4.299 随 dist/vendor 打包，协议文件同时保留。

词典查询向 FreeDictionaryAPI 发送所选词语。翻译向 MyMemory 发送词语、所在原句、选中的词典释义及第一条例句，不上传整篇文章。词典参考义项按原句与释义的词汇重合排序；有匹配时翻译该定义，否则翻译词语。这是简单的参考义项排序，不是专用语境 AI，不能保证词性、义项及机器译文准确。可查看英文定义或编辑中文释义。词形来自词典，过滤古旧、方言及非标准形式；能够识别的屈折形式会查询原形，例如 went → go。无资料时明确提示，不生成猜测词形；原文始终保留作例句。服务可能限额、超时或不可用，失败时记录仍保留，支持重试。过长原句会截取选词附近片段翻译并标识节选。

词典资料来自 [FreeDictionaryAPI](https://freedictionaryapi.com/)，其原始数据来自 [Wiktionary](https://en.wiktionary.org/)，按 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) 提供。界面为每个查询结果提供原词条链接；保存的词典数据经过筛选、排序和中文标签整理，派生的词典内容同样遵循该协议。中文释义及例句译文为 MyMemory 机器翻译参考。

页面、图标和 PDF 解析脚本均随仓库提供，字体使用本机字体；在线翻译和词典查询需要联网。

## 文件

- dist/index.html：页面入口。
- dist/styles.css：桌面与手机样式。
- dist/core.js：记录、去重、日期与回顾排期。
- dist/app.js：现有界面与统一保存入口。
- dist/cloud-core.js / sync-engine.js / cloud-ui.js：三方合并、同步队列、账号界面与 Supabase 通信。
- supabase/migrations/20261012_journal.sql：数据库表、RLS、版本触发器与事务函数。
- scripts/build.cjs / src/supabase-client.js：公开配置生成与官方 SDK 打包。
- dist/reader-core.js：文本切词、选区、原句与译文更新校验。
- dist/reader.js / reader.css：文章导入、阅读选词与响应式布局。
- dist/translate.js：在线翻译请求、并发控制、缓存和异常反馈。
- dist/lexicon.js / lexicon-ui.js / lexicon.css：词典查询、词形还原、义项参考排序、词性与例句展示。
- dist/bulk.js / bulk.css：生词本多选、删除确认与移动端样式。
- dist/vendor：PDF.js 模块与协议。
- dist/icon.svg：产品图标。
- tests/：现有逻辑测试与离线词典样本。
- docs/DEPLOYMENT.md：部署方法与当前线上站点。

用户文章与生词不包含在 GitHub 仓库或 Netlify 静态发布文件中。登录后的记录保存在 Supabase；访客记录和账号待同步缓存保存在浏览器。
