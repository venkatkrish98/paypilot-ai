"use client";

import React from "react";
import { Target, Clock, CheckCircle2, AlertTriangle, ArrowUpRight } from "lucide-react";

interface MetricsProps {
  metrics: {
    totalGoals: number;
    awaitingCount: number;
    awaitingAmount: number;
    paidCount: number;
    paidAmount: number;
    sandboxPaidCount?: number;
    sandboxPaidAmount?: number;
    simulatedPaidCount?: number;
    simulatedPaidAmount?: number;
    payoutApprovedCount?: number;
    payoutApprovedAmount?: number;
    attentionCount: number;
  } | null;
  isLoading?: boolean;
  onFilterClick?: (filter: string) => void;
}

export const MetricCards: React.FC<MetricsProps> = ({ metrics, isLoading = false, onFilterClick }) => {
  // Skeleton Loading Placeholders
  if (isLoading || !metrics) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" role="status" aria-label="Loading dashboard metrics">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="w-20 h-3 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="w-7 h-7 bg-slate-100 dark:bg-slate-800 rounded-lg" />
            </div>
            <div className="w-24 h-7 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="w-32 h-2.5 bg-slate-100 dark:bg-slate-850 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Goals */}
      <div
        onClick={() => onFilterClick?.("all")}
        tabIndex={0}
        role="button"
        aria-label={`Total goals: ${metrics.totalGoals} active plans`}
        className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition cursor-pointer group shadow-2xs focus-visible:ring-2 focus-visible:ring-paypal-blue"
      >
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
          <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400">
            Total Goals
          </span>
          <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
            <Target className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="flex items-baseline space-x-1.5">
          <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            {metrics.totalGoals}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">active plans</span>
        </div>
        <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
          Agent-managed payment workflows
        </div>
      </div>

      {/* 2. Awaiting Payment */}
      <div
        onClick={() => onFilterClick?.("awaiting_payment")}
        tabIndex={0}
        role="button"
        aria-label={`Awaiting payment: ${metrics.awaitingAmount} USD across ${metrics.awaitingCount} goals`}
        className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-300 dark:hover:border-paypal-blue/40 transition cursor-pointer group shadow-2xs focus-visible:ring-2 focus-visible:ring-paypal-blue"
      >
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
          <span className="text-[11px] font-bold tracking-wider uppercase text-sky-600 dark:text-sky-400">
            Awaiting Payment
          </span>
          <div className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800/40 flex items-center justify-center text-sky-600 dark:text-sky-400">
            <Clock className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="flex items-baseline space-x-1.5">
          <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            ${metrics.awaitingAmount.toLocaleString()}
          </span>
          <span className="text-xs text-sky-600 dark:text-sky-400 font-semibold">
            {metrics.awaitingCount} pending
          </span>
        </div>
        <div className="mt-2 flex items-center text-[11px] text-slate-500 dark:text-slate-400">
          <span className="text-sky-600 dark:text-sky-400 flex items-center mr-1 font-medium">
            <ArrowUpRight className="w-3 h-3 mr-0.5" /> Monitoring
          </span>
          <span>Orders v2 checkout</span>
        </div>
      </div>

      {/* 3. Collected Incoming Payments */}
      <div
        onClick={() => onFilterClick?.("paid")}
        tabIndex={0}
        role="button"
        aria-label={`Total collected: ${metrics.paidAmount} USD across ${metrics.paidCount} completed collections`}
        className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-600/40 transition cursor-pointer group shadow-2xs focus-visible:ring-2 focus-visible:ring-paypal-blue"
      >
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
          <span className="text-[11px] font-bold tracking-wider uppercase text-emerald-600 dark:text-emerald-400">
            Total Collected
          </span>
          <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="flex items-baseline space-x-1.5">
          <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            ${metrics.paidAmount.toLocaleString()}
          </span>
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
            {metrics.paidCount} collected
          </span>
        </div>
        <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
          {metrics.payoutApprovedCount && metrics.payoutApprovedCount > 0 ? (
            <span className="text-purple-600 dark:text-purple-400 font-medium">
              +{metrics.payoutApprovedCount} payout approved (${metrics.payoutApprovedAmount?.toLocaleString()}) [Sim]
            </span>
          ) : (
            <span>Confirmed incoming client collections</span>
          )}
        </div>
      </div>

      {/* 4. Needs Attention / Approvals */}
      <div
        onClick={() => onFilterClick?.("pending_approval")}
        tabIndex={0}
        role="button"
        aria-label={`Needs attention: ${metrics.attentionCount} items requiring sign-off`}
        className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-500/40 transition cursor-pointer group shadow-2xs focus-visible:ring-2 focus-visible:ring-paypal-blue"
      >
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
          <span className="text-[11px] font-bold tracking-wider uppercase text-amber-600 dark:text-amber-400">
            Needs Attention
          </span>
          <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="flex items-baseline space-x-1.5">
          <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            {metrics.attentionCount}
          </span>
          <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">sign-off required</span>
        </div>
        <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
          Human safety review queue
        </div>
      </div>
    </div>
  );
};
