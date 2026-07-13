import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { applySchema } from "./schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");

export function resolveDbPath() {
  const configured = process.env.PERSONA_DB_PATH || "./data/persona-universe.sqlite";
  return path.isAbsolute(configured) ? configured : path.resolve(projectRoot, configured);
}

export function openDatabase() {
  const dbPath = resolveDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  applySchema(db);
  try {
    fs.chmodSync(dbPath, 0o600);
  } catch {
    // Some filesystems do not expose POSIX permissions.
  }
  return db;
}
