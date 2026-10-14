# 部署说明

正式站点：[拾词](https://enchanting-faun-41350f.netlify.app/)。

现有 Netlify 项目 `enchanting-faun-41350f` 继续连接 GitHub `7eileen/read-keep` 的 `main` 分支；没有新建网站或更换域名。GitHub Netlify App 仍仅授权此仓库。

## 发布流程（2026-10-14 更新）

固定流程：本地修改 → 测试与验收 → 提交并推送 GitHub（跳过部署）→ 等待用户明确确认发布 → 提醒额度消耗 → 集中发布一次。

每次完成改动后均保存到 GitHub，提交信息必须带 `[skip netlify]`。批量推送时确保最新提交带标记；拉取请求标题也须带同一标记，以免触发预览部署。推送前检查标记，推送后核对远端提交与部署状态。具体执行规则见根目录 [AGENTS.md](../AGENTS.md)。

Netlify 的 Git 自动部署连接仍保留，日常推送通过该标记跳过部署；这不等于已在后台关闭自动部署。用户明确确认发布后，再核对待发布版本、测试结果、额度和可回退版本，通过一次受控的正式部署上线。

Netlify 官方说明：[跳过部署](https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/#skip-a-deploy)。下一个不含跳过标记的提交会连同之前跳过的改动一起部署，因此不能在未确认发布时移除标记。

## 上线前的自动测试与构建

根目录 `netlify.toml` 指定 Node.js 22、命令 `npm test && npm run build`、发布目录 `dist`。依赖按 `pnpm-lock.yaml` 和固定 packageManager 安装。获准发布并触发构建后，先跑全部 `check-*.cjs` 测试，再打包 Supabase 官方 SDK 和公开配置，全部成功才更新网站。失败时旧版继续服务。带 `[skip netlify]` 的日常推送不运行这条云端流程，相关测试须在本地先完成。

Netlify → Project configuration → Environment variables 已配置：

| Key | 用途 |
| --- | --- |
| `SUPABASE_URL` | 此项目的 HTTPS API 地址 |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase 客户端 publishable key |

当前 Free 账户只能使用 All scopes；两项变量已应用所有部署上下文。它们会写入公开的 `dist/config.js`，属于可公开客户端配置。这里不能填写数据库密码、secret key 或 service_role key。无需把 SMTP 密码配置到 Netlify。

环境变量变化需要重新构建，也应在发布确认后执行。日常 Git 推送只保存代码；获准发布后通过保留测试步骤的流程上线，不用绕过测试的手动目录上传。检查 [部署记录](https://app.netlify.com/projects/enchanting-faun-41350f/deploys) 中的提交号、测试结果、构建和 Published 状态。

## 本地

参考 README 安装依赖，复制 `.env.example` 为 `.env` 后运行 `pnpm test`、`pnpm build`。构建输出的 `dist/config.js` 和 `dist/vendor/supabase.js` 不提交，由各环境生成。PDF.js 及许可文件继续随仓库保留。

## 数据库变更

数据库迁移不会因 Git 推送自动执行。首次接入需在对应 Supabase 项目运行 `supabase/migrations/20261012_journal.sql`；本项目已执行，不要重复执行含建策略/触发器的首次迁移。后续结构变化应新增迁移，先评估旧版兼容性，再发布前端。

本次从旧版 localStorage 转为“访客本地 + 登录账号云端”，旧数据没有自动上传或删除。数据说明、认证回调地址、SMTP 待办和验证步骤见 [SUPABASE-SETUP.md](SUPABASE-SETUP.md)。

## 已验证的发布基础

2026-10-12 原有 Git 自动部署及发布前测试已实际验证。此次增加 Supabase 构建步骤；本次具体提交和发布结果在任务交付说明中列出。网站继续公开访问，账号登录用于读取个人学习数据。

Supabase 功能提交 `73f8a3d32df44919ede8beb4989c94c70ae36f16` 已于 2026-10-12 发布，[部署记录](https://app.netlify.com/projects/enchanting-faun-41350f/deploys/6acc9989a45c80b865f6341c) 为 ready。实际云端日志包含 `npm test && npm run build`、`Passed 9 test files.` 和 `Cloud enabled.`。正式网址已登录测试账号，读取到在 localhost 创建的文章和生词；正式网址删除测试词条后，独立客户端确认云端删除生效。
