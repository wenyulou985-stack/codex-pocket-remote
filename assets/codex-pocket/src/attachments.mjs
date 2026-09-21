import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

export const MAX_ATTACHMENT_COUNT = 5;
export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
export const MAX_TOTAL_ATTACHMENT_BYTES = 25 * 1024 * 1024;
export const MAX_MESSAGE_BODY_BYTES = 36 * 1024 * 1024;

const NATIVE_IMAGE_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function decodeAttachments(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw userError("附件格式不正确。");
  if (value.length > MAX_ATTACHMENT_COUNT) throw userError(`一次最多发送 ${MAX_ATTACHMENT_COUNT} 个附件。`);

  let totalBytes = 0;
  return value.map((item, index) => {
    const originalName = sanitizeFileName(item?.name, index);
    const type = sanitizeMimeType(item?.type);
    const encoded = String(item?.data || "");
    if (!encoded || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw userError(`${originalName} 的内容无效。`);
    const buffer = Buffer.from(encoded, "base64");
    if (!buffer.length) throw userError(`${originalName} 是空文件。`);
    if (buffer.length > MAX_ATTACHMENT_BYTES) throw userError(`${originalName} 超过 15 MB。`);
    totalBytes += buffer.length;
    if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) throw userError("附件总大小不能超过 25 MB。");
    return { originalName, type, buffer };
  });
}

export async function saveAttachments({ attachments, dataDir, threadId }) {
  if (!attachments.length) return [];
  const threadFolder = safeSegment(threadId);
  const uploadDir = join(dataDir, "uploads", threadFolder);
  await mkdir(uploadDir, { recursive: true });

  const saved = [];
  for (const attachment of attachments) {
    const storedName = `${Date.now()}-${randomBytes(4).toString("hex")}-${attachment.originalName}`;
    const path = join(uploadDir, storedName);
    await writeFile(path, attachment.buffer, { mode: 0o600 });
    saved.push({
      name: attachment.originalName,
      type: attachment.type,
      size: attachment.buffer.length,
      path,
      isImage: NATIVE_IMAGE_TYPES.has(attachment.type),
    });
  }
  return saved;
}

export function buildDesktopPrompt(text, attachments) {
  if (!attachments.length) return text;
  const files = attachments.map((file) => `## ${file.name}: ${file.path}`).join("\n\n");
  const request = text || "请查看并处理我发送的附件。";
  return `# Files mentioned by the user:\n\n${files}\n\n## My request:\n\n${request}`;
}

function sanitizeFileName(value, index) {
  const leaf = basename(String(value || `attachment-${index + 1}`)).replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").trim();
  const compact = leaf.replace(/\s+/g, " ").slice(-180);
  return compact && compact !== "." && compact !== ".." ? compact : `attachment-${index + 1}`;
}

function sanitizeMimeType(value) {
  const type = String(value || "application/octet-stream").toLowerCase().trim();
  return /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/.test(type)
    ? type
    : "application/octet-stream";
}

function safeSegment(value) {
  return String(value || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120) || "unknown";
}

function userError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}
