/**
 * GCC360 CRM — API Client
 * All communication with the backend goes through this file.
 */

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

let _token: string | null = null

export const setToken  = (t: string) => { _token = t }
export const clearToken = ()         => { _token = null }
export const getToken   = ()         => _token

// Core fetch wrapper with auto token-refresh
async function req<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  try {
    const res = await fetch(BASE + path, {
      ...opts,
      signal: controller.signal,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(_token ? { Authorization: `Bearer ${_token}` } : {}),
        ...(opts.headers ?? {}),
      },
    })

    clearTimeout(timeoutId)

    // Token expired — silently refresh and retry once
    if (res.status === 401 && path !== '/api/auth/login') {
      const r = await fetch(BASE + '/api/auth/refresh', { method: 'POST', credentials: 'include' })
      if (r.ok) {
        const { accessToken } = await r.json()
        setToken(accessToken)
        return req(path, opts)
      }
      clearToken()
      window.location.href = '/'
      throw new Error('Session expired')
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(err.error || 'Something went wrong')
    }

    return res.json()
  } catch (err: any) {
    clearTimeout(timeoutId)
    if (err.name === 'AbortError') throw new Error('Request timed out after 30s')
    throw err
  }
}

// ── Auth ───────────────────────────────────────────────────────────────────────
export const authApi = {
  bootstrapStatus: () => req<{ needsBootstrap: boolean; publicSignupEnabled: boolean }>('/api/auth/bootstrap-status'),
  companyCheck: (companyName: string) => req<{ exists: boolean; matches: Array<{ id: string; name: string }> }>(
    `/api/auth/company-check?companyName=${encodeURIComponent(companyName)}`
  ),
  login:  (email: string, password: string) =>
    req<{ accessToken: string; user: any }>('/api/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password })
    }),
  faceLogin: (descriptor: Float32Array | number[]) =>
    req<{ accessToken: string; user: any }>('/api/auth/face-login', {
      method: 'POST', body: JSON.stringify({ descriptor: Array.from(descriptor) })
    }),
  signup: (data: { name: string; email: string; password: string; companyName: string; country?: string; industry?: string }) =>
    req<{ accessToken: string; user: any }>('/api/auth/signup', {
      method: 'POST', body: JSON.stringify(data)
    }),
  logout: () => req('/api/auth/logout', { method: 'POST' }),
  changePasswordFirstLogin: (data: any) => 
    req('/api/auth/change-password-first-login', { method: 'POST', body: JSON.stringify(data) }),
}

// ── Profile ────────────────────────────────────────────────────────────────────
export const profileApi = {
  get:            () => req<any>('/api/profile'),
  update:         (data: { name?: string; department?: string; phone?: string; bio?: string }) =>
    req('/api/profile', { method: 'PATCH', body: JSON.stringify(data) }),
  changePassword: (currentPassword: string, newPassword: string) =>
    req('/api/profile/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
  uploadAvatar:   (file: File) => {
    const form = new FormData()
    form.append('avatar', file)
    return fetch(BASE + '/api/profile/avatar', {
      method:      'POST',
      credentials: 'include',
      headers:     _token ? { Authorization: `Bearer ${_token}` } : {},
      body:        form,
    }).then(r => r.json())
  },
  removeAvatar: () => req('/api/profile/avatar', { method: 'DELETE' }),
}

// ── Users ──────────────────────────────────────────────────────────────────────
export const usersApi = {
  list:      () => req<any[]>('/api/users'),
  invite:    (data: { name: string; email: string; role: string; department?: string }) =>
    req('/api/users/invite', { method: 'POST', body: JSON.stringify(data) }),
  setRole:   (id: string, role: string) =>
    req(`/api/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  setStatus: (id: string, status: string) =>
    req(`/api/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  delete:    (id: string) => req(`/api/users/${id}`, { method: 'DELETE' }),
  resetPassword: (id: string) => req(`/api/users/${id}/reset-password`, { method: 'POST' }),
}

// ── Imports ───────────────────────────────────────────────────────────────────
export const importsApi = {
  importCsv: (entity: 'leads' | 'clients' | 'contacts' | 'users', file: File) => {
    const form = new FormData()
    form.append('file', file)
    const send = async () => fetch(BASE + `/api/imports/${entity}`, {
      method: 'POST',
      credentials: 'include',
      headers: _token ? { Authorization: `Bearer ${_token}` } : {},
      body: form,
    })

    return send().then(async r => {
      if (r.status === 401) {
        const refreshed = await fetch(BASE + '/api/auth/refresh', { method: 'POST', credentials: 'include' })
        if (refreshed.ok) {
          const { accessToken } = await refreshed.json()
          setToken(accessToken)
          return send().then(async retry => {
            if (!retry.ok) {
              const err = await retry.json().catch(() => ({ error: 'Import failed' }))
              throw new Error(err.error || 'Import failed')
            }
            return retry.json()
          })
        }
      }

      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: 'Import failed' }))
        throw new Error(err.error || 'Import failed')
      }
      return r.json()
    })
  },
}

// ── Leads ──────────────────────────────────────────────────────────────────────
export const leadsApi = {
  list:    () => req<any[]>('/api/leads'),
  get:     (id: string) => req<any>(`/api/leads/${id}`),
  create:  (data: any) => req('/api/leads', { method: 'POST', body: JSON.stringify(data) }),
  update:  (id: string, data: any) => req(`/api/leads/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete:  (id: string) => req(`/api/leads/${id}`, { method: 'DELETE' }),
  bulkDelete: (ids: string[]) => req('/api/leads/bulk', { method: 'DELETE', body: JSON.stringify({ ids }) }),
  qualify: (id: string) => req(`/api/leads/${id}/qualify`, { method: 'POST' }),
  approve: (id: string) => req(`/api/leads/${id}/approve`, { method: 'POST' }),
  reject:  (id: string) => req(`/api/leads/${id}/reject`,  { method: 'POST' }),
}

// ── Opportunities ──────────────────────────────────────────────────────────────
export const oppsApi = {
  list:          () => req<any[]>('/api/opportunities'),
  create:        (data: any) => req('/api/opportunities', { method: 'POST', body: JSON.stringify(data) }),
  update:        (id: string, data: any) => req(`/api/opportunities/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete:        (id: string) => req(`/api/opportunities/${id}`, { method: 'DELETE' }),
  bulkDelete:    (ids: string[]) => req('/api/opportunities/bulk', { method: 'DELETE', body: JSON.stringify({ ids }) }),
  generateQuote: (id: string) => req<any[]>(`/api/opportunities/${id}/generate-quote`, { method: 'POST' }),
  markWon:       (id: string) => req(`/api/opportunities/${id}/won`,  { method: 'POST' }),
  markLost:      (id: string) => req(`/api/opportunities/${id}/lost`, { method: 'POST' }),
}

// ── Clients ────────────────────────────────────────────────────────────────────
export const clientsApi = {
  list:   () => req<any[]>('/api/clients'),
  create: (data: any) => req('/api/clients', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => req(`/api/clients/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => req(`/api/clients/${id}`, { method: 'DELETE' }),
  bulkDelete: (ids: string[]) => req('/api/clients/bulk', { method: 'DELETE', body: JSON.stringify({ ids }) }),
}

// ── Contacts ───────────────────────────────────────────────────────────────────
export const contactsApi = {
  list:   () => req<any[]>('/api/contacts'),
  create: (data: any) => req('/api/contacts', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => req(`/api/contacts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => req(`/api/contacts/${id}`, { method: 'DELETE' }),
  bulkDelete: (ids: string[]) => req('/api/contacts/bulk', { method: 'DELETE', body: JSON.stringify({ ids }) }),
}

// ── Deals ──────────────────────────────────────────────────────────────────────
export const dealsApi = {
  list:   () => req<any[]>('/api/deals'),
  create: (data: any) => req('/api/deals', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => req(`/api/deals/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => req(`/api/deals/${id}`, { method: 'DELETE' }),
  bulkDelete: (ids: string[]) => req('/api/deals/bulk', { method: 'DELETE', body: JSON.stringify({ ids }) }),
}

// ── Tasks ──────────────────────────────────────────────────────────────────────
export const tasksApi = {
  list:   () => req<any[]>('/api/tasks'),
  create: (data: any) => req('/api/tasks', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => req(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => req(`/api/tasks/${id}`, { method: 'DELETE' }),
  bulkDelete: (ids: string[]) => req('/api/tasks/bulk', { method: 'DELETE', body: JSON.stringify({ ids }) }),
}

// ── Activities ─────────────────────────────────────────────────────────────────
export const activitiesApi = {
  list:   () => req<any[]>('/api/activities'),
  create: (data: any) => req('/api/activities', { method: 'POST', body: JSON.stringify(data) }),
}

// ── Invoices ───────────────────────────────────────────────────────────────────
export const invoicesApi = {
  list:         () => req<any[]>('/api/invoices'),
  create:       (data: any) => req('/api/invoices', { method: 'POST', body: JSON.stringify(data) }),
  updateStatus: (id: string, status: string) =>
    req(`/api/invoices/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  delete: (id: string) => req(`/api/invoices/${id}`, { method: 'DELETE' }),
  bulkDelete: (ids: string[]) => req('/api/invoices/bulk', { method: 'DELETE', body: JSON.stringify({ ids }) }),
}

// ── Analytics ──────────────────────────────────────────────────────────────────
export const analyticsApi = {
  dashboard: () => req<any>('/api/analytics/dashboard'),
  pipeline:  () => req<any[]>('/api/analytics/pipeline'),
  revenue:   () => req<any[]>('/api/analytics/revenue'),
  leads:     () => req<any>('/api/analytics/leads'),
  team:      () => req<any[]>('/api/analytics/team'),
}

// ── Email Scanner ──────────────────────────────────────────────────────────────
export const emailApi = {
  scan:         () => req('/api/email/scan', { method: 'POST' }),
  logs:         () => req<any[]>('/api/email/logs'),
  pendingLeads: () => req<any[]>('/api/email/pending-leads'),
  send:         (to: string, subject: string, body: string) => req('/api/email/send', { method: 'POST', body: JSON.stringify({ to, subject, body }) }),
}

export const emailImportApi = {
  setup: (data: { email: string; password: string; imapHost: string; imapPort: number }) =>
    req<any>('/api/email-import/setup', { method: 'POST', body: JSON.stringify(data) }),
  sync: (autoCreateLeads = true) =>
    req<any>('/api/email-import/sync', { method: 'POST', body: JSON.stringify({ autoCreateLeads }) }),
  logs: (limit = 20, offset = 0) =>
    req<any>(`/api/email-import/logs?limit=${limit}&offset=${offset}`),
}

export const voiceApi = {
  initiateCall: (leadId: string, provider: 'VAPI' | 'TWILIO' = 'VAPI') =>
    req<any>('/api/voice/initiate-call', { method: 'POST', body: JSON.stringify({ leadId, provider }) }),
  callLogs: (limit = 20, offset = 0) =>
    req<any>(`/api/voice/call-logs?limit=${limit}&offset=${offset}`),
}
// ── Notifications ──────────────────────────────────────────────────────────────
export const notificationsApi = {
  list:        () => req<any[]>('/api/notifications'),
  unreadCount: () => req<{ count: number }>('/api/notifications/unread-count'),
  markRead:    (id: string) => req(`/api/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () => req('/api/notifications/read-all', { method: 'PATCH' }),
  delete:      (id: string) => req(`/api/notifications/${id}`, { method: 'DELETE' }),
  deleteAll:   () => req('/api/notifications', { method: 'DELETE' }),
}

// ── Biometric ────────────────────────────────────────────────────────────────
export const biometricApi = {
  enroll: (userId: string, faceDescriptor: number[] | Float32Array, confidence: number) =>
    req('/api/biometric/enroll', {
      method: 'POST',
      body: JSON.stringify({ userId, faceDescriptor: Array.from(faceDescriptor), confidence })
    }),
  status: (userId: string) =>
    req<any>(`/api/biometric/status/${userId}`),
  disable: () =>
    req('/api/biometric/disable', { method: 'DELETE' }),
  authenticate: (userId: string, faceDescriptor: number[] | Float32Array) =>
    req<any>('/api/biometric/authenticate', {
      method: 'POST',
      body: JSON.stringify({ userId, faceDescriptor: Array.from(faceDescriptor) })
    }),
  verify: (userId: string, faceDescriptor: number[] | Float32Array) =>
    req<any>('/api/biometric/verify', {
      method: 'POST',
      body: JSON.stringify({ userId, faceDescriptor: Array.from(faceDescriptor) })
    }),
}

// ── AI ─────────────────────────────────────────────────────────────────────────
export const aiApi = {
  extractFile: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return fetch(BASE + '/api/ai/extract-file', {
      method: 'POST',
      credentials: 'include',
      headers: _token ? { Authorization: `Bearer ${_token}` } : {},
      body: form
    }).then(async r => {
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: 'Upload failed' }))
        throw new Error(err.error || 'Upload failed')
      }
      return r.json()
    })
  },
  draftEmail: (recordId: string, recordType: string, purpose?: string) => 
    req<any>('/api/ai/draft-email', { method: 'POST', body: JSON.stringify({ recordId, recordType, purpose }) }),
  generateCallScript: (recordId: string, recordType: string) => 
    req<any>('/api/ai/call-script', { method: 'POST', body: JSON.stringify({ recordId, recordType }) }),
  dashboardSummary: () => req<any>('/api/ai/agent/dashboard-summary'),
  adminInsights: () => req<any>('/api/ai/agent/admin-insights'),
  chatGuide: (message: string, history: Array<{ role: 'user' | 'assistant'; content: string }>, language = 'en') =>
    req<any>('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message, history, language }),
    }),
  exportDashboardSummaryPdf: async () => {
    const response = await fetch(BASE + '/api/ai/agent/dashboard-summary/pdf', {
      method: 'GET',
      credentials: 'include',
      headers: _token ? { Authorization: `Bearer ${_token}` } : {},
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Failed to export summary' }))
      throw new Error(err.error || 'Failed to export summary')
    }

    return response.blob()
  },
}

// ── Integrations ──────────────────────────────────────────────────────────────
export const integrationApi = {
  biometricEnrollmentCheck: (userId: string) =>
    req<any>(`/api/biometric/enrollment-check/${userId}`),

  aiLeadExtract: (documentText: string, companyContext?: string) =>
    req<any>('/api/ai-lead-ingestion/extract-lead-data', {
      method: 'POST',
      body: JSON.stringify({ documentText, companyContext }),
    }),

  emailImportLogs: (limit = 10, offset = 0) =>
    req<any>(`/api/email-import/logs?limit=${limit}&offset=${offset}`),

  voiceCallLogs: (limit = 10, offset = 0) =>
    req<any>(`/api/voice/call-logs?limit=${limit}&offset=${offset}`),

  generatedReports: (limit = 10, offset = 0) =>
    req<any>(`/api/reporting/generated-reports?limit=${limit}&offset=${offset}`),

  socialStats: () =>
    req<any>('/api/social/stats'),
}
