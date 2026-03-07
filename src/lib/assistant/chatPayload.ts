import type { AssistantMessage, ResponseInputMessage } from "../../types/ai-types";

export type { AssistantMessage } from "../../types/ai-types";

export function trimConversationHistory(history: AssistantMessage[]): AssistantMessage[] {
  return history.slice(-50);
}

export function buildResponseInput(args: {
  history: AssistantMessage[];
  contextXml: string;
  userMessage: string;
}): ResponseInputMessage[] {
  const trimmed = trimConversationHistory(args.history).map((message) => ({
    role: message.role,
    content: message.content,
  }));

  return [
    ...trimmed,
    {
      role: "user",
      content: `${args.contextXml}\n\n${args.userMessage}`,
    },
  ];
}
