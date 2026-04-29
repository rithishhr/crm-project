import React, { useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2, X, Loader2, Globe, Phone, Mail } from 'lucide-react';
import { clientsApi, usersApi } from '../api';
import { Client, User } from '../types';

const INDUSTRIES = ['Technology', 'Healthcare', 'Finance', 'Construction', 'Energy', 'Retail', 'Manufacturing', 'Education', 'Other'];

interface ClientForm {
  name: string; email: string; phone: string; company: string;
  industry: string; website: string; address: string;
  assigned_to: string; notes: string; total_value: string;
}

const emptyForm: ClientForm = {
  name: '', email: '', phone: '', company: '', industry: '',
  website: '', address: '', assigned_to: '', notes: '', total_value: '0',
};

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchClients();
    usersApi.getAll().then(r => setUsers(r.data)).catch(() => {});
  }, []);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const { data } = await clientsApi.getAll();
      setClients(data);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (client?: Client) => {
    if (client) {
      setEditing(client);
      setForm({
        name: client.name, email: client.email || '', phone: client.phone || '',
        company: client.company || '', industry: client.industry || '',
        website: client.website || '', address: client.address || '',
        assigned_to: String(client.assigned_to || ''), notes: client.notes || '',
        total_value: String(client.total_value || 0),
      });
    } else {
      setEditing(null);
      setForm(emptyForm);
    }
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setEditing(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, total_value: parseFloat(form.total_value) || 0 };
      if (editing) {
        await clientsApi.update(editing.id, payload);
      } else {
        await clientsApi.create(payload);
      }
      await fetchClients();
      closeModal();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this client?')) return;
    await clientsApi.delete(id);
    setClients(clients.filter(c => c.id !== id));
  };

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.company || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Clients</h1>
          <p className="text-slate-500 text-sm">{clients.length} clients · Total value: ${clients.reduce((s, c) => s + c.total_value, 0).toLocaleString()}</p>
        </div>
        <button onClick={() => openModal()} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Client
        </button>
      </div>

      <div className="card p-4 flex items-center gap-2">
        <Search className="w-4 h-4 text-slate-400" />
        <input type="text" placeholder="Search clients..." value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-transparent border-none outline-none text-sm dark:text-slate-200 placeholder-slate-400" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(client => (
            <div key={client.id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-700 font-bold text-sm">
                    {client.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white text-sm">{client.name}</h3>
                    <p className="text-xs text-slate-500">{client.company}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openModal(client)} className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(client.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 mb-3">
                {client.email && <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><Mail className="w-3 h-3 text-slate-400" />{client.email}</div>}
                {client.phone && <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><Phone className="w-3 h-3 text-slate-400" />{client.phone}</div>}
                {client.website && <div className="flex items-center gap-2 text-xs text-blue-600"><Globe className="w-3 h-3" /><a href={client.website} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">{client.website}</a></div>}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
                {client.industry && <span className="badge bg-indigo-50 text-indigo-700">{client.industry}</span>}
                <span className="text-sm font-bold text-green-600">${client.total_value.toLocaleString()}</span>
              </div>
              {client.assigned_name && <p className="text-xs text-slate-400 mt-2">Assigned: {client.assigned_name}</p>}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-3 text-center py-12 text-slate-400">No clients found</div>
          )}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{editing ? 'Edit Client' : 'Add New Client'}</h2>
              <button onClick={closeModal}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Name *', key: 'name', type: 'text', required: true },
                  { label: 'Email', key: 'email', type: 'email', required: false },
                  { label: 'Phone', key: 'phone', type: 'text', required: false },
                  { label: 'Company', key: 'company', type: 'text', required: false },
                  { label: 'Website', key: 'website', type: 'text', required: false },
                  { label: 'Address', key: 'address', type: 'text', required: false },
                  { label: 'Total Value ($)', key: 'total_value', type: 'number', required: false },
                ].map(({ label, key, type, required }) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{label}</label>
                    <input type={type} value={form[key as keyof ClientForm]} onChange={e => setForm(f => ({...f, [key]: e.target.value}))} required={required}
                      className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white" />
                  </div>
                ))}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Industry</label>
                  <select value={form.industry} onChange={e => setForm(f => ({...f, industry: e.target.value}))}
                    className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white">
                    <option value="">Select industry</option>
                    {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Assigned To</label>
                  <select value={form.assigned_to} onChange={e => setForm(f => ({...f, assigned_to: e.target.value}))}
                    className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white">
                    <option value="">Select user</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} rows={3}
                  className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editing ? 'Save Changes' : 'Create Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
