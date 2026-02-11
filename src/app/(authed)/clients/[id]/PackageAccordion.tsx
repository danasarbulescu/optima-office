"use client";

import { useState, useMemo, useEffect } from "react";
import { Package, Dashboard, DashboardWidget } from "@/lib/types";
import { getWidgetType, defaultWidgetName } from "@/widgets/registry";
import { usePackages } from "@/context/PackageContext";
import { TrashIcon } from "@/components/TrashIcon";
import { PencilIcon } from "@/components/PencilIcon";

/* ─── Package Row (nested accordion) ─── */

export function PackageRow({
  pkg, isExpanded, dashboards, allWidgets, expandedDashId,
  onToggle, onEdit, onDelete, onAddDashboard, onEditDashboard, onDeleteDashboard,
  onToggleDash, onAddWidget, onDeleteWidget, onDeleteAllWidgets, onSwapWidgetOrder,
}: {
  pkg: Package;
  isExpanded: boolean;
  dashboards: Dashboard[];
  allWidgets: Record<string, DashboardWidget[]>;
  expandedDashId: string | null;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddDashboard: () => void;
  onEditDashboard: (d: Dashboard) => void;
  onDeleteDashboard: (d: Dashboard) => void;
  onToggleDash: (id: string) => void;
  onAddWidget: (d: Dashboard) => void;
  onDeleteWidget: (dashboardId: string, widgetId: string) => void;
  onDeleteAllWidgets: (dashboardId: string) => void;
  onSwapWidgetOrder: (dashboardId: string, widgetId1: string, order1: number, widgetId2: string, order2: number) => void;
}) {
  return (
    <>
      <tr className={`client-row ${isExpanded ? "client-row-expanded" : ""}`} onClick={onToggle}>
        <td>
          <span className={`expand-arrow ${isExpanded ? "expand-arrow-open" : ""}`}>{"\u25B6"}</span>
        </td>
        <td>{pkg.displayName}</td>
        <td><code className="slug-badge">{pkg.slug}</code></td>
        <td>{pkg.sortOrder}</td>
        <td>
          <div className="action-buttons">
            <button className="icon-btn-muted icon-btn-view" title="Edit package" onClick={(e) => { e.stopPropagation(); onEdit(); }}><PencilIcon /></button>
            <button className="icon-btn-muted" title="Delete package" onClick={(e) => { e.stopPropagation(); onDelete(); }}><TrashIcon /></button>
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr className="detail-row">
          <td colSpan={5}>
            <div className="detail-content" style={{ paddingLeft: 24 }}>
              <div className="entities-section">
                <div className="entities-section-header">
                  <h3>Dashboards</h3>
                  <button className="add-entity-btn" onClick={onAddDashboard}>New Dashboard</button>
                </div>
                {dashboards.length === 0 ? (
                  <div className="entities-empty-sub">No dashboards yet.</div>
                ) : (
                  <table className="entities-sub-table">
                    <thead>
                      <tr>
                        <th style={{ width: 24 }}></th>
                        <th>Dashboard Name</th>
                        <th>Slug</th>
                        <th>Order</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboards.map((d) => {
                        const dashExpanded = expandedDashId === d.id;
                        const widgets = allWidgets[d.id] || [];
                        return (
                          <DashboardRow
                            key={d.id}
                            dashboard={d}
                            isExpanded={dashExpanded}
                            widgets={widgets}
                            onToggle={() => onToggleDash(d.id)}
                            onEdit={() => onEditDashboard(d)}
                            onDelete={() => onDeleteDashboard(d)}
                            onAddWidget={() => onAddWidget(d)}
                            onDeleteWidget={(wId) => onDeleteWidget(d.id, wId)}
                            onDeleteAllWidgets={() => onDeleteAllWidgets(d.id)}
                            onSwapWidgetOrder={(wId1, o1, wId2, o2) => onSwapWidgetOrder(d.id, wId1, o1, wId2, o2)}
                          />
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ─── Dashboard Row (nested accordion) ─── */

type WidgetSortColumn = "name" | "category" | "sortOrder";
type SortDirection = "asc" | "desc";
const PAGE_SIZE = 20;

function DashboardRow({
  dashboard, isExpanded, widgets,
  onToggle, onEdit, onDelete, onAddWidget, onDeleteWidget,
  onDeleteAllWidgets, onSwapWidgetOrder,
}: {
  dashboard: Dashboard;
  isExpanded: boolean;
  widgets: DashboardWidget[];
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddWidget: () => void;
  onDeleteWidget: (widgetId: string) => void;
  onDeleteAllWidgets: () => void;
  onSwapWidgetOrder: (widgetId1: string, order1: number, widgetId2: string, order2: number) => void;
}) {
  const { widgetTypeNames } = usePackages();
  const [sortColumn, setSortColumn] = useState<WidgetSortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [currentPage, setCurrentPage] = useState(1);

  // Reset page when widget count changes
  useEffect(() => { setCurrentPage(1); }, [widgets.length]);

  const handleSort = (column: WidgetSortColumn) => {
    if (sortColumn === column) {
      setSortDirection(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const sortIndicator = (column: WidgetSortColumn) => {
    if (sortColumn !== column)
      return <span className="sort-arrow sort-arrow-inactive">{"\u25B2"}</span>;
    return (
      <span className="sort-arrow">
        {sortDirection === "asc" ? "\u25B2" : "\u25BC"}
      </span>
    );
  };

  const sortedWidgets = useMemo(() => {
    if (!sortColumn) return [...widgets];
    const sorted = [...widgets].sort((a, b) => {
      if (sortColumn === "name") {
        const aName = (widgetTypeNames[a.widgetTypeId] || defaultWidgetName(a.widgetTypeId)).toLowerCase();
        const bName = (widgetTypeNames[b.widgetTypeId] || defaultWidgetName(b.widgetTypeId)).toLowerCase();
        return aName.localeCompare(bName);
      }
      if (sortColumn === "category") {
        const aCat = (getWidgetType(a.widgetTypeId)?.category || "").toLowerCase();
        const bCat = (getWidgetType(b.widgetTypeId)?.category || "").toLowerCase();
        return aCat.localeCompare(bCat);
      }
      return a.sortOrder - b.sortOrder;
    });
    return sortDirection === "desc" ? sorted.reverse() : sorted;
  }, [widgets, sortColumn, sortDirection]);

  const totalPages = Math.ceil(sortedWidgets.length / PAGE_SIZE);
  const paginatedWidgets = sortedWidgets.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // Show reorder arrows only when in natural order (no custom sort or sorting by order)
  const showReorderArrows = sortColumn === null || sortColumn === "sortOrder";

  return (
    <>
      <tr className={`client-row ${isExpanded ? "client-row-expanded" : ""}`} onClick={onToggle}>
        <td>
          <span className={`expand-arrow ${isExpanded ? "expand-arrow-open" : ""}`}>{"\u25B6"}</span>
        </td>
        <td>{dashboard.displayName}</td>
        <td><code className="slug-badge">{dashboard.slug}</code></td>
        <td>{dashboard.sortOrder}</td>
        <td>
          <div className="action-buttons">
            <button className="icon-btn-muted icon-btn-view" title="Edit dashboard" onClick={(e) => { e.stopPropagation(); onEdit(); }}><PencilIcon /></button>
            <button className="icon-btn-muted" title="Delete dashboard" onClick={(e) => { e.stopPropagation(); onDelete(); }}><TrashIcon /></button>
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr className="detail-row">
          <td colSpan={5}>
            <div className="detail-content" style={{ paddingLeft: 24 }}>
              <div className="entities-section">
                <div className="entities-section-header">
                  <h3>Widgets</h3>
                  <div style={{ display: "flex", gap: 8 }}>
                    {widgets.length > 0 && (
                      <button className="delete-btn" onClick={onDeleteAllWidgets}>Remove All</button>
                    )}
                    <button className="add-entity-btn" onClick={onAddWidget}>Add Widget</button>
                  </div>
                </div>
                {widgets.length === 0 ? (
                  <div className="entities-empty-sub">No widgets yet.</div>
                ) : (
                  <>
                    <table className="entities-sub-table">
                      <thead>
                        <tr>
                          <th className="sortable-th" onClick={() => handleSort("name")}>
                            Widget Type {sortIndicator("name")}
                          </th>
                          <th className="sortable-th" onClick={() => handleSort("category")}>
                            Category {sortIndicator("category")}
                          </th>
                          <th className="sortable-th" onClick={() => handleSort("sortOrder")}>
                            Order {sortIndicator("sortOrder")}
                          </th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedWidgets.map((w) => {
                          const wt = getWidgetType(w.widgetTypeId);
                          const naturalIndex = widgets.findIndex(nw => nw.id === w.id);
                          const isFirst = naturalIndex === 0;
                          const isLast = naturalIndex === widgets.length - 1;
                          return (
                            <tr key={w.id}>
                              <td>{widgetTypeNames[w.widgetTypeId] || defaultWidgetName(w.widgetTypeId)}</td>
                              <td>{wt?.category || "—"}</td>
                              <td>
                                {showReorderArrows ? (
                                  <div className="reorder-controls">
                                    <span>{w.sortOrder}</span>
                                    <div className="reorder-arrows">
                                      {!isFirst && (
                                        <button
                                          className="reorder-btn"
                                          title="Move up"
                                          onClick={() => {
                                            const prev = widgets[naturalIndex - 1];
                                            onSwapWidgetOrder(w.id, w.sortOrder, prev.id, prev.sortOrder);
                                          }}
                                        >{"\u25B2"}</button>
                                      )}
                                      {!isLast && (
                                        <button
                                          className="reorder-btn"
                                          title="Move down"
                                          onClick={() => {
                                            const next = widgets[naturalIndex + 1];
                                            onSwapWidgetOrder(w.id, w.sortOrder, next.id, next.sortOrder);
                                          }}
                                        >{"\u25BC"}</button>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  w.sortOrder
                                )}
                              </td>
                              <td>
                                <div className="action-buttons">
                                  <button className="icon-btn-muted" title="Remove widget" onClick={() => onDeleteWidget(w.id)}>
                                    <TrashIcon />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {totalPages > 1 && (
                      <div className="pagination-controls">
                        <button
                          className="pagination-btn"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(p => p - 1)}
                        >Previous</button>
                        <span className="pagination-info">
                          Page {currentPage} of {totalPages}
                        </span>
                        <button
                          className="pagination-btn"
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage(p => p + 1)}
                        >Next</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
