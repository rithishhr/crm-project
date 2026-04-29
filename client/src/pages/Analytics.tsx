import React, { useEffect, useState } from 'react';
import { analyticsApi } from '../api';
import { AnalyticsSummary } from '../types';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Loader2 } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function Analytics() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsApi.getSummary()
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  const taskCompletionData = data ? [
    { name: 'Completed', value: data.taskCompletion.completed },
    { name: 'Pending', value: data.taskCompletion.total - data.taskCompletion.completed },
  ] : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Analytics</h1>
        <p className="text-slate-500 text-sm">Business performance insights</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Leads', value: data?.kpis.totalLeads ?? 0, color: 'text-blue-600' },
          { label: 'Clients', value: data?.kpis.totalClients ?? 0, color: 'text-green-600' },
          { label: 'Revenue', value: `$${(data?.kpis.totalRevenue ?? 0).toLocaleString()}`, color: 'text-teal-600' },
          { label: 'Pipeline Value', value: `$${(data?.kpis.openDealsValue ?? 0).toLocaleString()}`, color: 'text-purple-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card p-4 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-slate-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Month */}
        <div className="card p-6">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Revenue Trend (Last 6 Months)</h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data?.revenueByMonth ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, 'Revenue']} />
              <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Leads by Source */}
        <div className="card p-6">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Leads by Source</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data?.leadsBySource ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="source" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Deals by Stage */}
        <div className="card p-6">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Deal Pipeline by Stage</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data?.dealsByStage ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="stage" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number, name: string) => name === 'total' ? [`$${v.toLocaleString()}`, 'Value'] : [v, 'Count']} />
              <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Count" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Task Completion */}
        <div className="card p-6">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Task Completion Rate</h2>
          <div className="flex items-center gap-8">
            <ResponsiveContainer width="50%" height={250}>
              <PieChart>
                <Pie data={taskCompletionData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                  {taskCompletionData.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? '#10b981' : '#e2e8f0'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1">
              <div className="space-y-3">
                {taskCompletionData.map((entry, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0`} style={{ backgroundColor: i === 0 ? '#10b981' : '#e2e8f0' }}></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{entry.name}</p>
                      <p className="text-xs text-slate-400">{entry.value} tasks</p>
                    </div>
                  </div>
                ))}
                {data?.taskCompletion?.total != null && data.taskCompletion.total > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-600">
                    <p className="text-2xl font-bold text-green-600">
                      {Math.round((data.taskCompletion.completed / data.taskCompletion.total) * 100)}%
                    </p>
                    <p className="text-xs text-slate-500">Completion rate</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lead Status breakdown */}
      <div className="card p-6">
        <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Lead Status Distribution</h2>
        <div className="flex flex-wrap gap-4">
          {(data?.leadsByStatus ?? []).map((item: any, i) => (
            <div key={item.status} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700 px-4 py-3 rounded-xl">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
              <div>
                <p className="text-sm font-medium capitalize text-slate-700 dark:text-slate-200">{item.status}</p>
                <p className="text-lg font-bold" style={{ color: COLORS[i % COLORS.length] }}>{item.count}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
