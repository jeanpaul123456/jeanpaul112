import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, mkdirSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
const root = resolve(import.meta.dirname, "..");
mkdirSync(join(root, ".tmp"), { recursive: true });
const directory = mkdtempSync(join(root, ".tmp", "browser-test-"));
const databasePath = join(directory, "test.db");
const database = new DatabaseSync(databasePath);
database.exec(readFileSync(join(root, "backend/prisma/schema.sql"), "utf8"));
database.close();
process.env.DATABASE_URL = `file:${databasePath.replaceAll("\\", "/")}`;
process.env.PORT = "3101";
process.chdir(join(root, "backend"));
const seed = spawnSync(
  process.execPath,
  ["node_modules/tsx/dist/cli.mjs", "prisma/seed.mjs"],
  { stdio: "inherit", env: process.env, windowsHide: true },
);
if (seed.status !== 0)
  throw new Error("Could not seed the isolated browser-test database.");
await import("../backend/dist/main.js");
