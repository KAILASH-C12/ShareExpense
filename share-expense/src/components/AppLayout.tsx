"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ name: string; email: string; id: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem("shareexpense_user");
    if (stored) {
      setUser(JSON.parse(stored));
    } else {
      router.push("/login");
    }
  }, [router]);

  if (!user) {
    return (
      <div style={{
        height: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--background)",
      }}>
        <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <Sidebar userName={user.name} />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
