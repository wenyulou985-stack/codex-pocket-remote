import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareProjectDirectory } from "../src/projects.mjs";

test("creates a named project folder inside an existing parent", async (t) => {
  const parent = await mkdtemp(join(tmpdir(), "codex-pocket-project-"));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const created = await prepareProjectDirectory({ cwd: parent, createProject: true, projectName: "New project" });
  assert.equal((await stat(created)).isDirectory(), true);
  assert.equal(created, join(parent, "New project"));
});

test("rejects unsafe or duplicate project folder names", async (t) => {
  const parent = await mkdtemp(join(tmpdir(), "codex-pocket-project-"));
  t.after(() => rm(parent, { recursive: true, force: true }));
  await assert.rejects(() => prepareProjectDirectory({ cwd: parent, createProject: true, projectName: "..\\escape" }), /不允许/);
  await prepareProjectDirectory({ cwd: parent, createProject: true, projectName: "Existing" });
  await assert.rejects(() => prepareProjectDirectory({ cwd: parent, createProject: true, projectName: "Existing" }), /已经存在/);
});

test("increments the default New project name when it already exists", async (t) => {
  const parent = await mkdtemp(join(tmpdir(), "codex-pocket-project-"));
  t.after(() => rm(parent, { recursive: true, force: true }));
  await prepareProjectDirectory({ cwd: parent, createProject: true, projectName: "New project" });
  const second = await prepareProjectDirectory({ cwd: parent, createProject: true, projectName: "New project" });
  assert.equal(second, join(parent, "New project 2"));
});
