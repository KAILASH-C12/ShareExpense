import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShareExpense — Smart Expense Splitting",
  description: "Track shared expenses, split bills, and settle debts with your flatmates. Built for real-world messy data.",
  keywords: ["expense tracker", "split bills", "flatmates", "shared expenses"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
