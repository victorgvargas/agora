import { rmSync, existsSync } from "node:fs";
import { join } from "node:path";

const path = join(process.cwd(), "data", "agora.db");
if (existsSync(path)) {
  rmSync(path);
  rmSync(`${path}-wal`, { force: true });
  rmSync(`${path}-shm`, { force: true });
  console.log(`Removed ${path}`);
} else {
  console.log("No database to remove.");
}
