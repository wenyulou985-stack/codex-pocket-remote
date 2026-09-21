# Codex Pocket Remote

[简体中文](README.zh-CN.md)

Codex Pocket Remote is an open Codex Skill and a Windows-first local web app for people who cannot use the official mobile connection flow. It lets a phone view Codex Desktop tasks and send new instructions to an already-running task through a private Tailscale connection.

The project grew from a practical need: leave a long Codex task running on a computer, check its state from a phone, and redirect it without exposing a terminal or desktop to the public internet.

## What it provides

- A mobile-friendly task timeline with terminal and internal work grouped and collapsed by default
- Follow-up messages to tasks already open in Codex Desktop
- Photos and files sent from the phone to the selected Codex task
- Task interruption, refresh, recent activity, and file-change visibility
- A PWA that can be installed from the phone browser
- Loopback-only local service plus private HTTPS through Tailscale Serve
- A reusable Codex Skill that can install, repair, audit, and troubleshoot the setup

## Security model

The Node service listens on `127.0.0.1`. Tailscale Serve exposes it only inside your tailnet. The app adds its own random access token and keeps runtime state under the Git-ignored `.data/` directory. It contains no analytics or telemetry.

Do not publish your token, private URL, device name, task IDs, prompts, terminal output, or screenshots. Read [references/security.md](references/security.md) before sharing a customized copy.

## Install as a Codex Skill

Clone the repository, then copy or link the repository directory into a Codex skill location. For a local project:

```powershell
git clone https://github.com/wenyulou985-stack/codex-pocket-remote.git
New-Item -ItemType Directory -Force .agents\skills | Out-Null
Copy-Item -Recurse -Force .\codex-pocket-remote .\.agents\skills\codex-pocket-remote
```

Then ask Codex:

```text
Use $codex-pocket-remote to set up private mobile access to my Codex Desktop tasks.
```

After marketplace approval, LobeHub users can install the published skill by its listed identifier.

## Install the app manually

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1 -Destination "$HOME\CodexPocket"
Set-Location "$HOME\CodexPocket"
npm run check
npm test
npm run start:bg
```

Open `http://127.0.0.1:4310` on the computer. Read the first-use token locally with `Get-Content .data\access-token`; enter it once on the phone and do not send it through chat. To enable private phone access after installing and signing into Tailscale on both devices:

```powershell
npm run remote:setup
npm run remote:status
```

Open the reported private HTTPS address on the phone and install it from the browser menu if desired.

To send an attachment, open a task, tap the `+` button beside the message box, choose up to five photos or files, and send. Each file may be up to 15 MB, with a 25 MB combined limit. Uploads stay on the computer under the Git-ignored `.data/uploads` directory.

## Requirements

- Windows 10 or 11
- Codex Desktop signed in and running
- Node.js 20+
- PowerShell 5.1+
- Tailscale on the computer and phone for remote access

## How desktop-task steering works

Codex Desktop may already own the App Server writer for a task. Opening a competing writer can produce `thread ... already has an active writer`. This app discovers the local pipe exposed by the bundled `codex-app-tools` integration and uses `send_message_to_thread`, allowing follow-up messages to reach the desktop-owned task without taking it over.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run check` | Syntax validation |
| `npm test` | Node tests |
| `npm run start:bg` | Start the bridge in the background |
| `npm run stop` | Stop the bridge |
| `npm run remote:setup` | Configure private Tailscale Serve access |
| `npm run remote:status` | Show local and private access status |
| `npm run remote:off` | Disable Tailscale Serve |
| `npm run autostart:install` | Start the bridge after Windows sign-in |
| `npm run autostart:remove` | Remove startup registration |

## Limitations

- Windows-first; macOS and Linux are not yet packaged.
- The computer, Codex Desktop, the bridge, and Tailscale must remain online.
- The local desktop integration can change after a Codex update; restart the bridge and use the troubleshooting guide if task writes stop working.
- This is a personal single-user tool, not a multi-user remote shell or public SaaS service.

## Documentation

- [Setup](references/setup.md)
- [Troubleshooting](references/troubleshooting.md)
- [Security and privacy](references/security.md)
- [Responsible disclosure](SECURITY.md)

## License

MIT
