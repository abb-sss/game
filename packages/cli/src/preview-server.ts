import { spawn, type ChildProcess } from "node:child_process";
import fsp from "node:fs/promises";
import http from "node:http";
import path from "node:path";

export interface PreviewStatus {
  ready: boolean;
  needBuild: boolean;
  url: string | null;
  port: number | null;
  projectRoot: string;
}

interface PreviewEntry {
  process: ChildProcess;
  port: number;
}

const previewServers = new Map<string, PreviewEntry>();
const DEFAULT_PORT = 4173;
const usedPorts = new Set<number>();

async function findFreePort(start: number): Promise<number> {
  for (let port = start; port < start + 30; port++) {
    if (usedPorts.has(port)) continue;

    const free = await new Promise<boolean>((resolve) => {
      const probe = http.createServer();
      probe.once("error", () => resolve(false));
      probe.listen(port, "127.0.0.1", () => {
        probe.close(() => resolve(true));
      });
    });

    if (free) return port;
  }
  return start;
}

function runCommand(cmd: string, args: string[], cwd: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}

async function distReady(projectRoot: string): Promise<boolean> {
  try {
    await fsp.access(path.join(projectRoot, "dist", "index.html"));
    return true;
  } catch {
    return false;
  }
}

async function waitForPort(port: number, timeoutMs = 30_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await new Promise<boolean>((resolve) => {
      const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
        res.resume();
        resolve(res.statusCode !== undefined && res.statusCode < 500);
      });
      req.on("error", () => resolve(false));
      req.setTimeout(2000, () => {
        req.destroy();
        resolve(false);
      });
    });
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

export async function buildPreview(projectRoot: string): Promise<boolean> {
  return (await runCommand("npm", ["run", "build"], projectRoot)) === 0;
}

export async function getPreviewStatus(projectRoot: string): Promise<PreviewStatus> {
  const resolved = path.resolve(projectRoot);
  const built = await distReady(resolved);
  const entry = previewServers.get(resolved);

  return {
    ready: Boolean(entry && built),
    needBuild: !built,
    url: entry ? `http://127.0.0.1:${entry.port}` : null,
    port: entry?.port ?? null,
    projectRoot: resolved,
  };
}

export async function startPreviewServer(
  projectRoot: string,
  preferredPort = DEFAULT_PORT,
): Promise<PreviewStatus> {
  const resolved = path.resolve(projectRoot);

  if (!(await distReady(resolved))) {
    return {
      ready: false,
      needBuild: true,
      url: null,
      port: null,
      projectRoot: resolved,
    };
  }

  const existing = previewServers.get(resolved);
  if (existing) {
    return {
      ready: true,
      needBuild: false,
      url: `http://127.0.0.1:${existing.port}`,
      port: existing.port,
      projectRoot: resolved,
    };
  }

  const port = await findFreePort(preferredPort);
  usedPorts.add(port);

  const child = spawn(
    "npm",
    ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(port)],
    {
      cwd: resolved,
      stdio: "ignore",
      shell: process.platform === "win32",
      detached: false,
    },
  );

  child.on("exit", () => {
    previewServers.delete(resolved);
    usedPorts.delete(port);
  });

  previewServers.set(resolved, { process: child, port });

  const up = await waitForPort(port);
  if (!up) {
    child.kill();
    previewServers.delete(resolved);
    return {
      ready: false,
      needBuild: false,
      url: null,
      port: null,
      projectRoot: resolved,
    };
  }

  return {
    ready: true,
    needBuild: false,
    url: `http://127.0.0.1:${port}`,
    port,
    projectRoot: resolved,
  };
}

export function stopPreviewServer(projectRoot: string): void {
  const resolved = path.resolve(projectRoot);
  const entry = previewServers.get(resolved);
  if (entry) {
    entry.process.kill();
    previewServers.delete(resolved);
    usedPorts.delete(entry.port);
  }
}

export function stopAllPreviewServers(): void {
  for (const [, entry] of previewServers) {
    entry.process.kill();
    usedPorts.delete(entry.port);
  }
  previewServers.clear();
}
