# Supabase 接入、后台设置与验证

## 原先数据在哪里

原先 `dist/app.js` 使用 `KEY = 'read-and-keep-demo-v1'`，启动读取 `localStorage.getItem(KEY)`，`persist()` 将整个 state 序列化保存。文章在 `dist/reader.js` 加入 `state.articles`，词条及回顾进度在 `state.entries`，设置在 `state.settings`。内存是界面运行时副本，没有云端数据库。

因此旧版刷新同一网址可以恢复；清理该网站的浏览器数据后会丢失；更换设备、浏览器或网址不能读取旧记录。GitHub 存代码，Netlify 存发布文件，两者都不是用户学习数据的存储位置。

## 接入后

| 数据 | 位置与内容 |
| --- | --- |
| 注册、密码、登录会话 | Supabase Auth；应用不自行存储密码 |
| `public.articles` | 标题、全文段落、导入方式、日期、PDF 页码等原有文章属性 |
| `public.entries` | 生词、原句、译文、词性词形例句、笔记、收藏、文章定位、回顾次数及下次日期 |
| `public.preferences` | 回顾间隔、每批条数、自动翻译开关；每账号一条 `settings` |
| 浏览器本地 | 访客空间；官方 SDK 会话；按用户 ID 分开的缓存和待同步修改 |

原始 PDF 文件仍在本机解析，不上传文件本体；登录后解析出的文章正文会保存至 Supabase。全文与词条使用 JSONB 保留现有数据结构，避免损失已有词典资料和定位信息。

三张表公共字段为 `owner_id`、`id`、`payload`、`version`、`updated_at`，复合主键 `(owner_id,id)`。版本和更新时间由数据库触发器管理。删除文章仍保留已收录词条及原句，延续产品既有行为；删除 Auth 用户会级联删除该用户三表数据。

| 操作 | 数据是否还在 |
| --- | --- |
| 刷新页面 | 已同步从云端读取；本机待同步队列也会恢复 |
| 清理浏览器数据 | 已同步数据仍在，重新登录可取回；访客和未同步内容会丢失 |
| 换设备/浏览器 | 同一账号登录可读取已同步数据 |
| 退出账号 | 切回访客空间；显式退出成功会清理该账号本机缓存，云端不删除 |
| 另一人登录 | 读取另一人的空间，不自动继承上一账号或访客记录 |

看到“已同步到云端”才表示同步完成。保存先写入本机队列，再请求云端；失败显示错误，可手动重试。首次登录尚未成功读取时会暂时锁定内容操作。没有离线应用缓存服务，首次打开页面仍需网络。

## 数据权限与同步实现

SQL 位于 `supabase/migrations/20261012_journal.sql`。三表全部启用 RLS，匿名没有表读写权限；authenticated 的 SELECT、INSERT、UPDATE、DELETE 各有策略，均限定 `auth.uid() = owner_id`。UPDATE 同时约束旧行和新行；触发器禁止更换 owner_id/id。

`journal_load()` 和 `journal_apply(changes)` 为 **SECURITY INVOKER**，以当前用户权限执行并受 RLS 约束；只授权 authenticated。客户端没有管理员密钥。修改采用版本比较；文章改名影响多条词条、批量删除等操作在一个事务中完成。冲突返回 `PT409 / HTTP 409` 并回滚整个批次。不要使用 `40001` 表达业务冲突：会触发 PostgREST 的事务重试，见 [Supabase 官方说明](https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b)。

`dist/cloud-core.js` 做基线/本机/云端三方合并，`dist/sync-engine.js` 管理队列与版本，`dist/cloud-ui.js` 使用官方 SDK 登录和请求。不同记录的修改自动合并；同一记录同时改动、或一端删除另一端修改，会要求选择本机或云端版本。可先导出当前记录。它是个人跨设备同步，不是多人实时协同编辑器。

保存、恢复联网、回到页面和手动点击同步时检查云端。账号切换会取消翻译任务、清除草稿、弹窗及回顾会话，并销毁旧同步实例；请求绑定发起时账号的 token，避免晚到结果进入另一账号页面。

## 已完成的后台设置

- 免费组织 `Read & Keep`，免费项目 `read-keep`，project ref `ypmhbjegipygakmpzrby`。区域 Sydney；没有升级套餐。
- [项目后台](https://supabase.com/dashboard/project/ypmhbjegipygakmpzrby)：已执行建表、RLS、触发器和 RPC。
- Email 登录已启用；Allow new users to sign up、Confirm email 保持开启；匿名 Auth 登录关闭。
- [URL Configuration](https://supabase.com/dashboard/project/ypmhbjegipygakmpzrby/auth/url-configuration)：Site URL 为 `https://enchanting-faun-41350f.netlify.app/`；允许回调为该地址及 `http://127.0.0.1:4180/`。
- [Netlify 环境变量](https://app.netlify.com/projects/enchanting-faun-41350f/configuration/env)：已配置 `SUPABASE_URL` 与 `SUPABASE_PUBLISHABLE_KEY`，构建生成前端公开配置。具体值从 Supabase Connect / API Keys 查看，不要使用 secret/service_role。
- GitHub / Netlify 保留原站点、main 自动发布与发布前测试。

## 你还需要完成：邮件发送服务

你已说明暂时没有 SMTP，因此这一项留待你准备。默认邮件服务只面向项目团队地址，不适合公众注册；当前公开注册验证邮件及找回密码的完整邮件链路尚未验收。不要通过关闭 Confirm email 来掩盖邮件服务缺失。官方依据：[Supabase 自定义 SMTP](https://supabase.com/docs/guides/auth/auth-smtp)。

1. 选择支持 SMTP 的邮件服务并创建账户，例如 Supabase 文档列出的 Resend、Brevo 等；套餐与域名要求以所选服务后台为准。
2. 验证发信地址/发信域名；按服务商提供的 DNS 记录完成域名验证。准备 SMTP Host、Port、Username、Password，以及 Sender email、Sender name（可填“拾词 Read & Keep”）。
3. Supabase 项目 → Authentication → Emails → SMTP Settings，开启 Custom SMTP，将上述信息填入并保存。SMTP 密码只填 Supabase 后台，不能放进 GitHub、Netlify 前端变量或发到公开聊天。
4. 检查 Authentication → URL Configuration 仍为正式站点；检查 Confirm email 开启。新换域名时更新 Site URL 与精确回调白名单。
5. 在正式站点用自己的邮箱注册，收到邮件后点击验证，再登录。新增文章和生词；在手机登录同一账号并刷新/同步，检查记录；最后验证“忘记密码”邮件可以返回站点设置新密码。测试邮件时注意服务商和 Supabase 的发送限额。

SMTP 不要求改动当前 Netlify 两项配置。若你先自行体验，可在 Supabase Users 中为自己的邮箱创建已确认账号，再到网页用该邮箱密码登录；这不代表公众注册邮件已经可用。

## 迁移旧记录与备份

登录不会自动上传访客内容。确认是自己的账号后，在“我的账号”点击“迁移此浏览器的访客记录”。非演示文章/词条按 ID 合并；相同内容不重复；相同 ID 内容不同会停止并提示。原访客副本保留。

浏览器按 origin 隔离：localhost:4178、localhost:4180 和 Netlify 域名互相看不到 localStorage。此按钮只迁移当前网址当前浏览器的访客数据。旧网址数据请先导出留存；本版尚无通用 JSON 导入恢复界面。不要清理唯一存放未同步记录的浏览器。

账户页可导出当前记录。云端存储不等同于备份策略；上线后应按实际套餐配置数据库备份/导出并验证恢复。同步缓存不是加密保险箱，共用设备应主动退出账号。

## 验证与复测

2026-10-12 已使用两个专用、已确认的 QA 账号实际执行以下项目，没有使用 admin/secret key：

- 三张表的自身新增、读取、修改、删除，修改后版本增长。
- B 读取 A 返回空；B 冒用 owner_id 新增失败；B 更新/删除 A 影响 0 行；A 不能把行所有权改给 B。
- 匿名表读取及 journal_load 被拒绝。
- 同一记录 ID 可分别属于 A、B；A 删除不会删除 B 的记录。
- A 的独立登录客户端读取更新/删除；事务 RPC 新增、更新、删除正常。
- 错误版本返回 409；同一批前面的有效修改也回滚。
- 实际网页新增文章、点词收录、编辑笔记、开关设置后，独立 API 客户端核对数据库内容一致；刷新仍在；网页切换 B 看不到 A 的内容。
- 本地 9 组逻辑测试通过，正式构建通过。桌面与 390px 嵌入页面的登录弹窗已实际检查；提示块保持浅色背景和四周统一边框，没有单侧强调竖条，弹窗只有一个可用关闭入口。该检查不是实体手机测试。
- 正式 Netlify 站点登录 A 后读到了 localhost 创建的数据；正式站点删除词条，独立客户端确认删除已进入数据库。发布日志确认 9 组测试和构建通过。验证结束已退出测试会话，删除两个专用 QA 账号及关联测试数据；原有访客数据保留。

常规测试运行 `pnpm test`。独立真实 API 测试需 `.env` 公开配置和忽略的 `.env.qa`：

```text
QA_A_EMAIL=qa.sync.a.<唯一后缀>@example.com
QA_A_PASSWORD=<测试账号密码>
QA_B_EMAIL=qa.sync.b.<唯一后缀>@example.com
QA_B_PASSWORD=<测试账号密码>
```

先通过 Supabase Users 创建两个对应的专用已确认账号，再执行 `node tests/live-supabase.cjs`。脚本会清理这些账号的三表数据，因此只允许 `qa.sync.a.` / `qa.sync.b.` 前缀且不得使用真实学习账户；验证时不要让网页同时登录这两个账号。测试后删除专用账号和本地测试凭据。

普通 CI 运行逻辑测试，不连接真实用户数据库。两账号隔离验证不等于完整渗透测试；邮件收发、真实手机浏览器/网络环境仍须在 SMTP 配置后做最终验收。
