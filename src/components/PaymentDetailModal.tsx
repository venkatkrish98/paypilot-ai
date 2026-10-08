"use client";

import React, { useEffect, useRef } from "react";
import {
  X,
  CreditCard,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  Clock,
  CheckCircle2,
  Check,
  Info,
} from "lucide-react";
import { PaymentGoal } from "@/packages/types";

interface DetailModalProps {
  goal: PaymentGoal | null;
  onClose: () => void;
  onSimulatePayment: (goalId: string) => void;
  onApprovePayment: (goalId: string) => void;
  onOpenSimulationCheckout?: (goal: PaymentGoal) => void;
}

export const PaymentDetailModal: React.FC<DetailModalProps> = ({
  goal,
  onClose,
  onSimulatePayment,
  onApprovePayment,
  onOpenSimulationCheckout,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // WAI-ARIA Focus Trap, Focus Restoration, and Escape Handling
  useEffect(() => {
    if (!goal) return;

    previousActiveElement.current = document.activeElement as HTMLElement;
    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousActiveElement.current?.focus();
    };
  }, [goal, onClose]);

  if (!goal) return null;

  const isLiveSandbox = !goal.isSimulated;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={modalRef}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-paypal-blue/20 text-paypal-blue dark:text-sky-300 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 id="modal-title" className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  Payment Goal Details
                </h3>
                {goal.isSimulated && (
                  <span className="text-[10px] font-bold px-2 py-0.2 rounded bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 uppercase">
                    Simulation
                  </span>
                )}
                <span
                  className={`text-[10px] font-bold px-2 py-0.2 rounded uppercase ${
                    goal.status === "paid"
                      ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300"
                      : goal.status === "pending_approval"
                      ? "bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300"
                      : "bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300"
                  }`}
                >
                  {goal.status.replace("_", " ")}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Goal ID: {goal.id} &bull; Type: {goal.goalType === "payout_review" ? "Vendor Disbursement Review" : "Client Collection"}
              </p>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-5">
          {/* Snapshot Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-semibold">Amount</span>
              <span className="text-base font-bold text-slate-900 dark:text-white">
                ${goal.amount.toLocaleString()} <span className="text-xs text-slate-400">{goal.currency}</span>
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-semibold">Recipient</span>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{goal.customer}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-semibold">Deadline</span>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{goal.deadline}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-semibold">Execution Mode</span>
              <span className={`text-xs font-bold ${goal.isSimulated ? "text-purple-600 dark:text-purple-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                {goal.isSimulated ? "Simulation" : "PayPal Sandbox"}
              </span>
            </div>
          </div>

          {/* Objective Description */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Objective &amp; Description
            </span>
            <p className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
              {goal.purpose || goal.goal}
            </p>
          </div>

          {/* PayPal Order Details */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                <span className={`w-2 h-2 rounded-full ${isLiveSandbox ? "bg-emerald-500" : "bg-purple-500"}`} />
                <span>{isLiveSandbox ? "PayPal Sandbox Order (Live API)" : "Simulated PayPal Order (Simulation Mode)"}</span>
              </span>

              {goal.paypalOrderId && (
                goal.isSimulated ? (
                  <button
                    onClick={() => {
                      if (onOpenSimulationCheckout) {
                        onOpenSimulationCheckout(goal);
                      } else {
                        onSimulatePayment(goal.id);
                      }
                    }}
                    className="inline-flex items-center space-x-1 text-xs text-purple-600 dark:text-purple-400 hover:underline font-semibold"
                    aria-label="Open In-App Simulation Checkout Preview"
                  >
                    <span>Simulation Checkout Preview</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <a
                    href={goal.paypalPaymentLink || `https://www.sandbox.paypal.com/checkoutnow?token=${goal.paypalOrderId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1 text-xs text-paypal-blue dark:text-sky-400 hover:underline font-semibold"
                    aria-label="Open PayPal Sandbox Checkout in new tab"
                  >
                    <span>Open PayPal Sandbox</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-500 block text-[10px]">Orders v2 ID</span>
                <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold truncate block">
                  {goal.paypalOrderId || (goal.goalType === "payout_review" ? "N/A (Disbursement Review)" : "Held in approval queue")}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Capture Reference / Payout Status</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold truncate block">
                  {goal.paypalCaptureId || (goal.status === "payout_approved" ? "Approved for Review (Simulation Only — No Payout Dispatched)" : goal.status === "paid" ? "Confirmed" : "Pending capture / execution")}
                </span>
              </div>
            </div>
          </div>

          {/* 5-Point Safety Checks */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5 text-paypal-blue dark:text-sky-400" />
                <span>Payment Safety Checks (Risk Engine)</span>
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.2 rounded ${
                  goal.riskLevel === "low"
                    ? "text-emerald-800 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-500/20"
                    : goal.riskLevel === "medium"
                    ? "text-amber-800 bg-amber-100 dark:text-amber-300 dark:bg-amber-500/20"
                    : "text-red-800 bg-red-100 dark:text-red-300 dark:bg-red-500/20"
                }`}
              >
                {goal.riskLevel.toUpperCase()} RISK ({goal.riskScore}/100)
              </span>
            </div>

            <div className="space-y-1.5">
              {goal.riskChecks.map((chk) => (
                <div
                  key={chk.id}
                  className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs flex items-start space-x-2"
                >
                  <div className="mt-0.5">
                    {chk.passed ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    )}
                  </div>
                  <div className="flex-1">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 block">{chk.name}</span>
                    <span className="text-slate-500 dark:text-slate-400 text-[11px]">{chk.details}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5 text-paypal-blue dark:text-sky-400" />
              <span>Agent Activity Timeline</span>
            </span>

            <div className="relative pl-5 space-y-3 border-l-2 border-slate-200 dark:border-slate-800 ml-2">
              {goal.timeline.map((ev, i) => (
                <div key={ev.id || i} className="relative group">
                  <div className="absolute -left-[27px] top-1 w-3 h-3 rounded-full bg-white dark:bg-slate-900 border-2 border-paypal-blue" />
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] text-slate-400 font-mono">{ev.timestamp}</span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{ev.title}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{ev.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-end space-x-2">
          {goal.status === "pending_approval" && (
            <button
              onClick={() => {
                onApprovePayment(goal.id);
                onClose();
              }}
              className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition"
            >
              Approve Payment (${goal.amount.toLocaleString()})
            </button>
          )}

          {goal.status === "awaiting_payment" && (
            <button
              onClick={() => {
                onSimulatePayment(goal.id);
                onClose();
              }}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition"
            >
              {goal.isSimulated ? "Simulate Payment Capture" : "Capture Confirmed Payment"}
            </button>
          )}

          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
