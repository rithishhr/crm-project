import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckSquare, Circle, CheckCircle2, Loader2, X, Plus, Trash2, Edit3, CheckCircle } from 'lucide-react'
import { tasksApi, usersApi } from '../lib/api'
import type { Task, Priority } from '../types'
import type { Toast } from '../components/ui/Toast'

interface Props {
  canEdit: boolean
  addToast: (t: Omit<Toast, 'id'>) => void
}

const priorityConfig: Record<Priority, { class: string; label: string }> = {
  low: { class: 'bg-slate-500/10 text-[var(--text-muted)] border-slate-500/20', label: 'Low' },
  medium: { class: 'bg-blue-500/10 text-blue-400 border-blue-500/20', label: 'Medium' },
  high: { class: 'bg-amber-500/10 text-amber-400 border-amber-500/20', label: 'High' },
  critical: { class: 'bg-red-500/10 text-red-400 border-red-500/20', label: 'Critical' },
}

const EMPTY_FORM = {
  title: '',
  assignedToId: '',
  dueDate: new Date().toISOString().split('T')[0],
  priority: 'medium' as Priority,
  relatedTo: '',
  status: 'todo' as 'todo' | 'in_progress' | 'done',
}

function TaskFormDrawer({ task, users, onSave, onClose }: {
  task?: Task; users: any[]; onSave: (data: any) => Promise<void>; onClose: () => void
}) {
  const [form, setForm] = useState(task ? {
    ...EMPTY_FORM,
    ...task,
    assignedToId: (task as any).assignedToId || '',
    dueDate: new Date(task.dueDate).toISOString().split('T')[0]
  } : { ...EMPTY_FORM })
  
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!form.title) {
      setError('Task title is required.')
      return
    }
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <motion.div 
        initial={{ x: 600 }} animate={{ x: 0 }}
        className="ml-auto w-full max-w-xl h-full overflow-y-auto shadow-2xl bg-[var(--bg-card)] border-l border-[var(--border)]"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between p-6 bg-[var(--bg-card)] border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-teal-500/10 text-teal-400">
              <CheckSquare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-[var(--text-primary)]">{task ? 'Edit Task' : 'New Task'}</h2>
              <p className="text-xs text-[var(--text-muted)]">Assign and schedule your work</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
              <X className="w-4 h-4" /> {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-[var(--text-muted)]">Task Title *</label>
              <input 
                className="input-field" placeholder="e.g. Call client for proposal follow-up" 
                value={form.title} onChange={e => setForm({...form, title: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-[var(--text-muted)]">Related To (Opportunity/Client)</label>
              <input 
                className="input-field" placeholder="e.g. Saudi Aramco Deal" 
                value={form.relatedTo} onChange={e => setForm({...form, relatedTo: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-[var(--text-muted)]">Due Date</label>
                <input 
                  type="date" className="input-field" 
                  value={form.dueDate} onChange={e => setForm({...form, dueDate: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-[var(--text-muted)]">Priority</label>
                <select 
                  className="input-field" 
                  value={form.priority} onChange={e => setForm({...form, priority: e.target.value as Priority})}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-[var(--text-muted)]">Assigned To</label>
              <select 
                className="input-field" 
                value={form.assignedToId} onChange={e => setForm({...form, assignedToId: e.target.value})}
              >
                <option value="">Unassigned (Me)</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button className="btn-primary flex-1 justify-center" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {saving ? 'Saving...' : (task ? 'Update Task' : 'Create Task')}
            </button>
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default function TasksPage({ addToast, canEdit }: Props) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isSelectionMode, setIsSelectionMode] = useState(false)

  const fetchData = async () => {
    try {
      const [tasksData, usersData] = await Promise.all([
        tasksApi.list(),
        usersApi.list()
      ])
      setTasks(tasksData)
      setUsers(usersData)
    } catch (err: any) {
      addToast({ message: 'Failed to load tasks', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const toggleDone = async (task: Task) => {
    const newStatus = task.status === 'done' ? 'todo' : 'done'
    try {
      await tasksApi.update(task.id, { status: newStatus })
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
      if (newStatus === 'done') addToast({ message: 'Task marked complete!', type: 'success' })
    } catch (err) {
      addToast({ message: 'Failed to update task', type: 'error' })
    }
  }

  const handleSave = async (data: any) => {
    try {
      if (editTask) {
        const updated = await tasksApi.update(editTask.id, data)
        setTasks(prev => prev.map(t => t.id === updated.id ? updated : t))
        addToast({ message: 'Task updated', type: 'success' })
      } else {
        const created = await tasksApi.create(data)
        setTasks(prev => [created, ...prev])
        addToast({ message: 'Task created', type: 'success' })
      }
    } catch (err: any) {
      throw err
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return
    try {
      await tasksApi.delete(id)
      setTasks(prev => prev.filter(t => t.id !== id))
      setSelectedIds(prev => prev.filter(i => i !== id))
      addToast({ message: 'Task deleted', type: 'info' })
    } catch (err) {
      addToast({ message: 'Failed to delete task', type: 'error' })
    }
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} tasks?`)) return
    try {
      await tasksApi.bulkDelete(selectedIds)
      setTasks(prev => prev.filter(t => !selectedIds.includes(t.id)))
      addToast({ message: `${selectedIds.length} tasks deleted`, type: 'info' })
      setSelectedIds([])
      setIsSelectionMode(false)
    } catch (err) {
      addToast({ message: 'Failed to delete selected items', type: 'error' })
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
        <p className="text-[var(--text-muted)] animate-pulse">Loading tasks...</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Tasks</h2>
          <p className="text-[var(--text-muted)] text-sm mt-0.5">
            {tasks.filter(t => t.status !== 'done').length} pending · {tasks.filter(t => t.status === 'done').length} completed
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tasks.length > 0 && (
            <button 
              className={`btn-secondary ${isSelectionMode ? 'bg-amber-500/10 text-amber-400' : ''}`} 
              onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedIds([]) }}
            >
              <CheckCircle className="w-4 h-4" /> {isSelectionMode ? 'Cancel Selection' : 'Bulk Action'}
            </button>
          )}
          <button className="btn-primary" onClick={() => { setEditTask(null); setShowForm(true) }}>
            <Plus className="w-4 h-4" />
            New Task
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {tasks.length === 0 ? (
          <div className="panel p-20 text-center">
            <CheckSquare className="w-12 h-12 mx-auto mb-4 opacity-10" />
            <p className="text-[var(--text-muted)]">No tasks scheduled.</p>
          </div>
        ) : (
          tasks.map((task, i) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className={`panel p-4 flex items-center gap-4 transition-all duration-200 relative ${task.status === 'done' ? 'opacity-50' : 'hover:border-[var(--border)]'} ${selectedIds.includes(task.id) ? 'border-teal-500 ring-1 ring-teal-500/50' : ''}`}
              onClick={() => isSelectionMode && toggleSelect(task.id)}
            >
              {isSelectionMode ? (
                <div className={`w-5 h-5 rounded border ${selectedIds.includes(task.id) ? 'bg-teal-500 border-teal-500' : 'bg-black/20 border-white/20'} flex items-center justify-center transition-all`}>
                  {selectedIds.includes(task.id) && <CheckCircle className="w-4 h-4 text-slate-900" />}
                </div>
              ) : (
                <button onClick={(e) => { e.stopPropagation(); toggleDone(task) }} className="text-[var(--text-muted)] hover:text-teal-400 transition-colors flex-shrink-0">
                  {task.status === 'done' ? <CheckCircle2 className="w-5 h-5 text-teal-400" /> : <Circle className="w-5 h-5" />}
                </button>
              )}

              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${task.status === 'done' ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>
                  {task.title}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{task.relatedTo}</p>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                <span className={`badge border ${priorityConfig[((task as any).priority || 'medium').toLowerCase() as Priority || 'medium']?.class || priorityConfig.medium.class}`}>
                  {priorityConfig[((task as any).priority || 'medium').toLowerCase() as Priority || 'medium']?.label || 'Medium'}
                </span>
                <p className="text-xs text-[var(--text-muted)] hidden sm:block">
                  {(task as any).assignedTo?.name || (task as any).assignedToId || 'Unassigned'}
                </p>
                <p className="text-xs text-[var(--text-placeholder)]">
                  {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No date'}
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => { setEditTask(task); setShowForm(true) }} className="p-1 rounded hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-white">
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(task.id)} className="p-1 rounded hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border border-[var(--border)] rounded-2xl shadow-2xl px-6 py-4 flex items-center gap-6"
          >
            <span className="text-sm font-medium text-white">{selectedIds.length} tasks selected</span>
            <div className="h-6 w-px bg-slate-700" />
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-2 text-sm font-semibold text-red-400 hover:text-red-300 transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Delete Selected
            </button>
            <button
              onClick={() => { setSelectedIds([]); setIsSelectionMode(false) }}
              className="text-sm font-medium text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {showForm && (
        <TaskFormDrawer 
          task={editTask || undefined} 
          users={users} 
          onSave={handleSave} 
          onClose={() => { setShowForm(false); setEditTask(null) }} 
        />
      )}
    </div>
  )
}
