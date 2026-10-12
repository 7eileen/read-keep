# 部署说明

当前正式网站：https://enchanting-faun-41350f.netlify.app/

项目管理：https://app.netlify.com/projects/enchanting-faun-41350f

## 静态文件

发布目录是 `dist`，无需构建命令。必须完整保留 `dist/vendor` 中的 PDF.js 模块和许可文件。不要只上传 index.html。

现有站点通过 Netlify 手动上传部署。更新时进入这个已有项目的 Overview 或 Deploys，上传 dist 文件夹，或上传根目录直接包含 index.html 的 ZIP。

上传 GitHub 本身不会更新现有网站。目前尚未配置 GitHub 到 Netlify 的自动部署。如果后续连接 Git 仓库，选择本仓库的 main 分支，发布目录填写 dist，构建命令留空。

新项目应检查访问权限为 Public，访客无需站点密码或 Netlify 团队登录。手机布局使用底部导航；当前项目已关闭会遮挡导航的可选 Powered by Netlify 角标。

## 当前版本验证

2026-10-12 上线后已实际验证首页匿名请求返回 HTTP 200、PDF 导入、点词收录与取消、词性词形和译文展示、重新加载后的本地保存，以及手机尺寸下的阅读页、生词本和回顾入口。

## 数据与外部服务

文章和生词存在使用者的浏览器 localStorage 中，不上传到 Netlify 或 GitHub。更换域名、设备或浏览器不会自动迁移记录。

在线翻译与词典查询会把所选词及必要的上下文发送给相关服务，具体范围见 README。此版本没有用户登录、后端数据库或跨设备同步功能。
