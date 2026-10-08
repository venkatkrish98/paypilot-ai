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
import { AIRecommendationsCard } from "@/components/AIRecommendationsCard";
import { PaymentGoal, AIRecommendation, ExecutionMode } from "@/packages/types";
import { Bot, Menu, Sparkles, Sun, Moon, AlertTriangle, CheckCircle2 } from "lucide-react";

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
  const [globalNotice, setGlobalNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [metrics, setMetrics] = useState({
    totalGoals: 4,
    awaitingCount: 2,
    awaitingAmount: 1800,
    paidCount: 1,
    paidAmount: 850,
    sandboxPaidCount: 0,
    sandboxPaidAmount: 0,
    simulatedPaidCount: 1,
    simulatedPaidAmount: 850,
    attentionCount: 1,
  });

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

    // Fetch system configuration safely
    fetch("/api/config")
      .then((r) => r.json())
      .then((cfg) => {
        if (cfg.mode) setMode(cfg.mode);
      })
      .catch((e) => console.error("Error fetching config:", e));
  }, []);

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
      const [goalsRes, recsRes] = await Promise.all([
        fetch("/api/goals"),
        fetch("/api/recommendations"),
      ]);

      if (goalsRes.ok) {
        const goalsData = await goalsRes.json();
        if (goalsData.goals) setGoals(goalsData.goals);
        if (goalsData.metrics) setMetrics(goalsData.metrics);
      }

      if (recsRes.ok) {
        const recsData = await recsRes.json();
        if (recsData.recommendations) setRecommendations(recsData.recommendations);
      }
    } catch (e) {
      console.error(e);
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
          message: `Disbursement approved! Order ${data.goal.paypalOrderId} generated.`,
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
        pendingApprovalCount={metrics.attentionCount}
        onResetDemo={handleResetDemo}
        isResetting={isResetting}
        isOpenMobile={isOpenMobile}
        onCloseMobile={() => setIsOpenMobile(false)}
        isDark={isDark}
        onToggleTheme={handleToggleTheme}
        mode={mode}
      />

      {/* Main Content Area */}
      <main className="flex-1 md:ml-64 p-4 sm:p-6 lg:p-8 min-h-screen max-w-7xl">
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
                {mode === "sandbox" ? "PayPal Sandbox (Live)" : "PayPal Simulation Mode"}
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

            {/* 2. KPI Metrics */}
            <MetricCards
              metrics={metrics}
              onFilterClick={(f) => {
                if (f === "pending_approval") setCurrentTab("approvals");
                else setCurrentTab("goals");
              }}
            />

            {/* 3. Proactive Agent Recommendations */}
            <AIRecommendationsCard
              recommendations={recommendations}
              onActionClick={handleRecommendationAction}
              onDismiss={handleDismissRecommendation}
            />

            {/* 4. Interactive AI Chat & Goals Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Column: Payment Goals Table */}
              <div className="lg:col-span-7">
                <PaymentGoalsTable
                  goals={goals}
                  onOpenDetails={(g) => setSelectedGoal(g)}
                  onSimulatePayment={handleSimulatePayment}
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
      </main>
    </div>
  );
}
