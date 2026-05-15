/**
 * Ensures package.json "version" is valid Semantic Versioning 2.0.0 (npm / node-semver standard).
 * @see https://semver.org/
 * @see https://docs.npmjs.com/cli/v11/configuring-npm/package-json#version
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import semver from "semver";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const raw = pkg.version;

if (typeof raw !== "string" || raw.trim() === "") {
  console.error('package.json "version" must be a non-empty string.');
  process.exit(1);
}

const normalized = semver.valid(raw.trim());
if (normalized === null) {
  console.error(`Invalid SemVer in package.json "version": ${JSON.stringify(raw)}`);
  console.error("Use MAJOR.MINOR.PATCH (e.g. 1.0.0); prereleases: 1.0.0-alpha.1, 1.0.0+build.1");
  process.exit(1);
}

if (normalized !== raw.trim()) {
  console.warn(`Note: version normalized for comparison: ${JSON.stringify(raw)} -> ${normalized}`);
}

console.log(`ok  package.json version ${normalized} (SemVer 2.0.0)`);
