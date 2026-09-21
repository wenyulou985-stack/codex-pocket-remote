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
