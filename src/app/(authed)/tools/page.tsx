"use client";

import { useState } from "react";
import { SANDBOXES } from "@/lib/sandboxes";
import { EntityConfig } from "@/lib/types";
import "./tools.css";

interface PreviewData {
  sourceTable: string;
  destinationTable: string;
  sourceItemCount: number;
  destinationItemCount: number;
  sourceItems: EntityConfig[];
}

interface ReportData {
  sourceLabel: string;
  destinationLabel: string;
  sourceTable: string;
  destinationTable: string;
  itemsCopied: number;
  itemsDeletedFromDestination: number;
  copiedItems: EntityConfig[];
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
          Copy client configuration between developer sandboxes.
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
            <ul>
              <li>{preview.sourceItemCount} client(s) will be copied</li>
              <li>
                {preview.destinationItemCount} existing client(s) in destination
                will be replaced
              </li>
            </ul>
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
                <tr>
                  <td>Items Copied</td>
                  <td>{report.itemsCopied}</td>
                </tr>
                <tr>
                  <td>Items Removed from Dest.</td>
                  <td>{report.itemsDeletedFromDestination}</td>
                </tr>
              </tbody>
            </table>
            {report.copiedItems.length > 0 && (
              <>
                <h4>Copied Clients</h4>
                <ul>
                  {report.copiedItems.map((c) => (
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
