import { EventEmitter } from "node:events";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const ALL_THREAD_SOURCES = [
  "cli",
  "vscode",
  "exec",
  "appServer",
  "subAgent",
  "subAgentReview",
  "subAgentCompact",
  "subAgentThreadSpawn",
  "subAgentOther",
  "unknown",
];

export class AppServerClient extends EventEmitter {
  constructor({ mode = "direct", command = "codex" } = {}) {
    super();
    this.mode = mode;
    this.command = command;
    this.child = null;
    this.readyPromise = null;
    this.nextId = 1;
    this.pending = new Map();
    this.approvals = new Map();
    this.ownedThreadIds = new Set();
    this.lastError = null;
    this.stderrTail = [];
  }

  async ready() {
    if (this.child && !this.child.killed && this.readyPromise) return this.readyPromise;
    this.readyPromise = this.#start();
    return this.readyPromise;
  }

  async #start() {
    const args = this.mode === "proxy"
      ? ["app-server", "proxy"]
      : ["app-server", "--stdio"];

    const child = spawn(this.command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      env: process.env,
    });
    this.child = child;

    const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
    lines.on("line", (line) => this.#handleLine(line));

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      this.stderrTail.push(chunk.trim());
      this.stderrTail = this.stderrTail.filter(Boolean).slice(-10);
      this.emit("diagnostic", chunk.trim());
    });

    child.on("error", (error) => this.#handleExit(error));
    child.on("exit", (code, signal) => {
      const detail = this.stderrTail.at(-1) || `Codex App Server exited (${code ?? signal}).`;
      this.#handleExit(new Error(detail));
    });

    await this.request("initialize", {
      clientInfo: {
        name: "codex_pocket",
        title: "Codex Pocket",
        version: "0.1.0",
      },
      capabilities: {
        experimentalApi: true,
      },
    });
    this.notify("initialized", {});
    this.lastError = null;
    return true;
  }

  #handleExit(error) {
    if (!this.child && !this.readyPromise) return;
    this.lastError = error;
    this.child = null;
    this.readyPromise = null;
    for (const { reject, timer } of this.pending.values()) {
      clearTimeout(timer);
      reject(error);
    }
    this.pending.clear();
    this.emit("offline", error);
  }

  #handleLine(line) {
    if (!line.trim()) return;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      this.emit("diagnostic", `Ignored non-JSON output: ${line.slice(0, 200)}`);
      return;
    }

    if (message.id !== undefined && (message.result !== undefined || message.error !== undefined)) {
      const entry = this.pending.get(message.id);
      if (!entry) return;
      clearTimeout(entry.timer);
      this.pending.delete(message.id);
      if (message.error) {
        entry.reject(new Error(message.error.message || JSON.stringify(message.error)));
      } else {
        entry.resolve(message.result);
      }
      return;
    }

    if (message.id !== undefined && message.method) {
      const key = String(message.id);
      this.approvals.set(key, {
        requestId: key,
        method: message.method,
        params: message.params || {},
        receivedAt: Date.now(),
      });
      this.emit("approval", this.approvals.get(key));
      return;
    }

    if (message.method) this.emit("notification", message);
  }

  async request(method, params = {}, timeoutMs = 20_000) {
    if (method !== "initialize") await this.ready();
    if (!this.child?.stdin?.writable) throw new Error("Codex App Server is offline.");

    const id = this.nextId++;
    const message = { method, id, params };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out after ${timeoutMs}ms.`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(`${JSON.stringify(message)}\n`);
    });
  }

  notify(method, params = {}) {
    if (!this.child?.stdin?.writable) return;
    this.child.stdin.write(`${JSON.stringify({ method, params })}\n`);
  }

  async listThreads(limit = 40) {
    const result = await this.request("thread/list", {
      cursor: null,
      limit,
      sortKey: "recency_at",
      sortDirection: "desc",
      sourceKinds: ALL_THREAD_SOURCES,
      archived: false,
    });
    return result?.data || [];
  }

  async readThread(threadId) {
    let lastError;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        const result = await this.request("thread/read", { threadId, includeTurns: true });
        return result?.thread;
      } catch (error) {
        lastError = error;
        if (!/rollout.*empty|failed to read session metadata/i.test(error.message) || attempt === 5) throw error;
        await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
      }
    }
    throw lastError;
  }

  async startThread(cwd, text) {
    const started = await this.request("thread/start", {
      cwd,
      approvalPolicy: "on-request",
      sandbox: "workspace-write",
      threadSource: "appServer",
    }, 30_000);
    const threadId = started?.thread?.id;
    if (!threadId) throw new Error("Codex did not return a new task id.");
    this.ownedThreadIds.add(threadId);
    const turn = await this.request("turn/start", {
      threadId,
      input: [{ type: "text", text }],
    }, 30_000);
    return { threadId, turnId: turn?.turn?.id || null };
  }

  ownsThread(threadId) {
    return this.ownedThreadIds.has(threadId);
  }

  async sendMessage(threadId, text) {
    const thread = await this.readThread(threadId);
    const activeTurn = findActiveTurn(thread);
    if (thread?.status?.type === "active" && activeTurn?.id) {
      await this.request("turn/steer", {
        threadId,
        expectedTurnId: activeTurn.id,
        input: [{ type: "text", text }],
      });
      return { mode: "steer", turnId: activeTurn.id };
    }

    await this.request("thread/resume", { threadId });
    this.ownedThreadIds.add(threadId);
    const result = await this.request("turn/start", {
      threadId,
      input: [{ type: "text", text }],
    }, 30_000);
    return { mode: "start", turnId: result?.turn?.id || null };
  }

  async interrupt(threadId) {
    const thread = await this.readThread(threadId);
    const activeTurn = findActiveTurn(thread);
    if (!activeTurn?.id) throw new Error("This task has no active turn to interrupt.");
    await this.request("turn/interrupt", { threadId, turnId: activeTurn.id });
    return { turnId: activeTurn.id };
  }

  async archiveThread(threadId) {
    await this.request("thread/archive", { threadId });
    this.ownedThreadIds.delete(threadId);
    return { threadId };
  }

  listApprovals(threadId) {
    return [...this.approvals.values()]
      .filter((item) => !threadId || item.params?.threadId === threadId)
      .map(sanitizeApproval);
  }

  resolveApproval(requestId, decision) {
    const pending = this.approvals.get(String(requestId));
    if (!pending) throw new Error("The approval request is no longer pending.");
    if (!isSupportedApproval(pending.method)) {
      throw new Error(`Unsupported approval type: ${pending.method}`);
    }
    if (!["accept", "acceptForSession", "decline", "cancel"].includes(decision)) {
      throw new Error("Invalid approval decision.");
    }
    this.child.stdin.write(`${JSON.stringify({ id: Number(requestId), result: { decision } })}\n`);
    this.approvals.delete(String(requestId));
    return { requestId: String(requestId), decision };
  }

  status() {
    return {
      online: Boolean(this.child && !this.child.killed),
      mode: this.mode,
      error: this.lastError?.message || null,
      diagnostic: this.stderrTail.at(-1) || null,
      pendingApprovals: this.approvals.size,
    };
  }

  close() {
    if (this.child && !this.child.killed) this.child.kill();
    this.child = null;
    this.readyPromise = null;
  }
}

function findActiveTurn(thread) {
  return [...(thread?.turns || [])].reverse().find((turn) =>
    ["inProgress", "in_progress", "running"].includes(turn?.status)
  );
}

function isSupportedApproval(method) {
  return method === "item/commandExecution/requestApproval" ||
    method === "item/fileChange/requestApproval";
}

function sanitizeApproval(item) {
  const params = item.params || {};
  return {
    requestId: item.requestId,
    method: item.method,
    threadId: params.threadId || null,
    turnId: params.turnId || null,
    reason: params.reason || null,
    command: params.command || null,
    cwd: params.cwd || null,
    receivedAt: item.receivedAt,
    supported: isSupportedApproval(item.method),
  };
}
