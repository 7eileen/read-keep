# 部署说明

当前正式网站：https://enchanting-faun-41350f.netlify.app/

项目管理：https://app.netlify.com/projects/enchanting-faun-41350f

## 静态文件

发布目录是 `dist`，应用无需编译；Netlify 的构建步骤用于执行现有测试。必须完整保留 `dist/vendor` 中的 PDF.js 模块和许可文件。

## 自动发布与测试

2026-10-12 已将现有 Netlify 项目 `enchanting-faun-41350f` 连接到 GitHub 仓库 `7eileen/read-keep`，以 `main` 分支作为生产来源，沿用当前正式网址。

Netlify GitHub App 的安装授权设为 **Only select repositories**，已选列表仅含 `7eileen/read-keep`。可在 [GitHub 安装设置](https://github.com/settings/installations/170483992) 核对；公开仓库仍可被公开读取。

根目录 `netlify.toml` 定义发布设置：

- 基础目录：仓库根目录。
- Node.js：22。
- 构建命令：`npm test`，依次运行现有 7 组逻辑测试。
- 发布目录：`dist`。

推送或合并到 `main` 会触发 Netlify 获取该提交并运行测试。测试通过才发布 `dist`；测试退出码非零时部署失败，当前线上版本继续提供服务。可在 [部署记录](https://app.netlify.com/projects/enchanting-faun-41350f/deploys) 核对提交号及云端测试日志。`netlify.toml` 中的设置优先于后台同名设置。

建议修改后先在本地运行 `npm test`，再提交到 GitHub。若测试失败，修复并推送新的提交即可重新触发部署。现有测试主要验证业务逻辑，不替代真实浏览器、PDF 文件和外部翻译服务验证。

日常更新走 Git 自动部署流程。手动上传目录或 ZIP 的部署方式不会执行这里的测试命令，因此不作为日常发布方式。`.netlify/` 已加入 `.gitignore`，本地站点关联文件不会进入仓库。

新项目应检查访问权限为 Public，访客无需站点密码或 Netlify 团队登录。手机布局使用底部导航；当前项目已关闭会遮挡导航的可选 Powered by Netlify 角标。

## 当前版本验证

2026-10-12 首次 Git 部署已成功发布提交 `5c992367d332af9d110ee4e1d536b53366a7ff61`。Netlify 云端日志确认执行 `npm test`，结果为 `Passed 7 test files.`；[该次部署记录](https://app.netlify.com/projects/enchanting-faun-41350f/deploys/6acc726bd67e571ede53d394) 状态为 `ready`，分支为 `main`。

2026-10-12 上线后已实际验证首页匿名请求返回 HTTP 200、PDF 导入、点词收录与取消、词性词形和译文展示、重新加载后的本地保存，以及手机尺寸下的阅读页、生词本和回顾入口。

## 数据与外部服务

文章和生词存在使用者的浏览器 localStorage 中，不上传到 Netlify 或 GitHub。更换域名、设备或浏览器不会自动迁移记录。

在线翻译与词典查询会把所选词及必要的上下文发送给相关服务，具体范围见 README。此版本没有用户登录、后端数据库或跨设备同步功能。
