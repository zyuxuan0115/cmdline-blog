# CmdLine Blog for macOS

原生 Swift + WKWebView 客户端，最低支持 macOS 13。**界面代码随 app 打包，在本地运行**，
启动时不加载线上编辑器页面。终端、vim 编辑器、背景、图片、字体以及 Firebase SDK、
CodeMirror、marked 均包含在 app 内。

构建时从仓库根目录复制 `index.html`、`style.css`、`js/`、`fonts/`、`pic/`，
因此修改共享界面代码后重新构建即可，不需要部署网站。账号、文档同步、发布和社交功能仍使用
原有 Firebase 后端，需要联网；本次修改不增加离线保存或离线同步功能。

## 构建与启动

安装 Xcode Command Line Tools，使用 Swift 6.2 或更新版本、Python 3。
没有第三方 Swift 依赖，构建时无需下载前端库；运行 `.app` 时无需 Python、Node 或外部服务器。

```sh
cd macos
bash build.sh
open "dist/CmdLine Blog.app"
```

也可以先执行 `python3 prepare_web.py`，再在 Xcode 中打开 `Package.swift`。
构建脚本生成适用于当前 Mac 架构的 `.app`，
使用本机 ad-hoc 签名。供其他 Mac 分发时需使用 Developer ID 签名并公证。
同时生成 `dist/CmdLine Blog.zip`，从临时目录中签名并验证后打包，避免桌面/iCloud
给构建目录添加的 Finder 元数据影响归档。

## 博客预览

在 app 的终端输入 `blog username` 或 `blog`，对应的线上博客会通过
`NSWorkspace.shared.open` 打开系统默认浏览器，app 保留终端和编辑器。
支持 `@username`，`blog --name` 仍然用于查询或修改博客标题。

例如本地命令生成的 `blog.html?u=alice` 会转换成
`https://kate0115.cc/apps/cmdline-blog/blog.html?u=alice`，不会把本地服务器地址交给浏览器。
用户名、文章、标签等参数会保留。线上博客基地址集中定义在 `Site.productionURL`。

命令通过 `Resources/desktop.js` 注入的异步桥接调用 macOS，并报告打开结果。
客户端也接管 `window.open` 和博客链接。普通浏览器中的命令继续在新标签页打开。
其他外部链接也交给默认浏览器。

app 使用持久化 WebKit 数据存储，重新打开后可恢复 Firebase 登录。
**默认浏览器和 app 的登录状态相互独立**：公开博客可直接查看；查看私密或朋友可见的内容、
发表评论时，需要在默认浏览器的 Web app 中另外登录。客户端不会把凭据放进博客 URL。

## 本地开发与资源

在 `macos/` 中运行：

```sh
python3 prepare_web.py
swift run
```

app 内置的只读静态服务器只监听 `127.0.0.1:47836`，随 app 启动和退出。
固定本地来源让 WebKit/Firebase 保留登录和界面偏好；由原先线上外壳升级到本地界面后，需要重新登录一次。
该端口被占用时会显示启动错误，不会加载其他服务的页面。

`vendor/manifest.json` 记录固定版本库的来源和 SHA-256，`prepare_web.py` 验证校验和，
仅将生成的 `Resources/Web/index.html` 中的 CDN 链接替换成本地依赖，不改浏览器版的脚本链接。
第三方许可证也包含在资源中。生成目录已加入 `.gitignore`，源文件和 `vendor/` 应提交到版本控制。

本地界面仍使用现有 Firebase 项目，写入会影响真实数据。
`⌘R` 重新加载打包的界面；`⌘C/V/X/A/Z` 使用系统编辑菜单，原有 Ctrl 终端/vim 快捷键保留。

## 验证

```sh
bash test.sh
```

验证覆盖线上博客 URL 映射、用户名和筛选参数、本地 HTTP 服务、目录穿越与来源边界。
打包检查验证所有脚本和样式均来自本地、共享源文件一致、第三方库校验和及许可证完整。
命令测试直接执行共享的
`js/terminal.js`，覆盖浏览器、macOS、失败、当前用户、`@username` 与标题命令。
实际登录、发布和系统浏览器启动需要在 Mac 上联网验证。
