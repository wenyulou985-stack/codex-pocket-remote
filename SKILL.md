---
name: codex-pocket-remote
description: "Set up, repair, or audit a private mobile companion for Codex Desktop on Windows using a local Node.js bridge and Tailscale. Use it to view and steer an already-running desktop task, send files, inspect activity, or install a PWA without exposing a public port. 在 Windows 上配置、修复或审计 Codex Desktop 私有手机控制端；适用于官方手机连接不可用，需要远程查看并调整正在运行的任务、发送文件或安装 PWA 的场景。"
---

# Codex Pocket Remote / Codex 手机远程助手

Create a private phone control panel for Codex Desktop. The included template reads desktop tasks through the local App Server and sends follow-up instructions to an already-open task through the bundled `codex-app-tools` local pipe.

为 Codex Desktop 创建一个私有手机控制面板。内置模板通过本地 App Server 读取电脑端任务，并通过随附的 `codex-app-tools` 本地管道向已打开的任务发送后续要求。

## Choose the operation / 选择操作

- For a new installation or reinstall, read [references/setup.md](references/setup.md), then use `scripts/install.ps1`.
- For connection, pairing, task-write, or Tailscale failures, read [references/troubleshooting.md](references/troubleshooting.md).
- For a security or privacy review, read [references/security.md](references/security.md) and run `scripts/privacy-scan.ps1` against the planned public or shared directory.
- For implementation changes, inspect `assets/codex-pocket/` and preserve the invariants below.

- 新安装或重装：阅读 [references/setup.md](references/setup.md)，然后运行 `scripts/install.ps1`。
- 连接、配对、任务写入或 Tailscale 故障：阅读 [references/troubleshooting.md](references/troubleshooting.md)。
- 安全或隐私检查：阅读 [references/security.md](references/security.md)，并对准备公开或共享的目录运行 `scripts/privacy-scan.ps1`。
- 修改实现：检查 `assets/codex-pocket/`，并保持下列约束。

## Required invariants / 必须保持的约束

1. Bind the Node server to `127.0.0.1` for remote mode. Publish it only through Tailscale Serve or another user-approved private overlay.
2. Never put the access token in source control, screenshots, documentation, chat messages, URLs shared with other people, analytics, or logs. Runtime secrets belong under `.data/`, which must remain ignored by Git.
3. Treat machine names, tailnet domains, usernames, absolute paths, task IDs, screenshots, and terminal output as private data.
4. Do not solve the desktop `active writer` error by opening a second App Server writer. Use the bundled local `codex-app-tools` pipe for desktop-owned task writes.
5. Keep the Codex desktop app and this bridge running while remote access is needed. Stop Tailscale Serve when the user no longer wants remote access.
6. Request user action only when interactive sign-in is required or an external publication/installation lacks prior authorization. Explain the exact step and continue all independent setup first.
7. Keep phone uploads under the Git-ignored `.data/uploads` directory. Enforce the bundled count and size limits, and never expose that directory through the static-file server.
8. Allow phone downloads only for absolute local files explicitly linked by an assistant message in the selected task. Resolve the file from the task again on every request; never expose a general path-based download endpoint.

中文要点：服务在远程模式下只监听 `127.0.0.1`，只通过用户批准的私有网络发布；访问令牌、设备名、私网域名、用户名、绝对路径、任务 ID、截图和终端输出都属于隐私数据；不要用第二个 App Server writer 绕过 `active writer`；手机上传必须保存在 Git 忽略的 `.data/uploads` 中，并执行数量与大小限制；下载只允许访问所选任务中由 Codex 回复明确链接的绝对路径文件，每次请求都要重新从任务内容核对，不能提供任意路径下载接口。

## Completion criteria / 完成标准

Do not report success until all applicable checks pass:

- `npm run check` and `npm test` pass in the installed app.
- `/api/health` returns an OK response locally.
- the listener is loopback-only in remote mode.
- Tailscale reports the HTTPS Serve route and both devices use the same tailnet.
- a benign test message reaches the selected existing desktop task.
- a benign file explicitly returned by Codex downloads successfully, while an unreferenced file id is rejected.
- the phone UI loads over HTTPS and can be installed as a PWA when requested.

Report the install directory, how to start and stop it, the private access method, and any remaining limitation. Redact secrets and private identifiers in the report.

只有在适用检查通过后才能报告成功：测试与语法检查通过、本地健康检查正常、远程模式仅监听回环地址、Tailscale HTTPS Serve 路由有效、测试消息能到达选中的电脑端任务，并且手机端可通过 HTTPS 使用。报告安装目录、启停方法、私有访问方式与剩余限制，同时隐去秘密和私人标识符。
