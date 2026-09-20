---
name: codex-pocket-remote
description: Set up, repair, or audit a private mobile web companion for Codex Desktop on Windows using a local Node.js bridge and Tailscale. Use when a user cannot use the official mobile connector and wants to view tasks, steer an already-running desktop task, interrupt work, inspect activity, or install the companion as a PWA without exposing a public port.
---

# Codex Pocket Remote

Create a private phone control panel for Codex Desktop. The included template can read desktop tasks through the local App Server and send follow-up instructions to an already-open desktop task through the bundled `codex-app-tools` local pipe.

## Choose the operation

- For a new installation or reinstall, read [references/setup.md](references/setup.md), then use `scripts/install.ps1`.
- For connection, pairing, task-write, or Tailscale failures, read [references/troubleshooting.md](references/troubleshooting.md).
- For a security or privacy review, read [references/security.md](references/security.md) and run `scripts/privacy-scan.ps1` against the planned public or shared directory.
- For implementation changes, inspect `assets/codex-pocket/` and preserve the invariants below.

## Required invariants

1. Bind the Node server to `127.0.0.1` for remote mode. Publish it only through Tailscale Serve or another user-approved private overlay.
2. Never put the access token in source control, screenshots, documentation, chat messages, URLs shared with other people, analytics, or logs. Runtime secrets belong under `.data/`, which must remain ignored by Git.
3. Treat machine names, tailnet domains, usernames, absolute paths, task IDs, screenshots, and terminal output as private data.
4. Do not solve the desktop `active writer` error by opening a second App Server writer. Use the bundled local `codex-app-tools` pipe for desktop-owned task writes.
5. Keep the Codex desktop app and this bridge running while remote access is needed. Stop Tailscale Serve when the user no longer wants remote access.
6. Request user action only when interactive sign-in is required or an external publication/installation lacks prior authorization. Explain the exact step and continue all independent setup first.

## Completion criteria

Do not report success until all applicable checks pass:

- `npm run check` and `npm test` pass in the installed app.
- `/api/health` returns an OK response locally.
- the listener is loopback-only in remote mode.
- Tailscale reports the HTTPS Serve route and both devices use the same tailnet.
- a benign test message reaches the selected existing desktop task.
- the phone UI loads over HTTPS and can be installed as a PWA when requested.

Report the install directory, how to start and stop it, the private access method, and any remaining limitation. Redact secrets and private identifiers in the report.
