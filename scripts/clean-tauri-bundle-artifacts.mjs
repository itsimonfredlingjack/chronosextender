import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const STALE_DMG_PATTERN = /^rw\.\d+\..+\.dmg$/;

export function isStaleBundleArtifact(name) {
  return STALE_DMG_PATTERN.test(name);
}

export async function cleanTauriBundleArtifacts(rootDir) {
  const candidates = [
    path.join(rootDir, "src-tauri", "target", "release", "bundle", "macos"),
    path.join(rootDir, "src-tauri", "target", "debug", "bundle", "macos"),
  ];

  const removed = [];

  for (const dir of candidates) {
    let entries = [];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isFile() || !isStaleBundleArtifact(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      await rm(fullPath, { force: true });
      removed.push(fullPath);
    }
  }

  return removed;
}

const modulePath = fileURLToPath(import.meta.url);
const isMain = process.argv[1] && path.resolve(process.argv[1]) === modulePath;

if (isMain) {
  const rootDir = path.resolve(path.dirname(modulePath), "..");
  const removed = await cleanTauriBundleArtifacts(rootDir);

  if (removed.length === 0) {
    console.log("No stale Tauri DMG artifacts found.");
  } else {
    console.log("Removed stale Tauri DMG artifacts:");
    for (const file of removed) {
      console.log(`- ${path.relative(rootDir, file)}`);
    }
  }
}
