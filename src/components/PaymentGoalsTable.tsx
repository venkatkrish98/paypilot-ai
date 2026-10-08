"use client";

import React, { useState } from "react";
import {
  CreditCard,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { PaymentGoal, GoalStatus } from "@/packages/types";

interface GoalsTableProps {
  goals: PaymentGoal[];
  onOpenDetails: (goal: PaymentGoal) => void;
  onSimulatePayment: (goalId: string) => void;
  onApproveGoal: (goalId: string) => void;
  initialFilter?: string;
  isLoading?: boolean;
}

export const PaymentGoalsTable: React.FC<GoalsTableProps> = ({
  goals,
  onOpenDetails,
  onSimulatePayment,
  onApproveGoal,
  initialFilter = "all",
  isLoading = false,
}) => {
  const [activeFilter, setActiveFilter] = useState<string>(initialFilter);

  const filteredGoals = goals.filter((g) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "awaiting_payment")
      return g.status === "awaiting_payment" || g.status === "payment_created";
    if (activeFilter === "paid") return g.status === "paid" || g.status === "payout_approved";
    if (activeFilter === "pending_approval")
      return (
        (g.status === "pending_approval" || (g.requiresApproval && g.approvalStatus === "pending")) &&
        g.status !== "payout_approved" &&
        g.status !== "paid" &&
        g.status !== "cancelled" &&
        g.approvalStatus !== "approved"
      );
    return true;
  });

  const getStatusBadge = (goal: PaymentGoal) => {
    switch (goal.status) {
      case "paid":
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 whitespace-nowrap">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{goal.isSimulated ? "Simulated Paid" : "Sandbox Paid"}</span>
          </span>
        );
      case "payout_approved":
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 whitespace-nowrap">
            <CheckCircle2 className="w-3 h-3 text-purple-600 dark:text-purple-400 shrink-0" />
            <span>Review Approved</span>
          </span>
        );
      case "awaiting_payment":
      case "payment_created":
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60 whitespace-nowrap">
            <Clock className="w-3 h-3 text-sky-600 dark:text-sky-400 shrink-0" />
            <span>Awaiting Payment</span>
          </span>
        );
      case "pending_approval":
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 whitespace-nowrap">
            <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>Needs Approval</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 whitespace-nowrap">
            {goal.status}
          </span>
        );
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
      {/* Table Header & Filters */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">Active Payment Goals</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Agent-monitored payment lifecycles and transactions
          </p>
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center space-x-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
          {[
            { id: "all", label: `All (${goals.length})` },
            {
              id: "awaiting_payment",
              label: `Awaiting (${
                goals.filter(
                  (g) => g.status === "awaiting_payment" || g.status === "payment_created"
                ).length
              })`,
            },
            {
              id: "paid",
              label: `Paid (${goals.filter((g) => g.status === "paid" || g.status === "payout_approved").length})`,
            },
            {
              id: "pending_approval",
              label: `Approvals (${
                goals.filter(
                  (g) =>
                    (g.status === "pending_approval" || (g.requiresApproval && g.approvalStatus === "pending")) &&
                    g.status !== "payout_approved" &&
                    g.status !== "paid" &&
                    g.status !== "cancelled" &&
                    g.approvalStatus !== "approved"
                ).length
              })`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded transition ${
                activeFilter === tab.id
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs border border-slate-200 dark:border-slate-700"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Goals List */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
        {isLoading ? (
          <div className="p-4 space-y-3" role="status" aria-label="Loading payment goals">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/40"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800" />
                  <div className="space-y-1.5">
                    <div className="w-28 h-3.5 bg-slate-200 dark:bg-slate-800 rounded" />
                    <div className="w-44 h-2.5 bg-slate-100 dark:bg-slate-850 rounded" />
                  </div>
                </div>
                <div className="space-y-1 text-right">
                  <div className="w-16 h-3.5 bg-slate-200 dark:bg-slate-800 rounded ml-auto" />
                  <div className="w-20 h-2.5 bg-slate-100 dark:bg-slate-850 rounded ml-auto" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredGoals.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No payment goals match the selected filter.
          </div>
        ) : (
          filteredGoals.map((g) => (
            <div
              key={g.id}
              className="p-3.5 sm:p-4 hover:bg-slate-50/80 dark:hover:bg-slate-850/50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4"
            >
              {/* Customer and Purpose */}
              <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 text-slate-800 dark:text-white font-bold text-sm shadow-2xs">
                  {g.customer.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-slate-900 dark:text-white truncate">{g.customer}</span>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shrink-0">
                      {g.goalType === "payout_review" ? "Disbursement" : "Collection"}
                    </span>
                    {g.isSimulated && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-500/20 shrink-0">
                        Simulated
                      </span>
                    )}
                    {g.riskLevel === "high" && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200/50 dark:border-amber-500/20 shrink-0">
                        Review Flag
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-md">
                    {g.purpose || g.goal}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                    {g.paypalOrderId && (
                      <span className="truncate max-w-[170px]" title={g.paypalOrderId}>
                        Order: {g.paypalOrderId}
                      </span>
                    )}
                    {g.paypalOrderId && <span>&bull;</span>}
                    <span className="whitespace-nowrap shrink-0 text-slate-500 dark:text-slate-400">
                      Due: {g.deadline}
                    </span>
                  </div>
                </div>
              </div>

              {/* Amount & Actions */}
              <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800/60">
                {/* Amount and Status Stack */}
                <div className="text-left sm:text-right sm:w-36 md:w-40 shrink-0">
                  <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
                    ${g.amount.toLocaleString()} <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">{g.currency}</span>
                  </div>
                  <div className="mt-0.5 sm:mt-1 flex justify-start sm:justify-end">
                    {getStatusBadge(g)}
                  </div>
                </div>

                {/* Actions Slot */}
                <div className="flex items-center justify-end gap-1.5 w-28 sm:w-32 shrink-0">
                  {g.status === "pending_approval" ? (
                    <button
                      onClick={() => onApproveGoal(g.id)}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-2xs transition text-center whitespace-nowrap"
                    >
                      Approve
                    </button>
                  ) : g.status === "awaiting_payment" ? (
                    <button
                      onClick={() => onSimulatePayment(g.id)}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-2xs transition text-center whitespace-nowrap"
                    >
                      {g.isSimulated ? "Simulate Pay" : "Capture Pay"}
                    </button>
                  ) : (
                    <button
                      onClick={() => onOpenDetails(g)}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 font-medium text-xs border border-slate-200/80 dark:border-slate-700/80 transition text-center whitespace-nowrap"
                    >
                      Details
                    </button>
                  )}

                  <button
                    onClick={() => onOpenDetails(g)}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition shrink-0"
                    title="View Timeline & Safety Checks"
                    aria-label={`View details for ${g.customer}`}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
