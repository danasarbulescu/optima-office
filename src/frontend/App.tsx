import React, { useState, useCallback, useEffect } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { fetchAuthSession } from 'aws-amplify/auth';
import outputs from '../../amplify_outputs.json';
import { generateHTML } from '../lib/html';
import './App.css';

const apiEndpoint = (outputs as any).custom?.API?.dashboardApi?.endpoint;

function getCurrentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function extractBody(html: string): string {
  const match = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return match ? match[1] : html;
}

function extractStyles(html: string): string {
  const match = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  return match ? match[1] : '';
}

function App() {
  const { signOut, user } = useAuthenticator();
  const [month, setMonth] = useState(getCurrentMonth());
  const [dashboardHtml, setDashboardHtml] = useState<string>('');
  const [dashboardStyles, setDashboardStyles] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const fetchDashboard = useCallback(async (selectedMonth: string) => {
    setLoading(true);
    setError('');
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();

      const res = await fetch(`${apiEndpoint}dashboard?month=${selectedMonth}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `API error: ${res.status}`);
      }

      const data = await res.json();
      const html = generateHTML(data.kpis, data.selectedMonth, data.pnlByMonth);
      setDashboardStyles(extractStyles(html));
      setDashboardHtml(extractBody(html));
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard(month);
  }, [month, fetchDashboard]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-user">
          {user?.signInDetails?.loginId}
        </span>
        <div className="app-controls">
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="month-picker"
          />
          <button onClick={signOut} className="sign-out-btn">
            Sign Out
          </button>
        </div>
      </header>

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
    </div>
  );
}

export default App;
