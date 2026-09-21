# Troubleshooting

## Phone cannot open the page

Check in this order:

1. `npm run remote:status` shows Tailscale connected and an HTTPS Serve route.
2. The computer page opens at `http://127.0.0.1:4310`.
3. The phone is signed into Tailscale and belongs to the same tailnet.
4. The phone uses the exact private HTTPS hostname reported by the setup script.
5. Battery optimization or a VPN profile is not suspending Tailscale on the phone.

Do not switch the server to `0.0.0.0` or add router forwarding as a quick fix.

## Access token is rejected

Read the token from the computer's local page or `.data/access-token.txt`. Avoid sending it through chat. If compromise is suspected, stop the app, delete `.data/access-token.txt`, and start it again to generate a new token.

## `thread ... already has an active writer`

This means a second App Server connection tried to write to a task already owned by Codex Desktop. Confirm the bundled `codex-app-tools` plugin exists under the local Codex plugin cache and let `src/codex-app-tools-client.mjs` use its named pipe. Do not terminate the desktop task or create another writer merely to bypass the message.

## Tasks are visible but sending fails

- Keep Codex Desktop open and signed in.
- Confirm the chosen task is a Codex task on the current host.
- Restart the bridge after Codex Desktop updates so local pipe discovery is refreshed.
- Inspect `.data/server.err.log` and `.data/server.out.log`, redacting tokens, task IDs, usernames, paths, and hostnames before sharing excerpts.

## The attachment button is missing or an upload fails

- Close every installed-app and browser instance, reopen the private URL, and reload once so service-worker cache `v6` activates.
- Keep each file below 15 MB, use no more than five files, and keep the combined size below 25 MB.
- Confirm the computer has free disk space and the bridge can write to `.data/uploads`.
- JPEG, PNG, GIF, and WebP are sent as native image inputs. All other formats, including source code and HEIC, are sent as file references; HEIC may require conversion before visual inspection.

## Page is stale after an update

The PWA service worker may cache the old shell. Close all installed-app and browser instances, reopen the page, and reload once. If needed, clear site data for the private hostname and enter the token again.

## Tailscale Serve authorization page repeats

Finish the Serve approval in the same tailnet account used by the computer. Then rerun `npm run remote:setup`. Avoid repeated rapid registration attempts because authentication endpoints may be rate-limited.

---

# 故障排查

## 手机打不开页面

按顺序检查：

1. `npm run remote:status` 显示 Tailscale 已连接并存在 HTTPS Serve 路由。
2. 电脑能打开 `http://127.0.0.1:4310`。
3. 手机已登录 Tailscale，并与电脑处于同一 tailnet。
4. 手机使用设置脚本给出的完整私有 HTTPS 地址。
5. 手机的电池优化或其他 VPN 配置没有暂停 Tailscale。

不要为了快速修复而改为监听 `0.0.0.0` 或配置路由器端口转发。

## 访问令牌被拒绝

从电脑本地页面或 `.data/access-token.txt` 读取令牌，不要通过聊天发送。如果怀疑泄露，停止应用、删除 `.data/access-token.txt`，然后重新启动以生成新令牌。

## `thread ... already has an active writer`

这表示第二个 App Server 连接试图写入已由 Codex Desktop 占用的任务。确认本地 Codex 插件缓存中存在 `codex-app-tools`，并让 `src/codex-app-tools-client.mjs` 使用其命名管道。不要仅为绕过错误而终止电脑端任务或创建另一个 writer。

## 能看到任务但发送失败

- 保持 Codex Desktop 打开并处于登录状态。
- 确认所选任务是当前主机上的 Codex 任务。
- Codex Desktop 更新后重启桥接服务，以刷新本地管道发现结果。
- 检查 `.data/server.err.log` 和 `.data/server.out.log`；分享前隐去令牌、任务 ID、用户名、路径与主机名。

## 没有附件按钮或上传失败

- 完全关闭已安装的 App 与浏览器页面，重新打开私有地址并刷新一次，使新版 Service Worker 生效。
- 单个文件不超过 15 MB，每条消息不超过五个文件，总大小不超过 25 MB。
- 确认电脑磁盘空间充足，且桥接服务可写入 `.data/uploads`。
- JPEG、PNG、GIF 与 WebP 会作为原生图片输入；源码、HEIC 等其他格式作为文件引用，HEIC 在视觉检查前可能需要转换。

## 更新后页面仍是旧版

PWA Service Worker 可能缓存了旧界面。关闭所有已安装 App 与浏览器实例，重新打开并刷新一次；必要时清除私有域名的站点数据并重新输入令牌。

## Tailscale Serve 授权页面反复出现

使用电脑所在的同一 tailnet 账号完成 Serve 授权，然后重新运行 `npm run remote:setup`。不要快速重复注册，以免认证端点限流。
