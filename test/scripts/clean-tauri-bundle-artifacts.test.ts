import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  cleanTauriBundleArtifacts,
  isStaleBundleArtifact,
} from "../../scripts/clean-tauri-bundle-artifacts.mjs";

test("isStaleBundleArtifact matches rw dmg artifacts only", () => {
  assert.equal(isStaleBundleArtifact("rw.20524.Chronos AI_0.1.0_aarch64.dmg"), true);
  assert.equal(isStaleBundleArtifact("Chronos AI_0.1.0_aarch64.dmg"), false);
  assert.equal(isStaleBundleArtifact("rw.20524.notes.txt"), false);
});

test("cleanTauriBundleArtifacts removes stale rw dmgs from Tauri macos bundle dirs only", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "chronos-clean-"));
  const macosDir = path.join(root, "src-tauri", "target", "release", "bundle", "macos");
  const otherDir = path.join(root, "src-tauri", "target", "release", "bundle", "dmg");

  await mkdir(macosDir, { recursive: true });
  await mkdir(otherDir, { recursive: true });

  const stale = path.join(macosDir, "rw.20524.Chronos AI_0.1.0_aarch64.dmg");
  const keepApp = path.join(macosDir, "Chronos AI.app");
  const keepOther = path.join(otherDir, "rw.20524.Chronos AI_0.1.0_aarch64.dmg");

  await writeFile(stale, "stale");
  await writeFile(keepApp, "app-bundle-placeholder");
  await writeFile(keepOther, "other");

  const removed = await cleanTauriBundleArtifacts(root);
  const remaining = await readdir(macosDir);
  const otherRemaining = await readdir(otherDir);

  assert.deepEqual(removed, [stale]);
  assert.deepEqual(remaining.sort(), ["Chronos AI.app"]);
  assert.deepEqual(otherRemaining.sort(), ["rw.20524.Chronos AI_0.1.0_aarch64.dmg"]);
});
