#!/usr/bin/env node
/**
 * @deprecated 请使用: aigf deploy gh-pages --project <路径>
 * 保留此脚本仅为向后兼容。
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const project = process.argv[2] ?? "templates/phaser-2d";
const cli = path.join(root, "packages", "cli", "dist", "index.js");

const result = spawnSync(
  process.execPath,
  [cli, "deploy", "gh-pages", "--project", project],
  { stdio: "inherit", cwd: root },
);

process.exit(result.status ?? 1);
