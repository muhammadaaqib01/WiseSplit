import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Transaction } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { User } from 'firebase/auth';
import { 
  Search, 
  Filter, 
  Trash2, 
  Edit2, 
  Calendar,
  X,
  Check,
  ChevronDown
} from 'lucide-react';
import { format } from 'date-fns';

interface HistoryViewProps {
  user: User;
}

export default function HistoryView({ user }: HistoryViewProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Transaction>>({});

  useEffect(() => {
    fetchTransactions();
  }, [user]);

  const fetchTransactions = async () => {
    try {
      const q = query(
        collection(db, 'transactions'),
        where('userId', '==', user.uid),
        orderBy('date', 'desc')
      );
      const querySnapshot = await getDocs(q);
      setTransactions(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) return;
    try {
      await deleteDoc(doc(db, 'transactions', id));
      setTransactions(transactions.filter(t => t.id !== id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `transactions/${id}`);
    }
  };

  const handleEditStart = (transaction: Transaction) => {
    setEditingId(transaction.id || null);
    setEditForm({ ...transaction });
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editForm) return;
    try {
      const { id, ...updateData } = editForm;
      if (editForm.date) {
        updateData.month = format(new Date(editForm.date), 'yyyy-MM');
      }
      await updateDoc(doc(db, 'transactions', editingId), {
        ...updateData,
        updatedAt: serverTimestamp()
      });
      setTransactions(transactions.map(t => t.id === editingId ? { ...t, ...updateData } : t));
      setEditingId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `transactions/${editingId}`);
    }
  };

  const filteredTransactions = transactions.filter(t => {
    const searchMatch = t.description.toLowerCase().includes(search.toLowerCase());
    const monthMatch = monthFilter ? t.month === monthFilter : true;
    return searchMatch && monthMatch;
  });

  const availableMonths = Array.from(new Set(transactions.map(t => t.month))).sort().reverse();

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Transaction History</h1>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-blue-500 w-full"
            />
          </div>
          
          <div className="relative group">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="pl-10 pr-8 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-blue-500 appearance-none w-full"
            >
              <option value="">All Time</option>
              {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Date</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Description</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Type</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Amount</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                [1,2,3,4,5].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-6 py-8"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded"></div></td>
                  </tr>
                ))
              ) : filteredTransactions.length > 0 ? (
                filteredTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    {editingId === t.id ? (
                      <>
                        <td className="px-6 py-4">
                          <input 
                            type="date" 
                            className="bg-transparent border border-blue-500 rounded p-1 text-sm outline-none"
                            value={editForm.date}
                            onChange={(e) => setEditForm({...editForm, date: e.target.value})}
                          />
                        </td>
                        <td className="px-6 py-4">
                          <input 
                            type="text" 
                            className="bg-transparent border border-blue-500 rounded p-1 text-sm w-full outline-none"
                            value={editForm.description}
                            onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                          />
                        </td>
                        <td className="px-6 py-4">
                          <select 
                            className="bg-transparent border border-blue-500 rounded p-1 text-sm outline-none"
                            value={editForm.type}
                            onChange={(e) => setEditForm({...editForm, type: e.target.value as any})}
                          >
                            <option value="received">Received</option>
                            <option value="spent">Spent</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <input 
                            type="number" 
                            className="bg-transparent border border-blue-500 rounded p-1 text-sm w-24 text-right outline-none"
                            value={editForm.amount}
                            onChange={(e) => setEditForm({...editForm, amount: parseFloat(e.target.value)})}
                          />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={handleSaveEdit} className="p-2 hover:bg-green-100 text-green-600 rounded-lg"><Check className="w-4 h-4" /></button>
                            <button onClick={() => setEditingId(null)} className="p-2 hover:bg-slate-100 text-slate-400 rounded-lg"><X className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4 text-sm whitespace-nowrap">{t.date}</td>
                        <td className="px-6 py-4">
                          <div className="font-medium">{t.description}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2 py-1 text-[10px] font-bold uppercase rounded-md tracking-wider shadow-sm",
                            t.type === 'received' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                          )}>
                            {t.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={cn(
                            "font-bold",
                            t.type === 'received' ? "text-green-600" : "text-red-600"
                          )}>
                            {formatCurrency(t.type === 'received' ? t.amount : -t.amount, true)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => handleEditStart(t)} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => handleDelete(t.id!)} className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-slate-500">
                    <Search className="w-12 h-12 mx-auto mb-4 opacity-10" />
                    <p className="font-medium">No transactions found</p>
                    <p className="text-sm opacity-60">Try adjusting your filters or search terms</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
