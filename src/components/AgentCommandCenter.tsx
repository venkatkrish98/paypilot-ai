"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Sparkles,
  Bot,
  User,
  ShieldCheck,
  CreditCard,
  ExternalLink,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Info,
} from "lucide-react";
import { AgentStep, PaymentGoal, AgentOrchestratorResult, ExecutionMode } from "@/packages/types";

export interface ChatMessage {
  id: string;
  sender: "user" | "agent";
  text: string;
  steps?: AgentStep[];
  goal?: PaymentGoal;
  requiresApproval?: boolean;
  timestamp: string;
  isSimulated?: boolean;
  aiEngine?: "gemini" | "deterministic";
  error?: string;
}

interface AgentCommandCenterProps {
  onGoalUpdated?: () => void;
  onOpenDetails?: (goal: PaymentGoal) => void;
  onOpenSimulationCheckout?: (goal: PaymentGoal) => void;
  compact?: boolean;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  mode?: ExecutionMode;
}

export const AgentCommandCenter: React.FC<AgentCommandCenterProps> = ({
  onGoalUpdated,
  onOpenDetails,
  onOpenSimulationCheckout,
  compact = false,
  messages,
  setMessages,
  mode = "simulation",
}) => {
  const [inputQuery, setInputQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const quickPrompts = [
    "I need to collect $1,200 from Sarah for the website project by Friday.",
    "Has Sarah paid me recently?",
    "Which payments need my attention today?",
    "Pay vendor Mike $2,500 for cloud review.",
    "Follow up with Sarah.",
    "Remember that Sarah prefers email payment reminders.",
  ];

  const handleSend = async (queryText?: string) => {
    const query = queryText || inputQuery;
    if (!query.trim() || isLoading) return;

    setActionError(null);
    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, mode }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `Server returned HTTP ${res.status}`);
      }

      const data: AgentOrchestratorResult = await res.json();

      const agentMsg: ChatMessage = {
        id: `agent_${Date.now()}`,
        sender: "agent",
        text: data.assistantResponse,
        steps: data.steps,
        goal: data.goal,
        requiresApproval: data.requiresApproval,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        isSimulated: data.isSimulated,
        aiEngine: data.aiEngine,
      };

      setMessages((prev) => [...prev, agentMsg]);
      if (onGoalUpdated) {
        onGoalUpdated();
      }
    } catch (e) {
      console.error(e);
      const errText = e instanceof Error ? e.message : "Error executing request";
      setActionError(errText);
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: "agent",
          text: `I encountered an issue processing your request: ${errText}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          error: errText,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (goalId: string) => {
    setActionError(null);
    try {
      const res = await fetch(`/api/goals/${goalId}/approve`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Approval failed");
      }
      const data = await res.json();
      if (data.goal) {
        setMessages((prev) => [
          ...prev,
          {
            id: `appr_${Date.now()}`,
            sender: "agent",
            text:
              data.message ||
              (data.goal.goalType === "payout_review"
                ? `Vendor disbursement of $${data.goal.amount.toLocaleString()} for ${data.goal.customer || "vendor"} approved for review (Simulation Only — No Payout Dispatched).`
                : `Payment collection goal approved for ${data.goal.customer || "customer"}.${data.goal.paypalOrderId ? ` Order \`${data.goal.paypalOrderId}\` generated.` : ""}`),
            goal: data.goal,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            isSimulated: data.isSimulated,
          },
        ]);
        if (onGoalUpdated) onGoalUpdated();
      }
    } catch (e) {
      const errText = e instanceof Error ? e.message : "Error approving payment";
      setActionError(errText);
    }
  };

  const handleCapturePayment = async (goalId: string) => {
    setActionError(null);
    try {
      const res = await fetch(`/api/goals/${goalId}/capture`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Capture failed");
      }
      const data = await res.json();
      if (data.goal) {
        setMessages((prev) => [
          ...prev,
          {
            id: `cap_${Date.now()}`,
            sender: "agent",
            text: data.agentMessage || `Payment of $${data.goal.amount.toLocaleString()} confirmed and reconciled!`,
            goal: data.goal,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            isSimulated: data.isSimulated,
          },
        ]);
        if (onGoalUpdated) onGoalUpdated();
      }
    } catch (e) {
      const errText = e instanceof Error ? e.message : "Error executing capture";
      setActionError(errText);
    }
  };

  const chatCard = (
    <div
      className={`flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden ${
        compact ? "h-[500px]" : "h-[700px]"
      }`}
      role="region"
      aria-label="AI Payment Agent Chat"
    >
      {/* Header */}
      <div className="p-3.5 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-paypal-blue flex items-center justify-center text-white">
            <Bot className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">
                {compact ? "Interactive Payment Agent" : "AI Command Center"}
              </h3>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 font-semibold uppercase">
                Active
              </span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Natural language payment planning, safety verification, and PayPal execution
            </p>
          </div>
        </div>
      </div>

      {/* Global Error Banner */}
      {actionError && (
        <div className="px-3.5 py-2 bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-800/40 text-[11px] text-red-700 dark:text-red-300 flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-[10px] font-semibold underline hover:no-underline ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.map((msg) => {
          const isUser = msg.sender === "user";
          return (
            <div
              key={msg.id}
              className={`flex items-start space-x-2.5 ${isUser ? "flex-row-reverse space-x-reverse" : ""}`}
            >
              {/* Avatar */}
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-semibold ${
                  isUser
                    ? "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                    : "bg-paypal-blue text-white"
                }`}
                aria-hidden="true"
              >
                {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
              </div>

              {/* Message Body */}
              <div
                className={`max-w-[85%] rounded-xl p-3 text-xs leading-relaxed ${
                  isUser
                    ? "bg-paypal-blue text-white rounded-tr-xs"
                    : "bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-xs"
                }`}
              >
                {/* Capability Execution Steps */}
                {msg.steps && msg.steps.length > 0 && (
                  <div className="mb-2.5 space-y-1 border-b border-slate-200 dark:border-slate-800 pb-2">
                    <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                      <Sparkles className="w-3 h-3 text-paypal-blue dark:text-sky-400" />
                      <span>
                        Agent Capability Execution Chain{" "}
                        {msg.aiEngine && (
                          <span className="font-mono text-[8px] text-slate-400">
                            ({msg.aiEngine === "gemini" ? "Google Gemini 2.5 Flash" : "Deterministic Fallback"})
                          </span>
                        )}
                      </span>
                    </div>
                    {msg.steps.map((st, idx) => (
                      <div
                        key={idx}
                        className="flex items-center space-x-1.5 text-[10px] py-0.5 px-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono text-[9px]">
                          [{st.agentName}]
                        </span>
                        <span className="text-slate-500 dark:text-slate-400 truncate">{st.summary}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Formatted Text */}
                <div className="whitespace-pre-line text-xs font-normal">
                  {msg.text}
                </div>

                {/* Inline Payment Goal Card */}
                {msg.goal && (
                  <div className="mt-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[11px] font-bold text-slate-900 dark:text-white flex items-center space-x-1">
                          <CreditCard className="w-3.5 h-3.5 text-paypal-blue dark:text-sky-400" />
                          <span>{msg.goal.customer}</span>
                        </div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                          ${msg.goal.amount.toLocaleString()} {msg.goal.currency}
                          <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400 ml-1.5">
                            ({msg.goal.goalType === "payout_review" ? "Disbursement Review" : "Client Collection"})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1">
                        {msg.goal.isSimulated && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-bold uppercase">
                            Simulation
                          </span>
                        )}
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                            msg.goal.status === "paid"
                              ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300"
                              : msg.goal.status === "pending_approval"
                              ? "bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300"
                              : "bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300"
                          }`}
                        >
                          {msg.goal.status.replace("_", " ")}
                        </span>
                      </div>
                    </div>

                    {msg.goal.paypalOrderId && (
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono flex items-center justify-between bg-slate-50 dark:bg-slate-950 p-1.5 rounded border border-slate-200 dark:border-slate-800">
                        <span>Order ID:</span>
                        <span className="text-slate-800 dark:text-slate-200 font-semibold truncate max-w-[180px]">
                          {msg.goal.paypalOrderId}
                        </span>
                      </div>
                    )}

                    {/* Action Controls */}
                    <div className="flex items-center space-x-2 pt-1">
                      {msg.requiresApproval && msg.goal.status === "pending_approval" ? (
                        <button
                          onClick={() => handleApprove(msg.goal!.id)}
                          className="w-full flex items-center justify-center space-x-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Approve Payment (${msg.goal.amount.toLocaleString()})</span>
                        </button>
                      ) : msg.goal.status === "awaiting_payment" ? (
                        <>
                          <button
                            onClick={() => handleCapturePayment(msg.goal!.id)}
                            className="flex-1 flex items-center justify-center space-x-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>
                              {msg.goal.isSimulated ? "Simulate Payment Capture" : "Capture Confirmed Payment"}
                            </span>
                          </button>
                          {msg.goal.paypalPaymentLink && (
                            msg.goal.isSimulated ? (
                              <button
                                onClick={() => onOpenSimulationCheckout?.(msg.goal!)}
                                className="px-2.5 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 text-purple-700 dark:text-purple-300 text-xs font-semibold border border-purple-200 dark:border-purple-700/60 flex items-center space-x-1"
                                title="Open Simulation Checkout Preview"
                                aria-label="Open Simulation Checkout Preview"
                              >
                                <span>Simulate</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            ) : (
                              <a
                                href={msg.goal.paypalPaymentLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium border border-slate-200 dark:border-slate-700 flex items-center space-x-1"
                                title="Open PayPal Sandbox Checkout"
                                aria-label="Open PayPal Sandbox Checkout"
                              >
                                <span>Sandbox</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )
                          )}
                        </>
                      ) : (
                        <button
                          onClick={() => onOpenDetails?.(msg.goal!)}
                          className="text-[11px] text-paypal-blue dark:text-sky-400 hover:underline flex items-center space-x-1 font-medium"
                        >
                          <span>View Payment Details &amp; Safety Checks</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div
                  className={`mt-1.5 text-[9px] ${
                    isUser ? "text-blue-100" : "text-slate-400 dark:text-slate-500"
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-start space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-paypal-blue flex items-center justify-center text-white">
              <Bot className="w-3.5 h-3.5 animate-spin" />
            </div>
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-600 dark:text-slate-400 flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-paypal-blue animate-ping" />
              <span>Orchestrating agents and evaluating safety rules...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts Bar (Responsive Wrapping, No Clipping) */}
      <div className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-1.5">
        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 shrink-0 mr-1">
          Try:
        </span>
        {quickPrompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(p)}
            className="text-[10px] px-2.5 py-1 rounded-full bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 transition active:scale-95 text-left"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Input Bar */}
      <div className="p-2.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center space-x-1.5"
        >
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Tell PayPilot: 'Collect $1,200 from Sarah by Friday'..."
            disabled={isLoading}
            className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-paypal-blue rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition"
            aria-label="Payment Goal or Question"
          />
          <button
            type="submit"
            disabled={!inputQuery.trim() || isLoading}
            className="w-8 h-8 rounded-lg bg-paypal-blue hover:bg-blue-600 disabled:opacity-50 text-white flex items-center justify-center transition active:scale-95 shrink-0"
            aria-label="Send message"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );

  if (compact) {
    return chatCard;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full">
      <div className="lg:col-span-8">{chatCard}</div>

      <div className="lg:col-span-4 space-y-4">
        {/* Card 1: Orchestration Stack */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
          <div className="flex items-center space-x-2 pb-2 border-b border-slate-200 dark:border-slate-800">
            <div className="w-7 h-7 rounded-lg bg-sky-100 dark:bg-sky-500/15 text-paypal-blue dark:text-sky-300 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">Multi-Agent Orchestration</h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Gemini 2.5 Flash + PayPal Engine</p>
            </div>
          </div>

          <div className="space-y-2 text-[11px]">
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-0.5">
              <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                <span>1. Goal &amp; Intent Parser</span>
                <span className="text-[9px] text-sky-500 font-mono">Gemini 2.5</span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Extracts counterparty, amount, currency, and deadline from natural language.
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-0.5">
              <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                <span>2. Safety &amp; Risk Evaluator</span>
                <span className="text-[9px] text-emerald-500 font-mono">$2,000 Cap</span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Validates transaction boundaries, new vendor flags, and 24h duplicate velocity.
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-0.5">
              <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                <span>3. PayPal Orders v2 Engine</span>
                <span className="text-[9px] text-purple-500 font-mono">REST v2</span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Generates valid Orders v2 schemas with checkout links and instant capture.
              </p>
            </div>
          </div>
        </div>

        {/* Card 2: Interactive Prompts */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2.5">
          <div className="flex items-center space-x-2 pb-2 border-b border-slate-200 dark:border-slate-800">
            <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-500/15 text-purple-600 dark:text-purple-300 flex items-center justify-center">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">Quick Test Scenarios</h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Click to run immediately</p>
            </div>
          </div>

          <div className="space-y-1.5">
            {quickPrompts.slice(0, 4).map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSend(prompt)}
                disabled={isLoading}
                className="w-full text-left p-2 rounded-lg bg-slate-50 hover:bg-sky-50 dark:bg-slate-950 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300 hover:text-paypal-blue dark:hover:text-sky-300 transition flex items-center justify-between group disabled:opacity-50"
              >
                <span className="truncate pr-2">{prompt}</span>
                <ArrowRight className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-paypal-blue dark:text-sky-400" />
              </button>
            ))}
          </div>
        </div>

        {/* Card 3: Security & Verification Badge */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px]">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-slate-600 dark:text-slate-300 font-medium">Dual-Auth Gate: $2,000 USD</span>
          </div>
          <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Active</span>
        </div>
      </div>
    </div>
  );
};
