"use client";

import { Package, Dashboard, DashboardWidget } from "@/lib/types";
import { getWidgetType } from "@/widgets/registry";

/* ─── Package Row (nested accordion) ─── */

export function PackageRow({
  pkg, isExpanded, dashboards, allWidgets, expandedDashId,
  onToggle, onEdit, onDelete, onAddDashboard, onEditDashboard, onDeleteDashboard,
  onToggleDash, onAddWidget, onDeleteWidget,
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
            <button className="edit-btn" onClick={(e) => { e.stopPropagation(); onEdit(); }}>Edit</button>
            <button className="delete-btn" onClick={(e) => { e.stopPropagation(); onDelete(); }}>Delete</button>
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

function DashboardRow({
  dashboard, isExpanded, widgets,
  onToggle, onEdit, onDelete, onAddWidget, onDeleteWidget,
}: {
  dashboard: Dashboard;
  isExpanded: boolean;
  widgets: DashboardWidget[];
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddWidget: () => void;
  onDeleteWidget: (widgetId: string) => void;
}) {
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
            <button className="edit-btn" onClick={(e) => { e.stopPropagation(); onEdit(); }}>Edit</button>
            <button className="delete-btn" onClick={(e) => { e.stopPropagation(); onDelete(); }}>Delete</button>
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
                  <button className="add-entity-btn" onClick={onAddWidget}>Add Widget</button>
                </div>
                {widgets.length === 0 ? (
                  <div className="entities-empty-sub">No widgets yet.</div>
                ) : (
                  <table className="entities-sub-table">
                    <thead>
                      <tr>
                        <th>Widget Type</th>
                        <th>Category</th>
                        <th>Order</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {widgets.map((w) => {
                        const wt = getWidgetType(w.widgetTypeId);
                        return (
                          <tr key={w.id}>
                            <td>{wt?.name || w.widgetTypeId}</td>
                            <td>{wt?.category || "—"}</td>
                            <td>{w.sortOrder}</td>
                            <td>
                              <div className="action-buttons">
                                <button className="delete-btn" onClick={() => onDeleteWidget(w.id)}>Remove</button>
                              </div>
                            </td>
                          </tr>
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
