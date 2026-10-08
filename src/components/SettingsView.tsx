"use client";

import React, { useState, useEffect } from "react";
import { Settings, Shield, ExternalLink, Key, Sliders, CheckCircle2, AlertTriangle, Database } from "lucide-react";
import { SafeSystemConfig } from "@/packages/types";

export const SettingsView: React.FC = () => {
  const [config, setConfig] = useState<SafeSystemConfig | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => setConfig(data))
      .catch((e) => console.error("Error loading config:", e))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">System Settings &amp; Configuration</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          PayPal Developer Platform credentials, risk thresholds, and execution environment
        </p>
      </div>

      {/* PayPal Platform Configuration */}
      <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3.5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-paypal-blue/20 text-paypal-blue dark:text-sky-300 flex items-center justify-center">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">PayPal Platform Integration</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Orders v2 REST API (api-m.sandbox.paypal.com)</p>
            </div>
          </div>

          {config?.paypalConfigured ? (
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Live Sandbox Active</span>
            </span>
          ) : (
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-500/15 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30 flex items-center space-x-1">
              <span>Simulation Mode Active</span>
            </span>
          )}
        </div>

        <div className="space-y-2 text-xs">
          <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800 dark:text-slate-200">Execution Mode:</span>
              <span className="font-mono text-slate-600 dark:text-slate-400 uppercase font-bold text-[11px]">
                {config?.mode || "simulation"}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {config?.paypalConfigured
                ? "PayPal Client ID and Secret are configured server-side. Live sandbox orders are created and verified."
                : "Valid sandbox credentials are not set in .env. PayPilot operates in Truthful Simulation Mode with deterministic state transitions and zero downtime."}
            </p>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800 dark:text-slate-200">AI Planning Engine:</span>
              <span className="font-mono text-slate-600 dark:text-slate-400 font-bold text-[11px]">
                {config?.aiProvider || "Google Gemini 3.8 Flash / Fallback"}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Structured intent extraction uses Gemini 3.8 Flash when GEMINI_API_KEY is present, with an automatic verified deterministic rule-based fallback.
            </p>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800 dark:text-slate-200">Storage &amp; Persistence:</span>
              <span className="font-mono text-slate-600 dark:text-slate-400 font-bold text-[11px]">
                Local Durable File Storage (data/paypilot_db.json)
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              All payment goals, customer ledgers, and memories are written to local JSON storage, preserving state across server restarts.
            </p>
          </div>
        </div>

        <div className="pt-1 flex items-center justify-between text-xs">
          <a
            href="https://developer.paypal.com/dashboard/applications/sandbox"
            target="_blank"
            rel="noopener noreferrer"
            className="text-paypal-blue dark:text-sky-400 hover:underline flex items-center space-x-1 font-semibold text-[11px]"
          >
            <span>Manage Sandbox Credentials in PayPal Developer Portal</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Payment Safety Thresholds */}
      <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
        <div className="flex items-center space-x-2.5 pb-2.5 border-b border-slate-200 dark:border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">Payment Safety Boundaries</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Heuristic review thresholds for autonomous execution</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-slate-500 block text-[10px] font-bold uppercase">
              Autonomous Approval Boundary
            </span>
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              ${config?.reviewThreshold?.toLocaleString() || "2,000"}.00 USD
            </span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Payments below this threshold execute autonomously after passing heuristic safety checks.
            </p>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-slate-500 block text-[10px] font-bold uppercase">
              Duplicate Detection Window
            </span>
            <span className="text-sm font-bold text-slate-900 dark:text-white">24 Hours</span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Identical amounts to the same recipient within 24 hours trigger duplicate payment warnings.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
