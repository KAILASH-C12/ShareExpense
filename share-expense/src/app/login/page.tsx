"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const USERS = [
  { name: "Aisha", email: "aisha@shareexpense.app", color: "#6c63ff" },
  { name: "Rohan", email: "rohan@shareexpense.app", color: "#00d4aa" },
  { name: "Priya", email: "priya@shareexpense.app", color: "#ff6b9d" },
  { name: "Meera", email: "meera@shareexpense.app", color: "#ffa726" },
  { name: "Dev",   email: "dev@shareexpense.app",   color: "#64b5f6" },
  { name: "Sam",   email: "sam@shareexpense.app",   color: "#ab47bc" },
];

export default function LoginPage() {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) {
      setError("Please select a user");
      return;
    }
    setLoading(true);
    setError("");

    const user = USERS.find((u) => u.email === selectedUser);
    if (user) {
      // Simple auth — store user in localStorage
      // In production, this would use NextAuth with proper credentials
      localStorage.setItem(
        "shareexpense_user",
        JSON.stringify({ name: user.name, email: user.email, id: user.name })
      );
      router.push("/dashboard");
    } else {
      setError("Invalid user selection");
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--background)",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Background decorations */}
      <div style={{
        position: "absolute",
        top: "-20%", right: "-10%",
        width: 600, height: 600,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(108,99,255,0.08) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute",
        bottom: "-20%", left: "-10%",
        width: 500, height: 500,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(0,212,170,0.06) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div className="animate-fade-in-up" style={{
        width: "100%", maxWidth: 480, padding: "0 24px",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20, margin: "0 auto 16px",
            background: "linear-gradient(135deg, #6c63ff, #00d4aa)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 32, boxShadow: "0 10px 40px rgba(108,99,255,0.25)",
          }}>
            💸
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>
            <span className="gradient-text">ShareExpense</span>
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            Split smart, live easy
          </p>
        </div>

        {/* Login Card */}
        <div className="glass-card-static" style={{ padding: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
            Welcome back
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 24 }}>
            Select your account to continue
          </p>

          <form onSubmit={handleLogin}>
            {/* User Selection Grid */}
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
              gap: 10, marginBottom: 24,
            }}>
              {USERS.map((user) => (
                <button
                  key={user.email}
                  type="button"
                  onClick={() => { setSelectedUser(user.email); setError(""); }}
                  style={{
                    padding: "16px 8px",
                    borderRadius: 12,
                    border: selectedUser === user.email
                      ? `2px solid ${user.color}`
                      : "1px solid var(--glass-border)",
                    background: selectedUser === user.email
                      ? `${user.color}15`
                      : "var(--glass-bg)",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                    transition: "all 0.2s ease",
                    color: "var(--foreground)",
                  }}
                >
                  <div className="avatar" style={{
                    background: `linear-gradient(135deg, ${user.color}, ${user.color}99)`,
                    color: "white",
                  }}>
                    {user.name.charAt(0)}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{user.name}</span>
                </button>
              ))}
            </div>

            {/* Password Field */}
            <div style={{ marginBottom: 20 }}>
              <label style={{
                display: "block", fontSize: 13, fontWeight: 500,
                marginBottom: 6, color: "var(--text-secondary)",
              }}>
                Password
              </label>
              <input
                type="password"
                className="input-field"
                placeholder="Enter password (any value)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 6 }}>
                Demo mode — any password works
              </p>
            </div>

            {error && (
              <div style={{
                padding: "10px 16px", borderRadius: 10, marginBottom: 16,
                background: "rgba(255,82,82,0.1)", border: "1px solid rgba(255,82,82,0.2)",
                color: "#ff5252", fontSize: 13,
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{ width: "100%", justifyContent: "center", padding: "14px 24px" }}
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p style={{
          textAlign: "center", marginTop: 24,
          fontSize: 12, color: "var(--text-tertiary)",
        }}>
          Built for flatmates who hate spreadsheets ✨
        </p>
      </div>
    </div>
  );
}
