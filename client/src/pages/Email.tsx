import React, { useEffect, useState } from 'react';
import { Send, Loader2, Mail, CheckCircle, XCircle } from 'lucide-react';
import { emailApi, leadsApi, clientsApi } from '../api';
import { EmailLog, Lead, Client } from '../types';

interface ComposeForm { to_email: string; subject: string; body: string; }
const emptyForm: ComposeForm = { to_email: '', subject: '', body: '' };

export default function Email() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState<ComposeForm>(emptyForm);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [logsLoading, setLogsLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
    leadsApi.getAll().then(r => setLeads(r.data)).catch(() => {});
    clientsApi.getAll().then(r => setClients(r.data)).catch(() => {});
  }, []);

  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const { data } = await emailApi.getLogs();
      setLogs(data);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError('');
    setSuccess('');
    try {
      const { data } = await emailApi.send(form);
      setSuccess(data.mock ? 'Email logged (SMTP not configured - mock mode)' : 'Email sent successfully!');
      setForm(emptyForm);
      fetchLogs();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  const quickFill = (email: string, name: string) => {
    setForm(f => ({
      ...f,
      to_email: email,
      subject: f.subject || `Following up - ${name}`,
    }));
  };

  const allContacts = [
    ...leads.filter(l => l.email).map(l => ({ email: l.email!, name: l.name, type: 'Lead' })),
    ...clients.filter(c => c.email).map(c => ({ email: c.email!, name: c.name, type: 'Client' })),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Email</h1>
        <p className="text-slate-500 text-sm">Compose and send emails to leads & clients</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Compose */}
        <div className="lg:col-span-2 card p-6">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-500" /> Compose Email
          </h2>

          {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4" />{success}</div>}
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2"><XCircle className="w-4 h-4" />{error}</div>}

          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">To *</label>
              <input type="email" value={form.to_email} onChange={e => setForm(f => ({...f, to_email: e.target.value}))} required
                placeholder="recipient@example.com"
                className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Subject *</label>
              <input type="text" value={form.subject} onChange={e => setForm(f => ({...f, subject: e.target.value}))} required
                placeholder="Email subject"
                className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Message *</label>
              <textarea value={form.body} onChange={e => setForm(f => ({...f, body: e.target.value}))} required rows={8}
                placeholder="Write your message here..."
                className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white resize-none" />
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={sending} className="btn-primary flex items-center gap-2">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? 'Sending...' : 'Send Email'}
              </button>
            </div>
          </form>
        </div>

        {/* Contacts sidebar */}
        <div className="card p-4">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-3 text-sm">Quick Select Contact</h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {allContacts.map((contact, i) => (
              <button key={i} onClick={() => quickFill(contact.email, contact.name)}
                className="w-full text-left p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{contact.name}</p>
                <p className="text-xs text-slate-500 truncate">{contact.email}</p>
                <span className={`text-xs ${contact.type === 'Lead' ? 'text-blue-500' : 'text-green-500'}`}>{contact.type}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Email Log */}
      <div className="card p-6">
        <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Email History</h2>
        {logsLoading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  {['To', 'Subject', 'Status', 'Sent By', 'Date'].map(h => (
                    <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-3 py-2 text-sm text-slate-700 dark:text-slate-300">{log.to_email}</td>
                    <td className="px-3 py-2 text-sm text-slate-700 dark:text-slate-300 max-w-48 truncate">{log.subject}</td>
                    <td className="px-3 py-2">
                      <span className={`badge ${log.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm text-slate-500">{log.sent_by || '-'}</td>
                    <td className="px-3 py-2 text-sm text-slate-500">{new Date(log.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
                {logs.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-slate-400">No emails sent yet</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
