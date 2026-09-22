import { mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

export async function prepareProjectDirectory({ cwd, createProject = false, projectName = "" }) {
  const base = resolve(String(cwd || "").trim());
  const info = await stat(base).catch(() => null);
  if (!info?.isDirectory()) throw userError(createProject ? "父目录不存在，或不是文件夹。" : "项目目录不存在，或不是文件夹。");
  if (!createProject) return base;

  const name = String(projectName || "").trim();
  if (!name) throw userError("请输入新项目文件夹名称。");
  if (name.length > 100) throw userError("项目文件夹名称不能超过 100 个字符。");
  if (/[<>:"/\\|?*\u0000-\u001F]/.test(name) || name === "." || name === ".." || /[. ]$/.test(name) || WINDOWS_RESERVED.test(name)) {
    throw userError("项目文件夹名称包含 Windows 不允许的字符或名称。");
  }

  for (let suffix = 1; suffix <= 100; suffix += 1) {
    const candidate = suffix === 1 ? name : `${name} ${suffix}`;
    const target = resolve(base, candidate);
    if (dirname(target).toLowerCase() !== base.toLowerCase()) throw userError("新项目文件夹必须位于所选父目录中。");
    try {
      await mkdir(target, { recursive: false });
      return target;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      if (name.toLowerCase() !== "new project") throw userError("同名项目文件夹已经存在，请换一个名称。");
    }
  }
  throw userError("New project 文件夹过多，请自定义一个名称。");
}

function userError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}
