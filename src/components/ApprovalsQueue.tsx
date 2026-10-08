"use client";

import React from "react";
import { ShieldAlert, ShieldCheck, AlertTriangle, Check } from "lucide-react";
import { PaymentGoal } from "@/packages/types";

interface ApprovalsQueueProps {
  goals: PaymentGoal[];
  onApprove: (goalId: string) => void;
  onReject?: (goalId: string) => void;
}

export const ApprovalsQueue: React.FC<ApprovalsQueueProps> = ({ goals, onApprove, onReject }) => {
  const pendingGoals = goals.filter(
    (g) =>
      (g.status === "pending_approval" || (g.requiresApproval && g.approvalStatus === "pending")) &&
      g.status !== "payout_approved" &&
      g.status !== "paid" &&
      g.status !== "cancelled" &&
      g.approvalStatus !== "approved"
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Human Approval Queue</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          High-risk payment disbursements and transactions held for human verification
        </p>
      </div>

      {pendingGoals.length === 0 ? (
        <div className="p-8 text-center rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center mb-2.5">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white">All Clear — No Approvals Pending</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
            Every transaction is within autonomous boundaries. Payments exceeding review thresholds
            or involving new recipients will appear here for sign-off.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingGoals.map((g) => (
            <div
              key={g.id}
              className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-500/30 shadow-2xs space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-start space-x-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">{g.customer}</h4>
                      <span className="text-[10px] px-2 py-0.2 rounded font-bold uppercase bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300">
                        Requires Sign-off
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {g.purpose || g.goal} &bull; <span className="font-medium text-slate-700 dark:text-slate-300">Type: Outbound Vendor Disbursement</span>
                    </p>
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <div className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                    ${g.amount.toLocaleString()} <span className="text-xs text-slate-500">{g.currency}</span>
                  </div>
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                    Flag: {g.riskLevel.toUpperCase()} RISK ({g.riskScore}/100)
                  </span>
                </div>
              </div>

              {/* Safety Reason Breakdown */}
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Payment Safety Engine Findings
                </span>
                <div className="space-y-1">
                  {g.riskChecks.map((chk) => (
                    <div key={chk.id} className="flex items-center space-x-2 text-xs">
                      {chk.passed ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      )}
                      <span className={chk.passed ? "text-slate-500 dark:text-slate-400" : "text-amber-800 dark:text-amber-200 font-medium"}>
                        {chk.details}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 italic">
                  * Approval records safety sign-off for review. Payout execution is separate (no live funds dispatched).
                </span>
                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={() => onReject?.(g.id)}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition"
                  >
                    Cancel / Reject
                  </button>
                  <button
                    onClick={() => onApprove(g.id)}
                    className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition active:scale-95 shadow-xs"
                  >
                    Approve for Review (Simulation: ${g.amount.toLocaleString()})
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
