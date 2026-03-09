import test from "node:test";
import assert from "node:assert/strict";

import worker from "../src/worker";
import { isValidSyncToken, readBearerToken } from "../src/lib/auth";
import {
  pickLatestSyncedDate,
  summariseFlowSessions,
  summariseProjectBreakdown,
} from "../src/lib/service";

test("readBearerToken extracts a bearer token", () => {
  const request = new Request("https://chronos.example.com/sync", {
    headers: {
      authorization: "Bearer secret-token",
    },
  });

  assert.equal(readBearerToken(request), "secret-token");
  assert.equal(isValidSyncToken(request, "secret-token"), true);
  assert.equal(isValidSyncToken(request, "wrong-token"), false);
});

test("summariseFlowSessions totals minutes and interruptions", () => {
  const flow = summariseFlowSessions([
    {
      startedAt: "2026-03-06T08:00:00Z",
      endedAt: "2026-03-06T09:00:00Z",
      primaryApp: "Cursor",
      primaryProject: "Chronos",
      durationMinutes: 60,
      interrupted: false,
      interruptedBy: null,
    },
    {
      startedAt: "2026-03-06T10:00:00Z",
      endedAt: "2026-03-06T10:45:00Z",
      primaryApp: "Figma",
      primaryProject: null,
      durationMinutes: 45,
      interrupted: true,
      interruptedBy: "Slack",
    },
  ]);

  assert.equal(flow.totalMinutes, 105);
  assert.equal(flow.interruptedCount, 1);
  assert.equal(flow.sessions.length, 2);
});

test("summariseProjectBreakdown sorts projects and computes totals", () => {
  const breakdown = summariseProjectBreakdown(
    [
      {
        project: "Internal",
        client: null,
        color: "#222222",
        billable: false,
        hours: 1.5,
      },
      {
        project: "Chronos",
        client: "Owner",
        color: "#ff9900",
        billable: true,
        hours: 3.25,
      },
    ],
    {
      startDate: "2026-03-01",
      endDate: "2026-03-06",
    },
    [
      { date: "2026-03-05", totalHours: 2.5 },
      { date: "2026-03-06", totalHours: 2.25 },
    ]
  );

  assert.equal(breakdown.totalHours, 4.75);
  assert.equal(breakdown.billableHours, 3.25);
  assert.equal(breakdown.projects[0]?.project, "Chronos");
  assert.equal(breakdown.dailyTotals.length, 2);
});

test("pickLatestSyncedDate falls back to the most recent synced table date", () => {
  assert.equal(
    pickLatestSyncedDate([null, "2026-03-06", "2026-03-08"], "2026-03-09"),
    "2026-03-08"
  );
  assert.equal(pickLatestSyncedDate([undefined, null], "2026-03-09"), "2026-03-09");
});

test("worker rejects sync requests with an invalid token", async () => {
  const response = await worker.fetch(
    new Request("https://chronos.example.com/sync/daily-summary", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer bad-token",
      },
      body: JSON.stringify({
        account_id: "owner",
        device_id: "chronos-desktop-macos",
        date: "2026-03-06",
        total_hours: 5.5,
        top_category: "coding",
        top_project: "Chronos",
        summary: "Focus day",
        productivity_score: 8.8,
        event_count: 42,
      }),
    }),
    {
      CHRONOS_SYNC_TOKEN: "expected-token",
      CHRONOS_ACCOUNT_ID: "owner",
      CHRONOS_APP_ORIGIN: "https://chronos-mcp.example.com",
      ASSETS: {
        fetch: async () => new Response("missing", { status: 404 }),
      } as unknown as Fetcher,
      DB: {} as D1Database,
    }
  );

  assert.equal(response.status, 401);
});

test("worker health endpoint returns owner-scoped service metadata", async () => {
  const response = await worker.fetch(
    new Request("https://chronos.example.com/health"),
    {
      CHRONOS_ACCOUNT_ID: "owner",
      CHRONOS_APP_ORIGIN: "https://chronos-mcp.example.com",
      ASSETS: {
        fetch: async () => new Response("missing", { status: 404 }),
      } as unknown as Fetcher,
      DB: {} as D1Database,
    }
  );

  assert.equal(response.status, 200);
  const payload = (await response.json()) as { mcp: string; ownerAccountId: string };
  assert.equal(payload.mcp, "/mcp");
  assert.equal(payload.ownerAccountId, "owner");
});

test("worker adds CORS headers to widget asset responses", async () => {
  const response = await worker.fetch(
    new Request("https://chronos.example.com/widget.js"),
    {
      CHRONOS_ACCOUNT_ID: "owner",
      CHRONOS_APP_ORIGIN: "https://chronos-mcp.example.com",
      ASSETS: {
        fetch: async () =>
          new Response("console.log('widget');", {
            headers: {
              "content-type": "text/javascript",
            },
          }),
      } as unknown as Fetcher,
      DB: {} as D1Database,
    }
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
  assert.equal(response.headers.get("content-type"), "text/javascript");
});
