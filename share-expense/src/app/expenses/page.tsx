"use client";

import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";

interface ExpenseSplit {
  userId: number;
  user: { name: string };
  shareAmount: string;
  shareAmountInr: string;
  percentage: string | null;
  shareUnits: string | null;
}

interface Expense {
  id: number;
  description: string;
  amount: string;
  currency: string;
  exchangeRate: string;
  splitType: string;
  notes: string | null;
  expenseDate: string;
  isSettlement: boolean;
  importSource: string | null;
  importRow: number | null;
  paidBy: { id: number; name: string };
  splits: ExpenseSplit[];
}

const AVATAR_COLORS: Record<string, string> = {
  Aisha: "#6c63ff", Rohan: "#00d4aa", Priya: "#ff6b9d",
  Meera: "#ffa726", Dev: "#64b5f6", Sam: "#ab47bc",
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<string>("all");

  useEffect(() => {
    fetch("/api/expenses?groupId=1")
      .then((r) => r.json())
      .then((d) => { setExpenses(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = expenses.filter((e) => {
    if (filterType === "all") return true;
    if (filterType === "settlement") return e.isSettlement;
    return e.splitType === filterType;
  });

  const formatCurrency = (amount: number, currency: string) => {
    return currency === "USD"
      ? `$${amount.toLocaleString()}`
      : `₹${amount.toLocaleString("en-IN")}`;
  };

  return (
    <AppLayout>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div className="animate-fade-in-up" style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>
            💰 <span className="gradient-text">Expenses</span>
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            All group expenses with full split breakdowns • Click any row for details
          </p>
        </div>

        {/* Filters */}
        <div className="glass-card-static animate-fade-in-up" style={{
          padding: "12px 16px", marginBottom: 20,
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
        }}>
          {[
            { key: "all", label: "All" },
            { key: "equal", label: "Equal" },
            { key: "unequal", label: "Unequal" },
            { key: "percentage", label: "Percentage" },
            { key: "share", label: "Share" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilterType(f.key)}
              style={{
                padding: "6px 16px", borderRadius: 8, border: "none",
                background: filterType === f.key ? "var(--accent)" : "rgba(255,255,255,0.04)",
                color: filterType === f.key ? "white" : "var(--text-secondary)",
                fontSize: 13, fontWeight: 500, cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              {f.label}
            </button>
          ))}
          <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--text-tertiary)" }}>
            {filtered.length} expenses
          </span>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "var(--text-secondary)" }}>
            Loading expenses...
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-card-static" style={{ padding: 60, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>💰</div>
            <p style={{ color: "var(--text-secondary)" }}>No expenses found. Import CSV to get started!</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map((expense) => {
              const isExpanded = expandedId === expense.id;
              const amount = parseFloat(expense.amount);
              const exchangeRate = parseFloat(expense.exchangeRate);

              return (
                <div key={expense.id} className="glass-card" style={{ padding: 0, overflow: "hidden" }}>
                  {/* Row Header */}
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : expense.id)}
                    style={{
                      padding: "16px 20px",
                      display: "flex", alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                      <div className="avatar avatar-sm" style={{
                        background: `linear-gradient(135deg, ${AVATAR_COLORS[expense.paidBy.name] || "#666"}, ${AVATAR_COLORS[expense.paidBy.name] || "#666"}99)`,
                        color: "white",
                      }}>
                        {expense.paidBy.name.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>
                          {expense.description}
                          {expense.isSettlement && (
                            <span className="badge" style={{
                              marginLeft: 8, background: "rgba(171,71,188,0.15)",
                              color: "#ab47bc", fontSize: 10,
                            }}>
                              Settlement
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
                          {new Date(expense.expenseDate).toLocaleDateString("en-IN", {
                            day: "2-digit", month: "short", year: "numeric",
                          })} • Paid by {expense.paidBy.name} • {expense.splitType}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>
                        {formatCurrency(amount, expense.currency)}
                      </div>
                      {expense.currency === "USD" && (
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                          ≈ ₹{(amount * exchangeRate).toLocaleString("en-IN")}
                        </div>
                      )}
                    </div>
                    <span style={{
                      marginLeft: 12, color: "var(--text-tertiary)",
                      transition: "transform 0.2s ease",
                      transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                    }}>
                      ▼
                    </span>
                  </div>

                  {/* Expanded Details — Rohan's Request */}
                  {isExpanded && (
                    <div style={{
                      padding: "0 20px 16px",
                      borderTop: "1px solid var(--card-border)",
                      animation: "fadeIn 0.2s ease",
                    }}>
                      <div style={{ paddingTop: 16 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "var(--text-secondary)" }}>
                          Split Breakdown
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {expense.splits.map((split) => {
                            const shareInr = parseFloat(split.shareAmountInr);
                            const shareOrig = parseFloat(split.shareAmount);
                            return (
                              <div key={split.userId} style={{
                                display: "flex", alignItems: "center",
                                justifyContent: "space-between",
                                padding: "8px 12px", borderRadius: 8,
                                background: "rgba(255,255,255,0.02)",
                              }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <div className="avatar avatar-sm" style={{
                                    background: `linear-gradient(135deg, ${AVATAR_COLORS[split.user.name] || "#666"}, ${AVATAR_COLORS[split.user.name] || "#666"}99)`,
                                    color: "white", fontSize: 10,
                                  }}>
                                    {split.user.name.charAt(0)}
                                  </div>
                                  <span style={{ fontSize: 13 }}>{split.user.name}</span>
                                  {split.user.name === expense.paidBy.name && (
                                    <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>(paid)</span>
                                  )}
                                </div>
                                <div style={{ textAlign: "right" }}>
                                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                                    ₹{shareInr.toLocaleString("en-IN")}
                                  </span>
                                  {expense.currency === "USD" && (
                                    <span style={{ fontSize: 11, color: "var(--text-tertiary)", marginLeft: 6 }}>
                                      (${shareOrig})
                                    </span>
                                  )}
                                  {split.percentage && (
                                    <span style={{ fontSize: 11, color: "var(--text-tertiary)", marginLeft: 6 }}>
                                      ({split.percentage}%)
                                    </span>
                                  )}
                                  {split.shareUnits && (
                                    <span style={{ fontSize: 11, color: "var(--text-tertiary)", marginLeft: 6 }}>
                                      ({split.shareUnits} units)
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {expense.notes && (
                          <div style={{
                            marginTop: 12, padding: "8px 12px", borderRadius: 8,
                            background: "rgba(108,99,255,0.05)",
                            fontSize: 13, color: "var(--text-secondary)",
                          }}>
                            📝 {expense.notes}
                          </div>
                        )}
                        {expense.importRow && (
                          <div style={{
                            marginTop: 8, fontSize: 11, color: "var(--text-tertiary)",
                          }}>
                            Imported from CSV row {expense.importRow}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
