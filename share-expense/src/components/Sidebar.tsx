"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/groups", label: "Groups", icon: "👥" },
  { href: "/expenses", label: "Expenses", icon: "💰" },
  { href: "/import", label: "Import CSV", icon: "📁" },
  { href: "/settlements", label: "Settlements", icon: "🤝" },
  { href: "/balances", label: "Balances", icon: "⚖️" },
];

export default function Sidebar({ userName }: { userName?: string }) {
  const pathname = usePathname();

  return (
    <nav className="sidebar">
      {/* Logo */}
      <div style={{ padding: "24px 20px", borderBottom: "1px solid var(--card-border)" }}>
        <Link href="/dashboard" style={{ textDecoration: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: "linear-gradient(135deg, #6c63ff, #00d4aa)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20,
            }}>
              💸
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "var(--foreground)" }}>
                ShareExpense
              </div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                Split smart, live easy
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <div style={{ flex: 1, padding: "16px 0", display: "flex", flexDirection: "column", gap: "2px" }}>
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`sidebar-link ${pathname === item.href || pathname?.startsWith(item.href + "/") ? "active" : ""}`}
          >
            <span style={{ fontSize: 18 }}>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </div>

      {/* User */}
      <div style={{
        padding: "16px 20px",
        borderTop: "1px solid var(--card-border)",
        display: "flex", alignItems: "center", gap: "12px",
      }}>
        <div className="avatar" style={{
          background: "linear-gradient(135deg, #6c63ff, #a78bfa)",
          color: "white",
        }}>
          {userName ? userName.charAt(0).toUpperCase() : "U"}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{userName || "User"}</div>
          <Link
            href="/login"
            style={{ fontSize: 12, color: "var(--text-tertiary)", textDecoration: "none" }}
          >
            Sign out
          </Link>
        </div>
      </div>
    </nav>
  );
}
