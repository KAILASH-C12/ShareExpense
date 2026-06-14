"use client";

import { useState, useRef } from "react";
import AppLayout from "@/components/AppLayout";
import type { ImportResult, ImportAnomaly, ParsedExpense } from "@/lib/import-engine";

type ImportStep = "upload" | "review" | "confirm" | "report";

export default function ImportPage() {
  const [step, setStep] = useState<ImportStep>("upload");
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [importReport, setImportReport] = useState<{
    importReportId: number;
    importedExpenses: number;
    importedSettlements: number;
    totalAnomalies: number;
  } | null>(null);
  const [anomalyApprovals, setAnomalyApprovals] = useState<Record<string, boolean>>({});
  const [skipOverrides, setSkipOverrides] = useState<Record<number, boolean>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsvText(ev.target?.result as string);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsvText(ev.target?.result as string);
    };
    reader.readAsText(file);
  };

  const processCSV = async () => {
    if (!csvText) return;
    setLoading(true);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText, groupId: 1, userId: 1 }),
      });
      const data = await res.json();
      setResult(data);
      // Initialize approvals
      const approvals: Record<string, boolean> = {};
      data.anomalies.forEach((a: ImportAnomaly) => {
        approvals[a.id] = a.userApproved;
      });
      setAnomalyApprovals(approvals);
      setStep("review");
    } catch (err) {
      console.error("Import error:", err);
    }
    setLoading(false);
  };

  const confirmImport = async () => {
    if (!result) return;
    setLoading(true);
    try {
      // Apply skip overrides
      const finalExpenses = result.parsedExpenses.map((exp) => ({
        ...exp,
        skip: skipOverrides[exp.rowIndex] !== undefined ? skipOverrides[exp.rowIndex] : exp.skip,
      }));

      // Update anomaly approvals
      const finalAnomalies = result.anomalies.map((a) => ({
        ...a,
        userApproved: anomalyApprovals[a.id] ?? a.userApproved,
      }));

      const res = await fetch("/api/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: 1,
          userId: 1,
          filename: fileName,
          expenses: finalExpenses,
          anomalies: finalAnomalies,
        }),
      });
      const data = await res.json();
      setImportReport(data);
      setStep("report");
    } catch (err) {
      console.error("Confirm error:", err);
    }
    setLoading(false);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "error": return { bg: "rgba(255,82,82,0.1)", border: "#ff5252", text: "#ff5252" };
      case "warning": return { bg: "rgba(255,167,38,0.1)", border: "#ffa726", text: "#ffa726" };
      case "info": return { bg: "rgba(100,181,246,0.1)", border: "#64b5f6", text: "#64b5f6" };
      default: return { bg: "rgba(255,255,255,0.05)", border: "#666", text: "#999" };
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case "auto_fixed": return <span className="badge badge-info">Auto-fixed</span>;
      case "skip_row": return <span className="badge badge-warning">Skip</span>;
      case "flag_for_review": return <span className="badge badge-error">Needs Review</span>;
      case "keep_as_is": return <span className="badge badge-success">Keep</span>;
      case "convert_to_settlement": return <span className="badge" style={{ background: "rgba(171,71,188,0.15)", color: "#ab47bc" }}>→ Settlement</span>;
      default: return <span className="badge badge-info">{action}</span>;
    }
  };

  return (
    <AppLayout>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        {/* Header */}
        <div className="animate-fade-in-up" style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>
            📁 <span className="gradient-text">Import CSV</span>
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            Upload your expenses spreadsheet — we&apos;ll detect anomalies and help you clean up
          </p>
        </div>

        {/* Progress Steps */}
        <div className="glass-card-static animate-fade-in-up" style={{
          padding: "16px 24px", marginBottom: 24,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          {["upload", "review", "confirm", "report"].map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700,
                background: step === s
                  ? "linear-gradient(135deg, #6c63ff, #00d4aa)"
                  : ["upload", "review", "confirm", "report"].indexOf(step) > i
                    ? "var(--success)" : "rgba(255,255,255,0.06)",
                color: "white",
              }}>
                {["upload", "review", "confirm", "report"].indexOf(step) > i ? "✓" : i + 1}
              </div>
              <span style={{
                fontSize: 13, fontWeight: step === s ? 600 : 400,
                color: step === s ? "var(--foreground)" : "var(--text-secondary)",
                textTransform: "capitalize",
              }}>
                {s}
              </span>
              {i < 3 && <div style={{ flex: 1, height: 1, background: "var(--card-border)" }} />}
            </div>
          ))}
        </div>

        {/* Step: Upload */}
        {step === "upload" && (
          <div className="animate-fade-in-up">
            <div
              className={`drop-zone ${csvText ? "active" : ""}`}
              onClick={() => fileRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                style={{ display: "none" }}
              />
              {csvText ? (
                <>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                    {fileName}
                  </div>
                  <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                    {csvText.split("\n").length - 1} rows detected • Click to change file
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                    Drop your CSV file here
                  </div>
                  <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                    or click to browse • Supports expenses_export.csv format
                  </div>
                </>
              )}
            </div>

            {csvText && (
              <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
                <button className="btn-primary" onClick={processCSV} disabled={loading}>
                  {loading ? "Processing..." : "🔍 Analyze & Detect Anomalies"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step: Review Anomalies */}
        {step === "review" && result && (
          <div className="animate-fade-in-up">
            {/* Summary */}
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
              gap: 12, marginBottom: 24,
            }}>
              <div className="stat-card purple" style={{ padding: 16 }}>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Total Rows</div>
                <div style={{ fontSize: 24, fontWeight: 800 }}>{result.totalRows}</div>
              </div>
              <div className="stat-card green" style={{ padding: 16 }}>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Will Import</div>
                <div style={{ fontSize: 24, fontWeight: 800 }}>{result.importedCount}</div>
              </div>
              <div className="stat-card orange" style={{ padding: 16 }}>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Anomalies</div>
                <div style={{ fontSize: 24, fontWeight: 800 }}>{result.anomalies.length}</div>
              </div>
              <div className="stat-card pink" style={{ padding: 16 }}>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Will Skip</div>
                <div style={{ fontSize: 24, fontWeight: 800 }}>{result.skippedCount}</div>
              </div>
            </div>

            {/* Anomaly List */}
            <div className="glass-card-static" style={{ padding: 24, marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
                🔍 Anomalies Detected ({result.anomalies.length})
              </h2>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
                Review each issue. Toggle &quot;Approve&quot; to accept auto-fixes, or override skip decisions.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {result.anomalies.map((anomaly) => {
                  const colors = getSeverityColor(anomaly.severity);
                  return (
                    <div
                      key={anomaly.id}
                      className={`anomaly-card severity-${anomaly.severity}`}
                      style={{ borderLeft: `3px solid ${colors.border}` }}
                    >
                      <div style={{
                        display: "flex", alignItems: "flex-start",
                        justifyContent: "space-between", gap: 16,
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            display: "flex", alignItems: "center", gap: 8, marginBottom: 6,
                          }}>
                            <span className={`badge badge-${anomaly.severity}`}>
                              {anomaly.severity.toUpperCase()}
                            </span>
                            <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                              Row {anomaly.csvRow}
                            </span>
                            <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                              • {anomaly.anomalyType.replace(/_/g, " ")}
                            </span>
                          </div>
                          <div style={{ fontSize: 14, lineHeight: 1.5 }}>
                            {anomaly.description}
                          </div>
                          {anomaly.autoFixValue && (
                            <div style={{
                              marginTop: 6, fontSize: 12, color: "var(--info)",
                              padding: "4px 8px", borderRadius: 6,
                              background: "rgba(100,181,246,0.08)",
                              display: "inline-block",
                            }}>
                              Fix: {anomaly.autoFixValue}
                            </div>
                          )}
                        </div>
                        <div style={{
                          display: "flex", flexDirection: "column",
                          alignItems: "flex-end", gap: 8,
                        }}>
                          {getActionBadge(anomaly.suggestedAction)}
                          <button
                            onClick={() => {
                              setAnomalyApprovals((prev) => ({
                                ...prev,
                                [anomaly.id]: !prev[anomaly.id],
                              }));
                            }}
                            style={{
                              padding: "6px 14px", borderRadius: 8, fontSize: 12,
                              fontWeight: 600, cursor: "pointer", border: "none",
                              background: anomalyApprovals[anomaly.id]
                                ? "rgba(0,212,170,0.15)" : "rgba(255,255,255,0.06)",
                              color: anomalyApprovals[anomaly.id]
                                ? "var(--success)" : "var(--text-secondary)",
                              transition: "all 0.2s ease",
                            }}
                          >
                            {anomalyApprovals[anomaly.id] ? "✓ Approved" : "Approve"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Expense Preview Table */}
            <div className="glass-card-static" style={{ padding: 24, marginBottom: 24, overflowX: "auto" }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
                📋 Expense Preview
              </h2>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Paid By</th>
                    <th>Amount</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {result.parsedExpenses.map((exp) => {
                    const isSkipped = skipOverrides[exp.rowIndex] !== undefined
                      ? skipOverrides[exp.rowIndex]
                      : exp.skip;
                    return (
                      <tr key={exp.rowIndex} style={{ opacity: isSkipped ? 0.4 : 1 }}>
                        <td style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{exp.rowIndex}</td>
                        <td style={{ fontSize: 13 }}>
                          {exp.date ? new Date(exp.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : exp.dateString}
                        </td>
                        <td style={{ fontSize: 13, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {exp.description}
                          {exp.isSettlement && <span className="badge" style={{ marginLeft: 6, background: "rgba(171,71,188,0.15)", color: "#ab47bc", fontSize: 10 }}>Settlement</span>}
                        </td>
                        <td style={{ fontSize: 13 }}>{exp.paidBy || "—"}</td>
                        <td style={{ fontSize: 13, fontWeight: 600 }}>
                          {exp.currency === "USD" ? "$" : "₹"}{Math.abs(exp.amount).toLocaleString()}
                        </td>
                        <td><span className="badge badge-info" style={{ fontSize: 10 }}>{exp.splitType || "—"}</span></td>
                        <td>
                          {isSkipped ? (
                            <span className="badge badge-warning">Skip</span>
                          ) : exp.anomalies.length > 0 ? (
                            <span className="badge badge-error">{exp.anomalies.length} issues</span>
                          ) : (
                            <span className="badge badge-success">OK</span>
                          )}
                        </td>
                        <td>
                          <button
                            onClick={() => setSkipOverrides((prev) => ({
                              ...prev,
                              [exp.rowIndex]: !isSkipped,
                            }))}
                            style={{
                              padding: "4px 10px", borderRadius: 6, fontSize: 11,
                              cursor: "pointer", border: "none",
                              background: isSkipped ? "rgba(0,212,170,0.1)" : "rgba(255,82,82,0.1)",
                              color: isSkipped ? "var(--success)" : "var(--error)",
                              fontWeight: 600,
                            }}
                          >
                            {isSkipped ? "Include" : "Skip"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button className="btn-secondary" onClick={() => setStep("upload")}>
                ← Back
              </button>
              <button className="btn-primary" onClick={() => setStep("confirm")}>
                Continue to Confirm →
              </button>
            </div>
          </div>
        )}

        {/* Step: Confirm */}
        {step === "confirm" && result && (
          <div className="animate-fade-in-up">
            <div className="glass-card-static" style={{ padding: 32, textAlign: "center" }}>
              <div style={{ fontSize: 64, marginBottom: 20 }}>🚀</div>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
                Ready to Import
              </h2>
              <p style={{ color: "var(--text-secondary)", marginBottom: 24, maxWidth: 450, margin: "0 auto 24px" }}>
                {result.importedCount - Object.values(skipOverrides).filter(Boolean).length} expenses
                will be imported into the &quot;Flatmates&quot; group. {result.anomalies.length} anomalies
                will be logged in the import report.
              </p>

              <div style={{
                display: "flex", gap: 12, justifyContent: "center",
              }}>
                <button className="btn-secondary" onClick={() => setStep("review")}>
                  ← Review Again
                </button>
                <button className="btn-success" onClick={confirmImport} disabled={loading}>
                  {loading ? "Importing..." : "✅ Confirm & Import"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step: Report */}
        {step === "report" && importReport && (
          <div className="animate-fade-in-up">
            <div className="glass-card-static" style={{ padding: 32, textAlign: "center" }}>
              <div style={{ fontSize: 64, marginBottom: 20 }}>🎉</div>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
                Import Complete!
              </h2>
              <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>
                Successfully imported data into the database.
              </p>

              <div style={{
                display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
                gap: 12, marginBottom: 32, maxWidth: 500, margin: "0 auto 32px",
              }}>
                <div className="stat-card green" style={{ padding: 16 }}>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Expenses</div>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>{importReport.importedExpenses}</div>
                </div>
                <div className="stat-card purple" style={{ padding: 16 }}>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Settlements</div>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>{importReport.importedSettlements}</div>
                </div>
                <div className="stat-card orange" style={{ padding: 16 }}>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Anomalies</div>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>{importReport.totalAnomalies}</div>
                </div>
              </div>

              {/* Anomaly Report */}
              {result && result.anomalies.length > 0 && (
                <div style={{ textAlign: "left", marginTop: 24 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
                    📋 Import Anomaly Report
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {result.anomalies.map((a) => (
                      <div key={a.id} className={`anomaly-card severity-${a.severity}`} style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span className={`badge badge-${a.severity}`} style={{ fontSize: 10 }}>
                            {a.severity}
                          </span>
                          <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                            Row {a.csvRow} • {a.anomalyType.replace(/_/g, " ")}
                          </span>
                          {getActionBadge(a.suggestedAction)}
                        </div>
                        <div style={{ fontSize: 13 }}>{a.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginTop: 32, display: "flex", gap: 12, justifyContent: "center" }}>
                <a href="/dashboard">
                  <button className="btn-primary">
                    📊 Go to Dashboard
                  </button>
                </a>
                <a href="/expenses">
                  <button className="btn-secondary">
                    💰 View Expenses
                  </button>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
