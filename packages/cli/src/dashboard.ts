import http from "node:http";
import fsp from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readRecentEvents } from "./events.js";
import {
  claimApproval,
  getApprovalHistory,
  getPendingApprovals,
} from "@aigf/orchestrator";
import { approveTask } from "./approve.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DASHBOARD_DIST = path.join(__dirname, "../../dashboard/dist");

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
};

const sseClients = new Map<http.ServerResponse, string>();
const watchers = new Map<string, fs.FSWatcher>();

export async function startDashboard(port: number, defaultProject: string): Promise<void> {
  try {
    await fsp.access(path.join(DASHBOARD_DIST, "index.html"));
  } catch {
    console.error("看板未构建。请先运行: npm run build -w @aigf/dashboard");
    process.exit(1);
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);
    const project = url.searchParams.get("project") ?? defaultProject;

    if (url.pathname === "/api/run") {
      return sendJson(res, await readAigfFile(project, "last-run.json"));
    }
    if (url.pathname === "/api/plan") {
      return sendJson(res, await readAigfFile(project, "last-plan.json"));
    }
    if (url.pathname === "/api/events") {
      return sendJson(res, await readRecentEvents(project));
    }
    if (url.pathname === "/api/stream") {
      return handleSse(res, project);
    }
    if (url.pathname === "/api/approvals") {
      return sendJson(res, await getPendingApprovals(path.resolve(project)));
    }
    if (url.pathname === "/api/approval-history") {
      return sendJson(res, await getApprovalHistory(path.resolve(project), 30));
    }
    if (url.pathname === "/api/approve" && req.method === "POST") {
      return handleApprove(req, res, project);
    }
    if (url.pathname === "/api/claim" && req.method === "POST") {
      return handleClaim(req, res, project);
    }

    let filePath = url.pathname === "/"
      ? path.join(DASHBOARD_DIST, "index.html")
      : path.join(DASHBOARD_DIST, url.pathname);

    if (url.pathname.startsWith("/assets/")) {
      filePath = path.join(DASHBOARD_DIST, url.pathname);
    }

    try {
      const data = await fsp.readFile(filePath);
      const ext = path.extname(filePath);
      res.writeHead(200, { "Content-Type": MIME[ext] ?? "application/octet-stream" });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not Found");
    }
  });

  server.listen(port, () => {
    const link = `http://localhost:${port}?project=${encodeURIComponent(defaultProject)}`;
    console.log(`\n🎛️  AIGF 任务看板已启动（SSE 实时推送）`);
    console.log(`   ${link}\n`);
    setupWatcher(defaultProject);
  });
}

function handleSse(res: http.ServerResponse, project: string): void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  sseClients.set(res, project);

  void pushState(res, project);

  res.on("close", () => {
    sseClients.delete(res);
  });
}

async function pushState(res: http.ServerResponse, project: string): Promise<void> {
  const resolved = path.resolve(project);
  const payload = {
    run: await readAigfFile(project, "last-run.json"),
    plan: await readAigfFile(project, "last-plan.json"),
    events: await readRecentEvents(project),
    approvals: await getPendingApprovals(resolved),
    approvalHistory: await getApprovalHistory(resolved, 10),
  };
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

async function handleApprove(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  project: string,
): Promise<void> {
  const body = await readBody(req);
  try {
    const { taskId, action, reviewer, comment } = JSON.parse(body) as {
      taskId: string;
      action: "retry" | "skip" | "abort";
      reviewer?: string;
      comment?: string;
    };
    await approveTask(path.resolve(project), taskId, action ?? "retry", {
      reviewer,
      comment,
    });
    sendJson(res, { ok: true });
  } catch (e) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: String(e) }));
  }
}

async function handleClaim(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  project: string,
): Promise<void> {
  const body = await readBody(req);
  try {
    const { taskId, reviewer } = JSON.parse(body) as {
      taskId: string;
      reviewer: string;
    };
    await claimApproval(path.resolve(project), taskId, reviewer);
    sendJson(res, { ok: true });
  } catch (e) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: String(e) }));
  }
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

function setupWatcher(project: string): void {
  const resolved = path.resolve(project);
  const aigfDir = path.join(resolved, ".aigf");

  if (watchers.has(resolved)) return;

  try {
    const watcher = fs.watch(aigfDir, { recursive: true }, () => {
      for (const [client, clientProject] of sseClients) {
        void pushState(client, clientProject);
      }
    });
    watchers.set(resolved, watcher);
  } catch {
    fs.mkdirSync(aigfDir, { recursive: true });
    setupWatcher(project);
  }
}

async function readAigfFile(project: string, filename: string): Promise<unknown> {
  try {
    const raw = await fsp.readFile(
      path.join(path.resolve(project), ".aigf", filename),
      "utf-8",
    );
    return JSON.parse(raw);
  } catch {
    return filename === "last-plan.json" ? null : [];
  }
}

function sendJson(res: http.ServerResponse, data: unknown): void {
  res.writeHead(200, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(data));
}
