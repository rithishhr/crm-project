import React, { useEffect, useState } from 'react';
import { Plus, X, Loader2, CheckCircle, Clock, AlertCircle, Trash2, Edit2 } from 'lucide-react';
import { tasksApi, usersApi } from '../api';
import { Task, User } from '../types';

const priorityColors = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-red-100 text-red-700',
};

const statusIcons = {
  pending: <Clock className="w-4 h-4 text-slate-400" />,
  in_progress: <AlertCircle className="w-4 h-4 text-blue-500" />,
  completed: <CheckCircle className="w-4 h-4 text-green-500" />,
};

interface TaskForm {
  title: string; description: string; due_date: string;
  priority: string; status: string; assigned_to: string;
}

const emptyForm: TaskForm = {
  title: '', description: '', due_date: '', priority: 'medium', status: 'pending', assigned_to: '',
};

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState<TaskForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTasks();
    usersApi.getAll().then(r => setUsers(r.data)).catch(() => {});
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const { data } = await tasksApi.getAll();
      setTasks(data);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (task?: Task) => {
    if (task) {
      setEditing(task);
      setForm({
        title: task.title, description: task.description || '',
        due_date: task.due_date ? task.due_date.split('T')[0] : '',
        priority: task.priority, status: task.status,
        assigned_to: String(task.assigned_to || ''),
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
      if (editing) await tasksApi.update(editing.id, form);
      else await tasksApi.create(form);
      await fetchTasks();
      closeModal();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const toggleStatus = async (task: Task) => {
    const next: Record<string, string> = { pending: 'in_progress', in_progress: 'completed', completed: 'pending' };
    const newStatus = next[task.status];
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus as Task['status'] } : t));
    await tasksApi.updateStatus(task.id, newStatus);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this task?')) return;
    await tasksApi.delete(id);
    setTasks(tasks.filter(t => t.id !== id));
  };

  const isOverdue = (t: Task) => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed';

  const filtered = tasks.filter(t => {
    if (filter === 'all') return true;
    if (filter === 'overdue') return isOverdue(t);
    return t.status === filter;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Tasks</h1>
          <p className="text-slate-500 text-sm">{tasks.filter(t => t.status !== 'completed').length} pending tasks</p>
        </div>
        <button onClick={() => openModal()} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Task
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'all', label: 'All', count: tasks.length },
          { key: 'pending', label: 'Pending', count: tasks.filter(t => t.status === 'pending').length },
          { key: 'in_progress', label: 'In Progress', count: tasks.filter(t => t.status === 'in_progress').length },
          { key: 'completed', label: 'Completed', count: tasks.filter(t => t.status === 'completed').length },
          { key: 'overdue', label: 'Overdue', count: tasks.filter(t => isOverdue(t)).length },
        ].map(({ key, label, count }) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === key ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100'}`}>
            {label} {count > 0 && <span className="ml-1 bg-white/20 px-1.5 rounded-full text-xs">{count}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
      ) : (
        <div className="space-y-2">
          {filtered.map(task => (
            <div key={task.id} className={`card p-4 flex items-start gap-4 transition-all ${task.status === 'completed' ? 'opacity-60' : ''} ${isOverdue(task) ? 'border-l-4 border-red-500' : ''}`}>
              <button onClick={() => toggleStatus(task)} className="mt-0.5 flex-shrink-0">
                {statusIcons[task.status]}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className={`font-medium text-sm ${task.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                      {task.title}
                    </p>
                    {task.description && <p className="text-xs text-slate-500 mt-0.5">{task.description}</p>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openModal(task)} className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(task.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={`badge ${priorityColors[task.priority]}`}>{task.priority}</span>
                  {task.due_date && (
                    <span className={`text-xs ${isOverdue(task) ? 'text-red-600 font-medium' : 'text-slate-400'}`}>
                      📅 {isOverdue(task) ? 'OVERDUE: ' : ''}{new Date(task.due_date).toLocaleDateString()}
                    </span>
                  )}
                  {task.assigned_name && <span className="text-xs text-slate-400">👤 {task.assigned_name}</span>}
                  {task.related_to_type && <span className="text-xs text-blue-500 capitalize">🔗 {task.related_to_type}</span>}
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-slate-400">No tasks found</div>
          )}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-bold dark:text-white">{editing ? 'Edit Task' : 'New Task'}</h2>
              <button onClick={closeModal}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title *</label>
                <input type="text" value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} required
                  className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} rows={2}
                  className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Due Date</label>
                  <input type="datetime-local" value={form.due_date} onChange={e => setForm(f => ({...f, due_date: e.target.value}))}
                    className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Priority</label>
                  <select value={form.priority} onChange={e => setForm(f => ({...f, priority: e.target.value}))}
                    className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))}
                    className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white">
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
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
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editing ? 'Save Changes' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
