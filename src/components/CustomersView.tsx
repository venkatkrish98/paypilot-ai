"use client";

import React, { useState, useEffect } from "react";
import { Mail, ShieldCheck, User } from "lucide-react";
import { Customer } from "@/packages/types";

export const CustomersView: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/customers");
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      if (data.customers) {
        setCustomers(data.customers);
      }
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Error fetching customer profiles");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Customer Ledger &amp; Profiles</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Recipients, transaction histories, and risk profiles maintained for payment orchestration
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 rounded-lg text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="p-8 text-center text-xs text-slate-500">Loading customer profiles...</div>
      ) : customers.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          No customer profiles on record.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {customers.map((c) => (
            <div
              key={c.id}
              className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3 hover:border-slate-300 dark:hover:border-slate-700 transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-slate-800 dark:text-white text-xs">
                    {c.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm leading-tight">{c.name}</h4>
                    <div className="flex items-center space-x-1 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      <Mail className="w-3 h-3" />
                      <span>{c.email}</span>
                    </div>
                  </div>
                </div>

                {c.isNewRecipient ? (
                  <span className="text-[10px] font-bold px-2 py-0.2 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300">
                    New Recipient
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.2 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 flex items-center space-x-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Verified</span>
                  </span>
                )}
              </div>

              {/* Balances */}
              <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Outstanding Due</span>
                  <span className="font-bold text-slate-900 dark:text-white text-xs">
                    ${c.outstandingAmount.toLocaleString()} USD
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Last Payment</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 text-xs">
                    {c.lastPaymentAmount ? `$${c.lastPaymentAmount.toLocaleString()} (${c.lastPaymentDate})` : "None"}
                  </span>
                </div>
              </div>

              {/* Memory Notes */}
              <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800/60">
                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">
                  Agent Memory Notes
                </span>
                <p className="line-clamp-2 text-[11px]">{c.notes}</p>
              </div>

              {/* Payment History */}
              <div className="space-y-1 pt-0.5">
                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                  Transaction History ({c.paymentHistory.length})
                </span>
                {c.paymentHistory.length === 0 ? (
                  <span className="text-[11px] text-slate-400 italic">No past transactions recorded yet.</span>
                ) : (
                  <div className="space-y-1">
                    {c.paymentHistory.map((h) => (
                      <div
                        key={h.id}
                        className="flex items-center justify-between text-xs py-1 px-2 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/60"
                      >
                        <span className="text-slate-700 dark:text-slate-300 text-[11px] truncate max-w-[200px]">{h.purpose}</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs">${h.amount}</span>
                          <span className="text-[10px] text-slate-400">{h.date}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
