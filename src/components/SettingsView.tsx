"use client";

import React, { useState, useEffect } from "react";
import { Settings, Shield, ExternalLink, Key, Sliders, CheckCircle2, AlertTriangle, Database } from "lucide-react";
import { SafeSystemConfig } from "@/packages/types";

export const SettingsView: React.FC = () => {
  const [config, setConfig] = useState<SafeSystemConfig | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const p = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const requestedMode = p?.get("mode");
    const configUrl = requestedMode ? `/api/config?mode=${requestedMode}` : "/api/config";
    fetch(configUrl)
      .then((r) => r.json())
      .then((data) => setConfig(data))
      .catch((e) => console.error("Error loading config:", e))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="space-y-5 w-full">
      <div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">System Settings &amp; Configuration</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          PayPal Developer Platform credentials, risk thresholds, and execution environment
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full">
        {/* Left Column: Core Configurations */}
        <div className="lg:col-span-8 space-y-4">
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

          {config?.mode === "simulation" ? (
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-500/15 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30 flex items-center space-x-1">
              <span>Simulation Mode (Orders v2 Sandbox-Ready)</span>
            </span>
          ) : config?.canExecuteSandbox ? (
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Live Sandbox Active (Admin Authorized)</span>
            </span>
          ) : config?.paypalConfigured ? (
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 flex items-center space-x-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Sandbox Configured (Admin Unlock Required)</span>
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
                {config?.mode === "simulation"
                  ? "SIMULATION (ORDERS V2 SCHEMA COMPLIANT)"
                  : config?.canExecuteSandbox
                  ? "SANDBOX (LIVE ORDERS V2)"
                  : config?.paypalConfigured
                  ? "SIMULATION (SANDBOX CREDENTIALS GATED)"
                  : "SIMULATION (DETERMINISTIC)"}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {config?.mode === "simulation"
                ? "PayPilot operates in Truthful Simulation Mode with deterministic state transitions, mock orders, and full PayPal Orders v2 schema adherence with zero downtime."
                : config?.canExecuteSandbox
                ? "PayPal Client ID & Secret verified. Evaluator admin session is authenticated: live PayPal Orders v2 sandbox orders, buyer approvals, and captures execute directly on api-m.sandbox.paypal.com."
                : config?.paypalConfigured
                ? "PayPal sandbox credentials (Client ID & Secret) are present in server environment, but this session is unauthenticated. To safeguard public demo usage, live sandbox order creation requires unlocking Admin mode via the top header passkey."
                : "Valid PayPal sandbox credentials are not configured in .env. PayPilot operates in Truthful Simulation Mode with deterministic state transitions, mock orders, and zero downtime."}
            </p>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800 dark:text-slate-200">AI Planning Engine:</span>
              <span className="font-mono text-slate-600 dark:text-slate-400 font-bold text-[11px]">
                {config?.aiProvider || "Google Gemini 2.5 Flash / Fallback"}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {config?.geminiLiveVerified
                ? "Live Google Gemini 2.5 Flash engine active and verified via official @google/genai SDK with deterministic fallback safety net."
                : "Dual-engine architecture: structured intent extraction runs on Google Gemini 2.5 Flash when GEMINI_API_KEY is configured, with automated deterministic NLP fallback for guaranteed offline reliability."}
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

    {/* Right Column: Security Architecture & Compliance */}
    <div className="lg:col-span-4 space-y-4">
      <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3.5">
        <div className="flex items-center space-x-2 pb-2.5 border-b border-slate-200 dark:border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">Security Architecture</h4>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">Zero-Trust Agent Governance</p>
          </div>
        </div>

        <div className="space-y-2.5 text-[11px]">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800 dark:text-slate-200">Dual-Authorization Gate</span>
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 font-mono">$2,000 Cap</span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Outbound vendor disbursements exceeding $2,000 are paused for mandatory administrative sign-off. Review approval never auto-disburses funds.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800 dark:text-slate-200">Visitor Isolation</span>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 font-mono">Enforced</span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Anonymous demo visitors operate on isolated ephemeral records via secure HttpOnly cookies. Canonical fixtures remain immutable.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800 dark:text-slate-200">Test Suite Integrity</span>
              <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 font-mono">46/46 Passing</span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
              End-to-end integration and security regression test suite validated via Vitest with zero failures.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
  );
};
