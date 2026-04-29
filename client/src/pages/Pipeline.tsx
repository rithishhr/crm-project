import React, { useEffect, useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, useDraggable, useDroppable } from '@dnd-kit/core';
import { Plus, X, Loader2, Edit2, Trash2 } from 'lucide-react';
import { dealsApi, clientsApi } from '../api';
import { Deal, Client } from '../types';

const STAGES = [
  { id: 'prospecting', label: 'Prospecting', color: 'border-slate-300' },
  { id: 'qualification', label: 'Qualification', color: 'border-blue-400' },
  { id: 'proposal', label: 'Proposal', color: 'border-yellow-400' },
  { id: 'negotiation', label: 'Negotiation', color: 'border-orange-400' },
  { id: 'closed_won', label: 'Closed Won', color: 'border-green-500' },
  { id: 'closed_lost', label: 'Closed Lost', color: 'border-red-400' },
];

const stageBg: Record<string, string> = {
  prospecting: 'bg-slate-50 dark:bg-slate-800',
  qualification: 'bg-blue-50 dark:bg-blue-950/30',
  proposal: 'bg-yellow-50 dark:bg-yellow-950/30',
  negotiation: 'bg-orange-50 dark:bg-orange-950/30',
  closed_won: 'bg-green-50 dark:bg-green-950/30',
  closed_lost: 'bg-red-50 dark:bg-red-950/30',
};

function DealCard({ deal, onEdit, onDelete }: { deal: Deal; onEdit: (d: Deal) => void; onDelete: (id: number) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: deal.id });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes}
      className={`bg-white dark:bg-slate-700 rounded-lg p-3 shadow-sm border border-slate-200 dark:border-slate-600 cursor-grab active:cursor-grabbing transition-all ${isDragging ? 'opacity-50 scale-95' : 'hover:shadow-md'}`}>
      <div className="flex items-start justify-between gap-1">
        <p className="font-medium text-slate-900 dark:text-white text-sm leading-tight">{deal.title}</p>
        <div className="flex gap-1 flex-shrink-0" onPointerDown={e => e.stopPropagation()}>
          <button onClick={() => onEdit(deal)} className="p-1 text-slate-400 hover:text-blue-600 rounded"><Edit2 className="w-3 h-3" /></button>
          <button onClick={() => onDelete(deal.id)} className="p-1 text-slate-400 hover:text-red-600 rounded"><Trash2 className="w-3 h-3" /></button>
        </div>
      </div>
      {deal.client_name && <p className="text-xs text-slate-500 mt-1">{deal.client_name}</p>}
      <div className="flex items-center justify-between mt-2">
        <span className="text-sm font-bold text-green-600">${deal.value.toLocaleString()}</span>
        <span className="text-xs text-slate-400">{deal.probability}%</span>
      </div>
      {deal.expected_close && <p className="text-xs text-slate-400 mt-1">Close: {new Date(deal.expected_close).toLocaleDateString()}</p>}
    </div>
  );
}

function StageColumn({ stage, deals, onEdit, onDelete }: {
  stage: typeof STAGES[0]; deals: Deal[];
  onEdit: (d: Deal) => void; onDelete: (id: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const total = deals.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex-shrink-0 w-72">
      <div className={`rounded-xl border-t-4 ${stage.color} ${stageBg[stage.id]} p-3 h-full min-h-96 ${isOver ? 'ring-2 ring-blue-400' : ''}`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm">{stage.label}</h3>
            <p className="text-xs text-slate-500">{deals.length} deals · ${total.toLocaleString()}</p>
          </div>
        </div>
        <div ref={setNodeRef} className="space-y-2 min-h-32">
          {deals.map(deal => (
            <DealCard key={deal.id} deal={deal} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      </div>
    </div>
  );
}

interface DealForm {
  title: string; client_id: string; value: string; stage: string;
  probability: string; expected_close: string; notes: string;
}

const emptyDealForm: DealForm = {
  title: '', client_id: '', value: '0', stage: 'prospecting',
  probability: '10', expected_close: '', notes: '',
};

export default function Pipeline() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Deal | null>(null);
  const [form, setForm] = useState<DealForm>(emptyDealForm);
  const [saving, setSaving] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);

  useEffect(() => {
    fetchDeals();
    clientsApi.getAll().then(r => setClients(r.data)).catch(() => {});
  }, []);

  const fetchDeals = async () => {
    setLoading(true);
    try {
      const { data } = await dealsApi.getAll();
      setDeals(data);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (deal?: Deal) => {
    if (deal) {
      setEditing(deal);
      setForm({
        title: deal.title, client_id: String(deal.client_id || ''), value: String(deal.value),
        stage: deal.stage, probability: String(deal.probability),
        expected_close: deal.expected_close ? deal.expected_close.split('T')[0] : '',
        notes: deal.notes || '',
      });
    } else {
      setEditing(null);
      setForm(emptyDealForm);
    }
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setEditing(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, value: parseFloat(form.value) || 0, probability: parseInt(form.probability) || 0,
        client_id: form.client_id ? parseInt(form.client_id) : null };
      if (editing) await dealsApi.update(editing.id, payload);
      else await dealsApi.create(payload);
      await fetchDeals();
      closeModal();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this deal?')) return;
    await dealsApi.delete(id);
    setDeals(deals.filter(d => d.id !== id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const dealId = Number(active.id);
    const newStage = String(over.id);
    const validStages = STAGES.map(s => s.id);
    if (!validStages.includes(newStage)) return;

    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage: newStage as Deal['stage'] } : d));
    try {
      await dealsApi.updateStage(dealId, newStage);
    } catch {
      await fetchDeals();
    }
  };

  const dealsByStage = (stageId: string) => deals.filter(d => d.stage === stageId);
  const activeDeal = activeId ? deals.find(d => d.id === activeId) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Sales Pipeline</h1>
          <p className="text-slate-500 text-sm">{deals.length} deals · ${deals.reduce((s, d) => s + d.value, 0).toLocaleString()} total</p>
        </div>
        <button onClick={() => openModal()} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Deal
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
      ) : (
        <DndContext onDragStart={e => setActiveId(Number(e.active.id))} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {STAGES.map(stage => (
              <StageColumn key={stage.id} stage={stage} deals={dealsByStage(stage.id)} onEdit={openModal} onDelete={handleDelete} />
            ))}
          </div>
          <DragOverlay>
            {activeDeal ? (
              <div className="bg-white rounded-lg p-3 shadow-2xl border border-blue-400 w-72 opacity-95">
                <p className="font-medium text-slate-900 text-sm">{activeDeal.title}</p>
                <p className="text-sm font-bold text-green-600 mt-1">${activeDeal.value.toLocaleString()}</p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{editing ? 'Edit Deal' : 'New Deal'}</h2>
              <button onClick={closeModal}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title *</label>
                <input type="text" value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} required
                  className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Client</label>
                  <select value={form.client_id} onChange={e => setForm(f => ({...f, client_id: e.target.value}))}
                    className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white">
                    <option value="">No client</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Value ($)</label>
                  <input type="number" value={form.value} onChange={e => setForm(f => ({...f, value: e.target.value}))}
                    className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Stage</label>
                  <select value={form.stage} onChange={e => setForm(f => ({...f, stage: e.target.value}))}
                    className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white">
                    {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Probability (%)</label>
                  <input type="number" min="0" max="100" value={form.probability} onChange={e => setForm(f => ({...f, probability: e.target.value}))}
                    className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Expected Close Date</label>
                  <input type="date" value={form.expected_close} onChange={e => setForm(f => ({...f, expected_close: e.target.value}))}
                    className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white" />
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
                  {editing ? 'Save Changes' : 'Create Deal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
