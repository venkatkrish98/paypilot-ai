"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  X,
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Info,
  Lock,
} from "lucide-react";
import { PaymentGoal } from "@/packages/types";

interface SimulationCheckoutModalProps {
  goal: PaymentGoal | null;
  isOpen: boolean;
  onClose: () => void;
  onCapture: (goalId: string) => Promise<void>;
  isCapturing?: boolean;
}

export const SimulationCheckoutModal: React.FC<SimulationCheckoutModalProps> = ({
  goal,
  isOpen,
  onClose,
  onCapture,
  isCapturing = false,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // WAI-ARIA Focus Trap and Keyboard Navigation
  useEffect(() => {
    if (!isOpen || !goal) return;

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

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousActiveElement.current?.focus();
    };
  }, [isOpen, goal, onClose]);

  if (!isOpen || !goal) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sim-checkout-title"
      aria-describedby="sim-checkout-desc"
    >
      <div
        ref={modalRef}
        className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Simulation Watermark Banner */}
        <div className="bg-purple-600 dark:bg-purple-950/80 border-b border-purple-500/30 px-4 py-2 flex items-center justify-between text-white text-xs">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-purple-300 animate-pulse" />
            <span className="font-bold tracking-wide uppercase text-[11px]">
              In-App PayPal Simulation Mode
            </span>
          </div>
          <span className="text-[10px] bg-purple-500/40 px-2 py-0.5 rounded font-mono">
            No External Redirect
          </span>
        </div>

        {/* Modal Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-paypal-blue flex items-center justify-center text-white font-bold text-xs">
              PP
            </div>
            <div>
              <h2 id="sim-checkout-title" className="text-sm font-bold text-slate-900 dark:text-white">
                Simulated Customer Checkout Experience
              </h2>
              <p id="sim-checkout-desc" className="text-[11px] text-slate-500 dark:text-slate-400">
                Interactive preview for customer {goal.customer}
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Close simulation preview"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Truthful Disclosure Alert */}
          <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 text-purple-900 dark:text-purple-200 flex items-start space-x-2.5">
            <Info className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold block text-[11px]">
                Truthful Demo Mode Guarantee
              </span>
              <p className="text-[11px] leading-relaxed text-purple-800 dark:text-purple-300">
                This transaction runs in verified simulation. PayPilot AI deliberately keeps
                checkout inside the application rather than sending your browser to PayPal Sandbox
                with a fabricated token.
              </p>
            </div>
          </div>

          {/* Simulated PayPal Card */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                  Merchant
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  PayPilot AI Client Storefront
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                  Amount Due
                </span>
                <span className="font-mono text-base font-bold text-paypal-blue dark:text-sky-400">
                  ${goal.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {goal.currency}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-400 block text-[10px]">Simulated Order ID</span>
                <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold truncate block">
                  {goal.paypalOrderId || "SIMULATED_ORD_READY"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Payer (Customer)</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300 truncate block">
                  {goal.customer}
                </span>
              </div>
            </div>

            <div>
              <span className="text-slate-400 block text-[10px]">Purpose</span>
              <span className="text-slate-700 dark:text-slate-300 font-medium block">
                {goal.purpose || goal.goal}
              </span>
            </div>
          </div>

          {/* Simulated Payment Methods */}
          <div className="space-y-2">
            <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
              Simulated Buyer Payment Method
            </span>
            <div className="p-2.5 rounded-lg border border-paypal-blue/40 bg-sky-50 dark:bg-paypal-blue/10 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CreditCard className="w-4 h-4 text-paypal-blue dark:text-sky-400" />
                <span className="text-slate-800 dark:text-slate-200 font-medium">
                  PayPal Wallet / Linked Bank Account (Simulated)
                </span>
              </div>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
                <ShieldCheck className="w-3 h-3" />
                <span>Simulated Ready</span>
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="flex items-center space-x-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>Deterministic state machine capture</span>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-initial px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium transition"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                await onCapture(goal.id);
                onClose();
              }}
              disabled={isCapturing}
              className="flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition active:scale-95 disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                {isCapturing ? "Capturing..." : "Simulate Customer Approval & Capture"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
