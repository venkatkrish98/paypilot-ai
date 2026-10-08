"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Info,
  Lock,
  ArrowLeft,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { PaymentGoal } from "@/packages/types";

function SimulationCheckoutContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId") || "";

  const [goal, setGoal] = useState<PaymentGoal | null>(null);
  const [loading, setLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [captured, setCaptured] = useState(false);
  const [captureReceipt, setCaptureReceipt] = useState<{
    captureId: string;
    amount: number;
    currency: string;
    timestamp: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadGoal() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/goals");
        if (!res.ok) {
          throw new Error("Failed to load payment goals");
        }
        const data = await res.json();
        const goals: PaymentGoal[] = data.goals || [];

        // Match by paypalOrderId or id
        const matched = goals.find(
          (g) => g.paypalOrderId === orderId || g.id === orderId
        );

        if (matched) {
          // STRICT REJECTION: Simulation checkout is restricted to simulated goals only
          if (!matched.isSimulated || matched.mode === "sandbox") {
            setError(
              "Simulation Checkout is strictly restricted to simulated goals. Real PayPal Sandbox orders must be approved through the official PayPal Sandbox checkout flow."
            );
            setGoal(null);
            return;
          }

          setGoal(matched);
          if (matched.status === "paid") {
            setCaptured(true);
            setCaptureReceipt({
              captureId: matched.paypalCaptureId || "SIM_CAP_ALREADY_CONFIRMED",
              amount: matched.amount,
              currency: matched.currency,
              timestamp: new Date().toISOString(),
            });
          }
        } else {
          // If no match found by ID, find any simulation goal or create placeholder representation
          const fallbackGoal = goals.find((g) => g.isSimulated) || null;
          if (fallbackGoal && !orderId) {
            setGoal(fallbackGoal);
          } else {
            // Virtual simulation representation for unknown order
            setGoal({
              id: "sim_virtual",
              goal: "Simulated Payment Authorization",
              goalType: "collection",
              customer: "Simulated Customer",
              amount: 1200.0,
              currency: "USD",
              deadline: "2026-10-25",
              purpose: "Simulation Test Order",
              status: "awaiting_payment",
              mode: "simulation",
              isSimulated: true,
              riskLevel: "low",
              riskScore: 5,
              riskChecks: [],
              requiresApproval: false,
              createdBy: "agent",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              paypalOrderId: orderId || "SIMULATED_ORD_DIRECT",
              timeline: [],
            });
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Network error";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }

    loadGoal();
  }, [orderId]);

  const handleSimulateCapture = async () => {
    if (!goal || !goal.isSimulated) {
      setError("Cannot execute simulation capture for real PayPal Sandbox orders.");
      return;
    }
    setCapturing(true);
    setError(null);

    try {
      if (goal.id && goal.id !== "sim_virtual") {
        const res = await fetch(`/api/goals/${goal.id}/capture`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-simulation-checkout": "true",
          },
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Capture failed with status ${res.status}`);
        }

        const data = await res.json();
        setCaptured(true);
        setCaptureReceipt({
          captureId: data.goal?.paypalCaptureId || "SIM_CAP_COMPLETED",
          amount: data.goal?.amount || goal.amount,
          currency: data.goal?.currency || goal.currency,
          timestamp: new Date().toISOString(),
        });
      } else {
        // Virtual simulation fallback
        await new Promise((r) => setTimeout(r, 600));
        setCaptured(true);
        setCaptureReceipt({
          captureId: `SIM_CAP_${Date.now().toString(36).toUpperCase()}`,
          amount: goal.amount,
          currency: goal.currency,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to simulate payment capture";
      setError(msg);
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between">
      {/* Top Header / Watermark */}
      <header className="bg-purple-600 dark:bg-purple-950/80 border-b border-purple-500/30 text-white px-4 py-2.5 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-300 animate-pulse" />
            <span className="font-bold tracking-wider uppercase text-[11px]">
              PayPilot AI — In-App PayPal Simulation Mode
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-[10px] bg-purple-500/40 px-2 py-0.5 rounded font-mono">
              Safe In-App Preview (No External Redirect)
            </span>
            <Link
              href="/"
              className="text-white/80 hover:text-white flex items-center space-x-1 text-xs underline font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Dashboard</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-xl w-full mx-auto p-4 sm:p-6 my-auto">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          {/* Card Header */}
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-paypal-blue flex items-center justify-center text-white font-bold text-sm shadow-xs">
                PP
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900 dark:text-white">
                  PayPal Simulated Checkout
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Customer-Facing Simulation Experience
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-700/50">
              SIMULATION
            </span>
          </div>

          <div className="p-6 space-y-5">
            {/* Guarantee / Disclosure Banner */}
            <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 text-purple-900 dark:text-purple-200 flex items-start space-x-3">
              <Info className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold block text-xs">
                  Truthful Demo Mode Guarantee
                </span>
                <p className="text-[11px] leading-relaxed text-purple-800 dark:text-purple-300">
                  This transaction is safely contained inside PayPilot AI. We deliberately do not
                  redirect to external PayPal with fabricated tokens.
                </p>
              </div>
            </div>

            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-3">
                <RefreshCw className="w-6 h-6 text-paypal-blue animate-spin" />
                <span className="text-xs text-slate-500">Loading simulated order details...</span>
              </div>
            ) : error ? (
              <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 flex items-center space-x-2 text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
            ) : goal ? (
              <>
                {/* Order Summary Box */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3.5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                        Merchant
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                        PayPilot AI Client Storefront
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                        Amount Due
                      </span>
                      <span className="font-mono text-lg font-bold text-paypal-blue dark:text-sky-400">
                        ${goal.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {goal.currency}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Simulated Order ID</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold truncate block">
                        {goal.paypalOrderId || orderId || "SIMULATED_ORD_READY"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Customer / Payer</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300 truncate block">
                        {goal.customer}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs">
                    <span className="text-slate-400 block text-[10px]">Description</span>
                    <span className="text-slate-700 dark:text-slate-300 font-medium block">
                      {goal.purpose || goal.goal}
                    </span>
                  </div>
                </div>

                {captured ? (
                  /* Success Capture Receipt */
                  <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 space-y-3 animate-fade-in">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      <span className="font-bold text-sm">Simulated Payment Captured!</span>
                    </div>
                    <p className="text-xs text-emerald-800 dark:text-emerald-300">
                      The simulated payment of <strong>${captureReceipt?.amount.toFixed(2)} {captureReceipt?.currency}</strong> was successfully authorized and captured.
                    </p>
                    <div className="p-2.5 bg-white/60 dark:bg-slate-900/60 rounded-lg text-[11px] font-mono space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Capture ID:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{captureReceipt?.captureId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Timestamp:</span>
                        <span className="text-slate-700 dark:text-slate-300">{captureReceipt?.timestamp}</span>
                      </div>
                    </div>
                    <div className="pt-2">
                      <Link
                        href="/"
                        className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-xs"
                      >
                        <span>Return to PayPilot Dashboard</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ) : (
                  /* Payment Method & Authorization Action */
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <span className="font-semibold text-slate-700 dark:text-slate-300 text-xs">
                        Simulated Payment Method
                      </span>
                      <div className="p-3 rounded-xl border border-paypal-blue/40 bg-sky-50 dark:bg-paypal-blue/10 flex items-center justify-between">
                        <div className="flex items-center space-x-2.5">
                          <CreditCard className="w-4 h-4 text-paypal-blue dark:text-sky-400" />
                          <span className="text-xs text-slate-800 dark:text-slate-200 font-medium">
                            PayPal Wallet (Simulated Balance)
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Simulated Ready</span>
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={handleSimulateCapture}
                      disabled={capturing}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition active:scale-[0.99] disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {capturing
                          ? "Processing Simulated Capture..."
                          : "Authorize & Simulate Capture"}
                      </span>
                    </button>
                  </div>
                )}
              </>
            ) : null}
          </div>

          {/* Footer security notes */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <div className="flex items-center space-x-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>Safe deterministic state machine capture</span>
            </div>
            <Link
              href="/"
              className="text-paypal-blue dark:text-sky-400 hover:underline font-medium"
            >
              Cancel &amp; Return
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-slate-400 dark:text-slate-500 border-t border-slate-200 dark:border-slate-800">
        PayPilot AI &copy; 2026 &bull; PayPal AI Hackathon 2026 Simulation Sandbox
      </footer>
    </div>
  );
}

export default function SimulationCheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-500">
          <div className="flex items-center space-x-2 text-xs">
            <RefreshCw className="w-4 h-4 animate-spin text-paypal-blue" />
            <span>Loading simulated checkout...</span>
          </div>
        </div>
      }
    >
      <SimulationCheckoutContent />
    </Suspense>
  );
}
