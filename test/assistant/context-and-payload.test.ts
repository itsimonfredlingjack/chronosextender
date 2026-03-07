import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAppContextXml,
  type AppContextSnapshot,
} from "../../src/lib/assistant/contextBuilder";
import {
  buildResponseInput,
  trimConversationHistory,
  type AssistantMessage,
} from "../../src/lib/assistant/chatPayload";

test("buildAppContextXml formats current view, summary, and recent entries", () => {
  const snapshot: AppContextSnapshot = {
    currentView: "dashboard",
    dateRange: "2026-03-01 to 2026-03-06",
    summaryLines: [
      "Total tracked: 34h 12m across 5 projects",
      "Most active: Chronos (14h 30m)",
    ],
    recentEntries: [
      '2026-03-06 09:00-11:30 Chronos "API integration" [deep_work]',
      '2026-03-06 13:00-14:45 Internal "Code review" [collaboration]',
    ],
  };

  const xml = buildAppContextXml(snapshot);

  assert.match(xml, /<app_context>/);
  assert.match(xml, /<current_view>dashboard<\/current_view>/);
  assert.match(xml, /Total tracked: 34h 12m across 5 projects/);
  assert.match(xml, /Chronos "API integration"/);
});

test("trimConversationHistory keeps the newest 50 messages", () => {
  const history: AssistantMessage[] = Array.from({ length: 55 }, (_, index) => ({
    id: `m-${index}`,
    role: index % 2 === 0 ? "user" : "assistant",
    content: `message-${index}`,
    createdAt: `2026-03-06T10:${String(index).padStart(2, "0")}:00Z`,
  }));

  const trimmed = trimConversationHistory(history);

  assert.equal(trimmed.length, 50);
  assert.equal(trimmed[0]?.id, "m-5");
  assert.equal(trimmed.at(-1)?.id, "m-54");
});

test("buildResponseInput injects app context into the newest user turn", () => {
  const history: AssistantMessage[] = [
    {
      id: "assistant-1",
      role: "assistant",
      content: "Yesterday looked focused.",
      createdAt: "2026-03-06T08:00:00Z",
    },
  ];

  const input = buildResponseInput({
    history,
    contextXml: "<app_context><current_view>reports</current_view></app_context>",
    userMessage: "What did I do today?",
  });

  assert.equal(input.length, 2);
  assert.equal(input[0]?.role, "assistant");
  assert.match(String(input[1]?.content), /<app_context>/);
  assert.match(String(input[1]?.content), /What did I do today\?/);
});
