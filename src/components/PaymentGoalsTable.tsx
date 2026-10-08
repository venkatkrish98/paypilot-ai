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
}

export const PaymentGoalsTable: React.FC<GoalsTableProps> = ({
  goals,
  onOpenDetails,
  onSimulatePayment,
  onApproveGoal,
  initialFilter = "all",
}) => {
  const [activeFilter, setActiveFilter] = useState<string>(initialFilter);

  const filteredGoals = goals.filter((g) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "awaiting_payment")
      return g.status === "awaiting_payment" || g.status === "payment_created";
    if (activeFilter === "paid") return g.status === "paid";
    if (activeFilter === "pending_approval")
      return g.status === "pending_approval" || g.riskLevel === "high";
    return true;
  });

  const getStatusBadge = (goal: PaymentGoal) => {
    switch (goal.status) {
      case "paid":
        return (
          <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <span>{goal.isSimulated ? "Simulated Paid" : "Sandbox Paid"}</span>
          </span>
        );
      case "awaiting_payment":
      case "payment_created":
        return (
          <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-500/15 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-500/30">
            <Clock className="w-3 h-3 text-sky-600 dark:text-sky-400" />
            <span>Awaiting Payment</span>
          </span>
        );
      case "pending_approval":
        return (
          <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
            <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            <span>Needs Approval</span>
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
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
              label: `Paid (${goals.filter((g) => g.status === "paid").length})`,
            },
            {
              id: "pending_approval",
              label: `Approvals (${
                goals.filter((g) => g.status === "pending_approval" || g.riskLevel === "high")
                  .length
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
        {filteredGoals.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No payment goals match the selected filter.
          </div>
        ) : (
          filteredGoals.map((g) => (
            <div
              key={g.id}
              className="p-3.5 sm:p-4 hover:bg-slate-50 dark:hover:bg-slate-850/50 transition flex flex-col md:flex-row md:items-center justify-between gap-3"
            >
              {/* Customer and Purpose */}
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 text-slate-800 dark:text-white font-bold text-xs">
                  {g.customer.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-xs text-slate-900 dark:text-white">{g.customer}</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                      {g.goalType === "payout_review" ? "Disbursement Review" : "Client Collection"}
                    </span>
                    {g.isSimulated && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300">
                        Simulated
                      </span>
                    )}
                    {g.riskLevel === "high" && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300">
                        Review Flag
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-1">{g.purpose || g.goal}</p>
                  <div className="flex items-center space-x-2 mt-1 text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                    {g.paypalOrderId && <span>Order: {g.paypalOrderId}</span>}
                    <span>&bull;</span>
                    <span>Due: {g.deadline}</span>
                  </div>
                </div>
              </div>

              {/* Amount & Actions */}
              <div className="flex items-center space-x-4 md:space-x-6 justify-between md:justify-end">
                <div className="text-left md:text-right">
                  <div className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                    ${g.amount.toLocaleString()} <span className="text-[10px] text-slate-500">{g.currency}</span>
                  </div>
                  <div className="mt-0.5">{getStatusBadge(g)}</div>
                </div>

                <div className="flex items-center space-x-1.5">
                  {g.status === "pending_approval" ? (
                    <button
                      onClick={() => onApproveGoal(g.id)}
                      className="px-2.5 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] transition"
                    >
                      Approve
                    </button>
                  ) : g.status === "awaiting_payment" ? (
                    <button
                      onClick={() => onSimulatePayment(g.id)}
                      className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] transition"
                    >
                      {g.isSimulated ? "Simulate Pay" : "Capture Pay"}
                    </button>
                  ) : null}

                  <button
                    onClick={() => onOpenDetails(g)}
                    className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition"
                    title="View Timeline & Safety Checks"
                    aria-label={`View details for ${g.customer}`}
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
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
