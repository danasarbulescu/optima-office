"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import "./widgets.css";

interface WidgetTypeView {
  id: string;
  name: string;
  originalName: string;
  category: string;
  component: string;
  hasOverride: boolean;
}

export default function WidgetsPage() {
  const [widgetTypes, setWidgetTypes] = useState<WidgetTypeView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchWidgetTypes = useCallback(async () => {
    try {
      const res = await fetch("/api/widget-types");
      if (!res.ok) throw new Error("Failed to load widget types");
      const data = await res.json();
      setWidgetTypes(data.widgetTypes);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWidgetTypes();
  }, [fetchWidgetTypes]);

  if (loading) return <div className="app-loading">Loading widget types...</div>;
  if (error) return <div className="app-error">{error}</div>;

  return (
    <div className="widgets-page">
      <div className="widgets-header">
        <h1>Widget Types</h1>
      </div>

      <div className="widgets-table-wrapper">
        <table className="widgets-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Component</th>
            </tr>
          </thead>
          <tbody>
            {widgetTypes.map((wt) => (
              <tr key={wt.id}>
                <td>
                  <Link href={`/widgets/${wt.id}`} className="widget-name-link">
                    {wt.name}
                  </Link>
                </td>
                <td>{wt.category}</td>
                <td><code className="slug-badge">{wt.component}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
