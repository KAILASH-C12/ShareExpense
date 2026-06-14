"use client";

import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";

interface Membership {
  id: number;
  userId: number;
  joinedAt: string;
  leftAt: string | null;
  role: string;
  user: { id: number; name: string; email: string };
}

interface Group {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
  memberships: Membership[];
  _count: { expenses: number };
}

const AVATAR_COLORS: Record<string, string> = {
  Aisha: "#6c63ff", Rohan: "#00d4aa", Priya: "#ff6b9d",
  Meera: "#ffa726", Dev: "#64b5f6", Sam: "#ab47bc",
};

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/groups")
      .then((r) => r.json())
      .then((d) => { setGroups(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <AppLayout>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div className="animate-fade-in-up" style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>
            👥 <span className="gradient-text">Groups</span>
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            Manage your expense groups and member timelines
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "var(--text-secondary)" }}>
            Loading groups...
          </div>
        ) : groups.length === 0 ? (
          <div className="glass-card-static" style={{ padding: 60, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>👥</div>
            <p style={{ color: "var(--text-secondary)", marginBottom: 16 }}>
              No groups yet. Import CSV data to create your first group automatically.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {groups.map((group) => (
              <div key={group.id} className="glass-card-static" style={{ padding: 24 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                  <div>
                    <h2 style={{ fontSize: 20, fontWeight: 700 }}>{group.name}</h2>
                    {group.description && (
                      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
                        {group.description}
                      </p>
                    )}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                      {group._count.expenses} expenses
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                      Created {new Date(group.createdAt).toLocaleDateString("en-IN")}
                    </div>
                  </div>
                </div>

                {/* Member Timeline */}
                <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Membership Timeline
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {group.memberships.map((m) => {
                    const isActive = !m.leftAt;
                    return (
                      <div key={m.id} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "12px 16px", borderRadius: 10,
                        background: "rgba(255,255,255,0.02)",
                        opacity: isActive ? 1 : 0.6,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div className="avatar avatar-sm" style={{
                            background: `linear-gradient(135deg, ${AVATAR_COLORS[m.user.name] || "#666"}, ${AVATAR_COLORS[m.user.name] || "#666"}99)`,
                            color: "white",
                          }}>
                            {m.user.name.charAt(0)}
                          </div>
                          <div>
                            <span style={{ fontWeight: 600, fontSize: 14 }}>{m.user.name}</span>
                            {m.role === "admin" && (
                              <span className="badge badge-info" style={{ marginLeft: 8, fontSize: 10 }}>Admin</span>
                            )}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 13 }}>
                            {new Date(m.joinedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                            <span style={{ color: "var(--text-tertiary)", margin: "0 6px" }}>→</span>
                            {m.leftAt ? (
                              <span style={{ color: "var(--error)" }}>
                                {new Date(m.leftAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                              </span>
                            ) : (
                              <span style={{ color: "var(--success)" }}>Active</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
