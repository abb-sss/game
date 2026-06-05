/**
 * 从 LLM 响应中解析代码文件。
 * 支持两种格式：
 * 1. JSON: { "files": [{ "path": "...", "content": "..." }] }
 * 2. Markdown 代码块: ```typescript:path/to/file.ts
 */

export interface ParsedCodeFile {
  path: string;
  content: string;
}

export function parseCodeOutput(raw: string): ParsedCodeFile[] {
  const trimmed = raw.trim();

  if (trimmed.startsWith("{")) {
    try {
      const json = JSON.parse(trimmed) as {
        files?: ParsedCodeFile[];
      };
      if (Array.isArray(json.files) && json.files.length > 0) {
        return json.files.filter((f) => f.path && f.content !== undefined);
      }
    } catch {
      // fallback to markdown parsing
    }
  }

  return parseMarkdownCodeBlocks(raw);
}

function parseMarkdownCodeBlocks(raw: string): ParsedCodeFile[] {
  const files: ParsedCodeFile[] = [];
  const regex = /```(\w+)?(?::([^\n]+))?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(raw)) !== null) {
    const filePath = match[2]?.trim();
    const content = match[3]?.replace(/\n$/, "") ?? "";
    if (filePath && content) {
      files.push({ path: filePath, content });
    }
  }

  return files;
}
