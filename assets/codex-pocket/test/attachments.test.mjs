import test from "node:test";
import assert from "node:assert/strict";
import { buildDesktopPrompt, decodeAttachments, extractReturnedFiles } from "../src/attachments.mjs";
import { buildUserInput } from "../src/app-server-client.mjs";

test("decodes a mobile upload and sanitizes its name", () => {
  const [file] = decodeAttachments([{ name: "../photo?.png", type: "image/png", data: Buffer.from("image").toString("base64") }]);
  assert.equal(file.originalName, "photo_.png");
  assert.equal(file.type, "image/png");
  assert.equal(file.buffer.toString(), "image");
});

test("builds native image and file inputs for the App Server", () => {
  const input = buildUserInput("看看这些", [
    { name: "photo.png", path: "C:\\uploads\\photo.png", isImage: true },
    { name: "notes.pdf", path: "C:\\uploads\\notes.pdf", isImage: false },
  ]);
  assert.deepEqual(input, [
    { type: "text", text: "看看这些" },
    { type: "localImage", path: "C:\\uploads\\photo.png" },
    { type: "mention", name: "notes.pdf", path: "C:\\uploads\\notes.pdf" },
  ]);
});

test("desktop prompt preserves the attachment paths and user request marker", () => {
  const prompt = buildDesktopPrompt("按图片修改页面", [{ name: "参考图.png", path: "C:\\uploads\\参考图.png" }]);
  assert.match(prompt, /# Files mentioned by the user:/);
  assert.match(prompt, /## 参考图\.png: C:\\uploads\\参考图\.png/);
  assert.match(prompt, /## My request:\n\n按图片修改页面/);
});

test("extracts only local files explicitly linked by a Codex response", () => {
  const files = extractReturnedFiles([
    "已生成 [报告](<C:\\Users\\demo\\My Report.pdf>)。",
    "预览：![图片](D:/output/结果图.png)",
    "资料：[网页](https://example.com/file.pdf)",
    "站内页：[设置](/settings/profile)",
  ].join("\n"));
  assert.deepEqual(files, [
    { name: "报告", path: "C:\\Users\\demo\\My Report.pdf" },
    { name: "图片", path: "D:\\output\\结果图.png" },
  ]);
});
