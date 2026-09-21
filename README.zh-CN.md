# Codex Pocket Remote

[English](README.md) | [简体中文](README.zh-CN.md)

Codex Pocket Remote 是一个开源 Codex Skill 和 Windows 本地网页应用，面向无法使用官方手机连接功能的用户。它让手机通过 Tailscale 私网查看 Codex Desktop 任务，并向电脑端已经打开、正在运行的任务继续发送要求。

你是否还在担心：刚离开电脑，运行数小时的 Codex 任务就需要你确认，自己却无法查看进度或及时调整方向？Codex Pocket Remote 让你直接从手机查看进展、继续对话、上传照片和文件，同时不把远程终端或电脑端口暴露到公网。

## 功能

- 适合手机阅读的任务时间线
- “工作过程”默认整体折叠，其中包含终端输出、分析、工具调用和文件改动，需要时再展开
- 向 Codex Desktop 已打开的任务发送后续要求
- 从手机向所选 Codex 任务发送照片和文件
- 中断任务、刷新状态、查看最近活动和文件变化
- 可从手机浏览器安装为 PWA，体验接近独立 App
- 本地服务只监听回环地址，通过 Tailscale Serve 提供私有 HTTPS
- Codex 可调用的 Skill，用于安装、修复、审计和排错

## 安全设计

Node 服务只监听 `127.0.0.1`，Tailscale Serve 只在你的 tailnet 内提供访问。应用另外生成随机访问令牌，运行数据保存在 Git 已忽略的 `.data/` 目录。项目不包含统计或遥测。

请勿公开访问令牌、私人网址、设备名、任务 ID、提示词、终端输出或截图。准备分享修改版之前，请阅读 [references/security.md](references/security.md)。

## 作为 Codex Skill 安装

克隆仓库，然后把整个目录复制或链接到 Codex Skill 目录。例如在当前项目内安装：

```powershell
git clone https://github.com/wenyulou985-stack/codex-pocket-remote.git
New-Item -ItemType Directory -Force .agents\skills | Out-Null
Copy-Item -Recurse -Force .\codex-pocket-remote .\.agents\skills\codex-pocket-remote
```

然后告诉 Codex：

```text
使用 $codex-pocket-remote，为我配置通过手机私密访问 Codex Desktop 任务。
```

LobeHub 收录审核完成后，也可以直接从 LobeHub Skills 页面安装。

## 手动安装应用

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1 -Destination "$HOME\CodexPocket"
Set-Location "$HOME\CodexPocket"
npm run check
npm test
npm run start:bg
```

在电脑打开 `http://127.0.0.1:4310`。首次使用时，在电脑本地运行 `Get-Content .data\access-token` 读取令牌，在手机输入一次，不要通过聊天软件转发。电脑和手机安装 Tailscale 并登录同一个账号后，开启私网访问：

```powershell
npm run remote:setup
npm run remote:status
```

手机打开脚本显示的私有 HTTPS 地址。需要 App 体验时，在浏览器菜单中选择“添加到主屏幕”或“安装应用”。

发送附件时，打开一个任务，点击消息框旁边的 `+`，选择照片或文件后发送。一次最多 5 个附件，单个不超过 15 MB，总计不超过 25 MB。附件只保存在电脑端被 Git 忽略的 `.data/uploads` 目录。

## 环境要求

- Windows 10 或 11
- 已登录并保持运行的 Codex Desktop
- Node.js 20 或更高版本
- PowerShell 5.1 或更高版本
- 电脑和手机安装 Tailscale（远程访问时需要）

## 为什么能修改电脑端已打开的任务

Codex Desktop 可能已经占用了该任务的 App Server 写入连接。再建立一个写入连接会出现 `thread ... already has an active writer`。本应用会发现 Codex 桌面端内置 `codex-app-tools` 提供的本地管道，并调用 `send_message_to_thread`，因此可以把手机消息送到电脑端原任务，而不抢占任务。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run check` | 检查 JavaScript 语法 |
| `npm test` | 运行 Node 测试 |
| `npm run start:bg` | 在后台启动控制台 |
| `npm run stop` | 停止控制台 |
| `npm run remote:setup` | 配置 Tailscale 私网访问 |
| `npm run remote:status` | 查看本地与远程状态 |
| `npm run remote:off` | 关闭 Tailscale Serve |
| `npm run autostart:install` | 登录 Windows 后自动启动 |
| `npm run autostart:remove` | 移除自动启动 |

## 局限

- 当前优先支持 Windows，尚未为 macOS 和 Linux 打包。
- 电脑、Codex Desktop、本地桥接服务和 Tailscale 都需要保持在线。
- Codex 更新后本地集成可能变化；如果无法发消息，先重启桥接服务并查阅排错说明。
- 这是个人单用户工具，不是多人远程终端或公网 SaaS。

## 文档

- [安装说明](references/setup.md)
- [故障排查](references/troubleshooting.md)
- [安全与隐私](references/security.md)
- [漏洞报告](SECURITY.md)

## 开源协议

MIT
