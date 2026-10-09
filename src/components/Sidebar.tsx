"use client";

import React from "react";
import {
  LayoutDashboard,
  Bot,
  Target,
  Users,
  ShieldCheck,
  Clock,
  Brain,
  Settings,
  Sparkles,
  RotateCcw,
  ExternalLink,
  Sun,
  Moon,
  X,
} from "lucide-react";
import { ExecutionMode } from "@/packages/types";

export type NavTab =
  | "dashboard"
  | "agent"
  | "goals"
  | "customers"
  | "approvals"
  | "activity"
  | "memory"
  | "settings"
  | "summary";

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  pendingApprovalCount: number;
  onResetDemo: () => void;
  isResetting: boolean;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  mode: ExecutionMode;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  pendingApprovalCount,
  onResetDemo,
  isResetting,
  isOpenMobile,
  onCloseMobile,
  isDark,
  onToggleTheme,
  mode,
}) => {
  const navItems = [
    { id: "dashboard" as NavTab, label: "Dashboard", icon: LayoutDashboard },
    { id: "agent" as NavTab, label: "AI Command Center", icon: Bot },
    { id: "goals" as NavTab, label: "Payment Goals", icon: Target },
    { id: "customers" as NavTab, label: "Customers", icon: Users },
    {
      id: "approvals" as NavTab,
      label: "Approvals",
      icon: ShieldCheck,
      countBadge: pendingApprovalCount,
    },
    { id: "activity" as NavTab, label: "Activity Timeline", icon: Clock },
    { id: "memory" as NavTab, label: "Memory & Rules", icon: Brain },
    { id: "settings" as NavTab, label: "Settings & Config", icon: Settings },
    { id: "summary" as NavTab, label: "Project Takeaway", icon: Sparkles },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-950/60 z-40 md:hidden backdrop-blur-xs transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Main Sidebar */}
      <aside
        className={`w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-screen fixed left-0 top-0 select-none z-50 transition-transform duration-200 ease-in-out md:translate-x-0 ${
          isOpenMobile ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Sidebar Navigation"
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-paypal-blue flex items-center justify-center text-white shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-base text-slate-900 dark:text-white tracking-tight">
                  PayPilot
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-sky-100 dark:bg-paypal-blue/20 text-paypal-blue dark:text-sky-300 border border-sky-200 dark:border-paypal-blue/40">
                  AI
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                PayPal AI Hackathon 2026
              </p>
            </div>
          </div>

          {/* Close button on mobile */}
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            aria-label="Close Sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Workspaces
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all ${
                  isActive
                    ? "bg-slate-100 dark:bg-slate-800 text-paypal-blue dark:text-white border border-slate-200 dark:border-slate-700 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                }`}
              >
                <div className="flex items-center space-x-2.5 min-w-0 text-left">
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? "text-paypal-blue dark:text-sky-400" : "text-slate-400"
                    }`}
                  />
                  <span className="text-left whitespace-nowrap truncate">{item.label}</span>
                </div>
                {item.countBadge !== undefined && item.countBadge > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/40 shrink-0">
                    {item.countBadge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Connection Status Box */}
        <div className="p-3 mx-3 mb-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center space-x-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  mode === "sandbox" ? "bg-emerald-500" : "bg-purple-500"
                }`}
              />
              <span className="font-semibold text-slate-800 dark:text-slate-200 text-[11px]">
                {mode === "sandbox" ? "PayPal Sandbox (Live)" : "PayPal Simulation Mode"}
              </span>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed mb-1.5">
            {mode === "sandbox"
              ? "Live Sandbox REST v2 credentials active."
              : "Demo mode with verified deterministic simulation."}
          </p>
          <a
            href="https://developer.paypal.com/dashboard/applications/sandbox"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-1 text-paypal-blue dark:text-sky-400 hover:underline text-[10px] font-medium"
          >
            <span>Developer Dashboard</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>

        {/* Theme Toggle & Demo Reset Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Appearance
            </span>
            <button
              onClick={onToggleTheme}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
          </div>

          <button
            onClick={onResetDemo}
            disabled={isResetting}
            className="w-full flex items-center justify-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 text-[11px] font-medium border border-slate-200 dark:border-slate-700/60 transition disabled:opacity-50"
            aria-label="Reset Demo Data"
          >
            <RotateCcw className={`w-3 h-3 ${isResetting ? "animate-spin" : ""}`} />
            <span>{isResetting ? "Resetting..." : "Reset Demo Data"}</span>
          </button>
        </div>
      </aside>
    </>
  );
};
