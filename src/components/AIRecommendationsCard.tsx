"use client";

import React from "react";
import { Sparkles, ArrowRight } from "lucide-react";
import { AIRecommendation } from "@/packages/types";

interface RecommendationsProps {
  recommendations: AIRecommendation[];
  onActionClick: (rec: AIRecommendation) => void;
  onDismiss?: (id: string) => void;
}

export const AIRecommendationsCard: React.FC<RecommendationsProps> = ({
  recommendations,
  onActionClick,
  onDismiss,
}) => {
  if (recommendations.length === 0) return null;

  return (
    <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2.5">
      <div className="flex items-center space-x-1.5">
        <Sparkles className="w-4 h-4 text-paypal-blue dark:text-sky-400" />
        <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
          Proactive Agent Recommendations
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {recommendations.map((rec) => (
          <div
            key={rec.id}
            className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-2.5 hover:border-slate-300 dark:hover:border-slate-700 transition"
          >
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-900 dark:text-white">{rec.title}</span>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                    rec.urgency === "high"
                      ? "bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/40"
                      : "bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-500/40"
                  }`}
                >
                  {rec.urgency} urgency
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{rec.description}</p>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => onActionClick(rec)}
                className="flex items-center space-x-1 px-3 py-1 rounded-md bg-paypal-blue hover:bg-blue-600 text-white font-semibold text-xs transition active:scale-95 shadow-2xs"
              >
                <span>{rec.actionLabel}</span>
                <ArrowRight className="w-3 h-3" />
              </button>

              {onDismiss && (
                <button
                  onClick={() => onDismiss(rec.id)}
                  className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
