import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PayPilot AI — Intelligent Payment Agent for PayPal",
  description:
    "Your AI agent for getting paid, paying safely, and managing every transaction. Built for the PayPal AI Hackathon 2026.",
  keywords: [
    "PayPal",
    "Agentic Commerce",
    "AI Agent",
    "Payment Execution",
    "Payment Safety",
    "Fintech",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-paypal-blue selection:text-white">
        {children}
      </body>
    </html>
  );
}
