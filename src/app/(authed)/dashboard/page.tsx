"use client";

import { useState, useCallback, useEffect } from "react";
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
  const [error, setError] = useState<string>("");
  const fetchDashboard = useCallback(async (selectedMonth: string, refresh = false) => {
    setLoading(true);
    setError("");
    try {
      const url = `/api/dashboard?month=${selectedMonth}&companies=${selectedCompanies.join(',')}${refresh ? '&refresh=true' : ''}`;
      const res = await fetch(url);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `API error: ${res.status}`);
      }

      const data = await res.json();
      const html = generateHTML(data.kpis, data.selectedMonth, data.pnlByMonth, data.clientName);
      setDashboardStyles(extractStyles(html));
      setDashboardHtml(extractBody(html));
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [selectedCompanies]);

  useEffect(() => {
    if (selectedCompanies.length > 0) {
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
          onClick={() => fetchDashboard(month, true)}
          disabled={loading}
          className="refresh-btn"
        >
          {loading ? "Refreshing..." : "API Refresh"}
        </button>
      </div>

      {loading && <div className="app-loading">Loading dashboard...</div>}
      {error && <div className="app-error">{error}</div>}

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
