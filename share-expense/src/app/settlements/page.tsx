"use client";

import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";

interface Settlement {
  id: number;
  amount: string;
  currency: string;
  settlementDate: string;
  notes: string | null;
  importSource: string | null;
  from: { id: number; name: string };
  to: { id: number; name: string };
}

const AVATAR_COLORS: Record<string, string> = {
  Aisha: "#6c63ff", Rohan: "#00d4aa", Priya: "#ff6b9d",
  Meera: "#ffa726", Dev: "#64b5f6", Sam: "#ab47bc",
};

export default function SettlementsPage() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [users, setUsers] = useState<{ id: number; name: string }[]>([]);
  const [form, setForm] = useState({ fromId: "", toId: "", amount: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/settlements?groupId=1").then((r) => r.json()),
      fetch("/api/users").then((r) => r.json()),
    ]).then(([s, u]) => {
      setSettlements(s);
      setUsers(u);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: 1,
          fromUserId: parseInt(form.fromId),
          toUserId: parseInt(form.toId),
          amount: parseFloat(form.amount),
          currency: "INR",
          settlementDate: new Date().toISOString(),
          notes: form.notes || null,
        }),
      });
      const newSettlement = await res.json();
      setSettlements((prev) => [newSettlement, ...prev]);
      setShowForm(false);
      setForm({ fromId: "", toId: "", amount: "", notes: "" });
    } catch (err) {
      console.error(err);
    }
    setSubmitting(false);
  };

  return (
    <AppLayout>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div className="animate-fade-in-up" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>
              🤝 <span className="gradient-text">Settlements</span>
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
              Record payments between members to clear debts
            </p>
          </div>
          <button className="btn-success" onClick={() => setShowForm(!showForm)}>
            {showForm ? "✕ Cancel" : "➕ Record Payment"}
          </button>
        </div>

        {/* New Settlement Form */}
        {showForm && (
          <div className="glass-card-static animate-fade-in-up" style={{ padding: 24, marginBottom: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
              Record New Payment
            </h3>
            <form onSubmit={handleSubmit}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--text-secondary)" }}>
                    From (who pays)
                  </label>
                  <select
                    className="input-field"
                    value={form.fromId}
                    onChange={(e) => setForm({ ...form, fromId: e.target.value })}
                    required
                  >
                    <option value="">Select person</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--text-secondary)" }}>
                    To (who receives)
                  </label>
                  <select
                    className="input-field"
                    value={form.toId}
                    onChange={(e) => setForm({ ...form, toId: e.target.value })}
                    required
                  >
                    <option value="">Select person</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--text-secondary)" }}>
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    className="input-field"
                    placeholder="5000"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    required
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--text-secondary)" }}>
                    Notes (optional)
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g., UPI transfer for March dues"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
              </div>
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? "Recording..." : "✅ Record Settlement"}
              </button>
            </form>
          </div>
        )}

        {/* Settlement History */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "var(--text-secondary)" }}>
            Loading settlements...
          </div>
        ) : settlements.length === 0 ? (
          <div className="glass-card-static" style={{ padding: 60, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🤝</div>
            <p style={{ color: "var(--text-secondary)" }}>No settlements recorded yet</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {settlements.map((s) => (
              <div key={s.id} className="glass-card" style={{
                padding: "16px 20px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div className="avatar avatar-sm" style={{
                    background: `linear-gradient(135deg, ${AVATAR_COLORS[s.from.name] || "#666"}, ${AVATAR_COLORS[s.from.name] || "#666"}99)`,
                    color: "white",
                  }}>
                    {s.from.name.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {s.from.name} paid {s.to.name}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
                      {new Date(s.settlementDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      {s.notes && ` • ${s.notes}`}
                      {s.importSource === "csv" && (
                        <span className="badge badge-info" style={{ marginLeft: 6, fontSize: 10 }}>CSV</span>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ fontWeight: 800, fontSize: 18, color: "var(--success)" }}>
                  {s.currency === "USD" ? "$" : "₹"}{parseFloat(s.amount).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
