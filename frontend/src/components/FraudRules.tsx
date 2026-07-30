"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface Rule {
  id: number;
  name: string;
  description: string;
  rule_type: string;
  is_active: boolean;
  hit_count: number;
  severity: string;
}

export default function FraudRules() {
  const [rules, setRules] = useState<Rule[]>([]);

  const loadRules = useCallback(async () => {
    const data = await supabase.getRules();
    setRules(data as Rule[]);
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);
  return (
    <div className="glass-card rounded-2xl p-6 animate-slide-up delay-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold text-white">Fraud Detection Rules</h3>
          <p className="text-xs text-[#64748b] mt-0.5">Active monitoring rules and triggers</p>
        </div>
        <button className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium">
          Manage
        </button>
      </div>

      <div className="space-y-3">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="flex items-center justify-between p-3.5 rounded-xl bg-[#111827] border border-[#1e293b] hover:border-blue-500/20 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div
                className={`w-2 h-2 rounded-full shrink-0 ${rule.is_active ? "bg-[#22c55e]" : "bg-[#64748b]"}`}
              />
              <div>
                <span className="block text-sm font-medium text-white">{rule.name}</span>
                <span className="text-xs text-[#64748b]">{rule.description}</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="block text-sm font-semibold text-white">{rule.hit_count}</span>
                <span className="text-xs text-[#64748b]">triggers</span>
              </div>
              <div className="w-16 h-6 rounded-full bg-[#1e293b] relative overflow-hidden">
                <div
                  className="absolute inset-0 rounded-full transition-all bg-[#3b82f6]"
                  style={{ width: `${Math.min(rule.hit_count * 2, 100)}%`, opacity: 0.3 }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
