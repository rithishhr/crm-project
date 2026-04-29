import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: number;
  trendLabel?: string;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'teal';
}

const colorMap = {
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20',
  green: 'bg-green-50 text-green-600 dark:bg-green-900/20',
  purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20',
  orange: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20',
  red: 'bg-red-50 text-red-600 dark:bg-red-900/20',
  teal: 'bg-teal-50 text-teal-600 dark:bg-teal-900/20',
};

export default function StatCard({ title, value, icon, trend, trendLabel, color = 'blue' }: StatCardProps) {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
        <div className={`p-2 rounded-lg ${colorMap[color]}`}>
          {icon}
        </div>
      </div>
      <div className="flex items-end justify-between">
        <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span>{Math.abs(trend)}%</span>
            {trendLabel && <span className="text-slate-400 ml-1">{trendLabel}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
