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

## Page is stale after an update

The PWA service worker may cache the old shell. Close all installed-app and browser instances, reopen the page, and reload once. If needed, clear site data for the private hostname and enter the token again.

## Tailscale Serve authorization page repeats

Finish the Serve approval in the same tailnet account used by the computer. Then rerun `npm run remote:setup`. Avoid repeated rapid registration attempts because authentication endpoints may be rate-limited.
