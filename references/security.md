# Security and privacy model

Codex Pocket is a personal control surface with access to task text, terminal output, file paths, and task controls. Protect it as an administrative interface.

## Default protections

- The service binds to loopback.
- Tailscale provides authenticated private-network reachability and HTTPS.
- A randomly generated application token protects API requests.
- Runtime state is stored under `.data/` and excluded from Git.
- Phone uploads are stored under `.data/uploads/`, never served as public static files, and are limited by count and size.
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
