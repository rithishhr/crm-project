import React, { useEffect, useState } from 'react';
import { Users, UserCheck, TrendingUp, CheckSquare, DollarSign, Activity, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import StatCard from '../components/StatCard';
import { analyticsApi } from '../api';
import { AnalyticsSummary, Activity as ActivityType } from '../types';

const activityIcons: Record<string, string> = {
  email: '📧', call: '📞', meeting: '🤝', note: '📝',
};

export default function Dashboard() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsApi.getSummary()
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  const kpis = data?.kpis;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Your CRM overview at a glance</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Leads" value={kpis?.totalLeads ?? 0} icon={<Users className="w-5 h-5" />} color="blue" trend={12} trendLabel="vs last month" />
        <StatCard title="Active Clients" value={kpis?.totalClients ?? 0} icon={<UserCheck className="w-5 h-5" />} color="green" trend={5} />
        <StatCard title="Open Deals" value={kpis?.openDeals ?? 0} icon={<TrendingUp className="w-5 h-5" />} color="purple" trend={8} />
        <StatCard title="Tasks Due Today" value={kpis?.todayTasks ?? 0} icon={<CheckSquare className="w-5 h-5" />} color="orange" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Total Revenue" value={`$${(kpis?.totalRevenue ?? 0).toLocaleString()}`} icon={<DollarSign className="w-5 h-5" />} color="teal" trend={18} />
        <StatCard title="Pipeline Value" value={`$${(kpis?.openDealsValue ?? 0).toLocaleString()}`} icon={<TrendingUp className="w-5 h-5" />} color="blue" />
        <StatCard title="Qualified Leads" value={kpis?.qualifiedLeads ?? 0} icon={<Users className="w-5 h-5" />} color="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activities */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-500" /> Recent Activities
            </h2>
          </div>
          <div className="space-y-3">
            {(data?.recentActivities ?? []).slice(0, 6).map((activity: ActivityType) => (
              <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                <span className="text-lg">{activityIcons[activity.type] ?? '📌'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 dark:text-slate-200 truncate">{activity.description}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{activity.user_name} · {new Date(activity.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card p-6">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Add Lead', path: '/leads', color: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
              { label: 'Add Client', path: '/clients', color: 'bg-green-50 text-green-700 hover:bg-green-100' },
              { label: 'New Deal', path: '/pipeline', color: 'bg-purple-50 text-purple-700 hover:bg-purple-100' },
              { label: 'Create Task', path: '/tasks', color: 'bg-orange-50 text-orange-700 hover:bg-orange-100' },
              { label: 'Send Email', path: '/email', color: 'bg-teal-50 text-teal-700 hover:bg-teal-100' },
              { label: 'View Analytics', path: '/analytics', color: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' },
            ].map(({ label, path, color }) => (
              <Link key={path} to={path} className={`flex items-center justify-between p-4 rounded-xl font-medium text-sm transition-colors ${color}`}>
                {label}
                <ArrowRight className="w-4 h-4" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Deal stages */}
      <div className="card p-6">
        <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Pipeline by Stage</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {(data?.dealsByStage ?? []).map((stage: any) => (
            <div key={stage.stage} className="text-center p-3 bg-slate-50 dark:bg-slate-700 rounded-xl">
              <p className="text-xl font-bold text-slate-900 dark:text-white">{stage.count}</p>
              <p className="text-xs text-slate-500 capitalize mt-0.5">{stage.stage.replace('_', ' ')}</p>
              <p className="text-xs text-blue-600 font-medium mt-1">${Number(stage.total).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
