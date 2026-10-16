// Usage: node scripts/set-version.mjs 1.2.3   (a leading "v" is accepted)
// Keeps package.json, tauri.conf.json and Cargo.toml on the same version.
import { readFileSync, writeFileSync } from "node:fs";

const version = (process.argv[2] || "").replace(/^v/, "");
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  console.error("Usage: node scripts/set-version.mjs <major.minor.patch>");
  process.exit(1);
}

const editJson = (file) => {
  const j = JSON.parse(readFileSync(file, "utf8"));
  j.version = version;
  writeFileSync(file, JSON.stringify(j, null, 2) + "\n");
};
editJson("package.json");
editJson("src-tauri/tauri.conf.json");

const cargo = readFileSync("src-tauri/Cargo.toml", "utf8").replace(/^version = ".*"$/m, `version = "${version}"`);
writeFileSync("src-tauri/Cargo.toml", cargo);
console.log(`Version set to ${version}`);
