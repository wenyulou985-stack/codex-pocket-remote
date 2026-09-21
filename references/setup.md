# Windows setup

## Prerequisites

- Windows 10 or 11
- Codex Desktop installed and signed in
- Node.js 20 or newer
- Tailscale on the computer and phone, signed into the same tailnet
- PowerShell 5.1 or newer

The bridge does not require a public IP, router port forwarding, or inbound firewall exposure. Tailscale Serve terminates private HTTPS and forwards to the loopback service.

## Install the template

From the skill directory:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1 -Destination "$HOME\CodexPocket"
```

The installer copies `assets/codex-pocket` and does not copy runtime state. To update an existing installation, stop it first and pass `-Force`. Back up any local source edits before overwriting.

## Verify and start

```powershell
Set-Location "$HOME\CodexPocket"
npm run check
npm test
npm run start:bg
```

Open `http://127.0.0.1:4310` on the computer. Read the token locally with `Get-Content .data\access-token`, then enter it once on the phone; the browser stores it locally. Do not paste the token into messages or documentation.

## Enable private phone access

Install Tailscale only after the user has authorized installation. Sign in on the computer and phone with the same account, then run:

```powershell
npm run remote:setup
npm run remote:status
```

Open the reported `https://<device>.<tailnet>.ts.net/` address on the phone. Use the browser's Add to Home Screen or Install app action for the PWA experience.

## Send to an existing desktop task

Select the open task in the phone UI and send a harmless test such as `请回复：手机连接测试成功`. The bridge first uses the desktop app's local tools pipe so it does not compete for the App Server writer. It falls back only where the local environment supports it.

To send photos or files, tap the `+` beside the message field. The phone may select up to five files per message. Images use the App Server's native local-image input when the bridge owns the task; other files are passed as local file mentions. Existing desktop-owned tasks receive the same local paths through the desktop control channel.

## Stop or remove

```powershell
npm run remote:off
npm run stop
```

Optional startup registration:

```powershell
npm run autostart:install
# Remove later with:
npm run autostart:remove
```

Deleting the installation folder removes the application. Delete `.data` as well if the user wants to invalidate its local token and logs.

---

# Windows 安装

## 前置条件

- Windows 10 或 11
- 已安装并登录 Codex Desktop
- Node.js 20 或更高版本
- 电脑和手机安装 Tailscale，并登录同一个 tailnet
- PowerShell 5.1 或更高版本

本桥接服务不需要公网 IP、路由器端口转发或开放入站防火墙。Tailscale Serve 提供私有 HTTPS，并将请求转发给只监听回环地址的服务。

## 安装模板

在 Skill 目录运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1 -Destination "$HOME\CodexPocket"
```

安装程序会复制 `assets/codex-pocket`，不会复制运行状态。更新现有安装时，先停止服务并传入 `-Force`；覆盖前请备份本地源码修改。

## 验证并启动

```powershell
Set-Location "$HOME\CodexPocket"
npm run check
npm test
npm run start:bg
```

在电脑打开 `http://127.0.0.1:4310`。使用 `Get-Content .data\access-token` 在电脑本地读取令牌，然后在手机输入一次；浏览器会保存在本机。不要把令牌粘贴到消息或文档中。

## 开启手机私有访问

只有在用户授权安装后才安装 Tailscale。电脑和手机登录同一账号，然后运行：

```powershell
npm run remote:setup
npm run remote:status
```

在手机打开脚本报告的 `https://<device>.<tailnet>.ts.net/` 地址。需要类似 App 的体验时，使用浏览器的“添加到主屏幕”或“安装应用”。

## 向电脑端现有任务发送消息

在手机界面选择已经打开的任务，发送无害测试消息，例如 `请回复：手机连接测试成功`。桥接服务优先使用 Codex Desktop 的本地工具管道，避免与 App Server writer 冲突。

点击输入框旁的 `+` 可发送照片或文件，每条消息最多五个文件。桥接服务拥有任务时，图片使用 App Server 的原生本地图像输入；其他文件作为本地文件引用发送。电脑端已占用的任务通过桌面控制通道接收相同的本地路径。

## 停止或移除

```powershell
npm run remote:off
npm run stop
```

可选的开机启动：

```powershell
npm run autostart:install
# 以后移除：
npm run autostart:remove
```

删除安装目录即可移除应用。如果用户希望令牌和日志同时失效，也删除 `.data`。
