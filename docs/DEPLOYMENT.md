# 部署说明

正式站点：[拾词](https://enchanting-faun-41350f.netlify.app/)。

现有 Netlify 项目 `enchanting-faun-41350f` 继续连接 GitHub `7eileen/read-keep` 的 `main` 分支；没有新建网站或更换域名。GitHub Netlify App 仍仅授权此仓库。

## 自动发布

根目录 `netlify.toml` 指定 Node.js 22、命令 `npm test && npm run build`、发布目录 `dist`。依赖按 `pnpm-lock.yaml` 和固定 packageManager 安装。每次 main 更新先跑全部 `check-*.cjs` 测试，再打包 Supabase 官方 SDK 和公开配置，全部成功才更新网站。失败时旧版继续服务。

Netlify → Project configuration → Environment variables 已配置：

| Key | 用途 |
| --- | --- |
| `SUPABASE_URL` | 此项目的 HTTPS API 地址 |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase 客户端 publishable key |

当前 Free 账户只能使用 All scopes；两项变量已应用所有部署上下文。它们会写入公开的 `dist/config.js`，属于可公开客户端配置。这里不能填写数据库密码、secret key 或 service_role key。无需把 SMTP 密码配置到 Netlify。

环境变量变化需要重新构建。正常更新用 Git 推送，不用绕过测试的手动目录上传。检查 [部署记录](https://app.netlify.com/projects/enchanting-faun-41350f/deploys) 中的提交号、测试结果、构建和 Published 状态。

## 本地

参考 README 安装依赖，复制 `.env.example` 为 `.env` 后运行 `pnpm test`、`pnpm build`。构建输出的 `dist/config.js` 和 `dist/vendor/supabase.js` 不提交，由各环境生成。PDF.js 及许可文件继续随仓库保留。

## 数据库变更

数据库迁移不会因 Git 推送自动执行。首次接入需在对应 Supabase 项目运行 `supabase/migrations/20261012_journal.sql`；本项目已执行，不要重复执行含建策略/触发器的首次迁移。后续结构变化应新增迁移，先评估旧版兼容性，再发布前端。

本次从旧版 localStorage 转为“访客本地 + 登录账号云端”，旧数据没有自动上传或删除。数据说明、认证回调地址、SMTP 待办和验证步骤见 [SUPABASE-SETUP.md](SUPABASE-SETUP.md)。

## 已验证的发布基础

2026-10-12 原有 Git 自动部署及发布前测试已实际验证。此次增加 Supabase 构建步骤；本次具体提交和发布结果在任务交付说明中列出。网站继续公开访问，账号登录用于读取个人学习数据。
