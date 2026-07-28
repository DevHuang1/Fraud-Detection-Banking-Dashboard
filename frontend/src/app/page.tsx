import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import StatCard from "@/components/StatCard";
import ActivityChart from "@/components/ActivityChart";
import RecentTransactions from "@/components/RecentTransactions";
import FraudRules from "@/components/FraudRules";

export default function Dashboard() {
  return (
    <div className="flex min-h-screen" style={{ background: "#0a0e1a" }}>
      <Sidebar />

      <div className="flex-1 ml-64">
        <Header />

        <main className="p-8 space-y-6">
          <div className="animate-fade-in">
            <h1 className="text-xl font-bold text-white">Dashboard</h1>
            <p className="text-sm text-[#64748b] mt-1">Real-time fraud monitoring overview</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <StatCard
              title="Total Transactions"
              value="284,392"
              change="+12.5%"
              changeType="up"
              icon="activity"
              gradient="accent-gradient"
              delay={0.1}
            />
            <StatCard
              title="Fraud Detected"
              value="1,847"
              change="+23.1%"
              changeType="up"
              icon="alert"
              gradient="danger-gradient"
              delay={0.2}
            />
            <StatCard
              title="False Positives"
              value="2.3%"
              change="-4.1%"
              changeType="down"
              icon="check"
              gradient="success-gradient"
              delay={0.3}
            />
            <StatCard
              title="Active Rules"
              value="12"
              change="3 new"
              changeType="neutral"
              icon="shield"
              gradient="warning-gradient"
              delay={0.4}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2">
              <ActivityChart />
            </div>
            <div>
              <FraudRules />
            </div>
          </div>

          <RecentTransactions />
        </main>
      </div>
    </div>
  );
}
