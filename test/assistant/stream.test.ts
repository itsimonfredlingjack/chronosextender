import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAssistantStreamEvent,
  parseResponseStreamChunk,
} from "../../src/lib/ai/stream";

test("parseResponseStreamChunk extracts text deltas from SSE payloads", () => {
  const events = parseResponseStreamChunk(`event: response.output_text.delta
data: {"type":"response.output_text.delta","delta":"Hej"}

event: response.completed
data: {"type":"response.completed"}

`);

  assert.deepEqual(events, [
    { type: "response.output_text.delta", delta: "Hej" },
    { type: "response.completed" },
  ]);
});

test("applyAssistantStreamEvent appends deltas and marks completion", () => {
  const draft = { text: "", completed: false, error: null as string | null };
  const afterDelta = applyAssistantStreamEvent(draft, {
    type: "response.output_text.delta",
    delta: "Hej",
  });
  const afterDone = applyAssistantStreamEvent(afterDelta, {
    type: "response.completed",
  });

  assert.equal(afterDelta.text, "Hej");
  assert.equal(afterDone.completed, true);
  assert.equal(afterDone.error, null);
});
