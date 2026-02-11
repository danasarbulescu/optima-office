"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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

type SortColumn = "name" | "category" | "component";
type SortDirection = "asc" | "desc";
const PAGE_SIZE = 20;

export default function WidgetsPage() {
  const [widgetTypes, setWidgetTypes] = useState<WidgetTypeView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [currentPage, setCurrentPage] = useState(1);

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

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  const sortIndicator = (column: SortColumn) => {
    if (sortColumn !== column)
      return <span className="sort-arrow sort-arrow-inactive">{"\u25B2"}</span>;
    return (
      <span className="sort-arrow">
        {sortDirection === "asc" ? "\u25B2" : "\u25BC"}
      </span>
    );
  };

  const sortedTypes = useMemo(() => {
    if (!sortColumn) return widgetTypes;
    const sorted = [...widgetTypes].sort((a, b) => {
      const aVal = (a[sortColumn] ?? "").toString().toLowerCase();
      const bVal = (b[sortColumn] ?? "").toString().toLowerCase();
      return aVal.localeCompare(bVal);
    });
    return sortDirection === "desc" ? sorted.reverse() : sorted;
  }, [widgetTypes, sortColumn, sortDirection]);

  const totalPages = Math.ceil(sortedTypes.length / PAGE_SIZE);
  const pagedTypes = sortedTypes.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

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
              <th className="sortable-th" onClick={() => handleSort("name")}>
                Name {sortIndicator("name")}
              </th>
              <th className="sortable-th" onClick={() => handleSort("category")}>
                Category {sortIndicator("category")}
              </th>
              <th className="sortable-th" onClick={() => handleSort("component")}>
                Component {sortIndicator("component")}
              </th>
            </tr>
          </thead>
          <tbody>
            {pagedTypes.map((wt) => (
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
        {totalPages > 1 && (
          <div className="pagination-controls">
            <button
              className="pagination-btn"
              onClick={() => setCurrentPage((p) => p - 1)}
              disabled={currentPage <= 1}
            >
              Prev
            </button>
            <span className="pagination-info">
              Page {currentPage} of {totalPages}
            </span>
            <button
              className="pagination-btn"
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={currentPage >= totalPages}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
