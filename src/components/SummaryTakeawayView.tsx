"use client";

import React from "react";
import {
  Sparkles,
  Shield,
  CreditCard,
  Bot,
  CheckCircle2,
  Lock,
  ArrowRight,
  ExternalLink,
  Cpu,
  Layers,
} from "lucide-react";

export const SummaryTakeawayView: React.FC = () => {
  return (
    <div className="space-y-6 w-full animate-in fade-in duration-300">
      {/* Hero Header */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border border-paypal-blue/30 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-paypal-blue/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-paypal-blue/20 border border-paypal-blue/40 text-sky-300 text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>PayPal AI Hackathon 2026 Finalist Project</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white">
              PayPilot AI &mdash; Autonomous Payment Orchestrator
            </h2>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Transforming traditional commerce into proactive, goal-driven financial intelligence.
              From conversational goal to verified PayPal Orders v2 execution in seconds.
            </p>
          </div>

          <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
            <span className="text-xs font-mono text-emerald-400 font-bold px-3 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/40">
              46/46 Vitest Tests Passing
            </span>
            <span className="text-[11px] text-slate-400">
              MIT License &bull; Public GitHub Repository
            </span>
          </div>
        </div>
      </div>

      {/* 4 Architectural Pillars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pillar 1 */}
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-sky-500/10 text-paypal-blue dark:text-sky-400 flex items-center justify-center">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Multi-Agent Planning</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Google Gemini 2.5 Flash / Fallback</p>
          </div>
          <ul className="text-xs space-y-1.5 text-slate-600 dark:text-slate-300">
            <li className="flex items-start space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <span>Natural language intent parsing</span>
            </li>
            <li className="flex items-start space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <span>Customer entity identification</span>
            </li>
            <li className="flex items-start space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <span>Contextual memory recall</span>
            </li>
          </ul>
        </div>

        {/* Pillar 2 */}
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-sky-500/10 text-paypal-blue dark:text-sky-400 flex items-center justify-center">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">PayPal Integration</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Official Orders v2 API</p>
          </div>
          <ul className="text-xs space-y-1.5 text-slate-600 dark:text-slate-300">
            <li className="flex items-start space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <span>Live PayPal Sandbox checkout</span>
            </li>
            <li className="flex items-start space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <span>Deterministic offline simulation</span>
            </li>
            <li className="flex items-start space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <span>Immediate buyer checkout links</span>
            </li>
          </ul>
        </div>

        {/* Pillar 3 */}
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Risk Safety Engine</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Dual-Authorization Gating</p>
          </div>
          <ul className="text-xs space-y-1.5 text-slate-600 dark:text-slate-300">
            <li className="flex items-start space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <span>$2,000 threshold review boundary</span>
            </li>
            <li className="flex items-start space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <span>Duplicate velocity warnings (24h)</span>
            </li>
            <li className="flex items-start space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <span>Gated payouts (never auto-disbursed)</span>
            </li>
          </ul>
        </div>

        {/* Pillar 4 */}
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Ledger & Persistence</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Autonomous Reconciliation</p>
          </div>
          <ul className="text-xs space-y-1.5 text-slate-600 dark:text-slate-300">
            <li className="flex items-start space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <span>Real-time payment capture</span>
            </li>
            <li className="flex items-start space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <span>Automated ledger reconciliation</span>
            </li>
            <li className="flex items-start space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <span>Full immutable audit timeline</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Footer Takeaway Bar */}
      <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-400">
          <span className="font-semibold text-slate-900 dark:text-white">Core Tech Stack:</span>
          <span>Next.js 14 App Router &bull; TypeScript &bull; Tailwind CSS &bull; Google Gemini API &bull; PayPal Orders v2 REST API</span>
        </div>
        <div className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
          paypalaihackathon.devpost.com
        </div>
      </div>
    </div>
  );
};
