"use client";

import { useState } from "react";
import { SANDBOXES } from "@/lib/sandboxes";
import "./tools.css";

interface TablePreview {
  typeKey: string;
  displayLabel: string;
  sourceItemCount: number;
  destinationItemCount: number;
}

interface PreviewData {
  tables: TablePreview[];
  totalSourceItems: number;
  totalDestinationItems: number;
}

interface TableReport {
  typeKey: string;
  displayLabel: string;
  itemsCopied: number;
  itemsDeletedFromDestination: number;
}

interface ReportData {
  sourceLabel: string;
  destinationLabel: string;
  tables: TableReport[];
  totalItemsCopied: number;
  totalItemsDeleted: number;
  copiedClientNames: { id: string; displayName: string }[];
}

type Status = "idle" | "previewing" | "confirming" | "syncing" | "done" | "error";

export default function ToolsPage() {
  const [sourceId, setSourceId] = useState(SANDBOXES[0].id);
  const [destinationId, setDestinationId] = useState(SANDBOXES[1].id);
  const [status, setStatus] = useState<Status>("idle");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [error, setError] = useState("");

  const sourceLabel = SANDBOXES.find((s) => s.id === sourceId)?.label ?? sourceId;
  const destinationLabel = SANDBOXES.find((s) => s.id === destinationId)?.label ?? destinationId;

  const handleGo = async () => {
    if (sourceId === destinationId) {
      alert("Source and destination must be different.");
      return;
    }

    setStatus("previewing");
    setError("");
    setReport(null);

    try {
      const res = await fetch("/api/tools/sync-sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId, destinationId, preview: true }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `API error: ${res.status}`);
      }

      const data = await res.json();
      setPreview(data);
      setStatus("confirming");
    } catch (err: any) {
      setError(err.message || "Failed to load preview");
      setStatus("error");
    }
  };

  const handleConfirm = async () => {
    setStatus("syncing");
    setError("");

    try {
      const res = await fetch("/api/tools/sync-sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId, destinationId }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `API error: ${res.status}`);
      }

      const data = await res.json();
      setReport(data.report);
      setPreview(null);
      setStatus("done");
    } catch (err: any) {
      setError(err.message || "Sync failed");
      setStatus("error");
    }
  };

  const handleCancel = () => {
    setStatus("idle");
    setPreview(null);
  };

  return (
    <div className="tools-page">
      <div className="tools-header">
        <h1>Tools</h1>
      </div>

      <section className="tool-section">
        <h2>Sandbox Data Sync</h2>
        <p className="tool-description">
          Copy all configuration tables between developer sandboxes.
        </p>

        <div className="sync-controls">
          <div className="sync-field">
            <label>Copy From</label>
            <select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
              {SANDBOXES.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          <span className="sync-arrow">&rarr;</span>

          <div className="sync-field">
            <label>Copy To</label>
            <select value={destinationId} onChange={(e) => setDestinationId(e.target.value)}>
              {SANDBOXES.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          <button
            className="sync-go-btn"
            onClick={handleGo}
            disabled={status === "previewing" || status === "syncing"}
          >
            {status === "previewing" ? "Loading..." : "Go"}
          </button>
        </div>

        {status === "confirming" && preview && (
          <div className="sync-confirm">
            <p>
              Are you sure you want to copy sandbox data from{" "}
              <strong>{sourceLabel}</strong> to <strong>{destinationLabel}</strong>?
            </p>
            <table className="sync-preview-table">
              <thead>
                <tr>
                  <th>Table</th>
                  <th>Source</th>
                  <th>Destination</th>
                </tr>
              </thead>
              <tbody>
                {preview.tables.map((t) => (
                  <tr key={t.typeKey}>
                    <td>{t.displayLabel}</td>
                    <td>{t.sourceItemCount}</td>
                    <td>{t.destinationItemCount}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td><strong>Total</strong></td>
                  <td><strong>{preview.totalSourceItems}</strong></td>
                  <td><strong>{preview.totalDestinationItems}</strong></td>
                </tr>
              </tfoot>
            </table>
            <p className="sync-confirm-summary">
              {preview.totalSourceItems} item(s) will be copied.{" "}
              {preview.totalDestinationItems} existing item(s) will be replaced.
            </p>
            <div className="sync-confirm-actions">
              <button className="sync-cancel-btn" onClick={handleCancel}>
                Cancel
              </button>
              <button className="sync-confirm-btn" onClick={handleConfirm}>
                Confirm
              </button>
            </div>
          </div>
        )}

        {status === "syncing" && (
          <div className="app-loading">Syncing...</div>
        )}

        {status === "done" && report && (
          <div className="sync-report">
            <h3>Sync Complete</h3>
            <table className="sync-report-table">
              <tbody>
                <tr>
                  <td>Source</td>
                  <td>{report.sourceLabel}</td>
                </tr>
                <tr>
                  <td>Destination</td>
                  <td>{report.destinationLabel}</td>
                </tr>
              </tbody>
            </table>

            <h4>Per-Table Results</h4>
            <table className="sync-detail-table">
              <thead>
                <tr>
                  <th>Table</th>
                  <th>Copied</th>
                  <th>Removed</th>
                </tr>
              </thead>
              <tbody>
                {report.tables.map((t) => (
                  <tr key={t.typeKey}>
                    <td>{t.displayLabel}</td>
                    <td>{t.itemsCopied}</td>
                    <td>{t.itemsDeletedFromDestination}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td><strong>Total</strong></td>
                  <td><strong>{report.totalItemsCopied}</strong></td>
                  <td><strong>{report.totalItemsDeleted}</strong></td>
                </tr>
              </tfoot>
            </table>

            {report.copiedClientNames.length > 0 && (
              <>
                <h4>Copied Clients</h4>
                <ul>
                  {report.copiedClientNames.map((c) => (
                    <li key={c.id}>
                      {c.displayName} ({c.id})
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        {status === "error" && error && (
          <div className="app-error">{error}</div>
        )}
      </section>
    </div>
  );
}
