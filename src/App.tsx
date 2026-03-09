import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import ReviewQueue from "./pages/ReviewQueue";
import Timesheets from "./pages/Timesheets";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import OverlayView from "./pages/OverlayView";
import "./index.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/overlay" element={<OverlayView />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/review" element={<ReviewQueue />} />
          <Route path="/timesheets" element={<Timesheets />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
