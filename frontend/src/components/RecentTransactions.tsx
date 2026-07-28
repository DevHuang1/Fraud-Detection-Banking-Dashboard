"use client";

const transactions = [
  { id: "TXN-8294", card: "**** 4829", amount: "$12,450.00", merchant: "CryptoExchange.io", time: "2 min ago", risk: "critical", status: "Blocked" },
  { id: "TXN-8293", card: "**** 1736", amount: "$340.00", merchant: "Amazon.com", time: "15 min ago", risk: "low", status: "Approved" },
  { id: "TXN-8292", card: "**** 6591", amount: "$8,920.00", merchant: "Western Union", time: "28 min ago", risk: "high", status: "Flagged" },
  { id: "TXN-8291", card: "**** 3347", amount: "$2,150.00", merchant: "Target.com", time: "1 hour ago", risk: "medium", status: "Review" },
  { id: "TXN-8290", card: "**** 8872", amount: "$67.50", merchant: "Starbucks", time: "2 hours ago", risk: "low", status: "Approved" },
  { id: "TXN-8289", card: "**** 4412", amount: "$15,800.00", merchant: "HSBC Intl Transfer", time: "3 hours ago", risk: "critical", status: "Blocked" },
  { id: "TXN-8288", card: "**** 2239", amount: "$523.00", merchant: "Netflix.com", time: "4 hours ago", risk: "low", status: "Approved" },
];

const riskColors = {
  critical: { bg: "rgba(239,68,68,0.15)", text: "#ef4444", dot: "#ef4444" },
  high: { bg: "rgba(245,158,11,0.15)", text: "#f59e0b", dot: "#f59e0b" },
  medium: { bg: "rgba(59,130,246,0.15)", text: "#3b82f6", dot: "#3b82f6" },
  low: { bg: "rgba(34,197,94,0.15)", text: "#22c55e", dot: "#22c55e" },
};

const statusColors: Record<string, string> = {
  Blocked: "rgba(239,68,68,0.15) text-[#ef4444]",
  Flagged: "rgba(245,158,11,0.15) text-[#f59e0b]",
  Review: "rgba(59,130,246,0.15) text-[#3b82f6]",
  Approved: "rgba(34,197,94,0.15) text-[#22c55e]",
};

export default function RecentTransactions() {
  return (
    <div className="glass-card rounded-2xl p-6 animate-slide-up delay-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold text-white">Recent Transactions</h3>
          <p className="text-xs text-[#64748b] mt-0.5">Latest flagged activity requiring attention</p>
        </div>
        <button className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium">
          View All
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[#64748b] text-xs uppercase tracking-wider border-b border-[#1e293b]">
              <th className="text-left font-medium pb-3 pr-4">ID</th>
              <th className="text-left font-medium pb-3 pr-4">Card</th>
              <th className="text-left font-medium pb-3 pr-4">Amount</th>
              <th className="text-left font-medium pb-3 pr-4">Merchant</th>
              <th className="text-left font-medium pb-3 pr-4">Risk</th>
              <th className="text-left font-medium pb-3 pr-4">Status</th>
              <th className="text-right font-medium pb-3 pr-4">Time</th>
              <th className="text-right font-medium pb-3" />
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => {
              const rc = riskColors[tx.risk as keyof typeof riskColors];
              return (
                <tr key={tx.id} className="border-b border-[#1e293b]/50 hover:bg-white/[0.02] transition-colors group">
                  <td className="py-3.5 pr-4">
                    <span className="font-mono text-xs text-[#94a3b8]">{tx.id}</span>
                  </td>
                  <td className="py-3.5 pr-4">
                    <span className="text-white text-xs font-mono">{tx.card}</span>
                  </td>
                  <td className="py-3.5 pr-4">
                    <span className="text-white font-medium">{tx.amount}</span>
                  </td>
                  <td className="py-3.5 pr-4">
                    <span className="text-[#94a3b8] text-xs">{tx.merchant}</span>
                  </td>
                  <td className="py-3.5 pr-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: rc.bg, color: rc.text }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: rc.dot }} />
                      {tx.risk.charAt(0).toUpperCase() + tx.risk.slice(1)}
                    </span>
                  </td>
                  <td className="py-3.5 pr-4">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[tx.status]}`}>
                      {tx.status}
                    </span>
                  </td>
                  <td className="py-3.5 text-right pr-4">
                    <span className="text-[#64748b] text-xs">{tx.time}</span>
                  </td>
                  <td className="py-3.5 text-right">
                    <button className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-lg bg-[#1e293b] border border-[#334155] flex items-center justify-center hover:border-blue-500/30">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
