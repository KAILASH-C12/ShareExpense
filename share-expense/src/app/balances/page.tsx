"use client";

import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";

interface MemberBalance {
  userId: number;
  name: string;
  totalPaid: number;
  totalOwed: number;
  netBalance: number;
}

interface ExpenseBreakdown {
  id: number;
  description: string;
  date: string;
  paidBy: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  splitType: string;
  splits: { userId: number; userName: string; shareAmount: number; shareAmountInr: number }[];
}

interface BalanceData {
  memberBalances: MemberBalance[];
  simplifiedDebts: { from: string; to: string; amount: number }[];
  expenseBreakdown: ExpenseBreakdown[];
}

const AVATAR_COLORS: Record<string, string> = {
  Aisha: "#6c63ff", Rohan: "#00d4aa", Priya: "#ff6b9d",
  Meera: "#ffa726", Dev: "#64b5f6", Sam: "#ab47bc",
};

export default function BalancesPage() {
  const [data, setData] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/balances?groupId=1")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const formatCurrency = (amount: number) =>
    `₹${Math.abs(amount).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  // Filter expenses for selected member
  const memberExpenses = data?.expenseBreakdown.filter((e) =>
    selectedMember ? e.splits.some((s) => s.userName === selectedMember) || e.paidBy === selectedMember : false
  ) || [];

  return (
    <AppLayout>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div className="animate-fade-in-up" style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>
            ⚖️ <span className="gradient-text">Balances</span>
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            Detailed balance breakdown per member • Click a member to drill down into their expenses
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "var(--text-secondary)" }}>
            Loading balances...
          </div>
        ) : !data ? (
          <div className="glass-card-static" style={{ padding: 60, textAlign: "center" }}>
            <p style={{ color: "var(--text-secondary)" }}>No data available</p>
          </div>
        ) : (
          <>
            {/* Member Balance Cards */}
            <div className="stagger-children" style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 16, marginBottom: 32,
            }}>
              {data.memberBalances.map((member) => (
                <div
                  key={member.userId}
                  className="glass-card"
                  onClick={() => setSelectedMember(selectedMember === member.name ? null : member.name)}
                  style={{
                    padding: 20, cursor: "pointer",
                    border: selectedMember === member.name
                      ? `2px solid ${AVATAR_COLORS[member.name] || "#666"}`
                      : undefined,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                    <div className="avatar" style={{
                      background: `linear-gradient(135deg, ${AVATAR_COLORS[member.name] || "#666"}, ${AVATAR_COLORS[member.name] || "#666"}99)`,
                      color: "white",
                    }}>
                      {member.name.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{member.name}</div>
                      <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                        {member.netBalance >= 0 ? "is owed money" : "owes money"}
                      </div>
                    </div>
                  </div>

                  <div style={{
                    fontSize: 28, fontWeight: 800, marginBottom: 12,
                    color: member.netBalance >= 0 ? "var(--success)" : "var(--error)",
                  }}>
                    {member.netBalance >= 0 ? "+" : "-"}{formatCurrency(member.netBalance)}
                  </div>

                  <div style={{ display: "flex", gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 2 }}>Total Paid</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--success)" }}>
                        {formatCurrency(member.totalPaid)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 2 }}>Total Share</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--error)" }}>
                        {formatCurrency(member.totalOwed)}
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="progress-bar" style={{ marginTop: 12 }}>
                    <div className="progress-bar-fill" style={{
                      width: `${member.totalOwed > 0 ? Math.min((member.totalPaid / (member.totalPaid + member.totalOwed)) * 100, 100) : 50}%`,
                      background: `linear-gradient(90deg, ${AVATAR_COLORS[member.name] || "#666"}, ${AVATAR_COLORS[member.name] || "#666"}80)`,
                    }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Member Expense Drill-Down */}
            {selectedMember && (
              <div className="glass-card-static animate-fade-in-up" style={{ padding: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
                  📋 {selectedMember}&apos;s Expense Breakdown
                </h3>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
                  Every expense that affects {selectedMember}&apos;s balance
                </p>

                {memberExpenses.length === 0 ? (
                  <p style={{ color: "var(--text-tertiary)", textAlign: "center", padding: 20 }}>
                    No expenses found
                  </p>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Paid By</th>
                        <th>Total</th>
                        <th>{selectedMember}&apos;s Share</th>
                        <th>Impact</th>
                      </tr>
                    </thead>
                    <tbody>
                      {memberExpenses.map((e) => {
                        const memberSplit = e.splits.find((s) => s.userName === selectedMember);
                        const shareInr = memberSplit?.shareAmountInr || 0;
                        const amountInr = e.amount * e.exchangeRate;
                        const isPayer = e.paidBy === selectedMember;
                        const impact = isPayer ? amountInr - shareInr : -shareInr;

                        return (
                          <tr key={e.id}>
                            <td style={{ fontSize: 13 }}>
                              {new Date(e.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                            </td>
                            <td style={{ fontSize: 13 }}>{e.description}</td>
                            <td style={{ fontSize: 13 }}>
                              <span style={{ color: isPayer ? "var(--success)" : "var(--foreground)" }}>
                                {e.paidBy}
                              </span>
                            </td>
                            <td style={{ fontSize: 13 }}>
                              {e.currency === "USD" ? "$" : "₹"}{e.amount.toLocaleString()}
                            </td>
                            <td style={{ fontSize: 13, fontWeight: 600 }}>
                              ₹{shareInr.toLocaleString("en-IN")}
                            </td>
                            <td style={{
                              fontSize: 13, fontWeight: 600,
                              color: impact >= 0 ? "var(--success)" : "var(--error)",
                            }}>
                              {impact >= 0 ? "+" : ""}₹{Math.abs(Math.round(impact)).toLocaleString("en-IN")}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Simplified Debts */}
            <div className="glass-card-static animate-fade-in-up" style={{ padding: 24, marginTop: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
                💡 Simplified Settlements
              </h3>
              {data.simplifiedDebts.map((debt, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 16px", borderRadius: 10,
                  background: "rgba(255,255,255,0.02)", marginBottom: 8,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 600 }}>{debt.from}</span>
                    <span style={{ color: "var(--text-tertiary)" }}>→</span>
                    <span style={{ fontWeight: 600 }}>{debt.to}</span>
                  </div>
                  <span style={{ fontWeight: 800, color: "var(--accent)", fontSize: 16 }}>
                    {formatCurrency(debt.amount)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
