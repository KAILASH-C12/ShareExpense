"use client";

import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import Link from "next/link";

interface MemberBalance {
  userId: number;
  name: string;
  totalPaid: number;
  totalOwed: number;
  netBalance: number;
}

interface SimplifiedDebt {
  from: string;
  fromId: number;
  to: string;
  toId: number;
  amount: number;
}

interface BalanceData {
  memberBalances: MemberBalance[];
  simplifiedDebts: SimplifiedDebt[];
  expenseCount: number;
  settlementCount: number;
}

const AVATAR_COLORS: Record<string, string> = {
  Aisha: "#6c63ff",
  Rohan: "#00d4aa",
  Priya: "#ff6b9d",
  Meera: "#ffa726",
  Dev: "#64b5f6",
  Sam: "#ab47bc",
};

export default function DashboardPage() {
  const [data, setData] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<string>("");

  useEffect(() => {
    const stored = localStorage.getItem("shareexpense_user");
    if (stored) {
      const user = JSON.parse(stored);
      setCurrentUser(user.name);
    }

    fetch("/api/balances?groupId=1")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const formatCurrency = (amount: number) => {
    const sign = amount >= 0 ? "" : "-";
    return `${sign}₹${Math.abs(amount).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  return (
    <AppLayout>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Header */}
        <div className="animate-fade-in-up" style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>
            Welcome back, <span className="gradient-text">{currentUser}</span>
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            Here&apos;s your group expense summary
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "var(--text-secondary)" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⚡</div>
            Loading your data...
          </div>
        ) : !data || data.expenseCount === 0 ? (
          /* Empty State */
          <div className="glass-card-static animate-fade-in-up" style={{
            padding: 60, textAlign: "center",
          }}>
            <div style={{ fontSize: 64, marginBottom: 20 }}>📊</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
              No expenses yet
            </h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: 24, maxWidth: 400, margin: "0 auto 24px" }}>
              Import your CSV file to get started. We&apos;ll detect anomalies and help you clean up the data.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <Link href="/import">
                <button className="btn-primary">
                  📁 Import CSV
                </button>
              </Link>
              <Link href="/expenses">
                <button className="btn-secondary">
                  ➕ Add Expense
                </button>
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Stat Cards */}
            <div className="stagger-children" style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 16,
              marginBottom: 32,
            }}>
              <div className="stat-card purple">
                <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                  Total Expenses
                </div>
                <div style={{ fontSize: 28, fontWeight: 800 }}>
                  {data.expenseCount}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 }}>
                  across all members
                </div>
              </div>

              <div className="stat-card green">
                <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                  Settlements
                </div>
                <div style={{ fontSize: 28, fontWeight: 800 }}>
                  {data.settlementCount}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 }}>
                  recorded payments
                </div>
              </div>

              <div className="stat-card orange">
                <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                  Pending Transfers
                </div>
                <div style={{ fontSize: 28, fontWeight: 800 }}>
                  {data.simplifiedDebts.length}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 }}>
                  to settle all debts
                </div>
              </div>

              <div className="stat-card pink">
                <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                  Active Members
                </div>
                <div style={{ fontSize: 28, fontWeight: 800 }}>
                  {data.memberBalances.length}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 }}>
                  in the group
                </div>
              </div>
            </div>

            {/* Simplified Debts — Aisha's Request */}
            <div className="glass-card-static animate-fade-in-up" style={{ padding: 24, marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700 }}>
                    💡 Who Pays Whom
                  </h2>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
                    Simplified — minimum transfers to settle all debts
                  </p>
                </div>
                <Link href="/settlements">
                  <button className="btn-success" style={{ padding: "10px 20px", fontSize: 13 }}>
                    ✅ Settle Up
                  </button>
                </Link>
              </div>

              {data.simplifiedDebts.length === 0 ? (
                <div style={{ textAlign: "center", padding: 32, color: "var(--text-secondary)" }}>
                  🎉 All settled! No pending debts.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {data.simplifiedDebts.map((debt, i) => (
                    <div key={i} className="glass-card" style={{
                      padding: "16px 20px",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div className="avatar" style={{
                          background: `linear-gradient(135deg, ${AVATAR_COLORS[debt.from] || "#666"}, ${AVATAR_COLORS[debt.from] || "#666"}99)`,
                          color: "white",
                        }}>
                          {debt.from.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{debt.from}</div>
                          <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>pays</div>
                        </div>
                        <div style={{ color: "var(--text-tertiary)", fontSize: 20 }}>→</div>
                        <div className="avatar" style={{
                          background: `linear-gradient(135deg, ${AVATAR_COLORS[debt.to] || "#666"}, ${AVATAR_COLORS[debt.to] || "#666"}99)`,
                          color: "white",
                        }}>
                          {debt.to.charAt(0)}
                        </div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{debt.to}</div>
                      </div>
                      <div style={{
                        fontSize: 18, fontWeight: 800,
                        color: "var(--accent)",
                      }}>
                        {formatCurrency(debt.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Member Balances */}
            <div className="glass-card-static animate-fade-in-up" style={{ padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700 }}>
                    👥 Member Balances
                  </h2>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
                    Net balance per person — positive means others owe them
                  </p>
                </div>
                <Link href="/balances">
                  <button className="btn-secondary" style={{ padding: "8px 16px", fontSize: 13 }}>
                    View Details →
                  </button>
                </Link>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                {data.memberBalances.map((member) => (
                  <div key={member.userId} className="glass-card" style={{ padding: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <div className="avatar avatar-sm" style={{
                        background: `linear-gradient(135deg, ${AVATAR_COLORS[member.name] || "#666"}, ${AVATAR_COLORS[member.name] || "#666"}99)`,
                        color: "white",
                      }}>
                        {member.name.charAt(0)}
                      </div>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{member.name}</span>
                    </div>
                    <div style={{
                      fontSize: 22, fontWeight: 800,
                      color: member.netBalance >= 0 ? "var(--success)" : "var(--error)",
                      marginBottom: 4,
                    }}>
                      {formatCurrency(member.netBalance)}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                      {member.netBalance >= 0 ? "is owed" : "owes"}
                    </div>
                    <div style={{
                      marginTop: 8, display: "flex", justifyContent: "space-between",
                      fontSize: 11, color: "var(--text-secondary)",
                    }}>
                      <span>Paid: {formatCurrency(member.totalPaid)}</span>
                      <span>Share: {formatCurrency(member.totalOwed)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
