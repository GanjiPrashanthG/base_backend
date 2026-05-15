import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

function collectTestFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTestFiles(path));
    } else if (entry.isFile() && entry.name.endsWith(".test.ts")) {
      files.push(path);
    }
  }
  return files;
}

const files = collectTestFiles("test");
if (files.length === 0) {
  console.error("No test files matched test/**/*.test.ts");
  process.exit(1);
}

const result = spawnSync(process.execPath, ["--import", "tsx", "--test", ...files], {
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 1);
