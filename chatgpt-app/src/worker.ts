import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";

import { isValidSyncToken } from "./lib/auth";
import type {
  CloudDaySummaryPayload,
  CloudFlowSessionPayload,
  CloudProjectRollupPayload,
  Env,
  WidgetPeriod,
} from "./lib/contracts";
import {
  getDayOverview,
  getFlowSessionsForDate,
  getProjectBreakdown,
  getRecentSummaries,
  getReportWidgetData,
  upsertDailySummary,
  upsertFlowSessions,
  upsertProjectRollups,
} from "./lib/service";
import { buildWidgetHtml, getAppOrigin, REPORT_WIDGET_URI } from "./lib/widget";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders(),
      ...init?.headers,
    },
  });
}

function corsHeaders(): Record<string, string> {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
    "access-control-allow-headers":
      "authorization, content-type, last-event-id, mcp-protocol-version, mcp-session-id",
    "access-control-expose-headers": "mcp-protocol-version, mcp-session-id",
  };
}

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders())) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function ensureValidDate(value: string, fieldName: string): void {
  if (!DATE_PATTERN.test(value)) {
    throw new Error(`${fieldName} must use YYYY-MM-DD`);
  }
}

function parsePeriod(value: unknown): WidgetPeriod {
  if (value === "day" || value === "week" || value === "month" || value === "custom") {
    return value;
  }

  return "day";
}

async function parseJson<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}

function createServer(env: Env): McpServer {
  const accountId = env.CHRONOS_ACCOUNT_ID ?? "owner";
  const appOrigin = getAppOrigin(env);
  const server = new McpServer({
    name: "chronos-chatgpt-app",
    version: "0.1.0",
  });

  server.registerResource(
    "chronos-report-widget",
    REPORT_WIDGET_URI,
    {
      title: "Chronos Report Widget",
      description: "Responsive Chronos reporting widget for ChatGPT.",
      mimeType: "text/html;profile=mcp-app",
    },
    async () => ({
      contents: [
        {
          uri: REPORT_WIDGET_URI,
          mimeType: "text/html;profile=mcp-app",
          text: buildWidgetHtml(env),
          _meta: {
            ui: {
              prefersBorder: true,
              domain: appOrigin,
              resourceUri: REPORT_WIDGET_URI,
              csp: {
                connectDomains: [appOrigin],
                resourceDomains: [appOrigin],
              },
            },
            "openai/widgetDescription":
              "Chronos productivity report with summaries, top projects, flow sessions, and recent trends.",
            "openai/widgetPrefersBorder": true,
            "openai/widgetDomain": appOrigin,
            "openai/widgetCSP": {
              connect_domains: [appOrigin],
              resource_domains: [appOrigin],
            },
          },
        },
      ],
    })
  );

  server.registerTool(
    "get_day_overview",
    {
      title: "Get Day Overview",
      description: "Return the daily Chronos summary, top projects, and flow sessions for one date.",
      inputSchema: {
        date: z.string().regex(DATE_PATTERN, "Use YYYY-MM-DD"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true,
      },
    },
    async ({ date }) => {
      const overview = await getDayOverview(env, accountId, date);
      return {
        structuredContent: overview,
        content: [
          {
            type: "text",
            text: overview.summary
              ? `Loaded Chronos overview for ${date}.`
              : `No synced Chronos summary was found for ${date}.`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "get_project_breakdown",
    {
      title: "Get Project Breakdown",
      description: "Return project rollups for a date range without modifying any Chronos data.",
      inputSchema: {
        startDate: z.string().regex(DATE_PATTERN, "Use YYYY-MM-DD"),
        endDate: z.string().regex(DATE_PATTERN, "Use YYYY-MM-DD"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true,
      },
    },
    async ({ startDate, endDate }) => {
      const breakdown = await getProjectBreakdown(env, accountId, startDate, endDate);
      return {
        structuredContent: breakdown,
        content: [
          {
            type: "text",
            text: `Loaded ${breakdown.projects.length} project rollups for ${startDate} through ${endDate}.`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "get_flow_sessions",
    {
      title: "Get Flow Sessions",
      description: "Return synced focus sessions for a single day.",
      inputSchema: {
        date: z.string().regex(DATE_PATTERN, "Use YYYY-MM-DD"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true,
      },
    },
    async ({ date }) => {
      const flow = await getFlowSessionsForDate(env, accountId, date);
      return {
        structuredContent: flow,
        content: [
          {
            type: "text",
            text:
              flow.sessions.length > 0
                ? `Loaded ${flow.sessions.length} flow sessions for ${date}.`
                : `No synced flow sessions were found for ${date}.`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "get_recent_summaries",
    {
      title: "Get Recent Summaries",
      description: "Return the most recent synced daily summaries for Chronos.",
      inputSchema: {
        limit: z.number().int().min(1).max(30).default(7),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true,
      },
    },
    async ({ limit }) => {
      const summaries = await getRecentSummaries(env, accountId, limit);
      return {
        structuredContent: summaries,
        content: [
          {
            type: "text",
            text: `Loaded ${summaries.summaries.length} recent Chronos summaries.`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "render_report_widget",
    {
      title: "Render Chronos Report Widget",
      description:
        "Render the Chronos reporting widget for a time period after gathering the relevant daily and project context.",
      inputSchema: {
        period: z.enum(["day", "week", "month", "custom"]).default("day"),
        startDate: z.string().regex(DATE_PATTERN, "Use YYYY-MM-DD").optional(),
        endDate: z.string().regex(DATE_PATTERN, "Use YYYY-MM-DD").optional(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true,
      },
      _meta: {
        ui: {
          resourceUri: REPORT_WIDGET_URI,
        },
        "openai/outputTemplate": REPORT_WIDGET_URI,
      },
    },
    async ({ period, startDate, endDate }) => {
      const report = await getReportWidgetData(env, accountId, period, startDate, endDate);
      return {
        structuredContent: report.structuredContent,
        content: [
          {
            type: "text",
            text: report.meta.emptyState
              ? "Rendered the Chronos report widget with an empty synced state."
              : `Rendered the Chronos report widget for ${report.structuredContent.range.startDate} through ${report.structuredContent.range.endDate}.`,
          },
        ],
        _meta: report.meta,
      };
    }
  );

  return server;
}

async function handleSyncRequest(request: Request, env: Env, path: string): Promise<Response> {
  if (!isValidSyncToken(request, env.CHRONOS_SYNC_TOKEN)) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    switch (path) {
      case "/sync/daily-summary": {
        const payload = await parseJson<CloudDaySummaryPayload>(request);
        ensureValidDate(payload.date, "date");
        return json(await upsertDailySummary(env, payload));
      }
      case "/sync/project-rollups": {
        const payloads = await parseJson<CloudProjectRollupPayload[]>(request);
        for (const payload of payloads) {
          ensureValidDate(payload.date, "date");
        }
        return json(await upsertProjectRollups(env, payloads));
      }
      case "/sync/flow-sessions": {
        const payloads = await parseJson<CloudFlowSessionPayload[]>(request);
        for (const payload of payloads) {
          ensureValidDate(payload.date, "date");
        }
        return json(await upsertFlowSessions(env, payloads));
      }
      default:
        return json({ error: "Not found" }, { status: 404 });
    }
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Unexpected sync error" },
      { status: 400 }
    );
  }
}

async function handleMcpRequest(request: Request, env: Env): Promise<Response> {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  const server = createServer(env);
  await server.connect(transport);
  return withCors(await transport.handleRequest(request));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (url.pathname === "/" || url.pathname === "/health") {
      return json({
        ok: true,
        service: "chronos-chatgpt-app",
        mcp: "/mcp",
        sync: [
          "/sync/daily-summary",
          "/sync/project-rollups",
          "/sync/flow-sessions",
        ],
        widgetOrigin: getAppOrigin(env),
        ownerAccountId: env.CHRONOS_ACCOUNT_ID ?? "owner",
      });
    }

    if (url.pathname === "/mcp") {
      return handleMcpRequest(request, env);
    }

    if (
      url.pathname === "/sync/daily-summary" ||
      url.pathname === "/sync/project-rollups" ||
      url.pathname === "/sync/flow-sessions"
    ) {
      return handleSyncRequest(request, env, url.pathname);
    }

    return env.ASSETS.fetch(request);
  },
};
