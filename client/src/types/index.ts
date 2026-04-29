export interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'sales_rep';
  created_at?: string;
}

export interface Lead {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  status: 'new' | 'contacted' | 'qualified' | 'unqualified';
  priority: 'low' | 'medium' | 'high';
  source?: string;
  assigned_to?: number;
  assigned_name?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  industry?: string;
  website?: string;
  address?: string;
  assigned_to?: number;
  assigned_name?: string;
  notes?: string;
  total_value: number;
  created_at: string;
  updated_at: string;
}

export interface Deal {
  id: number;
  title: string;
  client_id?: number;
  client_name?: string;
  value: number;
  stage: 'prospecting' | 'qualification' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';
  probability: number;
  expected_close?: string;
  assigned_to?: number;
  assigned_name?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: number;
  title: string;
  description?: string;
  due_date?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed';
  assigned_to?: number;
  assigned_name?: string;
  related_to_type?: 'lead' | 'client' | 'deal';
  related_to_id?: number;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: number;
  type: 'email' | 'call' | 'meeting' | 'note';
  description: string;
  user_id?: number;
  user_name?: string;
  related_to_type?: string;
  related_to_id?: number;
  created_at: string;
}

export interface EmailLog {
  id: number;
  to_email: string;
  subject: string;
  body: string;
  status: 'sent' | 'failed';
  user_id?: number;
  sent_by?: string;
  created_at: string;
}

export interface AnalyticsSummary {
  kpis: {
    totalLeads: number;
    qualifiedLeads: number;
    totalClients: number;
    totalRevenue: number;
    openDeals: number;
    openDealsValue: number;
    pendingTasks: number;
    todayTasks: number;
  };
  dealsByStage: { stage: string; count: number; total: number }[];
  leadsBySource: { source: string; count: number }[];
  leadsByStatus: { status: string; count: number }[];
  revenueByMonth: { month: string; revenue: number }[];
  recentActivities: Activity[];
  taskCompletion: { completed: number; total: number };
}
