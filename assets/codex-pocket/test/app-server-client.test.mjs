import test from "node:test";
import assert from "node:assert/strict";
import { AppServerClient } from "../src/app-server-client.mjs";

test("connects to the local Codex App Server and lists stored threads", { timeout: 30_000 }, async (t) => {
  const client = new AppServerClient();
  t.after(() => client.close());

  const threads = await client.listThreads(5);
  assert.ok(Array.isArray(threads));
  for (const thread of threads) {
    assert.equal(typeof thread.id, "string");
    assert.ok(thread.id.length > 0);
  }
});

test("starts a Pocket-owned thread with initial attachments", async () => {
  const client = new AppServerClient();
  const calls = [];
  client.request = async (method, params) => {
    calls.push({ method, params });
    if (method === "thread/start") return { thread: { id: "thread-1" } };
    if (method === "turn/start") return { turn: { id: "turn-1" } };
    throw new Error(`Unexpected method: ${method}`);
  };

  const result = await client.startThread("D:\\project", "review this", [
    { name: "brief.pdf", path: "D:\\uploads\\brief.pdf", isImage: false },
  ]);

  assert.deepEqual(result, { threadId: "thread-1", turnId: "turn-1" });
  assert.equal(client.ownsThread("thread-1"), true);
  assert.deepEqual(calls.map((call) => call.method), ["thread/start", "turn/start"]);
  assert.equal(calls[0].params.approvalPolicy, "on-request");
  assert.equal(calls[0].params.sandbox, "workspace-write");
  assert.deepEqual(calls[1].params.input, [
    { type: "text", text: "review this" },
    { type: "mention", name: "brief.pdf", path: "D:\\uploads\\brief.pdf" },
  ]);
});
