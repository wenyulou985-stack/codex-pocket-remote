import http from "node:http";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { AppServerClient } from "./app-server-client.mjs";
import { CodexAppToolsClient } from "./codex-app-tools-client.mjs";
import { buildDesktopPrompt, decodeAttachments, MAX_MESSAGE_BODY_BYTES, saveAttachments } from "./attachments.mjs";

const execFileAsync = promisify(execFile);
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(rootDir, "public");
const dataDir = join(rootDir, ".data");
const tokenPath = join(dataDir, "access-token");
const lanMode = process.argv.includes("--lan") || process.env.CODEX_POCKET_LAN === "1";
const host = process.env.CODEX_POCKET_HOST || (lanMode ? "0.0.0.0" : "127.0.0.1");
const port = Number(process.env.CODEX_POCKET_PORT || 4310);
const bridgeMode = process.env.CODEX_POCKET_BRIDGE || "direct";
const bridge = new AppServerClient({ mode: bridgeMode });
const desktopBridge = new CodexAppToolsClient();
const mutationBuckets = new Map();
const token = await getOrCreateToken();

bridge.on("diagnostic", (message) => {
  if (message) console.error(`[codex] ${message}`);
});

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      if (!authorized(request, url)) return json(response, 401, { error: "需要访问令牌。" });
      return await handleApi(request, response, url);
    }
    return await serveStatic(response, url.pathname);
  } catch (error) {
    console.error(error);
    return json(response, error.statusCode || 500, { error: friendlyError(error) });
  }
});

server.listen(port, host, async () => {
  const localUrl = `http://127.0.0.1:${port}/`;
  console.log(`\nCodex Pocket 已启动：${localUrl}`);
  if (lanMode) {
    const addresses = await findLanAddresses();
    for (const address of addresses) {
      console.log(`手机访问：http://${address}:${port}/`);
    }
    console.log("仅在可信局域网或私有 VPN 中使用以上地址。");
    console.log("请在电脑本地读取 .data/access-token，再在手机首次访问时输入。\n");
  }
  bridge.ready().catch((error) => console.error(`[codex] ${error.message}`));
});

async function handleApi(request, response, url) {
  const method = request.method || "GET";
  if (method !== "GET" && !allowMutation(request)) {
    return json(response, 429, { error: "操作太频繁，请稍后再试。" });
  }

  if (method === "GET" && url.pathname === "/api/health") {
    try {
      await bridge.ready();
    } catch {}
    return json(response, 200, {
      app: "Codex Pocket",
      now: Date.now(),
      bridge: bridge.status(),
      desktopControl: desktopBridge.status(),
    });
  }

  if (method === "GET" && url.pathname === "/api/threads") {
    const threads = await bridge.listThreads();
    return json(response, 200, { threads: threads.map(summarizeThread) });
  }

  if (method === "POST" && url.pathname === "/api/threads") {
    const body = await readJsonBody(request);
    const cwd = String(body.cwd || "").trim();
    const text = String(body.text || "").trim();
    if (!cwd || !text) return json(response, 400, { error: "项目目录和任务要求都不能为空。" });
    if (cwd.length > 1000 || text.length > 8000) return json(response, 400, { error: "项目目录或任务要求过长。" });
    const info = await stat(cwd).catch(() => null);
    if (!info?.isDirectory()) return json(response, 400, { error: "项目目录不存在，或不是文件夹。" });
    const result = await bridge.startThread(resolve(cwd), text);
    return json(response, 201, { created: true, ...result });
  }

  const threadMatch = url.pathname.match(/^\/api\/threads\/([^/]+)(?:\/(message|interrupt|git|approvals|archive))?$/);
  if (threadMatch) {
    const threadId = decodeURIComponent(threadMatch[1]);
    const action = threadMatch[2];

    if (method === "GET" && !action) {
      const thread = await bridge.readThread(threadId);
      return json(response, 200, { thread: normalizeThread(thread) });
    }
    if (method === "GET" && action === "git") {
      const thread = await bridge.readThread(threadId);
      return json(response, 200, await readGitState(thread?.cwd));
    }
    if (method === "GET" && action === "approvals") {
      return json(response, 200, { approvals: bridge.listApprovals(threadId) });
    }
    if (method === "POST" && action === "message") {
      const body = await readJsonBody(request, MAX_MESSAGE_BODY_BYTES);
      const text = String(body.text || "").trim();
      const incomingAttachments = decodeAttachments(body.attachments);
      if ((!text && !incomingAttachments.length) || text.length > 8000) {
        return json(response, 400, { error: "请输入消息或选择附件；文字最多 8000 字。" });
      }
      const savedAttachments = await saveAttachments({ attachments: incomingAttachments, dataDir, threadId });
      try {
        const result = bridge.ownsThread(threadId)
          ? await bridge.sendMessage(threadId, text, savedAttachments)
          : await sendToDesktopOrResume(threadId, text, savedAttachments);
        return json(response, 202, {
          accepted: true,
          attachments: savedAttachments.map(({ name, type, size }) => ({ name, type, size })),
          ...result,
        });
      } catch (error) {
        if (/already has an active writer/i.test(error.message)) {
          return json(response, 409, {
            code: "THREAD_ACTIVE_WRITER",
            error: "电脑端任务仍由旧连接占用，且桌面控制通道不可用。请保持 Codex 桌面应用打开后重试；你的消息尚未发送。",
          });
        }
        throw error;
      }
    }
    if (method === "POST" && action === "interrupt") {
      if (!bridge.ownsThread(threadId)) {
        const result = await desktopBridge.sendMessage(threadId, "请尽快暂停当前工作，停止继续修改，并等待我的下一步指示。");
        return json(response, 200, { interrupted: false, requested: true, ...result });
      }
      return json(response, 200, { interrupted: true, ...(await bridge.interrupt(threadId)) });
    }
    if (method === "POST" && action === "archive") {
      return json(response, 200, { archived: true, ...(await bridge.archiveThread(threadId)) });
    }
  }

  const approvalMatch = url.pathname.match(/^\/api\/approvals\/([^/]+)$/);
  if (approvalMatch && method === "POST") {
    const body = await readJsonBody(request);
    const result = bridge.resolveApproval(decodeURIComponent(approvalMatch[1]), body.decision);
    return json(response, 200, result);
  }

  return json(response, 404, { error: "接口不存在。" });
}

async function sendToDesktopOrResume(threadId, text, attachments = []) {
  try {
    return await desktopBridge.sendMessage(threadId, buildDesktopPrompt(text, attachments));
  } catch (desktopError) {
    try {
      return await bridge.sendMessage(threadId, text, attachments);
    } catch (directError) {
      if (/already has an active writer/i.test(directError.message)) {
        directError.message = `${directError.message}\n桌面控制通道：${desktopError.message}`;
      }
      throw directError;
    }
  }
}

function summarizeThread(thread) {
  return {
    id: thread.id,
    name: thread.name || thread.preview || "未命名任务",
    preview: thread.preview || "",
    cwd: thread.cwd || null,
    modelProvider: thread.modelProvider || null,
    createdAt: normalizeTimestamp(thread.createdAt),
    updatedAt: normalizeTimestamp(thread.updatedAt),
    status: normalizeStatus(thread.status),
    isPinned: Boolean(thread.isPinned),
  };
}

function normalizeThread(thread) {
  const turns = thread?.turns || [];
  const items = turns.flatMap((turn) => (turn.items || []).map((item, index) => normalizeItem(item, turn, index)));
  return {
    ...summarizeThread(thread || {}),
    gitInfo: thread?.gitInfo || null,
    items: items.slice(-120),
    activeTurnId: [...turns].reverse().find((turn) => ["inProgress", "in_progress", "running"].includes(turn.status))?.id || null,
  };
}

function normalizeItem(item, turn, index) {
  const base = {
    id: item.id || `${turn.id}-${index}`,
    turnId: turn.id,
    type: item.type || "unknown",
    status: item.status || turn.status || null,
  };
  if (item.type === "userMessage") return { ...base, role: "user", text: contentText(item.content) };
  if (item.type === "agentMessage") return { ...base, role: "assistant", text: item.text || "", phase: item.phase || null };
  if (item.type === "commandExecution") {
    return { ...base, command: item.command || "", cwd: item.cwd || null, output: truncate(item.aggregatedOutput || item.output || "", 12_000), exitCode: item.exitCode ?? null };
  }
  if (item.type === "fileChange") return { ...base, changes: item.changes || [], summary: item.summary || null };
  if (item.type === "reasoning") return { ...base, text: truncate(item.summary?.map?.((part) => part.text || part).join("\n") || item.text || "", 4000) };
  return { ...base, text: truncate(item.text || item.name || "", 3000) };
}

function contentText(content) {
  const text = !Array.isArray(content)
    ? String(content || "")
    : content.map((part) => part.text || part.url || "").filter(Boolean).join("\n");
  return cleanUserMessage(text);
}

function cleanUserMessage(text) {
  const requestMarker = "## My request:";
  const requestIndex = text.lastIndexOf(requestMarker);
  if (requestIndex >= 0) return text.slice(requestIndex + requestMarker.length).trim();
  const delegated = text.match(/<codex_delegation>[\s\S]*?<input>([\s\S]*?)<\/input>[\s\S]*?<\/codex_delegation>/i);
  if (delegated) return delegated[1].trim();
  return text.replace(/<in-app-browser-context\b[\s\S]*?<\/in-app-browser-context>/gi, "").trim();
}

function normalizeStatus(status) {
  const type = status?.type || "notLoaded";
  if (type === "active") return "running";
  if (type === "idle") return "idle";
  if (type === "systemError") return "error";
  return "saved";
}

function normalizeTimestamp(value) {
  if (!value) return null;
  return value < 10_000_000_000 ? value * 1000 : value;
}

async function readGitState(cwd) {
  if (!cwd || typeof cwd !== "string") return { available: false, reason: "任务没有工作目录。" };
  try {
    const info = await stat(cwd);
    if (!info.isDirectory()) throw new Error("工作目录不存在。");
    const [statusResult, diffResult, branchResult] = await Promise.all([
      execFileAsync("git", ["-C", cwd, "status", "--short"], { windowsHide: true, timeout: 8000 }),
      execFileAsync("git", ["-C", cwd, "diff", "--stat"], { windowsHide: true, timeout: 8000 }),
      execFileAsync("git", ["-C", cwd, "branch", "--show-current"], { windowsHide: true, timeout: 8000 }),
    ]);
    const files = statusResult.stdout.split(/\r?\n/).filter(Boolean).slice(0, 100);
    return {
      available: true,
      branch: branchResult.stdout.trim() || "detached",
      files,
      summary: diffResult.stdout.trim(),
      changedCount: files.length,
    };
  } catch (error) {
    return { available: false, reason: friendlyError(error) };
  }
}

async function serveStatic(response, pathname) {
  const decoded = decodeURIComponent(pathname === "/" ? "/index.html" : pathname);
  const relative = normalize(decoded).replace(/^([/\\])+/, "");
  const filePath = resolve(publicDir, relative);
  if (!filePath.startsWith(publicDir)) return text(response, 403, "Forbidden");
  try {
    const body = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mimeType(extname(filePath)),
      "Cache-Control": [".html", ".css", ".js"].includes(extname(filePath)) ? "no-cache" : "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'",
    });
    response.end(body);
  } catch {
    text(response, 404, "Not found");
  }
}

function authorized(request, url) {
  const supplied = request.headers.authorization?.replace(/^Bearer\s+/i, "") || url.searchParams.get("token") || "";
  const expectedHash = createHash("sha256").update(token).digest();
  const suppliedHash = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(expectedHash, suppliedHash);
}

function allowMutation(request) {
  const key = request.socket.remoteAddress || "unknown";
  const now = Date.now();
  const recent = (mutationBuckets.get(key) || []).filter((stamp) => now - stamp < 60_000);
  if (recent.length >= 30) return false;
  recent.push(now);
  mutationBuckets.set(key, recent);
  return true;
}

async function readJsonBody(request, maxBytes = 100_000) {
  let raw = "";
  let receivedBytes = 0;
  for await (const chunk of request) {
    receivedBytes += Buffer.byteLength(chunk);
    if (receivedBytes > maxBytes) {
      const error = new Error("请求内容过大。");
      error.statusCode = 413;
      throw error;
    }
    raw += chunk;
  }
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error("请求不是有效的 JSON。");
  }
}

async function getOrCreateToken() {
  await mkdir(dataDir, { recursive: true });
  try {
    const existing = (await readFile(tokenPath, "utf8")).trim();
    if (existing.length >= 32) return existing;
  } catch {}
  const created = randomBytes(24).toString("base64url");
  await writeFile(tokenPath, `${created}\n`, { encoding: "utf8", mode: 0o600 });
  return created;
}

async function findLanAddresses() {
  const { networkInterfaces } = await import("node:os");
  return Object.values(networkInterfaces()).flat().filter((item) => item?.family === "IPv4" && !item.internal).map((item) => item.address);
}

function json(response, status, value) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(value));
}

function text(response, status, value) {
  response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(value);
}

function mimeType(extension) {
  return ({ ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png" })[extension] || "application/octet-stream";
}

function truncate(value, max) {
  const textValue = typeof value === "string" ? value : JSON.stringify(value);
  return textValue.length > max ? `${textValue.slice(0, max)}\n…已截断` : textValue;
}

function friendlyError(error) {
  return error?.stderr?.trim?.() || error?.message || "未知错误";
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    bridge.close();
    server.close(() => process.exit(0));
  });
}
