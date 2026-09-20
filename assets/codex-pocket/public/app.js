const state = {
  token: "",
  threads: [],
  selectedId: null,
  poller: null,
  detailPoller: null,
  installPrompt: null,
  terminalDisclosure: new Map(),
  workDisclosure: new Map(),
};

const $ = (selector) => document.querySelector(selector);
const auth = $("#auth");
const app = $("#app");
const detail = $("#detail");

boot();

function boot() {
  registerAppInstall();
  const params = new URLSearchParams(location.search);
  const urlToken = params.get("token");
  if (urlToken) {
    localStorage.setItem("codex-pocket-token", urlToken);
    history.replaceState({}, "", location.pathname);
  }
  state.token = urlToken || localStorage.getItem("codex-pocket-token") || "";
  bindEvents();
  if (!state.token) return showAuth();
  connect();
}

function registerAppInstall() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("/service-worker.js").catch(() => {}));
  }
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.installPrompt = event;
    $("#install-app").hidden = false;
  });
  window.addEventListener("appinstalled", () => {
    state.installPrompt = null;
    $("#install-app").hidden = true;
    toast("Codex Pocket 已安装");
  });
}

function bindEvents() {
  $("#install-app").addEventListener("click", installApp);
  $("#auth-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    state.token = $("#token-input").value.trim();
    localStorage.setItem("codex-pocket-token", state.token);
    await connect(true);
  });
  $("#refresh").addEventListener("click", loadThreads);
  $("#new-task").addEventListener("click", openNewTask);
  $("#close-new-task").addEventListener("click", closeNewTask);
  $("#new-task-form").addEventListener("submit", createTask);
  $("#detail-refresh").addEventListener("click", loadDetail);
  $("#back").addEventListener("click", closeDetail);
  $("#interrupt").addEventListener("click", interruptTask);
  $("#message-form").addEventListener("submit", sendMessage);
  $("#message").addEventListener("input", autoGrow);
  window.addEventListener("popstate", () => state.selectedId ? closeDetail(false) : null);
}

async function installApp() {
  if (!state.installPrompt) return;
  const prompt = state.installPrompt;
  state.installPrompt = null;
  await prompt.prompt();
  await prompt.userChoice;
  $("#install-app").hidden = true;
}

async function connect(fromForm = false) {
  try {
    await api("/api/health");
    auth.hidden = true;
    app.hidden = false;
    $("#auth-error").textContent = "";
    await loadThreads();
    clearInterval(state.poller);
    state.poller = setInterval(loadThreads, 5000);
  } catch (error) {
    if (fromForm) $("#auth-error").textContent = error.message;
    showAuth();
  }
}

function showAuth() {
  auth.hidden = false;
  app.hidden = true;
  detail.hidden = true;
}

async function loadThreads() {
  try {
    const [health, data] = await Promise.all([api("/api/health"), api("/api/threads")]);
    state.threads = data.threads || [];
    renderRecentCwds();
    renderHealth(health);
    renderThreads();
  } catch (error) {
    renderOffline(error.message);
  }
}

function renderRecentCwds() {
  const paths = [...new Set(state.threads.map((thread) => thread.cwd).filter(Boolean))];
  $("#recent-cwds").replaceChildren(...paths.map((path) => {
    const option = document.createElement("option");
    option.value = path;
    return option;
  }));
}

function openNewTask() {
  const firstCwd = state.threads.find((thread) => thread.cwd)?.cwd || "";
  $("#task-cwd").value ||= firstCwd;
  $("#new-task-error").textContent = "";
  $("#new-task-dialog").hidden = false;
  document.body.style.overflow = "hidden";
  $("#task-prompt").focus();
}

function closeNewTask() {
  $("#new-task-dialog").hidden = true;
  document.body.style.overflow = state.selectedId ? "hidden" : "";
}

async function createTask(event) {
  event.preventDefault();
  const button = $("#create-task");
  const cwd = $("#task-cwd").value.trim();
  const text = $("#task-prompt").value.trim();
  button.disabled = true;
  $("#new-task-error").textContent = "";
  try {
    const result = await api("/api/threads", { method: "POST", body: JSON.stringify({ cwd, text }) });
    closeNewTask();
    $("#task-prompt").value = "";
    toast("Codex 已开始执行新任务");
    await loadThreads();
    await openDetail(result.threadId);
  } catch (error) {
    $("#new-task-error").textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

function renderHealth(health) {
  const connection = $("#connection");
  connection.className = `connection ${health.bridge.online ? "online" : "offline"}`;
  connection.querySelector("strong").textContent = health.bridge.online ? "电脑在线" : "Codex 离线";
  $("#running-count").textContent = state.threads.filter((thread) => thread.status === "running").length;
  $("#approval-count").textContent = health.bridge.pendingApprovals || 0;
  $("#last-sync").textContent = formatTime(health.now);
}

function renderOffline(message) {
  const connection = $("#connection");
  connection.className = "connection offline";
  connection.querySelector("strong").textContent = "连接断开";
  toast(message || "无法连接电脑");
}

function renderThreads() {
  const list = $("#task-list");
  const empty = $("#empty-state");
  empty.hidden = state.threads.length > 0;
  list.hidden = state.threads.length === 0;
  list.replaceChildren(...state.threads.map((thread) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "task-card";
    button.setAttribute("aria-label", `${thread.name}，${statusText(thread.status)}`);
    button.innerHTML = `<div><div class="task-title"></div><p class="task-preview"></p><div class="task-meta"><span class="status-dot ${escapeAttr(thread.status)}"></span><span class="task-status"></span><span>·</span><span class="task-time"></span></div></div><span class="task-arrow">›</span>`;
    button.querySelector(".task-title").textContent = thread.name;
    button.querySelector(".task-preview").textContent = thread.preview || thread.cwd || "暂无摘要";
    button.querySelector(".task-status").textContent = statusText(thread.status);
    button.querySelector(".task-time").textContent = relativeTime(thread.updatedAt);
    button.addEventListener("click", () => openDetail(thread.id));
    return button;
  }));
}

async function openDetail(threadId) {
  if (state.selectedId !== threadId) {
    state.terminalDisclosure.clear();
    state.workDisclosure.clear();
  }
  state.selectedId = threadId;
  detail.hidden = false;
  history.pushState({ threadId }, "");
  document.body.style.overflow = "hidden";
  $("#timeline").innerHTML = '<div class="skeleton tall"></div>';
  await loadDetail();
  clearInterval(state.detailPoller);
  state.detailPoller = setInterval(loadDetail, 3000);
}

function closeDetail(goBack = true) {
  state.selectedId = null;
  detail.hidden = true;
  document.body.style.overflow = "";
  clearInterval(state.detailPoller);
  if (goBack && history.state?.threadId) history.back();
}

async function loadDetail() {
  if (!state.selectedId) return;
  const id = encodeURIComponent(state.selectedId);
  try {
    const [data, git, approvalData] = await Promise.all([
      api(`/api/threads/${id}`),
      api(`/api/threads/${id}/git`),
      api(`/api/threads/${id}/approvals`),
    ]);
    renderDetail(data.thread);
    renderGit(git);
    renderApprovals(approvalData.approvals || []);
  } catch (error) {
    toast(error.message, error.code === "THREAD_ACTIVE_WRITER" ? 7200 : 2800);
  }
}

function renderDetail(thread) {
  $("#detail-title").textContent = thread.name;
  $("#detail-path").textContent = compactPath(thread.cwd || "Codex 任务");
  const badge = $("#detail-status");
  badge.className = `status-badge ${thread.status}`;
  badge.textContent = statusText(thread.status);
  $("#detail-updated").textContent = `更新于 ${formatTime(thread.updatedAt)}`;
  $("#interrupt").hidden = thread.status !== "running";
  renderTimeline(thread.items || []);
}

function renderTimeline(items) {
  const timeline = $("#timeline");
  const recent = items.filter((item) => item.text || item.command || item.output || item.changes?.length).slice(-100).reverse();
  const entries = groupTimelineEntries(recent).slice(0, 35);
  if (!entries.length) {
    timeline.innerHTML = '<div class="empty-state"><strong>还没有活动记录</strong><span>发送一条消息开始这个任务。</span></div>';
    return;
  }
  timeline.replaceChildren(...entries.map((entry) => entry.kind === "work" ? renderWorkGroup(entry) : renderConversationEvent(entry.item)));
}

function groupTimelineEntries(items) {
  const entries = [];
  const groups = new Map();
  for (const item of items) {
    const visibleMessage = item.role === "user" || (item.role === "assistant" && (!item.phase || item.phase === "final_answer"));
    if (visibleMessage) {
      entries.push({ kind: "message", item });
      continue;
    }
    const key = item.turnId || item.id;
    let group = groups.get(key);
    if (!group) {
      group = { kind: "work", id: key, items: [] };
      groups.set(key, group);
      entries.push(group);
    }
    group.items.unshift(item);
  }
  return entries;
}

function renderConversationEvent(item) {
    const node = document.createElement("article");
    node.className = `event ${item.role || item.type}`;
    const label = document.createElement("div");
    label.className = "event-label";
    label.innerHTML = `<span>${eventLabel(item)}</span><span>${escapeHtml(eventStatusText(item.status))}</span>`;
    const body = document.createElement("div");
    body.className = "event-body";
    body.textContent = item.text || item.command || fileChangeText(item.changes) || "活动更新";
    node.append(label, body);
    if (item.output) {
      const output = document.createElement("pre");
      output.className = "event-output";
      output.textContent = item.output;
      node.append(output);
    }
    return node;
}

function renderWorkGroup(group) {
  const node = document.createElement("article");
  node.className = "event work-event";
  const details = document.createElement("details");
  details.className = "work-details";
  details.open = state.workDisclosure.get(group.id) ?? false;

  const summary = document.createElement("summary");
  const heading = document.createElement("span");
  heading.className = "work-heading";
  const title = document.createElement("strong");
  title.textContent = "工作过程";
  const status = document.createElement("span");
  status.className = `work-status ${workGroupStatus(group.items)}`;
  status.textContent = workGroupStatus(group.items) === "running" ? "进行中" : workGroupStatus(group.items) === "error" ? "有失败" : "已完成";
  heading.append(title, status);
  const description = document.createElement("span");
  description.className = "work-summary";
  description.textContent = workGroupSummary(group.items);
  const toggle = document.createElement("span");
  toggle.className = "work-toggle";
  toggle.innerHTML = '<span class="when-closed">展开</span><span class="when-open">收起</span>';
  summary.append(heading, description, toggle);

  const content = document.createElement("div");
  content.className = "work-content";
  content.replaceChildren(...group.items.map(renderWorkItem));
  details.append(summary, content);
  details.addEventListener("toggle", () => state.workDisclosure.set(group.id, details.open));
  node.append(details);
  return node;
}

function renderWorkItem(item) {
  const wrapper = document.createElement("div");
  wrapper.className = `work-item ${item.type || "activity"}`;
  if (item.type === "commandExecution" || item.command || item.output) {
    wrapper.append(renderTerminalDisclosure(item));
    return wrapper;
  }
  const label = document.createElement("div");
  label.className = "work-item-label";
  label.textContent = item.role === "assistant" ? "进度" : eventLabel(item);
  const body = document.createElement("div");
  body.className = "event-body";
  body.textContent = item.text || fileChangeText(item.changes) || "活动更新";
  wrapper.append(label, body);
  return wrapper;
}

function workGroupStatus(items) {
  if (items.some(terminalNeedsAttention)) {
    return items.some((item) => /failed|error/i.test(String(item.status || "")) || (item.exitCode != null && Number(item.exitCode) !== 0)) ? "error" : "running";
  }
  return "completed";
}

function workGroupSummary(items) {
  const counts = [
    [items.filter((item) => item.type === "reasoning").length, "条分析"],
    [items.filter((item) => item.type === "commandExecution" || item.command || item.output).length, "个终端"],
    [items.filter((item) => item.type === "fileChange").length, "次文件改动"],
    [items.filter((item) => item.role === "assistant" && item.phase !== "final_answer").length, "条进度"],
  ].filter(([count]) => count).map(([count, label]) => `${count}${label}`);
  return counts.join(" · ") || `${items.length} 条活动`;
}

function renderTerminalDisclosure(item) {
  const details = document.createElement("details");
  details.className = "terminal-details";
  const remembered = state.terminalDisclosure.get(item.id);
  details.open = remembered ?? terminalNeedsAttention(item);

  const summary = document.createElement("summary");
  const heading = document.createElement("span");
  heading.className = "terminal-heading";
  const label = document.createElement("strong");
  label.textContent = "终端";
  const status = document.createElement("span");
  status.className = `terminal-status ${terminalStatusClass(item)}`;
  status.textContent = terminalStatusText(item);
  heading.append(label, status);

  const preview = document.createElement("code");
  preview.className = "terminal-preview";
  preview.textContent = terminalPreview(item);
  const toggle = document.createElement("span");
  toggle.className = "terminal-toggle";
  toggle.innerHTML = '<span class="when-closed">展开</span><span class="when-open">收起</span>';
  summary.append(heading, preview, toggle);

  const content = document.createElement("div");
  content.className = "terminal-content";
  if (item.command) {
    const command = document.createElement("code");
    command.className = "terminal-command";
    command.textContent = item.command;
    content.append(command);
  }
  if (item.output) {
    const output = document.createElement("pre");
    output.className = "event-output";
    output.textContent = item.output;
    content.append(output);
  }
  details.append(summary, content);
  details.addEventListener("toggle", () => state.terminalDisclosure.set(item.id, details.open));
  return details;
}

function terminalNeedsAttention(item) {
  const status = String(item.status || "").toLowerCase();
  return /running|progress|failed|error/.test(status) || (item.exitCode != null && Number(item.exitCode) !== 0);
}

function terminalPreview(item) {
  const firstLine = String(item.command || item.output || "查看终端输出").split(/\r?\n/).find((line) => line.trim()) || "查看终端输出";
  return firstLine.length > 120 ? `${firstLine.slice(0, 120)}…` : firstLine;
}

function terminalStatusText(item) {
  const status = String(item.status || "").toLowerCase();
  if (/running|progress/.test(status)) return "运行中";
  if (/failed|error/.test(status) || (item.exitCode != null && Number(item.exitCode) !== 0)) return "失败";
  if (/completed|complete|saved/.test(status) || (item.exitCode != null && Number(item.exitCode) === 0)) return "已完成";
  return item.status || "等待中";
}

function terminalStatusClass(item) {
  const text = terminalStatusText(item);
  return text === "运行中" ? "running" : text === "失败" ? "error" : "completed";
}

function renderGit(git) {
  $("#git-count").textContent = git.available ? `${git.changedCount} 个文件` : "不可用";
  const content = $("#git-content");
  content.replaceChildren();
  if (!git.available) {
    content.textContent = git.reason || "当前任务不是 Git 项目。";
    return;
  }
  const branch = document.createElement("p");
  branch.className = "muted";
  branch.textContent = `分支：${git.branch}`;
  content.append(branch);
  for (const file of git.files || []) {
    const line = document.createElement("div");
    line.className = "git-file";
    line.textContent = file;
    content.append(line);
  }
}

function renderApprovals(approvals) {
  const panel = $("#approval-panel");
  const list = $("#approval-list");
  panel.hidden = approvals.length === 0;
  list.replaceChildren(...approvals.map((approval) => {
    const item = document.createElement("div");
    item.className = "approval-item";
    const reason = document.createElement("p");
    reason.textContent = approval.reason || (approval.method.includes("fileChange") ? "Codex 请求修改文件" : "Codex 请求执行命令");
    const command = document.createElement("code");
    command.className = "approval-command";
    command.textContent = Array.isArray(approval.command) ? approval.command.join(" ") : approval.command || approval.cwd || "";
    const actions = document.createElement("div");
    actions.className = "approval-actions";
    if (approval.supported) {
      actions.append(approvalButton("允许", approval.requestId, "accept"), approvalButton("拒绝", approval.requestId, "decline"));
    } else {
      actions.textContent = "请在电脑端处理此类请求。";
    }
    item.append(reason, command, actions);
    return item;
  }));
}

function approvalButton(label, requestId, decision) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      await api(`/api/approvals/${encodeURIComponent(requestId)}`, { method: "POST", body: JSON.stringify({ decision }) });
      toast(decision === "accept" ? "已允许" : "已拒绝");
      await loadDetail();
    } catch (error) {
      toast(error.message);
      button.disabled = false;
    }
  });
  return button;
}

async function sendMessage(event) {
  event.preventDefault();
  const input = $("#message");
  const button = $("#send");
  const text = input.value.trim();
  if (!text || !state.selectedId) return;
  button.disabled = true;
  try {
    const result = await api(`/api/threads/${encodeURIComponent(state.selectedId)}/message`, { method: "POST", body: JSON.stringify({ text }) });
    input.value = "";
    autoGrow({ target: input });
    toast(result.mode === "desktop-app" ? "新要求已发送到电脑端任务" : result.mode === "steer" ? "新要求已加入当前执行" : "Codex 已开始处理");
    setTimeout(loadDetail, 700);
  } catch (error) {
    toast(error.message);
  } finally {
    button.disabled = false;
  }
}

async function interruptTask() {
  const button = $("#interrupt");
  button.disabled = true;
  try {
    const result = await api(`/api/threads/${encodeURIComponent(state.selectedId)}/interrupt`, { method: "POST", body: "{}" });
    toast(result.mode === "desktop-app" ? "已向电脑端任务发送暂停要求" : "已请求中断当前执行");
    setTimeout(loadDetail, 500);
  } catch (error) {
    toast(error.message);
  } finally {
    button.disabled = false;
  }
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Authorization": `Bearer ${state.token}`, "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    localStorage.removeItem("codex-pocket-token");
    throw new Error("访问令牌无效，请重新输入。");
  }
  if (!response.ok) {
    const error = new Error(data.error || `请求失败 (${response.status})`);
    error.code = data.code || null;
    throw error;
  }
  return data;
}

function autoGrow(event) {
  const input = event.target;
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
}

let toastTimer;
function toast(message, duration = 2800) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove("show"), duration);
}

function statusText(status) {
  return ({ running: "正在运行", idle: "等待新指令", error: "出现错误", saved: "已保存" })[status] || "未知状态";
}

function eventLabel(item) {
  if (item.role === "assistant") return "Codex";
  if (item.role === "user") return "你";
  if (item.type === "commandExecution") return "终端";
  if (item.type === "fileChange") return "文件改动";
  if (item.type === "reasoning") return "分析";
  return "活动";
}

function eventStatusText(status) {
  const value = String(status || "").toLowerCase();
  if (/running|progress/.test(value)) return "进行中";
  if (/completed|complete|saved/.test(value)) return "已完成";
  if (/interrupted|cancelled|canceled/.test(value)) return "已中断";
  if (/failed|error/.test(value)) return "失败";
  return status || "";
}

function fileChangeText(changes) {
  if (!Array.isArray(changes)) return "";
  return changes.map((change) => change.path || change.file || JSON.stringify(change)).join("\n");
}

function relativeTime(value) {
  if (!value) return "未知时间";
  const seconds = Math.max(0, Math.round((Date.now() - value) / 1000));
  if (seconds < 60) return "刚刚";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时前`;
  return `${Math.floor(seconds / 86400)} 天前`;
}

function formatTime(value) {
  if (!value) return "未知";
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(value));
}

function compactPath(value) {
  const parts = String(value).split(/[\\/]/).filter(Boolean);
  return parts.length > 2 ? `…/${parts.slice(-2).join("/")}` : value;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function escapeAttr(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "");
}
