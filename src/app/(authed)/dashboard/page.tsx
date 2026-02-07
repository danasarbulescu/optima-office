"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { generateHTML } from "@/lib/html";
import { useCompany } from "@/context/CompanyContext";
import "./dashboard.css";

function getCurrentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function extractBody(html: string): string {
  const match = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return match ? match[1] : html;
}

function extractStyles(html: string): string {
  const match = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  return match ? match[1] : "";
}

export default function DashboardPage() {
  const { selectedCompanies } = useCompany();
  const [month, setMonth] = useState(getCurrentMonth());
  const [dashboardHtml, setDashboardHtml] = useState<string>("");
  const [dashboardStyles, setDashboardStyles] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [noCache, setNoCache] = useState(false);
  const [error, setError] = useState<string>("");
  const hasAutoLoaded = useRef(false);

  const fetchDashboard = useCallback(async (selectedMonth: string, refresh = false) => {
    setLoading(true);
    setError("");
    setNoCache(false);
    try {
      const url = `/api/dashboard?month=${selectedMonth}&companies=${selectedCompanies.join(',')}${refresh ? '&refresh=true' : ''}`;
      const res = await fetch(url);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `API error: ${res.status}`);
      }

      const data = await res.json();
      const html = generateHTML(data.kpis, data.selectedMonth, data.pnlByMonth, data.clientName);
      const body = extractBody(html);

      if (!body || body.trim() === '') {
        setDashboardHtml("");
        setDashboardStyles("");
        setNoCache(true);
      } else {
        setDashboardStyles(extractStyles(html));
        setDashboardHtml(body);
      }
    } catch (err: any) {
      // If auto-loading cached data fails, show the no-cache message instead of an error
      if (!refresh && !dashboardHtml) {
        setNoCache(true);
      } else {
        setError(err.message || "Failed to load dashboard");
      }
    } finally {
      setLoading(false);
    }
  }, [selectedCompanies, dashboardHtml]);

  // Auto-load cached data on mount when companies are available
  useEffect(() => {
    if (!hasAutoLoaded.current && selectedCompanies.length > 0) {
      hasAutoLoaded.current = true;
      fetchDashboard(month);
    }
  }, [selectedCompanies, fetchDashboard, month]);

  return (
    <>
      <div className="dashboard-controls">
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="month-picker"
        />
        <button
          onClick={() => fetchDashboard(month)}
          disabled={loading || selectedCompanies.length === 0}
          className="refresh-btn"
        >
          {loading ? "Loading..." : "Load"}
        </button>
        <button
          onClick={() => fetchDashboard(month, true)}
          disabled={loading || selectedCompanies.length === 0}
          className="refresh-btn"
        >
          {loading ? "Fetching..." : "Fetch API Data"}
        </button>
      </div>

      {loading && <div className="app-loading">Loading dashboard...</div>}
      {error && <div className="app-error">{error}</div>}

      {noCache && !loading && (
        <div className="app-empty">
          There is no cached data, you need to pull fresh data via API.
        </div>
      )}

      {dashboardHtml && (
        <>
          <style>{dashboardStyles}</style>
          <div
            className="dashboard-content"
            dangerouslySetInnerHTML={{ __html: dashboardHtml }}
          />
        </>
      )}
    </>
  );
}
