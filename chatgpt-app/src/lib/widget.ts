import type { Env } from "./contracts";

export const REPORT_WIDGET_URI = "ui://widget/chronos-report.html";

export function getAppOrigin(env: Env): string {
  return (env.CHRONOS_APP_ORIGIN ?? "https://chronos-mcp.example.com").replace(/\/$/, "");
}

export function buildWidgetHtml(env: Env): string {
  const origin = getAppOrigin(env);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Chronos Report</title>
    <link rel="stylesheet" href="${origin}/widget.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="${origin}/widget.js"></script>
  </body>
</html>`;
}
