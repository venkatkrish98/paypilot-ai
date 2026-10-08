"use client";

import React, { useState, useEffect } from "react";
import { Brain, Plus, Sparkles, Check } from "lucide-react";
import { MemoryItem } from "@/packages/types";

export const MemoryView: React.FC = () => {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [newRule, setNewRule] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMemories();
  }, []);

  const fetchMemories = async () => {
    try {
      const res = await fetch("/api/memory");
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      if (data.memories) {
        setMemories(data.memories);
      }
    } catch (e) {
      console.error(e);
      setError("Failed to fetch agent memories");
    }
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRule.trim()) return;
    setIsAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: newRule, category: "rule" }),
      });
      if (!res.ok) throw new Error("Failed to save rule");
      const data = await res.json();
      if (data.memories) {
        setMemories(data.memories);
      }
      setNewRule("");
    } catch (e) {
      console.error(e);
      setError("Failed to save memory rule");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Agent Memory &amp; Behavioral Rules</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Persistent context remembered by the AI agent across payment lifecycles and interactions
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 rounded-lg text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Add New Rule Form */}
      <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2.5">
        <div className="flex items-center space-x-2 text-xs font-bold text-paypal-blue dark:text-sky-400 uppercase tracking-wider">
          <Brain className="w-3.5 h-3.5" />
          <span>Teach PayPilot a New Rule</span>
        </div>
        <form onSubmit={handleAddMemory} className="flex gap-2">
          <input
            type="text"
            value={newRule}
            onChange={(e) => setNewRule(e.target.value)}
            placeholder='e.g., "Always use USD for international clients" or "Sarah prefers reminders 24h prior"'
            className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-paypal-blue rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition"
            aria-label="New behavioral rule"
          />
          <button
            type="submit"
            disabled={!newRule.trim() || isAdding}
            className="flex items-center space-x-1 px-3 py-2 rounded-lg bg-paypal-blue hover:bg-blue-600 text-white font-semibold text-xs transition active:scale-95 disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Save Rule</span>
          </button>
        </form>
      </div>

      {/* Active Memories */}
      <div className="space-y-2.5">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
          Active Persistent Memories ({memories.length})
        </span>

        <div className="grid grid-cols-1 gap-2.5">
          {memories.map((m) => (
            <div
              key={m.id}
              className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 shadow-2xs"
            >
              <div className="flex items-start space-x-2.5">
                <div className="w-6 h-6 rounded-md bg-sky-100 dark:bg-paypal-blue/20 text-paypal-blue dark:text-sky-300 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-3 h-3" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-relaxed">&ldquo;{m.value}&rdquo;</p>
                  <div className="flex items-center space-x-2 mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                    <span className="uppercase font-semibold tracking-wider text-paypal-blue dark:text-sky-400">
                      {m.category}
                    </span>
                    <span>&bull;</span>
                    <span>Learned: {new Date(m.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <span className="text-[9px] font-semibold px-2 py-0.2 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 shrink-0">
                Active
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
