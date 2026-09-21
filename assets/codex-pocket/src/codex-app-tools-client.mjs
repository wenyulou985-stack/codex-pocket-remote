import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";

const PIPE_PREFIX = "codex-browser-use-";

export class CodexAppToolsClient {
  constructor({ requestTimeoutMs = 8_000 } = {}) {
    this.requestTimeoutMs = requestTimeoutMs;
    this.lastSuccessAt = null;
    this.lastError = null;
    this.lastPipe = null;
  }

  async sendMessage(threadId, text, hostId = "local") {
    const errors = [];
    for (const pipePath of await findPipeCandidates(this.lastPipe)) {
      try {
        const result = await this.#call(pipePath, "send_message_to_thread", {
          threadId,
          hostId,
          prompt: text,
        }, threadId);
        this.lastPipe = pipePath;
        this.lastSuccessAt = Date.now();
        this.lastError = null;
        return { mode: "desktop-app", threadId, result };
      } catch (error) {
        errors.push(error.message);
      }
    }
    const error = new Error(errors.at(-1) || "未找到正在运行的 Codex 桌面应用连接。");
    this.lastError = error.message;
    throw error;
  }

  status() {
    return {
      available: Boolean(this.lastSuccessAt),
      lastSuccessAt: this.lastSuccessAt,
      error: this.lastError,
    };
  }

  async #call(pipePath, name, args, executorThreadId) {
    const pluginDir = await findPluginDir();
    const launcher = join(pluginDir, "scripts", "launch_codex_app_tools_mcp.cmd");
    const server = join(pluginDir, "server.mjs");
    const child = spawn("cmd.exe", ["/d", "/s", "/c", "call", launcher, server], {
      cwd: pluginDir,
      env: { ...process.env, CODEX_APP_TOOLS_PIPE_PATH: pipePath },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    const pending = new Map();
    const stderr = [];
    let nextId = 1;
    const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
    lines.on("line", (line) => {
      let message;
      try { message = JSON.parse(line); } catch { return; }
      const entry = pending.get(message.id);
      if (!entry) return;
      clearTimeout(entry.timer);
      pending.delete(message.id);
      if (message.error) entry.reject(new Error(message.error.message || JSON.stringify(message.error)));
      else entry.resolve(message.result);
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => stderr.push(chunk.trim()));

    const request = (method, params = {}) => {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(stderr.at(-1) || `${method} 请求桌面应用超时。`));
        }, this.requestTimeoutMs);
        pending.set(id, { resolve, reject, timer });
        child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
      });
    };

    try {
      await request("initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "codex-pocket", version: "0.2.0" },
      });
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
      const callId = `codex-pocket-${randomUUID()}`;
      const result = await request("tools/call", {
        name,
        arguments: args,
        _meta: {
          "openai/threadId": executorThreadId,
          "openai/turnId": callId,
          "openai/toolCallId": callId,
        },
      });
      if (result?.isError) {
        const detail = result.content?.map((item) => item.text).filter(Boolean).join("\n");
        throw new Error(detail || "Codex 桌面应用拒绝了该操作。");
      }
      return result;
    } finally {
      for (const entry of pending.values()) {
        clearTimeout(entry.timer);
        entry.reject(new Error("Codex 桌面应用连接已关闭。"));
      }
      pending.clear();
      child.kill();
    }
  }
}

async function findPluginDir() {
  const base = join(homedir(), ".codex", "plugins", "cache", "openai-bundled", "codex-app-tools");
  const entries = await readdir(base, { withFileTypes: true });
  const versions = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  if (!versions.length) throw new Error("未安装 Codex 桌面控制组件，请更新 Codex 应用。");
  return join(base, versions[0]);
}

async function findPipeCandidates(preferred) {
  const candidates = [preferred, process.env.CODEX_APP_TOOLS_PIPE_PATH].filter(Boolean);
  try {
    const names = await readdir("\\\\.\\pipe\\");
    for (const name of names) {
      if (name.startsWith(PIPE_PREFIX)) candidates.push(`\\\\.\\pipe\\${name}`);
    }
  } catch {}
  return [...new Set(candidates)];
}
