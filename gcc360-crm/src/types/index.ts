export type UserRole = 'admin' | 'manager' | 'sales' | 'finance' | 'analyst' | 'ADMIN' | 'MANAGER' | 'SALES' | 'FINANCE' | 'ANALYST' | 'SALESPERSON' | 'SALES_MANAGER' | 'salesperson' | 'sales_manager'
export type UserStatus = 'active' | 'inactive' | 'pending' | 'ACTIVE' | 'INACTIVE' | 'PENDING'

export interface Company {
  id: string
  name: string
  industry: string
  country: string
  plan: 'enterprise' | 'pro' | 'starter'
  logoInitial: string
}

export interface User {
  id: string
  name: string
  email: string
  password: string          // mock only — plain text
  role: UserRole
  avatar: string
  department: string
  companyId: string
  status: UserStatus
  biometricEnabled?: boolean
  isFirstLogin?: boolean
  joinedAt: string
  lastLogin?: string
}

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'disqualified'
export type DealStage = 'qualification' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost' | 'QUALIFICATION' | 'PROPOSAL' | 'NEGOTIATION' | 'CLOSED_WON' | 'CLOSED_LOST'
export type InvoiceStatus = 'pending' | 'partially_paid' | 'paid' | 'PENDING' | 'PARTIALLY_PAID' | 'PAID'
export type Priority = 'low' | 'medium' | 'high' | 'critical'

export interface Lead {
  id: string
  company: string
  contact: string
  email: string
  phone: string
  source: string
  aiCredibilityScore: number
  status: LeadStatus
  value: number
  industry: string
  country: string
  createdAt: string
  assignedTo: string
}

export interface Opportunity {
  id: string
  title: string
  company: string
  value: number
  stage: DealStage
  probability: number
  owner: string
  closeDate: string
  riskLevel: 'low' | 'medium' | 'high'
  notes: string
  leadId?: string
}

export interface Deal {
  id: string
  opportunityId: string
  title: string
  company: string
  value: number
  stage: DealStage
  closedDate: string
  owner: string
}

export interface Client {
  id: string
  name: string
  industry: string
  country: string
  tier: 'platinum' | 'gold' | 'silver'
  totalRevenue: number
  activeDeals: number
  contactPerson: string
  email: string
  phone: string
  since: string
}

export interface Contact {
  id: string
  name: string
  title: string
  company: string
  email: string
  phone: string
  lastActivity: string
  linkedOpportunities: number
}

export interface Task {
  id: string
  title: string
  assignedTo: string
  dueDate: string
  priority: Priority
  status: 'todo' | 'in_progress' | 'done'
  relatedTo: string
}

export interface Activity {
  id: string
  type: 'call' | 'email' | 'meeting' | 'note'
  description: string
  contact: string
  company: string
  createdBy: string
  date: string
}

export interface Invoice {
  id: string
  invoiceNumber: string
  client: string
  amount: number
  dueDate: string
  status: InvoiceStatus
  items: string
  createdAt: string
}

export interface AIQuote {
  type: 'primary' | 'conservative' | 'aggressive'
  label: string
  basePrice: number
  margin: number
  vat: number
  total: number
  confidence: number
  justification: string
}

export interface KPIMetric {
  label: string
  value: string
  change: number
  changeLabel: string
  trend: 'up' | 'down' | 'neutral'
}

export type Theme = 'dark' | 'light'
