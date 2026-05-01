import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Transaction, MonthlySummary } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { 
  TrendingUp, 
  TrendingDown, 
  CreditCard, 
  Plus, 
  ArrowRight,
  PieChart as PieChartIcon
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  LineChart,
  Line
} from 'recharts';
import { User } from 'firebase/auth';

interface DashboardProps {
  user: User;
  onNavigate: (view: any) => void;
}

export default function Dashboard({ user, onNavigate }: DashboardProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState({
    totalReceived: 0,
    totalSpent: 0,
    balance: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const q = query(
        collection(db, 'transactions'),
        where('userId', '==', user.uid),
        orderBy('date', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      setTransactions(data);

      const totals = data.reduce((acc, t) => {
        if (t.type === 'received') acc.totalReceived += t.amount;
        else acc.totalSpent += t.amount;
        return acc;
      }, { totalReceived: 0, totalSpent: 0 });

      setSummary({
        totalReceived: totals.totalReceived,
        totalSpent: totals.totalSpent,
        balance: totals.totalReceived - totals.totalSpent
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    } finally {
      setLoading(false);
    }
  };

  const getMonthlyData = () => {
    const months: Record<string, { received: number, spent: number }> = {};
    
    // Last 6 months
    transactions.slice(0, 100).forEach(t => {
      if (!months[t.month]) {
        months[t.month] = { received: 0, spent: 0 };
      }
      if (t.type === 'received') months[t.month].received += t.amount;
      else months[t.month].spent += t.amount;
    });

    return Object.entries(months)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(-6);
  };

  const recentTransactions = transactions.slice(0, 5);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>)}
        </div>
        <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Financial Dashboard</h1>
          <p className="text-slate-500 dark:text-slate-400">Welcome back, tracking your family's spendings.</p>
        </div>
        <button
          onClick={() => onNavigate('add')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-200 dark:shadow-none"
        >
          <Plus className="w-5 h-5" />
          Add Entry
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium text-green-600 bg-green-50 dark:bg-green-900/10 px-2 py-1 rounded-full">+ Total Received</span>
          </div>
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Money Received</h3>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{formatCurrency(summary.totalReceived)}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-lg flex items-center justify-center">
              <TrendingDown className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium text-red-600 bg-red-50 dark:bg-red-900/10 px-2 py-1 rounded-full">- Total Spent</span>
          </div>
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Money Spent</h3>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{formatCurrency(summary.totalSpent)}</p>
        </div>

        <div className="bg-blue-600 p-6 rounded-2xl shadow-xl shadow-blue-200 dark:shadow-none text-white transition-transform hover:scale-[1.02]">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <CreditCard className="w-6 h-6" />
            </div>
          </div>
          <h3 className="text-sm font-medium opacity-80">Remaining Balance</h3>
          <p className="text-3xl font-bold mt-1">{formatCurrency(summary.balance)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Chart */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-lg font-bold">Monthly Comparison</h2>
            <div className="flex items-center gap-4 text-xs font-medium">
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                <span>Income</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                <span>Expenses</span>
              </div>
            </div>
          </div>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={getMonthlyData()}>
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    backgroundColor: '#fff',
                    padding: '12px'
                  }}
                />
                <Bar dataKey="received" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="spent" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold">Recent Transactions</h2>
            <button 
              onClick={() => onNavigate('history')}
              className="text-blue-600 hover:text-blue-700 text-sm font-semibold flex items-center gap-1"
            >
              See all <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-4">
            {recentTransactions.length > 0 ? (
              recentTransactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center",
                      t.type === 'received' ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                    )}>
                      {t.type === 'received' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold">{t.description}</h4>
                      <p className="text-xs text-slate-500">{t.date}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      "text-sm font-bold",
                      t.type === 'received' ? "text-green-600" : "text-red-600"
                    )}>
                      {formatCurrency(t.type === 'received' ? t.amount : -t.amount, true)}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">{t.paid_to || 'N/A'}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 text-slate-500">
                <PieChartIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No transactions yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
