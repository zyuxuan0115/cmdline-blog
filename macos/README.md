# CmdLine Blog for macOS

原生 Swift + WKWebView 客户端，最低支持 macOS 13。直接加载现有 Web app，
终端、vim 编辑器、背景、账号、文档、标签、发布和社交功能均由同一套 Web 代码提供。
默认地址来自仓库 `register.html`：`https://kate0115.net/apps/cmdline-blog/`。
这是需要联网的客户端，不是离线编辑器；修改本地 Web 文件后，需要部署或使用下面的本地开发模式才能看到修改。

## 构建与启动

安装 Xcode Command Line Tools，使用 Swift 6.2 或更新版本（无需第三方 Swift 依赖）：

```sh
cd macos
bash build.sh
open "dist/CmdLine Blog.app"
```

也可以在 Xcode 中打开 `Package.swift`。构建脚本生成适用于当前 Mac 架构的 `.app`，
使用本机 ad-hoc 签名。供其他 Mac 分发时需使用 Developer ID 签名并公证。
同时生成 `dist/CmdLine Blog.zip`，从临时目录中签名并验证后打包，避免桌面/iCloud
给构建目录添加的 Finder 元数据影响归档。

## 博客预览

在 app 的终端输入 `blog username` 或 `blog`，对应的 `blog.html?u=…` 会通过
`NSWorkspace.shared.open` 打开系统默认浏览器，app 保留终端和编辑器。
支持 `@username`，`blog --name` 仍然用于查询或修改博客标题。

新版 Web 命令通过 `Resources/desktop.js` 注入的异步桥接调用 macOS，并报告打开结果。
尚未部署这次 Web 修改时，客户端也会接管原来的 `window.open`，因此已有网站仍可打开博客；
旧版终端的提示仍可能显示 “new tab”。普通浏览器中的命令继续在新标签页打开。
其他外部链接也交给默认浏览器。

app 使用持久化 WebKit 数据存储，重新打开后可恢复 Firebase 登录。
**默认浏览器和 app 的登录状态相互独立**：公开博客可直接查看；查看私密或朋友可见的内容、
发表评论时，需要在默认浏览器的 Web app 中另外登录。客户端不会把凭据放进博客 URL。

## 本地开发

从仓库根目录启动静态服务器：

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

另一个终端中运行：

```sh
cd macos
CMDLINE_BLOG_URL=http://127.0.0.1:8080/ swift run
```

本地页面仍使用现有 Firebase 项目，写入会影响真实数据。博客也会在默认浏览器中打开本地服务器地址。
可以通过 `CMDLINE_BLOG_URL` 指定另一个已部署的 HTTPS 地址；HTTP 仅允许本机地址。
网络加载失败时显示错误，`⌘R` 重试。`⌘C/V/X/A/Z` 使用系统编辑菜单；原有 Ctrl 终端/vim 快捷键保留。

## 验证

```sh
bash test.sh
```

URL 测试覆盖博客路由、用户名参数、部署子目录和来源边界。命令测试直接执行共享的
`js/terminal.js`，覆盖浏览器、macOS、失败、当前用户、`@username` 与标题命令。
实际登录、发布和系统浏览器启动需要在 Mac 上联网验证。
