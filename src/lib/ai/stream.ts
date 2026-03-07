import type { AssistantStreamEvent, AssistantStreamState } from "../../types/ai-types";

export function parseResponseStreamChunk(chunk: string): AssistantStreamEvent[] {
  const blocks = chunk.split("\n\n").map((block) => block.trim()).filter(Boolean);
  const events: AssistantStreamEvent[] = [];

  for (const block of blocks) {
    const lines = block.split("\n");
    const dataLine = lines.find((line) => line.startsWith("data: "));
    if (!dataLine) {
      continue;
    }

    const payload = dataLine.slice("data: ".length).trim();
    if (!payload || payload === "[DONE]") {
      continue;
    }

    try {
      const parsed = JSON.parse(payload) as
        | { type?: string; delta?: string; error?: { message?: string } }
        | undefined;
      if (!parsed?.type) {
        continue;
      }

      if (parsed.type === "response.output_text.delta") {
        events.push({
          type: "response.output_text.delta",
          delta: parsed.delta ?? "",
        });
        continue;
      }

      if (parsed.type === "response.completed") {
        events.push({ type: "response.completed" });
        continue;
      }

      if (parsed.type === "response.error") {
        events.push({
          type: "response.error",
          error: parsed.error?.message ?? "Unknown assistant stream error",
        });
      }
    } catch {
      // Ignore malformed event fragments.
    }
  }

  return events;
}

export function applyAssistantStreamEvent(
  state: AssistantStreamState,
  event: AssistantStreamEvent
): AssistantStreamState {
  if (event.type === "response.output_text.delta") {
    return {
      ...state,
      text: state.text + event.delta,
    };
  }

  if (event.type === "response.completed") {
    return {
      ...state,
      completed: true,
    };
  }

  return {
    ...state,
    completed: true,
    error: event.error,
  };
}
