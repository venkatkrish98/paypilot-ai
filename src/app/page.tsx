"use client";

import React, { useState, useEffect } from "react";
import { Sidebar, NavTab } from "@/components/Sidebar";
import { MetricCards } from "@/components/MetricCards";
import { HeroDemoFlow } from "@/components/HeroDemoFlow";
import { AgentCommandCenter, ChatMessage } from "@/components/AgentCommandCenter";
import { PaymentGoalsTable } from "@/components/PaymentGoalsTable";
import { PaymentDetailModal } from "@/components/PaymentDetailModal";
import { SimulationCheckoutModal } from "@/components/SimulationCheckoutModal";
import { ApprovalsQueue } from "@/components/ApprovalsQueue";
import { CustomersView } from "@/components/CustomersView";
import { MemoryView } from "@/components/MemoryView";
import { ActivityView } from "@/components/ActivityView";
import { SettingsView } from "@/components/SettingsView";
import { SummaryTakeawayView } from "@/components/SummaryTakeawayView";
import { AIRecommendationsCard } from "@/components/AIRecommendationsCard";
import { AdminAuthModal } from "@/components/AdminAuthModal";
import { PaymentGoal, AIRecommendation, ExecutionMode, DashboardMetrics } from "@/packages/types";
import { Bot, Menu, Sparkles, Sun, Moon, AlertTriangle, CheckCircle2, RotateCcw, Shield, LogOut } from "lucide-react";

export default function Home() {
  const [currentTab, setCurrentTab] = useState<NavTab>("dashboard");
  const [goals, setGoals] = useState<PaymentGoal[]>([]);
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<PaymentGoal | null>(null);
  const [simulationGoal, setSimulationGoal] = useState<PaymentGoal | null>(null);
  const [isSimModalOpen, setIsSimModalOpen] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [isOpenMobile, setIsOpenMobile] = useState<boolean>(false);
  const [isDark, setIsDark] = useState<boolean>(true);
  const [mode, setMode] = useState<ExecutionMode>("simulation");
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState<boolean>(false);
  const [canExecuteSandbox, setCanExecuteSandbox] = useState<boolean>(false);
  const [globalNotice, setGlobalNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Shared Chat Messages State between Dashboard and Command Center
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "msg_welcome",
      sender: "agent",
      text: "Hello! I am PayPilot AI — your autonomous agent for getting paid, paying safely, and managing transactions with PayPal.\n\nYou can enter payment goals in plain English (e.g. \"Collect $1,200 from Sarah by Friday\"), verify customer histories, or inspect safety reviews.",
      timestamp: "Just now",
    },
  ]);

  // Load theme and system config on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("paypilot_theme");
    const prefersDark = savedTheme ? savedTheme === "dark" : true;
    setIsDark(prefersDark);
    if (prefersDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    // Establish visitor isolation identity
    let visitorId = localStorage.getItem("paypilot_visitor_id");
    if (!visitorId) {
      visitorId = `v_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      localStorage.setItem("paypilot_visitor_id", visitorId);
    }
    document.cookie = `paypilot_visitor_id=${visitorId}; path=/; max-age=31536000; SameSite=Lax`;

    // Read initial tab from URL if provided (e.g. ?tab=goals)
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab") as NavTab | null;
    if (
      tabParam &&
      [
        "dashboard",
        "agent",
        "goals",
        "customers",
        "approvals",
        "activity",
        "memory",
        "settings",
        "summary",
      ].includes(tabParam)
    ) {
      setCurrentTab(tabParam);
    }

    const handlePopState = () => {
      const p = new URLSearchParams(window.location.search);
      const t = p.get("tab") as NavTab | null;
      if (t) setCurrentTab(t);
    };
    window.addEventListener("popstate", handlePopState);

    refreshAuthAndConfig();

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const refreshAuthAndConfig = async () => {
    try {
      const p = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
      const requestedMode = p?.get("mode");
      const configUrl = requestedMode ? `/api/config?mode=${requestedMode}` : "/api/config";
      const [sessionRes, configRes] = await Promise.all([
        fetch("/api/auth/session"),
        fetch(configUrl),
      ]);
      const sessionData = await sessionRes.json();
      const configData = await configRes.json();
      setIsAdmin(Boolean(sessionData.authenticated));
      setMode(configData.mode || "simulation");
      setCanExecuteSandbox(Boolean(configData.canExecuteSandbox));
    } catch (e) {
      console.error("Config check error:", e);
    }
  };

  const handleSignOutAdmin = async () => {
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
      setIsAdmin(false);
      setGlobalNotice({ type: "success", message: "Signed out to anonymous simulation demo." });
      setTimeout(() => setGlobalNotice(null), 3000);
      await refreshAuthAndConfig();
      await fetchData();
    } catch (e) {
      console.error("Logout error:", e);
    }
  };

  const handleToggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("paypilot_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("paypilot_theme", "light");
    }
  };

  const fetchData = async () => {
    try {
      setFetchError(null);
      const [goalsRes, recsRes] = await Promise.all([
        fetch("/api/goals"),
        fetch("/api/recommendations"),
      ]);

      if (!goalsRes.ok) {
        throw new Error(`Failed to load goals (${goalsRes.status})`);
      }

      const goalsData = await goalsRes.json();
      if (goalsData.goals) setGoals(goalsData.goals);
      if (goalsData.metrics) setMetrics(goalsData.metrics);

      if (recsRes.ok) {
        const recsData = await recsRes.json();
        if (recsData.recommendations) setRecommendations(recsData.recommendations);
      }
    } catch (e) {
      console.error(e);
      setFetchError(e instanceof Error ? e.message : "Error fetching dashboard data");
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleResetDemo = async () => {
    setIsResetting(true);
    setGlobalNotice(null);
    try {
      const res = await fetch("/api/demo/reset", { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to reset demo");
      }
      const data = await res.json();
      if (data.goals) setGoals(data.goals);
      if (data.metrics) setMetrics(data.metrics);
      setGlobalNotice({ type: "success", message: "Database reset to deterministic demo seed." });
      setTimeout(() => setGlobalNotice(null), 3000);
      fetchData();
    } catch (e) {
      console.error(e);
      setGlobalNotice({
        type: "error",
        message: e instanceof Error ? e.message : "Error resetting demo data",
      });
    } finally {
      setIsResetting(false);
    }
  };

  const handleSimulatePayment = async (goalId: string) => {
    try {
      const res = await fetch(`/api/goals/${goalId}/capture`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Capture failed");
      }
      const data = await res.json();
      if (data.goal) {
        setSelectedGoal(data.goal);
        setGlobalNotice({
          type: "success",
          message: `Payment captured: $${data.goal.amount.toLocaleString()} marked paid (${data.isSimulated ? "Simulation" : "PayPal Sandbox"}).`,
        });
        setTimeout(() => setGlobalNotice(null), 3500);
        fetchData();
      }
    } catch (e) {
      console.error(e);
      setGlobalNotice({
        type: "error",
        message: e instanceof Error ? e.message : "Capture failed",
      });
    }
  };

  const handleApproveGoal = async (goalId: string) => {
    try {
      const res = await fetch(`/api/goals/${goalId}/approve`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Approval failed");
      }
      const data = await res.json();
      if (data.goal) {
        setSelectedGoal(data.goal);
        setGlobalNotice({
          type: "success",
          message:
            data.message ||
            (data.goal.goalType === "payout_review"
              ? `Review approved for ${data.goal.customer}! Safety sign-off recorded (Simulation Only — No Payout Dispatched).`
              : `Collection goal approved for ${data.goal.customer}!${data.goal.paypalOrderId ? ` Order ${data.goal.paypalOrderId} created.` : ""}`),
        });
        setTimeout(() => setGlobalNotice(null), 3500);
        fetchData();
      }
    } catch (e) {
      console.error(e);
      setGlobalNotice({
        type: "error",
        message: e instanceof Error ? e.message : "Approval failed",
      });
    }
  };

  const handleRecommendationAction = (rec: AIRecommendation) => {
    if (rec.actionType === "review_approval") {
      setCurrentTab("approvals");
    } else if (rec.actionType === "prepare_followup") {
      setCurrentTab("agent");
    }
  };

  const handleDismissRecommendation = async (id: string) => {
    try {
      await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "dismiss" }),
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col md:flex-row text-slate-900 dark:text-slate-100 transition-colors">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        pendingApprovalCount={metrics ? metrics.attentionCount : 0}
        onResetDemo={handleResetDemo}
        isResetting={isResetting}
        isOpenMobile={isOpenMobile}
        onCloseMobile={() => setIsOpenMobile(false)}
        isDark={isDark}
        onToggleTheme={handleToggleTheme}
        mode={mode}
      />

      {/* Main Content Area */}
      <main className="flex-1 md:ml-64 p-4 sm:p-6 lg:p-8 min-h-screen w-full">
        {/* Mobile Navbar Header */}
        <div className="md:hidden flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsOpenMobile(true)}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-bold text-sm tracking-tight">PayPilot AI</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleToggleTheme}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
              aria-label="Toggle Theme"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Global Notifications Announcement Banner */}
        {globalNotice && (
          <div
            className={`mb-4 p-3 rounded-lg border text-xs flex items-center space-x-2 ${
              globalNotice.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300"
                : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/40 text-red-800 dark:text-red-300"
            }`}
            role="status"
            aria-live="polite"
          >
            {globalNotice.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
            )}
            <span>{globalNotice.message}</span>
          </div>
        )}

        {/* Desktop Top Header */}
        <header className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-paypal-blue dark:text-sky-400">
                PayPal AI Hackathon 2026
              </span>
              <span className="text-slate-300 dark:text-slate-700">&bull;</span>
              <span
                className={`text-[10px] font-semibold font-mono ${
                  mode === "sandbox" ? "text-emerald-600 dark:text-emerald-400" : "text-purple-600 dark:text-purple-400"
                }`}
              >
                {mode === "sandbox" ? "PayPal Sandbox (Live Admin)" : "Simulation Mode (Demo)"}
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight mt-0.5">
              PayPilot AI &mdash; Autonomous Payment Orchestrator
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              &ldquo;Your AI agent for getting paid, paying safely, and managing every transaction.&rdquo;
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {isAdmin ? (
              <button
                onClick={handleSignOutAdmin}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-xs transition active:scale-95"
                title="Sign out of Admin session back to anonymous demo"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out to Demo</span>
              </button>
            ) : (
              <button
                onClick={() => setIsAdminModalOpen(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-paypal-blue/30 dark:border-sky-500/30 bg-paypal-blue/10 dark:bg-sky-500/10 text-paypal-blue dark:text-sky-300 hover:bg-paypal-blue/20 dark:hover:bg-sky-500/20 font-medium text-xs transition active:scale-95"
                title="Enter Judge/Admin Key to unlock PayPal Sandbox mode"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Unlock Sandbox</span>
              </button>
            )}

            {currentTab !== "agent" && (
              <button
                onClick={() => setCurrentTab("agent")}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-paypal-blue hover:bg-blue-600 text-white font-semibold text-xs shadow-2xs transition active:scale-95"
              >
                <Bot className="w-3.5 h-3.5" />
                <span>Open Command Center</span>
              </button>
            )}
          </div>
        </header>

        {/* Tab Router */}
        {currentTab === "dashboard" && (
          <div className="space-y-6">
            {/* 1. Hero Demo Walkthrough Banner */}
            <HeroDemoFlow
              onFlowCompleted={fetchData}
              onOpenApproval={(goalId) => {
                const target = goals.find((g) => g.id === goalId);
                if (target) setSelectedGoal(target);
                setCurrentTab("approvals");
              }}
              onOpenSimulationCheckout={(goal) => {
                setSimulationGoal(goal);
                setIsSimModalOpen(true);
              }}
              mode={mode}
            />

            {/* Fetch Error Banner with Retry */}
            {fetchError && (
              <div
                className="p-3.5 rounded-xl border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 text-xs flex items-center justify-between"
                role="alert"
              >
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
                  <span>{fetchError}</span>
                </div>
                <button
                  onClick={fetchData}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Retry</span>
                </button>
              </div>
            )}

            {/* 2. KPI Metrics */}
            <MetricCards
              metrics={metrics}
              isLoading={isLoadingData}
              onFilterClick={(f) => {
                if (f === "pending_approval") setCurrentTab("approvals");
                else setCurrentTab("goals");
              }}
            />

            {/* 3. Proactive Agent Recommendations */}
            <AIRecommendationsCard
              recommendations={recommendations}
              goals={goals}
              onActionClick={handleRecommendationAction}
              onDismiss={handleDismissRecommendation}
            />

            {/* 4. Interactive AI Chat & Goals Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Column: Payment Goals Table */}
              <div className="lg:col-span-7">
                <PaymentGoalsTable
                  goals={goals}
                  isLoading={isLoadingData}
                  onOpenDetails={(g) => setSelectedGoal(g)}
                  onSimulatePayment={handleSimulatePayment}
                  onOpenSimulationCheckout={(goal) => {
                    setSimulationGoal(goal);
                    setIsSimModalOpen(true);
                  }}
                  onApproveGoal={handleApproveGoal}
                />
              </div>

              {/* Right Column: Interactive AI Chat directly on Dashboard */}
              <div className="lg:col-span-5">
                <AgentCommandCenter
                  compact={true}
                  messages={chatMessages}
                  setMessages={setChatMessages}
                  onGoalUpdated={fetchData}
                  onOpenDetails={(g) => setSelectedGoal(g)}
                  onOpenSimulationCheckout={(goal) => {
                    setSimulationGoal(goal);
                    setIsSimModalOpen(true);
                  }}
                  mode={mode}
                />
              </div>
            </div>
          </div>
        )}

        {currentTab === "agent" && (
          <div className="space-y-4">
            <AgentCommandCenter
              compact={false}
              messages={chatMessages}
              setMessages={setChatMessages}
              onGoalUpdated={fetchData}
              onOpenDetails={(g) => setSelectedGoal(g)}
              onOpenSimulationCheckout={(goal) => {
                setSimulationGoal(goal);
                setIsSimModalOpen(true);
              }}
              mode={mode}
            />
          </div>
        )}

        {currentTab === "goals" && (
          <div className="space-y-4">
            <PaymentGoalsTable
              goals={goals}
              onOpenDetails={(g) => setSelectedGoal(g)}
              onSimulatePayment={handleSimulatePayment}
              onOpenSimulationCheckout={(goal) => {
                setSimulationGoal(goal);
                setIsSimModalOpen(true);
              }}
              onApproveGoal={handleApproveGoal}
            />
          </div>
        )}

        {currentTab === "customers" && <CustomersView />}

        {currentTab === "approvals" && (
          <ApprovalsQueue
            goals={goals}
            onApprove={handleApproveGoal}
            onReject={(id) => {
              fetch(`/api/goals/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "cancelled" }),
              }).then(() => fetchData());
            }}
          />
        )}

        {currentTab === "activity" && (
          <ActivityView goals={goals} onOpenDetails={(g) => setSelectedGoal(g)} />
        )}

        {currentTab === "memory" && <MemoryView />}

        {currentTab === "settings" && <SettingsView />}

        {currentTab === "summary" && <SummaryTakeawayView />}

        {/* Global Accessible Detail Modal */}
        <PaymentDetailModal
          goal={selectedGoal}
          onClose={() => setSelectedGoal(null)}
          onSimulatePayment={handleSimulatePayment}
          onApprovePayment={handleApproveGoal}
          onOpenSimulationCheckout={(goal) => {
            setSelectedGoal(null);
            setSimulationGoal(goal);
            setIsSimModalOpen(true);
          }}
        />

        {/* In-App Simulation Checkout Preview Modal */}
        <SimulationCheckoutModal
          goal={simulationGoal}
          isOpen={isSimModalOpen}
          onClose={() => {
            setIsSimModalOpen(false);
            setSimulationGoal(null);
          }}
          onCapture={async (goalId) => {
            await handleSimulatePayment(goalId);
            setIsSimModalOpen(false);
            setSimulationGoal(null);
          }}
        />

        {/* Admin Authentication Modal for Sandbox Execution */}
        <AdminAuthModal
          isOpen={isAdminModalOpen}
          onClose={() => setIsAdminModalOpen(false)}
          onSuccess={() => {
            setGlobalNotice({
              type: "success",
              message: "Admin verified! PayPal Sandbox mode unlocked for this session.",
            });
            setTimeout(() => setGlobalNotice(null), 3500);
            refreshAuthAndConfig();
            fetchData();
          }}
        />
      </main>
    </div>
  );
}
