# Security and privacy model

Codex Pocket is a personal control surface with access to task text, terminal output, file paths, and task controls. Protect it as an administrative interface.

## Default protections

- The service binds to loopback.
- Tailscale provides authenticated private-network reachability and HTTPS.
- A randomly generated application token protects API requests.
- Runtime state is stored under `.data/` and excluded from Git.
- Phone uploads are stored under `.data/uploads/`, never served as public static files, and are limited by count and size.
- Returned-file downloads require the application token and a file link explicitly present in an assistant message for that task; arbitrary filesystem paths are rejected.
- No analytics or telemetry is included.

## Data that must remain private

- access tokens and token-bearing URLs
- tailnet and device hostnames
- operating-system usernames and home paths
- Codex task and host IDs
- prompts, responses, terminal logs, Git diffs, screenshots, and project files
- photos and files uploaded from the phone
- Tailscale account details and authentication artifacts

## Before sharing or publishing

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\privacy-scan.ps1 -Path .
git status --short
git diff --cached
```

Inspect Git history, not only the working tree. A later deletion does not remove a secret from earlier commits. If a secret was committed, rotate it and rewrite or recreate the repository before publication.

## Scope limits

This template is Windows-first and intended for one person's devices on one private tailnet. It is not a multi-user authorization system, a public SaaS backend, or a hardened remote shell. Add independent authentication, audit logging, rate limits, and an explicit threat model before adapting it for teams or public hosting.

Uploaded files remain on the computer until the user removes `.data/uploads`. Treat this directory as private runtime data and do not copy it into a release or support bundle.

Never append the access token to a phone URL or print a token-bearing URL. Read the token locally and enter it once in the phone UI.

---

# 安全与隐私模型

Codex Pocket 能访问任务文字、终端输出、文件路径和任务控制，因此应把它当作管理界面保护。

## 默认防护

- 服务只监听回环地址。
- Tailscale 提供需要身份验证的私有网络访问和 HTTPS。
- 随机生成的应用令牌保护 API 请求。
- 运行状态保存在 `.data/`，并排除在 Git 之外。
- 手机上传保存在 `.data/uploads/`，不会作为静态文件公开，并受数量和大小限制。
- 返回文件下载需要应用令牌，并且文件必须由该任务的 Codex 回复明确链接；任意文件系统路径会被拒绝。
- 不包含分析或遥测。

## 必须保持私密的数据

- 访问令牌和含令牌的 URL
- tailnet 与设备主机名
- 操作系统用户名和用户目录
- Codex 任务 ID 与主机 ID
- 提示词、回复、终端日志、Git diff、截图和项目文件
- 手机上传的照片与文件
- Tailscale 账号信息和认证材料

## 共享或发布前

运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\privacy-scan.ps1 -Path .
git status --short
git diff --cached
```

检查完整 Git 历史，而不只是工作区。后来删除文件并不会清除早期提交中的秘密。如果秘密曾被提交，应立即轮换，并在发布前重写历史或重建仓库。

## 适用范围

此模板优先支持 Windows，面向同一私有 tailnet 中的一位用户。它不是多用户授权系统、公开 SaaS 后端或经过强化的远程 Shell。改造成团队或公开服务前，需要增加独立身份验证、审计日志、速率限制和明确的威胁模型。

上传文件会一直保留在电脑上，直到用户删除 `.data/uploads`。该目录属于私有运行数据，不要复制进发行包或支持材料。

不要把访问令牌附在手机 URL 中，也不要输出含令牌的 URL。只在电脑本地读取令牌，并在手机界面输入一次。
