"use client";

import React, { useState } from "react";
import {
  Sparkles,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronRight,
  Play,
  RotateCcw,
  AlertTriangle,
  Info,
} from "lucide-react";
import { PaymentGoal, ExecutionMode } from "@/packages/types";

interface HeroDemoFlowProps {
  onFlowCompleted: () => void;
  onOpenApproval: (goalId: string) => void;
  mode: ExecutionMode;
}

export const HeroDemoFlow: React.FC<HeroDemoFlowProps> = ({
  onFlowCompleted,
  onOpenApproval,
  mode,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [createdGoal, setCreatedGoal] = useState<PaymentGoal | null>(null);
  const [isSimulatingPayment, setIsSimulatingPayment] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isLiveSandbox = mode === "sandbox";

  const stepsList = [
    {
      step: 1,
      title: "Goal Input",
      desc: '"I need to collect $1,200 from Sarah for the website project by Friday."',
    },
    {
      step: 2,
      title: "Agent Intent & Customer ID",
      desc: "Intent Agent + Customer Agent identify Sarah Jenkins (sarah.jenkins@designcraft.io)",
    },
    {
      step: 3,
      title: "Payment Safety Checks",
      desc: "Risk Agent verifies recipient, velocity, amount boundary ($1,200 < $2,000 threshold)",
    },
    {
      step: 4,
      title: isLiveSandbox ? "PayPal Sandbox Order Created" : "Simulated PayPal Order Created",
      desc: isLiveSandbox
        ? "Official Orders v2 Sandbox order generated with buyer checkout approval link"
        : "Simulated PayPal Orders v2 schema order generated for safe offline demo",
    },
    {
      step: 5,
      title: "Monitoring Active",
      desc: "Follow-up Agent monitors unpaid status awaiting buyer checkout",
    },
    {
      step: 6,
      title: "Payment Confirmed & Reconciled",
      desc: "Confirmed capture detected. Goal updated to PAID. Timeline reconciled.",
    },
    {
      step: 7,
      title: "Next-Action Recommendation",
      desc: "Agent alerts user: 'Mike's $2,500 payout review requires your approval.'",
    },
  ];

  const startHeroFlow = async () => {
    setIsRunning(true);
    setErrorMessage(null);
    setCurrentStep(1);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "I need to collect $1,200 from Sarah for the website project by Friday.",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Agent execution failed");
      }

      const data = await res.json();
      if (data.goal) {
        setCreatedGoal(data.goal);
      }

      setTimeout(() => setCurrentStep(2), 600);
      setTimeout(() => setCurrentStep(3), 1200);
      setTimeout(() => {
        setCurrentStep(4);
        setIsRunning(false);
      }, 1800);
    } catch (e) {
      console.error(e);
      setErrorMessage(e instanceof Error ? e.message : "Error executing hero demo flow");
      setIsRunning(false);
    }
  };

  const capturePayment = async () => {
    if (!createdGoal) return;
    setIsSimulatingPayment(true);
    setErrorMessage(null);
    setCurrentStep(5);

    try {
      const res = await fetch(`/api/goals/${createdGoal.id}/capture`, {
        method: "POST",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Capture failed");
      }

      const data = await res.json();
      if (data.goal) {
        setCreatedGoal(data.goal);
      }

      setTimeout(() => {
        setCurrentStep(6);
        setIsSimulatingPayment(false);
        onFlowCompleted();
      }, 800);

      setTimeout(() => {
        setCurrentStep(7);
      }, 1800);
    } catch (e) {
      console.error(e);
      setErrorMessage(e instanceof Error ? e.message : "Error capturing payment");
      setIsSimulatingPayment(false);
    }
  };

  const resetFlow = () => {
    setCurrentStep(0);
    setCreatedGoal(null);
    setIsRunning(false);
    setErrorMessage(null);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                isLiveSandbox
                  ? "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30"
                  : "bg-purple-50 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30"
              }`}
            >
              {isLiveSandbox ? "Live PayPal Sandbox Workflow" : "Verified Simulation Workflow"}
            </span>
          </div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight mt-1">
            Agentic Payment Lifecycle Walkthrough
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            UNDERSTAND &rarr; PLAN &rarr; VERIFY &rarr; EXECUTE &rarr; MONITOR &rarr; COMPLETE
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {currentStep === 0 ? (
            <button
              onClick={startHeroFlow}
              disabled={isRunning}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-paypal-blue hover:bg-blue-600 text-white font-semibold text-xs transition active:scale-95 disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run Hero Demo Flow</span>
            </button>
          ) : (
            <button
              onClick={resetFlow}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium border border-slate-200 dark:border-slate-700 transition"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Flow</span>
            </button>
          )}
        </div>
      </div>

      {/* Error Announcement */}
      {errorMessage && (
        <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 text-xs text-red-700 dark:text-red-300 flex items-start space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold block">Execution Notice:</span>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {/* Step Progress Line */}
      <div className="mt-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5">
          {stepsList.map((s) => {
            const isCompleted = currentStep > s.step;
            const isCurrent = currentStep === s.step;
            return (
              <div
                key={s.step}
                className={`p-2 rounded-lg border text-center transition-all ${
                  isCompleted
                    ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300"
                    : isCurrent
                    ? "bg-sky-50 dark:bg-slate-800 border-paypal-blue dark:border-sky-400 text-paypal-blue dark:text-white font-semibold"
                    : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500"
                }`}
              >
                <div className="text-[9px] font-bold tracking-wider uppercase mb-0.5">
                  Step {s.step}
                </div>
                <div className="text-[11px] leading-tight line-clamp-1">{s.title}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive Stage Panel */}
      <div className="mt-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
        {currentStep === 0 && (
          <div className="py-2 text-center text-xs text-slate-500 dark:text-slate-400">
            <p>
              Click &quot;Run Hero Demo Flow&quot; to test how PayPilot AI parses natural language,
              coordinates specialized agents, verifies payment safety, executes {isLiveSandbox ? "PayPal Sandbox" : "simulated"} orders,
              and recommends high-risk approval sign-offs.
            </p>
          </div>
        )}

        {currentStep >= 1 && currentStep <= 3 && (
          <div className="space-y-2 py-1">
            <div className="flex items-center space-x-2 text-sky-600 dark:text-sky-400 text-xs font-semibold">
              <Clock className="w-4 h-4 animate-spin" />
              <span>Orchestrating Specialized Agent Capabilities...</span>
            </div>
            <div className="p-3 bg-white dark:bg-slate-900 rounded-lg text-xs font-mono text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 space-y-1">
              <p>&gt; Intent Agent: Extracted $1,200 USD (Website Project) due Friday</p>
              <p>&gt; Customer Agent: Verified recipient Sarah Jenkins</p>
              <p>&gt; Risk Agent: 5-point payment safety check complete. Low Risk (10/100)</p>
            </div>
          </div>
        )}

        {currentStep === 4 && createdGoal && (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    $1,200.00 USD &bull; Sarah Jenkins
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      createdGoal.isSimulated
                        ? "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300"
                        : "bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300"
                    }`}
                  >
                    {createdGoal.isSimulated ? "Simulated Order Ready" : "PayPal Sandbox Order Ready"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                  Order ID: {createdGoal.paypalOrderId}
                </p>
              </div>

              <div className="flex items-center space-x-2">
                {createdGoal.paypalPaymentLink && (
                  <a
                    href={createdGoal.paypalPaymentLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium border border-slate-200 dark:border-slate-700 transition"
                  >
                    <span>{createdGoal.isSimulated ? "Preview Simulated Link" : "Open PayPal Sandbox"}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}

                <button
                  onClick={capturePayment}
                  disabled={isSimulatingPayment}
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition active:scale-95 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>
                    {isSimulatingPayment
                      ? "Processing Capture..."
                      : createdGoal.isSimulated
                      ? "Simulate Customer Payment"
                      : "Capture Confirmed Payment"}
                  </span>
                </button>
              </div>
            </div>

            {/* Note regarding buyer approval if in real sandbox mode */}
            {!createdGoal.isSimulated && (
              <div className="flex items-start space-x-2 text-[11px] text-slate-500 dark:text-slate-400 bg-sky-50 dark:bg-slate-900 p-2.5 rounded-lg border border-sky-100 dark:border-slate-800">
                <Info className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Sandbox Verification Notice:</strong> For real PayPal Sandbox orders, click
                  &quot;Open PayPal Sandbox&quot; to approve with sandbox buyer credentials before capturing.
                  If capturing in simulation mode, click &quot;Simulate Customer Payment&quot; directly.
                </span>
              </div>
            )}
          </div>
        )}

        {(currentStep === 5 || currentStep === 6 || currentStep === 7) && createdGoal && (
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                  {createdGoal.isSimulated ? "Simulated Payment Received" : "PayPal Confirmed Payment"}
                </span>
                <span className="text-[10px] px-2 py-0.2 rounded font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                  PAID
                </span>
              </div>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                Capture ID: {createdGoal.paypalCaptureId}
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Sarah&apos;s payment of $1,200 has been reconciled ({createdGoal.isSimulated ? "Simulation Mode" : "PayPal Sandbox Confirmed"}).
              The collection goal is complete and customer ledger has been updated.
            </p>

            {currentStep === 7 && (
              <div className="mt-3 p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start space-x-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block">
                      Next Agentic Action Recommended
                    </span>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                      Mike Reynolds&apos; $2,500 payout review is held for sign-off (&gt;$2,000 threshold &amp; new vendor).
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => onOpenApproval("goal_mike_2500")}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition active:scale-95 shrink-0"
                >
                  <span>Review Mike&apos;s Payout</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
