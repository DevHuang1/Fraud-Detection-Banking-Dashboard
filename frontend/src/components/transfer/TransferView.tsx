"use client";

import { useState, useEffect, useCallback } from "react";
import { Icons } from "@/components/ui/Icons";
import { supabase, type Account, type Transfer } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

function CurrencyRates() {
  const [rates, setRates] = useState<{ pair: string; rate: string }[]>([]);

  const loadRates = useCallback(async () => {
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/USD");
      const data = await res.json();
      if (data.rates) {
        setRates([
          { pair: "USD/EUR", rate: data.rates.EUR?.toFixed(4) || "—" },
          { pair: "USD/GBP", rate: data.rates.GBP?.toFixed(4) || "—" },
          { pair: "USD/BTC", rate: (1 / (data.rates.BTC || 30000)).toFixed(8) },
        ]);
      }
    } catch {
      setRates([
        { pair: "USD/EUR", rate: "0.92" },
        { pair: "USD/GBP", rate: "0.79" },
        { pair: "USD/BTC", rate: "0.000034" },
      ]);
    }
  }, []);

  useEffect(() => {
    loadRates();
  }, [loadRates]);

  return (
    <div className="glass-neon rounded-2xl p-5">
      <h3 className="text-xs font-semibold text-white mb-3">Currency Exchange</h3>
      <div className="space-y-2">
        {rates.map((c) => (
          <div key={c.pair} className="flex items-center justify-between p-2.5 rounded-lg bg-[#1e293b]/50">
            <span className="text-xs font-mono text-[#94a3b8]">{c.pair}</span>
            <span className="text-xs font-mono text-white font-medium">{c.rate}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TransferView() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<"send" | "receive" | "history">("send");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [verifiedRecipient, setVerifiedRecipient] = useState<{ id: number; name: string; number: string; email: string } | null>(null);

  const loadData = async () => {
    if (!user?.id) return;
    const accs = await supabase.getAccounts(user.id);
    setAccounts(accs);
    if (accs.length > 0) {
      const txns = await supabase.getTransfers(accs.map((a) => a.id));
      setTransfers(txns);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [user?.id]);

  const mainAccount = accounts[0];
  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);
  const accountIds = accounts.map((a) => a.id);

  const handleLookupRecipient = async () => {
    setError("");
    setSuccess("");
    setVerifiedRecipient(null);
    if (!recipient.trim()) {
      setError("Enter an account number or email");
      return;
    }
    if (!mainAccount) {
      setError("No account available");
      return;
    }
    const result = await supabase.lookupRecipient(recipient.trim());
    if (!result) {
      setError("Recipient not found. Try their account number or email.");
      return;
    }
    if (result.id === mainAccount.id) {
      setError("Cannot transfer to your own account");
      return;
    }
    setVerifiedRecipient({ id: result.id, name: result.account_name, number: result.account_number, email: result.email });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!verifiedRecipient || !amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }
    if (!mainAccount) {
      setError("No account available");
      return;
    }
    if (parseFloat(amount) > Number(mainAccount.balance)) {
      setError("Insufficient balance");
      return;
    }

    setSubmitting(true);
    const result = await supabase.transferMoney(mainAccount.id, verifiedRecipient.id, parseFloat(amount), note);
    setSubmitting(false);

    if (result.success) {
      setSuccess(`Successfully sent $${parseFloat(amount).toLocaleString()} to ${verifiedRecipient.name}`);
      setAmount("");
      setNote("");
      setVerifiedRecipient(null);
      setRecipient("");
      await loadData();
    } else {
      setError(result.error || "Transfer failed");
    }
  };

  if (loading) {
    return (
      <div className="animate-fade-in space-y-5">
        <div className="glass-neon rounded-2xl p-6">
          <div className="h-8 w-48 bg-[#1e293b] rounded animate-pulse mb-3" />
          <div className="h-12 w-64 bg-[#1e293b] rounded animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white">Banking</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#22ff8b]/10 text-[#22ff8b] border border-[#22ff8b]/20">LIVE</span>
          </div>
          <p className="text-sm text-[#64748b] mt-0.5">Send and receive money securely</p>
        </div>
      </div>

      <div className="glass-neon rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#00f0ff]/5 to-[#8b5cf6]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="relative z-10">
          <p className="text-[11px] font-semibold text-[#64748b] uppercase tracking-widest">
            {mainAccount?.account_name || "Available Balance"}
          </p>
          <div className="flex items-baseline gap-3 mt-1">
            <span className="text-4xl font-bold text-white tabular-nums">${totalBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
            <span className="text-sm text-[#00f0ff] font-mono">USD</span>
          </div>
          <div className="flex items-center gap-4 mt-4">
            <button
              onClick={() => setTab("send")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                tab === "send" ? "bg-gradient-to-r from-[#3b82f6] to-[#00f0ff] text-white shadow-lg" : "bg-[#1e293b] text-[#94a3b8] hover:text-white border border-[#334155]"
              }`}
            >
              <Icons.send size={14} /> Send
            </button>
            <button
              onClick={() => setTab("receive")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                tab === "receive" ? "bg-gradient-to-r from-[#8b5cf6] to-[#ec4899] text-white shadow-lg" : "bg-[#1e293b] text-[#94a3b8] hover:text-white border border-[#334155]"
              }`}
            >
              <Icons.receive size={14} /> Receive
            </button>
            <button
              onClick={() => setTab("history")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                tab === "history" ? "bg-gradient-to-r from-[#f59e0b] to-[#ef4444] text-white shadow-lg" : "bg-[#1e293b] text-[#94a3b8] hover:text-white border border-[#334155]"
              }`}
            >
              <Icons.clock size={14} /> History
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3">
          {tab === "send" && (
            <div className="glass-neon rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-white mb-1">Send Money</h3>
              <p className="text-xs text-[#64748b] mb-5">
                Balance: <span className="text-white font-medium">${Number(mainAccount?.balance || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </p>

              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center mb-4">{error}</div>
              )}
              {success && (
                <div className="p-3 rounded-xl bg-[#22ff8b]/10 border border-[#22ff8b]/20 text-[#22ff8b] text-sm text-center mb-4">{success}</div>
              )}

              <form onSubmit={verifiedRecipient ? handleSend : (e) => { e.preventDefault(); handleLookupRecipient(); }} className="space-y-4">
                {!verifiedRecipient ? (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">Recipient (Account # or Email)</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748b]"><Icons.users size={14} /></span>
                        <input
                          type="text"
                          value={recipient}
                          onChange={(e) => setRecipient(e.target.value)}
                          className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#1e293b] border border-[#334155] text-white text-sm outline-none focus:border-[#00f0ff]/30 transition-all placeholder:text-[#64748b]"
                          placeholder="Account number or email"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full h-12 rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#00f0ff] text-white text-sm font-semibold shadow-lg hover:shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
                    >
                      <Icons.search size={16} /> Find Recipient
                    </button>
                  </>
                ) : (
                  <>
                    <div className="p-4 rounded-xl bg-[#1e293b] border border-[#00f0ff]/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[#64748b] uppercase tracking-widest font-semibold">Recipient Verified</span>
                        <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-[#22ff8b]/10 text-[#22ff8b] border border-[#22ff8b]/20">CONFIRMED</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="block text-[10px] text-[#64748b]">Name</span>
                          <span className="block text-white font-medium">{verifiedRecipient.name}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-[#64748b]">Account</span>
                          <span className="block font-mono text-white">{verifiedRecipient.number}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="block text-[10px] text-[#64748b]">Email</span>
                          <span className="block text-white">{verifiedRecipient.email}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setVerifiedRecipient(null)}
                        className="text-[10px] text-[#00f0ff] hover:underline"
                      >
                        Change recipient
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">Amount</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748b] font-semibold">$</span>
                        <input
                          type="number"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="w-full h-11 pl-8 pr-4 rounded-xl bg-[#1e293b] border border-[#334155] text-white text-sm outline-none focus:border-[#00f0ff]/30 transition-all placeholder:text-[#64748b] font-mono tabular-nums"
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                        />
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        {[100, 500, 1000, 2500, 5000].map((a) => (
                          <button
                            key={a}
                            type="button"
                            onClick={() => setAmount(a.toString())}
                            className="px-3 py-1 rounded-lg text-[11px] font-mono bg-[#1e293b] border border-[#334155] text-[#94a3b8] hover:text-white hover:border-[#00f0ff]/20 transition-all"
                          >
                            ${a.toLocaleString()}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">Note (optional)</label>
                      <input
                        type="text"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="w-full h-11 px-4 rounded-xl bg-[#1e293b] border border-[#334155] text-white text-sm outline-none focus:border-[#00f0ff]/30 transition-all placeholder:text-[#64748b]"
                        placeholder="What's this for?"
                        maxLength={50}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full h-12 rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#00f0ff] text-white text-sm font-semibold shadow-lg hover:shadow-blue-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        <>
                          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" /><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" className="opacity-75" /></svg>
                          Processing...
                        </>
                      ) : (
                        <><Icons.send size={16} /> Send ${amount ? parseFloat(amount).toLocaleString() : "0.00"}</>
                      )}
                    </button>
                  </>
                )}
              </form>
            </div>
          )}

          {tab === "receive" && (
            <div className="glass-neon rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-white mb-1">Receive Money</h3>
              <p className="text-xs text-[#64748b] mb-5">Share your account details to receive funds</p>

              <div className="space-y-4">
                <div className="p-5 rounded-xl bg-[#1e293b] border border-[#334155] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#64748b] uppercase tracking-widest">Account Details</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(mainAccount?.account_number || "")}
                      className="flex items-center gap-1 text-[10px] text-[#00f0ff] hover:text-[#00f0ff]/80 transition-colors"
                    >
                      <Icons.plus size={12} className="rotate-45" /> Copy
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="block text-[10px] text-[#64748b]">Account Number</span>
                      <span className="block text-sm font-mono text-white font-medium">{mainAccount?.account_number || "N/A"}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-[#64748b]">Account Name</span>
                      <span className="block text-sm text-white font-medium">{mainAccount?.account_name || "N/A"}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-[#64748b]">Bank</span>
                      <span className="block text-sm text-white font-medium">FraudShield Banking</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-[#64748b]">Currency</span>
                      <span className="block text-sm font-mono text-white font-medium">{mainAccount?.currency || "USD"}</span>
                    </div>
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-gradient-to-br from-[#00f0ff]/5 to-[#8b5cf6]/5 border border-[#00f0ff]/10 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00f0ff] to-[#8b5cf6] mx-auto flex items-center justify-center mb-3 shadow-lg">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M12 2L2 6h20z" /><line x1="8" y1="10" x2="8" y2="14" /><line x1="16" y1="10" x2="16" y2="14" /><line x1="12" y1="10" x2="12" y2="14" /></svg>
                  </div>
                  <p className="text-xs text-[#94a3b8]">Share your account number to receive money instantly. No fees for incoming transfers.</p>
                </div>
              </div>
            </div>
          )}

          {tab === "history" && (
            <div className="glass-neon rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-sm font-semibold text-white">Transfer History</h3>
                  <p className="text-xs text-[#64748b] mt-0.5">Your recent transfers</p>
                </div>
                <button
                  onClick={loadData}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] bg-[#1e293b] border border-[#334155] text-[#94a3b8] hover:text-white transition-all"
                >
                  <Icons.refresh size={12} /> Refresh
                </button>
              </div>

              <div className="space-y-2">
                {transfers.length === 0 && (
                  <p className="text-xs text-[#64748b] text-center py-8">No transfers yet</p>
                )}
                {transfers.map((t) => {
                  const isReceived = accountIds.includes(t.receiver_account_id) && !accountIds.includes(t.sender_account_id);
                  const counterpartyName = isReceived ? t.sender_name : t.receiver_name;
                  return (
                    <div key={t.id} className="flex items-center gap-4 p-3 rounded-xl bg-[#1e293b]/50 border border-[#1e293b] hover:border-[#334155] transition-all">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isReceived ? "bg-[#22ff8b]/10 text-[#22ff8b]" : "bg-[#f59e0b]/10 text-[#f59e0b]"
                      }`}>
                        {isReceived ? <Icons.receive size={16} /> : <Icons.send size={16} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-white truncate">{counterpartyName || "Unknown"}</span>
                        <span className="block text-[11px] text-[#64748b] font-mono">
                          {new Date(t.created_at).toLocaleDateString()} · {t.note || "No note"}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className={`block text-sm font-semibold tabular-nums ${
                          isReceived ? "text-[#22ff8b]" : "text-white"
                        }`}>
                          {isReceived ? "+" : "-"}${Number(t.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </span>
                        <span className={`block text-[10px] font-medium ${
                          t.status === "completed" ? "text-[#22ff8b]" : t.status === "pending" ? "text-[#f59e0b]" : "text-[#ef4444]"
                        }`}>
                          {t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-5">
          <div className="glass-neon rounded-2xl p-5">
            <h3 className="text-xs font-semibold text-white mb-3">Your Accounts</h3>
            <div className="space-y-2">
              {accounts.map((a) => (
                <div key={a.id} className="p-3 rounded-xl bg-[#1e293b] border border-[#334155]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-white">{a.account_name}</span>
                    <span className="text-xs font-semibold text-white tabular-nums">${Number(a.balance).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <span className="text-[10px] text-[#64748b] font-mono">{a.account_number}</span>
                </div>
              ))}
            </div>
          </div>

          <CurrencyRates />
        </div>
      </div>
    </div>
  );
}
