import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { rmSync, existsSync } from "node:fs";

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error("TURSO_DATABASE_URL is not set.");
  process.exit(1);
}
if (!url.startsWith("file:")) {
  console.error(
    `Refusing to reset a non-local database (${url}). For Turso, use \`turso db shell <name>\` and DROP TABLE manually.`,
  );
  process.exit(1);
}

const path = url.slice("file:".length);
if (existsSync(path)) {
  rmSync(path);
  rmSync(`${path}-wal`, { force: true });
  rmSync(`${path}-shm`, { force: true });
  console.log(`Removed ${path}`);
} else {
  console.log("No database to remove.");
}
