import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Transaction, MonthlySummary } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { User } from 'firebase/auth';
import { 
  Download, 
  FileText, 
  TrendingUp, 
  TrendingDown, 
  Calculator,
  Calendar,
  ChevronRight
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface ReportsViewProps {
  user: User;
}

export default function ReportsView({ user }: ReportsViewProps) {
  const [monthlySummaries, setMonthlySummaries] = useState<MonthlySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const reportRef = useRef<HTMLDivElement>(null);

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
      const transactions = querySnapshot.docs.map(doc => doc.data() as Transaction);
      
      const summariesMap: Record<string, MonthlySummary> = {};
      
      transactions.forEach(t => {
        if (!summariesMap[t.month]) {
          summariesMap[t.month] = { month: t.month, received: 0, spent: 0, balance: 0 };
        }
        if (t.type === 'received') summariesMap[t.month].received += t.amount;
        else summariesMap[t.month].spent += t.amount;
        summariesMap[t.month].balance = summariesMap[t.month].received - summariesMap[t.month].spent;
      });

      setMonthlySummaries(Object.values(summariesMap).sort((a, b) => b.month.localeCompare(a.month)));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'transactions');
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = async () => {
    if (!reportRef.current) return;
    
    // Switch to light mode briefly if in dark mode for better PDF contrast
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark) document.documentElement.classList.remove('dark');

    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Financial_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
      console.error('PDF Export failed', error);
    } finally {
      if (isDark) document.documentElement.classList.add('dark');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Financial Reports</h1>
        <button
          onClick={exportPDF}
          disabled={loading || monthlySummaries.length === 0}
          className="bg-slate-900 border border-slate-700 dark:bg-white dark:text-slate-900 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          Export to PDF
        </button>
      </div>

      <div ref={reportRef} className="space-y-8 bg-transparent">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            [1,2,3].map(i => <div key={i} className="h-48 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse"></div>)
          ) : monthlySummaries.length > 0 ? (
            monthlySummaries.map((summary) => (
              <div key={summary.month} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-blue-600 mb-2">
                  <Calendar className="w-5 h-5" />
                  <span className="font-bold text-lg">{summary.month}</span>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-500">Total Received</span>
                    <span className="font-bold text-green-600">{formatCurrency(summary.received)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-500">Total Spent</span>
                    <span className="font-bold text-red-600">{formatCurrency(summary.spent)}</span>
                  </div>
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">Balance</span>
                    <span className={cn(
                      "font-extrabold text-lg",
                      summary.balance >= 0 ? "text-blue-600" : "text-red-700"
                    )}>
                      {formatCurrency(summary.balance)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-20 text-center">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-10" />
              <p className="text-slate-500">No data available for reports</p>
            </div>
          )}
        </div>

        {/* Global Stats Section in Report */}
        {!loading && monthlySummaries.length > 0 && (
          <div className="bg-blue-600 rounded-3xl p-8 text-white">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Calculator className="w-6 h-6" />
              Aggregate Summary
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              <div>
                <p className="text-blue-100 text-sm font-medium mb-1">Average Monthly Expense</p>
                <p className="text-3xl font-extrabold">
                  {formatCurrency(monthlySummaries.reduce((a, b) => a + b.spent, 0) / monthlySummaries.length)}
                </p>
              </div>
              <div>
                <p className="text-blue-100 text-sm font-medium mb-1">Most Active Month</p>
                <p className="text-3xl font-extrabold">
                  {monthlySummaries.sort((a, b) => (b.received + b.spent) - (a.received + a.spent))[0].month}
                </p>
              </div>
              <div>
                <p className="text-blue-100 text-sm font-medium mb-1">Total Savings Rate</p>
                <p className="text-3xl font-extrabold">
                  {Math.round((monthlySummaries.reduce((a, b) => a + b.balance, 0) / monthlySummaries.reduce((a, b) => a + b.received, 0)) * 100)}%
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
