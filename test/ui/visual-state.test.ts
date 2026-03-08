import assert from "node:assert/strict";
import test from "node:test";

import { getVisualStateLabel, resolveUIVisualState } from "../../src/lib/visualState";

test("resolveUIVisualState falls back to unknown when tracking state is missing", () => {
  const state = resolveUIVisualState({
    ollamaConnected: true,
    pendingCount: 0,
    inFlow: false,
  });

  assert.equal(state, "unknown");
});

test("resolveUIVisualState prioritizes critical when Ollama is offline", () => {
  const state = resolveUIVisualState({
    ollamaConnected: false,
    trackingActive: true,
    pendingCount: 0,
    inFlow: true,
  });

  assert.equal(state, "critical");
});

test("resolveUIVisualState returns warning when review items are pending", () => {
  const state = resolveUIVisualState({
    ollamaConnected: true,
    trackingActive: true,
    pendingCount: 4,
    inFlow: true,
  });

  assert.equal(state, "warning");
});

test("resolveUIVisualState returns paused when tracking is disabled", () => {
  const state = resolveUIVisualState({
    ollamaConnected: true,
    trackingActive: false,
    pendingCount: 0,
    inFlow: true,
  });

  assert.equal(state, "paused");
});

test("resolveUIVisualState returns flow when everything else is healthy", () => {
  const state = resolveUIVisualState({
    ollamaConnected: true,
    trackingActive: true,
    pendingCount: 0,
    inFlow: true,
  });

  assert.equal(state, "flow");
});

test("resolveUIVisualState returns normal by default with healthy inputs", () => {
  const state = resolveUIVisualState({
    ollamaConnected: true,
    trackingActive: true,
    pendingCount: 0,
    inFlow: false,
  });

  assert.equal(state, "normal");
});

test("visual-state labels remain stable during warm light migration", () => {
  const state = resolveUIVisualState({
    ollamaConnected: true,
    trackingActive: true,
    pendingCount: 0,
    inFlow: false,
  });

  assert.equal(state, "normal");
  assert.equal(getVisualStateLabel(state), "All systems normal");
});
