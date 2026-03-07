import { useEffect, useMemo, useState } from "react";

import type {
  ReportWidgetMeta,
  ReportWidgetStructuredContent,
} from "../lib/contracts";

type ToolResultMessage = {
  jsonrpc: "2.0";
  method: "ui/notifications/tool-result";
  params?: {
    structuredContent?: ReportWidgetStructuredContent;
    _meta?: ReportWidgetMeta;
  };
};

type WindowOpenAI = {
  toolOutput?: ReportWidgetStructuredContent;
  toolResponseMetadata?: ReportWidgetMeta;
  toolInput?: unknown;
  theme?: "light" | "dark";
  notifyIntrinsicHeight?: () => void;
};

declare global {
  interface Window {
    openai?: WindowOpenAI;
  }
}

function getInitialData() {
  return {
    structuredContent: window.openai?.toolOutput ?? null,
    meta: window.openai?.toolResponseMetadata ?? null,
    theme: window.openai?.theme ?? "dark",
  };
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

function formatHours(value: number) {
  return `${value.toFixed(1)}h`;
}

export function ReportWidgetApp() {
  const [data, setData] = useState(getInitialData);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) {
        return;
      }

      const message = event.data as ToolResultMessage;
      if (!message || message.jsonrpc !== "2.0") {
        return;
      }

      if (message.method !== "ui/notifications/tool-result") {
        return;
      }

      setData((current) => ({
        ...current,
        structuredContent:
          message.params?.structuredContent ?? window.openai?.toolOutput ?? current.structuredContent,
        meta: message.params?._meta ?? window.openai?.toolResponseMetadata ?? current.meta,
      }));
    };

    const handleGlobals = () => {
      setData(getInitialData());
    };

    window.addEventListener("message", handleMessage, { passive: true });
    window.addEventListener("openai:set_globals", handleGlobals as EventListener, {
      passive: true,
    });
    window.openai?.notifyIntrinsicHeight?.();

    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("openai:set_globals", handleGlobals as EventListener);
    };
  }, []);

  useEffect(() => {
    window.openai?.notifyIntrinsicHeight?.();
  }, [data]);

  const topProjectMax = useMemo(
    () => Math.max(...(data.structuredContent?.topProjects.map((project) => project.hours) ?? [0])),
    [data.structuredContent]
  );

  if (!data.structuredContent) {
    return (
      <main className="widget-shell">
        <section className="hero-card">
          <span className="eyebrow">Chronos Report</span>
          <h1>No report data yet</h1>
          <p>
            Run the report tool after your desktop app syncs summaries and aggregates to the
            hosted worker.
          </p>
        </section>
      </main>
    );
  }

  const { structuredContent } = data;

  return (
    <main className="widget-shell">
      <section className="hero-card">
        <div className="hero-topline">
          <span className="eyebrow">Chronos Report</span>
          <span className="period-pill">{structuredContent.period}</span>
        </div>
        <h1>{structuredContent.headline}</h1>
        <p>
          {formatDate(structuredContent.range.startDate)} to{" "}
          {formatDate(structuredContent.range.endDate)}
        </p>
        <div className="hero-metrics">
          <article>
            <strong>{structuredContent.summary ? formatHours(structuredContent.summary.totalHours) : "0.0h"}</strong>
            <span>Focused work</span>
          </article>
          <article>
            <strong>{structuredContent.flow.totalMinutes}m</strong>
            <span>Flow time</span>
          </article>
          <article>
            <strong>{structuredContent.flow.interruptedCount}</strong>
            <span>Interruptions</span>
          </article>
        </div>
      </section>

      <section className="grid">
        <article className="panel summary-panel">
          <div className="panel-header">
            <h2>Day Summary</h2>
            <span>{formatDate(structuredContent.range.focusDate)}</span>
          </div>
          {structuredContent.summary ? (
            <>
              <p className="summary-copy">{structuredContent.summary.summary}</p>
              <div className="summary-meta">
                <span>Top project: {structuredContent.summary.topProject}</span>
                <span>Top category: {structuredContent.summary.topCategory}</span>
                <span>Score: {structuredContent.summary.productivityScore.toFixed(1)}</span>
              </div>
            </>
          ) : (
            <p className="empty-copy">No synced daily summary is available for this day yet.</p>
          )}
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>Top Projects</h2>
            <span>{structuredContent.topProjects.length} active</span>
          </div>
          <div className="project-list">
            {structuredContent.topProjects.length > 0 ? (
              structuredContent.topProjects.map((project) => (
                <div className="project-row" key={project.project}>
                  <div className="project-copy">
                    <strong>{project.project}</strong>
                    <span>{project.client ?? (project.billable ? "Billable" : "Internal")}</span>
                  </div>
                  <div className="project-bar">
                    <span
                      className="project-fill"
                      style={{
                        width: `${topProjectMax > 0 ? (project.hours / topProjectMax) * 100 : 0}%`,
                        background: project.color,
                      }}
                    />
                  </div>
                  <strong className="project-hours">{formatHours(project.hours)}</strong>
                </div>
              ))
            ) : (
              <p className="empty-copy">No project rollups have been synced for this range yet.</p>
            )}
          </div>
        </article>
      </section>

      <section className="grid">
        <article className="panel">
          <div className="panel-header">
            <h2>Flow Sessions</h2>
            <span>{structuredContent.flow.sessions.length} sessions</span>
          </div>
          <div className="session-list">
            {structuredContent.flow.sessions.length > 0 ? (
              structuredContent.flow.sessions.map((session) => (
                <div className="session-card" key={session.startedAt}>
                  <div>
                    <strong>{session.primaryProject ?? session.primaryApp}</strong>
                    <span>
                      {session.primaryApp}
                      {session.interrupted && session.interruptedBy
                        ? ` interrupted by ${session.interruptedBy}`
                        : " uninterrupted"}
                    </span>
                  </div>
                  <strong>{session.durationMinutes}m</strong>
                </div>
              ))
            ) : (
              <p className="empty-copy">No flow sessions were synced for the focus day.</p>
            )}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>Recent Trend</h2>
            <span>{structuredContent.trendCards.length} days</span>
          </div>
          <div className="trend-list">
            {structuredContent.trendCards.length > 0 ? (
              structuredContent.trendCards.map((card) => (
                <div className="trend-card" key={card.date}>
                  <span>{formatDate(card.date)}</span>
                  <strong>{formatHours(card.totalHours)}</strong>
                  <small>{card.topProject}</small>
                  <small>Score {card.productivityScore.toFixed(1)}</small>
                </div>
              ))
            ) : (
              <p className="empty-copy">Recent summary cards will appear here after sync completes.</p>
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
