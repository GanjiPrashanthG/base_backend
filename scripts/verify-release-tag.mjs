/**
 * When CI runs for a git tag `v*`, require that the tag matches package.json "version"
 * (standard npm release convention: tag v1.2.3 ↔ package.json 1.2.3).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import semver from "semver";

const raw = process.env.GITHUB_REF_NAME;
const refName = typeof raw === "string" ? raw : "";

if (!/^v/u.test(refName)) {
  if (refName === "") {
    console.log(
      "skip  release tag check: GITHUB_REF_NAME is unset (expected on your machine).",
    );
    console.log(
      "     GitHub Actions sets it to the tag (e.g. v1.0.0) when this workflow runs on a v* tag.",
    );
    console.log(
      "     Local dry-run: GITHUB_REF_NAME=v1.0.0 node scripts/verify-release-tag.mjs",
    );
  } else {
    console.log(
      `skip  release tag check: GITHUB_REF_NAME=${JSON.stringify(refName)} is not a v-prefixed tag.`,
    );
  }
  process.exit(0);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const fromTag = refName.startsWith("v") ? refName.slice(1) : refName;

const tagVersion = semver.valid(fromTag);
if (tagVersion === null) {
  console.error(`Tag ${JSON.stringify(refName)} is not valid SemVer after stripping "v".`);
  process.exit(1);
}

const pkgVersion = semver.valid(typeof pkg.version === "string" ? pkg.version.trim() : "");
if (pkgVersion === null) {
  console.error("package.json version is invalid SemVer (run npm run version:validate).");
  process.exit(1);
}

if (!semver.eq(tagVersion, pkgVersion)) {
  console.error(
    `Release tag version ${tagVersion} does not match package.json version ${pkgVersion}.`,
  );
  console.error("Bump package.json (npm version patch|minor|major) then tag the same release.");
  process.exit(1);
}

console.log(`ok  tag ${refName} matches package.json version ${pkgVersion}`);
