import React from "react";
import ReactDOM from "react-dom/client";

import { ReportWidgetApp } from "./ReportWidgetApp";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ReportWidgetApp />
  </React.StrictMode>
);
