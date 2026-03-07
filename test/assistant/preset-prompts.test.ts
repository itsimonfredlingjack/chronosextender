import assert from "node:assert/strict";
import test from "node:test";

import { getPresetPrompts } from "../../src/components/ai-chat/presetPrompts";

test("getPresetPrompts prioritizes day-focused prompts on the dashboard", () => {
  const prompts = getPresetPrompts("dashboard");

  assert.equal(prompts.length, 4);
  assert.equal(prompts[0]?.label, "Today");
  assert.match(String(prompts[0]?.prompt), /today/i);
  assert.equal(prompts[1]?.label, "Flow");
});

test("getPresetPrompts prioritizes weekly prompts on reports pages", () => {
  const prompts = getPresetPrompts("reports");

  assert.equal(prompts.length, 4);
  assert.equal(prompts[0]?.label, "This Week");
  assert.match(String(prompts[0]?.prompt), /week/i);
  assert.ok(prompts.some((preset) => /project/i.test(preset.prompt)));
});
