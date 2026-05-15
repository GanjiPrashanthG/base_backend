import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");

export type PackageInfo = {
  name: string;
  version: string;
};

export const packageInfo: PackageInfo = JSON.parse(
  readFileSync(join(repoRoot, "package.json"), "utf8"),
) as PackageInfo;
