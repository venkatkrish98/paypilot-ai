"use client";

import React from "react";
import { Clock } from "lucide-react";
import { PaymentGoal } from "@/packages/types";

interface ActivityViewProps {
  goals: PaymentGoal[];
  onOpenDetails: (goal: PaymentGoal) => void;
}

export const ActivityView: React.FC<ActivityViewProps> = ({ goals, onOpenDetails }) => {
  const allEvents = goals
    .flatMap((g) =>
      g.timeline.map((ev) => ({
        ...ev,
        goal: g,
      }))
    )
    .sort((a, b) => b.id.localeCompare(a.id));

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Master Agent Activity Timeline</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Audit trail of agent planning, safety checks, PayPal orders, and reconciliations
        </p>
      </div>

      <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="relative pl-5 space-y-5 border-l-2 border-slate-200 dark:border-slate-800 ml-2">
          {allEvents.map((ev, idx) => (
            <div key={idx} className="relative group">
              <div
                className={`absolute -left-[27px] top-1 w-3 h-3 rounded-full border-2 ${
                  ev.stage === "goal_completed" || ev.stage === "payment_detected"
                    ? "bg-emerald-500 border-emerald-400"
                    : ev.stage === "approval_requested"
                    ? "bg-amber-500 border-amber-400"
                    : "bg-paypal-blue border-sky-400"
                }`}
              />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">{ev.title}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                    {ev.goal.customer} (${ev.goal.amount.toLocaleString()})
                  </span>
                  {ev.isSimulated && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-medium">
                      Simulated
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-mono text-slate-400">{ev.timestamp}</span>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{ev.description}</p>

              <button
                onClick={() => onOpenDetails(ev.goal)}
                className="mt-1 text-[11px] text-paypal-blue dark:text-sky-400 hover:underline inline-block font-medium"
              >
                Inspect Goal ({ev.goal.id})
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
