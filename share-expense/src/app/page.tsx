"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem("shareexpense_user");
    if (stored) {
      router.push("/dashboard");
    } else {
      router.push("/login");
    }
  }, [router]);

  return (
    <div style={{
      height: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--background)",
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>💸</div>
        <div style={{ color: "var(--text-secondary)" }}>Loading ShareExpense...</div>
      </div>
    </div>
  );
}
